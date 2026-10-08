"""DPE (ADEME) : téléchargement, rattachement aux bâtiments, rapprochement avec les ventes DVF et agrégats.

Aucun DPE individuel n'est publié : la page ne reçoit que des effectifs et des médianes par groupe
d'au moins `MIN_GROUPE` logements ou ventes.
"""

import json
import re
import unicodedata
import urllib.parse
import urllib.request
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pandas as pd

from .config import (
    BATIMENTS,
    COMMUNE,
    DPE_APRES_VENTE_JOURS,
    DPE_AVANT_VENTE_JOURS,
    DPE_CHAMPS,
    DPE_URL,
    ETIQUETTES,
    GROUPES_ETIQUETTES,
    MIN_GROUPE,
    USER_AGENT,
)
from .lots import MEME_PLAN, NIVEAUX, lookup


def normaliser(texte: object) -> str:
    """Minuscules, sans accents ni ponctuation : « Allée de l'Oseraie » -> « allee de l oseraie »."""
    if not isinstance(texte, str):
        return ""
    s = unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def numero(texte: object) -> str | None:
    """Numéro de voie sans complément : « 58 bis » -> « 58 »."""
    m = re.match(r"\s*(\d+)", str(texte)) if texte is not None else None
    return m.group(1) if m else None


# --- téléchargement -----------------------------------------------------------------------------------------------


def telecharger(destination: Path, ouvrir: Callable[..., Any] = urllib.request.urlopen, taille: int = 1000) -> int:
    """Télécharge les DPE de la commune dans un CSV ; suit les pages de l'API (lien « next »)."""
    params = {"code_insee_ban_eq": COMMUNE, "select": ",".join(DPE_CHAMPS), "size": taille}
    url: str | None = f"{DPE_URL}?{urllib.parse.urlencode(params)}"
    lignes: list[dict[str, Any]] = []
    for _ in range(200):  # garde-fou
        if not url:
            break
        requete = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with ouvrir(requete, timeout=120) as reponse:
            page = json.load(reponse)
        lignes += page.get("results", [])
        url = page.get("next")
    if not lignes:
        raise RuntimeError("Aucun DPE reçu de l'ADEME")
    destination.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(lignes).reindex(columns=list(DPE_CHAMPS)).to_csv(destination, index=False)
    return len(lignes)


# --- texte libre du complément d'adresse --------------------------------------------------------------------------

COULEURS = (
    ("rouge", "Galerie rouge"),
    ("jaune", "Galerie jaune"),
    ("bleu", "Galerie bleue"),
    ("vert", "Galerie verte"),
)


def niveau_de(complement: object) -> str | None:
    """Niveau (RdC ou galerie) d'après le texte libre : « Etage Rouge », « galerie bleue », « Etage 3 », « RDC »."""
    s = normaliser(complement)
    for mot, niveau in COULEURS:
        if re.search(rf"\b{mot}", s):
            return niveau
    if re.search(r"\b(rdc|rez)\b", s):
        return "RdC"
    m = re.search(r"\betage (\d+)", s) or re.search(r"\b(\d+) ?(?:er|eme|e)\b", s)
    return NIVEAUX[int(m.group(1))] if m and int(m.group(1)) < len(NIVEAUX) else None


def lots_de(complement: object) -> frozenset[int]:
    """Numéros de lots cités (« N°Lot : 145 / 167 »)."""
    s = normaliser(complement)
    i = s.find("lot")
    return frozenset(int(n) for n in re.findall(r"\d+", s[i:])) if i >= 0 else frozenset()


# --- chargement ---------------------------------------------------------------------------------------------------


def batiment_de(nom_rue: object, entree: str | None) -> str | None:
    rue = normaliser(nom_rue)
    for b in BATIMENTS:
        if b.dpe_voie and b.dpe_voie in rue and (not b.dpe_numeros or entree in b.dpe_numeros):
            return b.code
    return None


def charger(chemin: Path) -> pd.DataFrame:
    """DPE du domaine : une ligne par DPE, avec bâtiment, entrée, étage, surface, étiquette et date."""
    d = pd.read_csv(chemin, dtype=str)
    out = pd.DataFrame(
        {
            "entree": d.numero_voie_ban.map(numero),
            "niveau": d.complement_adresse_logement.map(niveau_de),
            "lots": d.complement_adresse_logement.map(lots_de),
            "surface": pd.to_numeric(d.surface_habitable_logement, errors="coerce"),
            "etiquette": d.etiquette_dpe.str.strip().str.upper(),
            "date": pd.to_datetime(d.date_etablissement_dpe, errors="coerce"),
        }
    )
    if "type_batiment" in d:  # on écarte les DPE d'immeuble entier
        out = out[d.type_batiment.fillna("appartement").str.lower().str.contains("appartement")]
        d = d.loc[out.index]
    out["bat"] = [batiment_de(r, e) for r, e in zip(d.nom_rue_ban, out.entree, strict=True)]
    out = out[out.bat.notna() & out.etiquette.isin(ETIQUETTES) & out.surface.notna() & out.date.notna()]
    out = out.assign(cle=list(zip(out.bat, out.entree, out.niveau.fillna(""), out.surface.round(), strict=True)))
    return out.reset_index(drop=True)


def logements(dpe: pd.DataFrame) -> pd.DataFrame:
    """Un DPE par logement (le plus récent) ; le logement est identifié par bâtiment, entrée, niveau et surface."""
    return dpe.sort_values("date").drop_duplicates("cle", keep="last").reset_index(drop=True)


