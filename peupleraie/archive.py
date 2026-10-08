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


def fusionner(data: Path, archive: Path) -> dict[str, list[int]]:
    """Synchronise `data/{année}.csv` (source) et `archive/{année}.csv`. Retourne ce qui a été fait, par année."""
    archive.mkdir(parents=True, exist_ok=True)
    bilan: dict[str, list[int]] = {"archivees": [], "restaurees": [], "gardees": []}
    sources = {int(c.stem): c for c in data.glob("[0-9][0-9][0-9][0-9].csv")}
    archives = {int(c.stem): c for c in archive.glob("[0-9][0-9][0-9][0-9].csv")}
    for annee in sorted(sources.keys() | archives.keys()):
        src, arc = sources.get(annee), archives.get(annee)
        if src and (arc is None or lignes(src) >= SEUIL_TRONCATURE * lignes(arc)):
            if arc is None or src.read_bytes() != arc.read_bytes():
                shutil.copyfile(src, archive / f"{annee}.csv")
                bilan["archivees"].append(annee)
        elif arc:  # année absente de la source, ou source tronquée : on garde l'archive
            shutil.copyfile(arc, data / f"{annee}.csv")
            bilan["restaurees" if src is None else "gardees"].append(annee)
    return bilan
