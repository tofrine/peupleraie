"""Bâtiments du domaine et paramètres du nettoyage des données."""

from dataclasses import dataclass

COMMUNE = "94034"  # code INSEE de Fresnes
DVF_URL = "https://files.data.gouv.fr/geo-dvf/latest/csv/{annee}/communes/94/{commune}.csv"
USER_AGENT = "peupleraie/0.1"

NATURES = ("Vente", "Vente en l'état futur d'achèvement")
SURFACE_MIN = 9.0  # m² : en dessous, ce n'est pas un logement
PRIX_M2_BORNES = (1_000, 12_000)  # €/m² : hors de cette plage, l'enregistrement est écarté
ATYPIQUE_BAS, ATYPIQUE_HAUT = 0.65, 1.5  # écart à la médiane du bâtiment, en rapport


@dataclass(frozen=True)
class Batiment:
    code: str
    label: str
    voie: str  # nom de voie tel qu'écrit dans DVF
    parcelle: str | None = None  # section + numéro (ex. « V0080 ») quand une voie porte plusieurs bâtiments
    peupleraie: bool = True


BATIMENTS = (
    Batiment("A", "Bât. A · Allée de l'Oseraie", "ALL DE L OSERAIE"),
    Batiment("B", "Bât. B · Allée de la Favorite", "ALL DE LA FAVORITE"),
    Batiment("C", "Bât. C · Allée Georges-Braque", "ALL GEORGES BRAQUE"),
    Batiment("E", "Bât. E · Allée de la Résidence", "ALL DE LA RESIDENCE"),
    Batiment("F", "Bât. F · Allée Louis Pasteur", "BD PASTEUR", "V0080"),  # n° 58–60
    Batiment("H", "Bât. H · Allée de la Convention", "BD PASTEUR", "V0090"),  # n° 30–32
    Batiment("O", "Bât. O · Allée des Blancs-Bouleaux", "ALL DES BLANCS BOULEAUX"),
)
