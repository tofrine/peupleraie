"""Ligne de commande : `peupleraie fetch | build | site | all`."""

import argparse
import json
from pathlib import Path

from . import archive as coffre
from . import dpe
from .build import construire
from .fetch import telecharger
from .site import assembler


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="peupleraie", description=__doc__)
    sub = p.add_subparsers(dest="commande", required=True)
    for nom, aide in (
        ("fetch", "télécharge les CSV DVF"),
        ("build", "produit data.json"),
        ("site", "assemble la page"),
        ("all", "les trois étapes"),
    ):
        s = sub.add_parser(nom, help=aide)
        s.add_argument("--data", type=Path, default=Path("data"), help="dossier des CSV (défaut : data/)")
        s.add_argument(
            "--archive", type=Path, default=Path("archive"), help="coffre des années DVF (défaut : archive/)"
        )
        s.add_argument("--json", type=Path, default=Path("data.json"), help="fichier intermédiaire")
        s.add_argument("--site", type=Path, default=Path("site"), help="dossier de sortie (défaut : site/)")
    r = sub.add_parser("rapprochement", help="ventes et DPE, vente par vente, dans prive/ (jamais publié)")
    r.add_argument("--data", type=Path, default=Path("data"))
    r.add_argument("--sortie", type=Path, default=Path("prive/rapprochement.csv"))
    a = p.parse_args(argv)
    if a.commande == "rapprochement":
        return _rapprochement(a.data, a.sortie)

    if a.commande in ("fetch", "all"):
        coffre_dvf = a.archive / "dvf"
        try:
            print("Années téléchargées :", telecharger(a.data))
        except (RuntimeError, OSError):  # aucun fichier, ou source injoignable
            if not (coffre_dvf.exists() and any(coffre_dvf.glob("*.csv"))):
                raise
            print("::warning::Source DVF indisponible, on utilise l'archive")
        if a.archive.exists():
            b = coffre.fusionner(a.data, coffre_dvf)
            print(f"Archive : {b['archivees']} enregistrées, {b['restaurees']} restaurées, {b['gardees']} conservées")
        fichier_dpe = a.data / "dpe" / "dpe.csv"
        try:  # les DPE sont un complément : leur échec ne doit pas bloquer la publication
            print("DPE téléchargés :", dpe.telecharger(fichier_dpe))
        except Exception as erreur:  # noqa: BLE001
            print(f"::warning::DPE indisponibles ({erreur})")
        if a.archive.exists():
            print("Archive DPE :", coffre.synchroniser(fichier_dpe, a.archive / "dpe" / "dpe.csv"))
    if a.commande in ("build", "all"):
        donnees = construire(sorted(a.data.glob("*.csv")), a.data / "dpe" / "dpe.csv")
        a.json.write_text(json.dumps(donnees, ensure_ascii=False, separators=(",", ":")))
        if "dpe" in donnees:
            r = donnees["dpe"]["rapprochement"]
            print(
                f"DPE : {donnees['dpe']['n_logements']} logements, {r['apparie']}/{r['ventes']} ventes appariées "
                f"({r['par_lot']} par numéro de lot)"
            )
        print(
            f"{len(donnees['buildings'])} bâtiments, {len(donnees['sales'])} ventes, "
            f"dont {sum('niv' in v for v in donnees['sales'])} situées par galerie, "
            f"{sum(v['aty'] for v in donnees['sales'])} atypiques"
        )
    if a.commande in ("site", "all"):
        print("Page :", assembler(json.loads(a.json.read_text()), a.site))
    return 0


def _rapprochement(data: Path, sortie: Path) -> int:
    """Fichier de travail privé : pour chaque vente, le DPE retenu et les candidats. À ne pas publier."""
    from .build import batiment_de, charger, ventes_de

    d = charger(sorted(data.glob("*.csv")))
    a = ventes_de(d, "Appartement")
    a["bat"] = [batiment_de(r) for r in a.itertuples()]
    a = a[a.bat.notna()]
    parc = dpe.charger(data / "dpe" / "dpe.csv")
    res = dpe.rapprocher(a, parc)
    sortie.parent.mkdir(parents=True, exist_ok=True)
    out = a[
        [
            "date_mutation",
            "bat",
            "adresse_numero",
            "surface_reelle_bati",
            "nombre_pieces_principales",
            "valeur_fonciere",
            "pm2",
        ]
    ].join(res[["etiquette", "statut", "methode", "candidats"]])
    out["dpe_candidats"] = [
        "; ".join(f"{c.date:%Y-%m-%d} {c.etiquette} {c.surface:g} m² {c.niveau or 'niveau ?'}" for c in r.itertuples())
        for r in res.detail
    ]
    out.sort_values("date_mutation").to_csv(sortie, index=False)
    print(
        f"{sortie} : {len(out)} ventes, {(out.statut == 'apparie').sum()} appariées, "
        f"{(out.statut == 'ambigu').sum()} ambiguës, {(out.statut == 'aucun').sum()} sans DPE"
    )
    return 0
