"""Ligne de commande : `peupleraie fetch | build | site | all`."""

import argparse
import json
from pathlib import Path

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
        s.add_argument("--json", type=Path, default=Path("data.json"), help="fichier intermédiaire")
        s.add_argument("--site", type=Path, default=Path("site"), help="dossier de sortie (défaut : site/)")
    a = p.parse_args(argv)

    if a.commande in ("fetch", "all"):
        print("Années téléchargées :", telecharger(a.data))
    if a.commande in ("build", "all"):
        donnees = construire(sorted(a.data.glob("*.csv")))
        a.json.write_text(json.dumps(donnees, ensure_ascii=False, separators=(",", ":")))
        print(
            f"{len(donnees['buildings'])} bâtiments, {len(donnees['sales'])} ventes, "
            f"dont {sum('niv' in v for v in donnees['sales'])} situées par galerie, "
            f"{sum(v['aty'] for v in donnees['sales'])} atypiques"
        )
    if a.commande in ("site", "all"):
        print("Page :", assembler(json.loads(a.json.read_text()), a.site))
    return 0
