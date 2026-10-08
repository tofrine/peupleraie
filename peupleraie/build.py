"""Du CSV DVF brut aux données de la page (data.json)."""

import math
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import pandas as pd

from .config import (
    ATYPIQUE_BAS,
    ATYPIQUE_HAUT,
    BATIMENTS,
    COMMUNE,
    NATURES,
    PRIX_M2_BORNES,
    SURFACE_MIN,
    Batiment,
)
from .lots import lookup

NUMERIQUES = ["valeur_fonciere", "surface_reelle_bati", "nombre_pieces_principales", "longitude", "latitude"]


def charger(chemins: Iterable[Path]) -> pd.DataFrame:
    """Concatène les CSV DVF (communaux ou départementaux), retire les en-têtes répétés et les doublons."""
    d = pd.concat([pd.read_csv(c, dtype=str) for c in chemins], ignore_index=True)
    d = d[(d.date_mutation != "date_mutation") & (d.code_commune == COMMUNE)]
    d = d[d.nature_mutation.isin(NATURES)].copy()
    for col in NUMERIQUES:
        d[col] = pd.to_numeric(d[col], errors="coerce")
    return d.drop_duplicates(
        ["id_mutation", "id_parcelle", "type_local", "surface_reelle_bati", "lot1_numero", "lot2_numero"]
    )


def ventes_de(d: pd.DataFrame, type_local: str) -> pd.DataFrame:
    """Ventes portant sur un seul local du type donné (dépendances admises), avec le prix au m²."""
    ct = pd.crosstab(d.id_mutation, d.type_local.fillna("Sans local"))
    ok = {
        m
        for m, row in ct.iterrows()
        if row.get(type_local, 0) == 1
        and not {k for k, v in row.items() if v and k != "Sans local"} - {type_local, "Dépendance"}
    }
    deps = ct["Dépendance"] if "Dépendance" in ct else pd.Series(0, index=ct.index)
    x = d[(d.type_local == type_local) & d.id_mutation.isin(ok)].copy()
    x["dep"] = x.id_mutation.map(deps).fillna(0).astype(int)
    x = x[(x.surface_reelle_bati >= SURFACE_MIN) & x.valeur_fonciere.notna()]
    x["pm2"] = x.valeur_fonciere / x.surface_reelle_bati
    x = x[x.pm2.between(*PRIX_M2_BORNES)]
    x["annee"] = x.date_mutation.str[:4].astype(int)
    return x


def batiment_de(ligne: Any) -> str | None:
    """Code du bâtiment d'une vente d'après la voie (et la parcelle pour le boulevard Pasteur)."""
    section = ligne.id_parcelle[8:10].lstrip("0") + ligne.id_parcelle[10:]
    for b in BATIMENTS:
        if ligne.adresse_nom_voie == b.voie and (
            b.parcelle is None or b.parcelle in (section.rjust(5, "0"), ligne.id_parcelle[9:])
        ):
            return b.code
    return None


def _entier(valeur: float) -> int:
    return 0 if math.isnan(valeur) else int(valeur)


def _numero(valeur: object) -> str | None:
    """Numéro de voie ; les « 900x » sont des numéros fictifs de copropriété."""
    return valeur if isinstance(valeur, str) and not valeur.startswith("900") else None


def construire(chemins: Iterable[Path], dpe: Path | None = None) -> dict[str, Any]:
    d = charger(chemins)
    appartements, maisons = ventes_de(d, "Appartement"), ventes_de(d, "Maison")

    # Repères Fresnes : [année, surface, pièces, €/m², 0 = appartement / 1 = maison]
    refsales = [
        [int(an), round(float(s)), _entier(p), round(float(v)), t]
        for t, x in ((0, appartements), (1, maisons))
        for an, s, p, v in x[["annee", "surface_reelle_bati", "nombre_pieces_principales", "pm2"]].itertuples(
            index=False
        )
    ]
    ref = {
        nom: {int(an): int(m) for an, m in x.groupby("annee").pm2.median().items()}
        for nom, x in (("appartements", appartements), ("maisons", maisons))
    }

    a = appartements.copy()
    a["bat"] = [batiment_de(r) for r in a.itertuples()]
    p = a[a.bat.notna()]

    batiments: list[dict[str, Any]] = []
    for b in BATIMENTS:
        sub = p[p.bat == b.code]
        if sub.empty:
            continue
        entrees = sorted({n for n in sub.adresse_numero.dropna() if not str(n).startswith("900")}, key=int)
        batiments.append(_fiche(b, sub, entrees))

    ventes = [_vente(r) for r in p.itertuples()]
    mediane = pd.DataFrame(ventes).groupby("g").m2.median().to_dict() if ventes else {}
    for v in ventes:
        rapport = v["m2"] / mediane[v["g"]]
        v["aty"] = int(rapport < ATYPIQUE_BAS or rapport > ATYPIQUE_HAUT)

    couverture = d.groupby(d.date_mutation.str[:4]).id_mutation.nunique()
    donnees: dict[str, Any] = {
        "buildings": batiments,
        "sales": ventes,
        "ref": ref,
        "refsales": refsales,
        "coverage": {int(k): int(v) for k, v in couverture.items()},
    }
    if dpe is not None and dpe.exists():
        try:  # complément : une erreur ne doit pas empêcher la publication des ventes
            donnees["dpe"] = _energie(p.assign(aty=[v["aty"] for v in ventes]), dpe)
        except Exception as erreur:  # noqa: BLE001
            texte = f"{type(erreur).__name__}: {erreur}".replace("\n", " ")[:300]
            print(f"::warning::DPE ignorés, onglet Énergie omis ({texte})")
    return donnees


def _energie(p: pd.DataFrame, chemin: Path) -> dict[str, Any]:
    from . import dpe as m

    parc = m.charger(chemin)
    return m.agreger(parc, p, m.rapprocher(p, parc))


def _fiche(b: Batiment, sub: pd.DataFrame, entrees: list[str]) -> dict[str, Any]:
    return {
        "id": b.code,
        "label": b.label,
        "peupleraie": b.peupleraie,
        "lat": round(float(sub.latitude.median()), 6),
        "lon": round(float(sub.longitude.median()), 6),
        "entrees": entrees,
    }


def _vente(r: Any) -> dict[str, Any]:
    vente: dict[str, Any] = {
        "g": r.bat,
        "e": _numero(r.adresse_numero),
        "d": r.date_mutation,
        "y": int(r.annee),
        "s": round(float(r.surface_reelle_bati)),
        "p": _entier(r.nombre_pieces_principales),
        "v": round(float(r.valeur_fonciere)),
        "m2": round(float(r.pm2)),
        "dep": int(r.dep),
    }
    lot = lookup([r.lot1_numero, r.lot2_numero, r.lot3_numero], r.bat)
    if lot:
        vente |= {"niv": lot[0], "esc": lot[1], "md": lot[2], "typ": lot[3]}
    return vente
