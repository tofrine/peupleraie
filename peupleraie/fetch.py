"""Téléchargement des fichiers DVF géolocalisés officiels (data.gouv.fr)."""

import datetime
import urllib.error
import urllib.request
from pathlib import Path

from .config import COMMUNE, DVF_URL, USER_AGENT


def telecharger(dossier: Path, annees: range | None = None) -> list[int]:
    """Télécharge un CSV par année dans `dossier` ; les années non publiées (404) sont ignorées."""
    dossier.mkdir(parents=True, exist_ok=True)
    if annees is None:
        an = datetime.date.today().year
        annees = range(an - 6, an + 1)
    obtenues: list[int] = []
    for annee in annees:
        requete = urllib.request.Request(
            DVF_URL.format(annee=annee, commune=COMMUNE), headers={"User-Agent": USER_AGENT}
        )
        try:
            with urllib.request.urlopen(requete, timeout=60) as reponse:
                (dossier / f"{annee}.csv").write_bytes(reponse.read())
        except urllib.error.HTTPError as erreur:
            if erreur.code != 404:
                raise
            continue
        obtenues.append(annee)
    if not obtenues:
        raise RuntimeError("Aucun fichier DVF trouvé")
    return obtenues