# --- rapprochement avec les ventes --------------------------------------------------------------------------------


def _lots_vente(v: Any) -> set[int]:
    lots = set()
    for k in range(1, 6):
        try:
            lots.add(int(float(getattr(v, f"lot{k}_numero", None))))
        except (TypeError, ValueError):
            continue
    return lots


def rapprocher(ventes: pd.DataFrame, dpe: pd.DataFrame) -> pd.DataFrame:
    """Associe à chaque vente l'étiquette du DPE correspondant, quand elle est sans ambiguïté.

    `ventes` : colonnes bat, adresse_numero, date_mutation, surface_reelle_bati, lot1_numero… (DVF).
    1. Par les lots : si un DPE cite un numéro de lot (« N°Lot : 145 / 167 ») que la vente porte aussi, c'est le même
       logement ; on retient le DPE le plus récent établi avant la vente.
    2. Sinon : même bâtiment et même entrée, DPE établi de 2 ans avant à 1 mois après la vente, surface habitable à
       moins de max(3 m², 8 %) de celle de la vente, et même niveau (RdC, galerie) quand les deux sont connus (bât. A, C).
       Si plusieurs logements restent mais donnent la même étiquette, la vente est appariée ; sinon « ambigu ».
    """
    resultats = []
    for v in ventes.itertuples():
        date = pd.Timestamp(v.date_mutation)
        c = dpe[dpe.bat == v.bat]
        lots_v = _lots_vente(v)
        par_lot = c[
            c.lots.map(lambda s, lots=lots_v: bool(s & lots))
            & (c.date <= date + pd.Timedelta(days=DPE_APRES_VENTE_JOURS))
        ]
        if len(par_lot):
            dernier = par_lot.sort_values("date").iloc[[-1]]
            resultats.append((v.Index, dernier.etiquette.iloc[0], "apparie", 1, dernier, "lot"))
            continue
        entree = numero(v.adresse_numero) if not str(v.adresse_numero).startswith("900") else None
        if entree:
            c = c[c.entree == entree]
        tolerance = max(3.0, 0.08 * v.surface_reelle_bati)
        c = c[
            (c.date >= date - pd.Timedelta(days=DPE_AVANT_VENTE_JOURS))
            & (c.date <= date + pd.Timedelta(days=DPE_APRES_VENTE_JOURS))
            & ((c.surface - v.surface_reelle_bati).abs() <= tolerance)
        ]
        lot_connu = lookup(list(lots_v), v.bat) if v.bat in MEME_PLAN else None
        if lot_connu:
            c = c[c.niveau.isna() | (c.niveau == lot_connu[0])]
        c = logements(c) if len(c) else c
        etiquettes = sorted(set(c.etiquette))
        if not len(c):
            statut, etiquette = "aucun", None
        elif len(etiquettes) == 1:
            statut, etiquette = "apparie", etiquettes[0]
        else:
            statut, etiquette = "ambigu", None
        resultats.append((v.Index, etiquette, statut, len(c), c, "surface" if statut == "apparie" else ""))
    return pd.DataFrame(
        {
            "etiquette": [r[1] for r in resultats],
            "statut": [r[2] for r in resultats],
            "candidats": [r[3] for r in resultats],
            "detail": [r[4] for r in resultats],
            "methode": [r[5] for r in resultats],
        },
        index=[r[0] for r in resultats],
    )


# --- agrégats publiés ---------------------------------------------------------------------------------------------


def _stats(prix: pd.Series) -> dict[str, Any]:
    n = len(prix)
    if n < MIN_GROUPE:
        return {"n": n}
    return {"n": n, "med": int(prix.median()), "q1": int(prix.quantile(0.25)), "q3": int(prix.quantile(0.75))}


def agreger(dpe: pd.DataFrame, ventes: pd.DataFrame, appariement: pd.DataFrame) -> dict[str, Any]:
    """Effectifs d'étiquettes par bâtiment et prix au m² par classe. `ventes` : colonnes bat, pm2, aty."""
    parc = logements(dpe)
    repartition: dict[str, dict[str, int]] = {}
    trop_peu: list[str] = []
    for code, sous in [("TOUS", parc), *((b.code, parc[parc.bat == b.code]) for b in BATIMENTS)]:
        if sous.empty:
            continue
        if len(sous) < MIN_GROUPE:
            trop_peu.append(code)
            continue
        comptes = sous.etiquette.value_counts()
        repartition[code] = {"n": len(sous), **{e: int(comptes.get(e, 0)) for e in ETIQUETTES}}

    v = ventes.join(appariement[["etiquette"]]).query("aty == 0")
    v = v[v.etiquette.notna()]

    def par_groupe(x: pd.DataFrame) -> dict[str, dict[str, Any]]:
        return {nom: _stats(x[x.etiquette.isin(liste)].pm2) for nom, liste in GROUPES_ETIQUETTES}

    prix = {"TOUS": par_groupe(v)}
    for b in BATIMENTS:
        sous = v[v.bat == b.code]
        if len(sous) >= MIN_GROUPE:
            prix[b.code] = par_groupe(sous)

    return {
        "maj": dpe.date.max().strftime("%d/%m/%Y"),
        "n_logements": len(parc),
        "repartition": repartition,
        "trop_peu": trop_peu,
        "prix": prix,
        "rapprochement": {
            "ventes": len(appariement),
            **{k: int((appariement.statut == k).sum()) for k in ("apparie", "ambigu", "aucun")},
            "par_lot": int((appariement.methode == "lot").sum()),
        },
    }
