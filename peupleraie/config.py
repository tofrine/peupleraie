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
    dpe_voie: str | None = None  # fragment du nom de rue dans les DPE (normalisé : minuscules, sans accents)
    dpe_numeros: tuple[str, ...] = ()  # numéros de voie du bâtiment quand la rue en porte plusieurs


BATIMENTS = (
    Batiment("A", "Bât. A · Allée de l'Oseraie", "ALL DE L OSERAIE", dpe_voie="oseraie"),
    Batiment("B", "Bât. B · Allée de la Favorite", "ALL DE LA FAVORITE", dpe_voie="favorite"),
    Batiment("C", "Bât. C · Allée Georges-Braque", "ALL GEORGES BRAQUE", dpe_voie="braque"),
    Batiment("E", "Bât. E · Allée de la Résidence", "ALL DE LA RESIDENCE", dpe_voie="allee de la residence"),
    Batiment(
        "F",
        "Bât. F · Allée Louis Pasteur",
        "BD PASTEUR",
        "V0080",
        dpe_voie="boulevard pasteur",
        dpe_numeros=("58", "60"),
    ),
    Batiment(
        "H",
        "Bât. H · Allée de la Convention",
        "BD PASTEUR",
        "V0090",
        dpe_voie="boulevard pasteur",
        dpe_numeros=("30", "32"),
    ),
    Batiment("O", "Bât. O · Allée des Blancs-Bouleaux", "ALL DES BLANCS BOULEAUX", dpe_voie="blancs bouleaux"),
)


# --- DPE (ADEME, « DPE logements existants depuis juillet 2021 »)
DPE_URL = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines"
DPE_CHAMPS = (
    "numero_voie_ban",
    "nom_rue_ban",
    "code_insee_ban",
    "complement_adresse_logement",
    "surface_habitable_logement",
    "etiquette_dpe",
    "etiquette_ges",
    "date_etablissement_dpe",
    "type_batiment",
)
ETIQUETTES = ("A", "B", "C", "D", "E", "F", "G")
GROUPES_ETIQUETTES = (("A-C", ("A", "B", "C")), ("D", ("D",)), ("E", ("E",)), ("F-G", ("F", "G")))
MIN_GROUPE = 5  # en dessous, aucun chiffre n'est publié pour le groupe
DPE_AVANT_VENTE_JOURS = 730  # un DPE sert à la vente : établi jusqu'à deux ans avant…
DPE_APRES_VENTE_JOURS = 31  # …ou tout juste après
