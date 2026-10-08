"""Archive des fichiers DVF : DVF ne publie que cinq années glissantes, on garde les années qui disparaissent.

L'archive est un dépôt privé cloné dans `archive/` ; elle contient un CSV par année (`archive/dvf/2021.csv`).
Règle : pour une année, le fichier le plus récent de la source remplace la copie archivée, sauf s'il est nettement
plus court (téléchargement tronqué) ; une année absente de la source est restaurée depuis l'archive.
"""

import shutil
from pathlib import Path

SEUIL_TRONCATURE = 0.9  # une source de moins de 90 % des lignes archivées n'écrase pas l'archive


def lignes(chemin: Path) -> int:
    with chemin.open("rb") as f:
        return sum(1 for _ in f)


def synchroniser(src: Path, arc: Path) -> str:
    """Synchronise un fichier source et sa copie archivée.

    « archivee » (source plus récente copiée dans l'archive), « inchangee », « restauree » (source absente : copie
    restaurée), « gardee » (source tronquée : l'archive prévaut), « absente » (ni l'un ni l'autre).
    """
    if src.exists() and (not arc.exists() or lignes(src) >= SEUIL_TRONCATURE * lignes(arc)):
        if arc.exists() and src.read_bytes() == arc.read_bytes():
            return "inchangee"
        arc.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, arc)
        return "archivee"
    if arc.exists():
        existait = src.exists()
        src.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(arc, src)
        return "gardee" if existait else "restauree"
    return "absente"


def fusionner(data: Path, archive: Path) -> dict[str, list[int]]:
    """Synchronise `data/{année}.csv` (source) et `archive/{année}.csv`. Retourne ce qui a été fait, par année."""
    archive.mkdir(parents=True, exist_ok=True)
    bilan: dict[str, list[int]] = {"archivees": [], "restaurees": [], "gardees": []}
    annees = {int(c.stem) for d in (data, archive) for c in d.glob("[0-9][0-9][0-9][0-9].csv")}
    for annee in sorted(annees):
        etat = synchroniser(data / f"{annee}.csv", archive / f"{annee}.csv")
        if etat != "inchangee":
            bilan[{"archivee": "archivees", "restauree": "restaurees", "gardee": "gardees"}[etat]].append(annee)
    return bilan
