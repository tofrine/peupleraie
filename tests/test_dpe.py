import io
import json

import pandas as pd

from peupleraie import dpe
from peupleraie.build import construire
from tests.test_build import csv, ligne


def test_normaliser_et_numero():
    assert dpe.normaliser("Allée de l'Oseraie") == "allee de l oseraie"
    assert dpe.numero("58 bis") == "58" and dpe.numero(None) is None and dpe.numero("bis") is None


def test_batiment_de_pasteur_par_numero():
    assert dpe.batiment_de("Boulevard Pasteur", "58") == "F"
    assert dpe.batiment_de("Boulevard Pasteur", "32") == "H"
    assert dpe.batiment_de("Boulevard Pasteur", "65") is None
    assert dpe.batiment_de("Allée de l'Oseraie", "6") == "A"
    assert dpe.batiment_de("Rue de la Résidence", "1") is None


def test_telecharger_suit_les_pages(tmp_path):
    pages = {
        "p1": {"results": [{"nom_rue_ban": "Allée de l'Oseraie", "etiquette_dpe": "D"}], "next": "https://x/p2"},
        "p2": {"results": [{"nom_rue_ban": "Allée de la Favorite", "etiquette_dpe": "E"}]},
    }
    appels = []

    def faux(req, timeout):
        appels.append(req.full_url)
        cle = "p2" if req.full_url.endswith("p2") else "p1"
        return io.BytesIO(json.dumps(pages[cle]).encode())

    n = dpe.telecharger(tmp_path / "dpe.csv", ouvrir=faux)
    assert n == 2 and len(appels) == 2
    assert "code_insee_ban" in appels[0] and "94034" in appels[0]
    assert list(pd.read_csv(tmp_path / "dpe.csv").etiquette_dpe) == ["D", "E"]


def fichier_dpe(tmp_path, lignes):
    cols = [
        "numero_voie_ban",
        "nom_rue_ban",
        "complement_adresse_logement",
        "surface_habitable_logement",
        "etiquette_dpe",
        "date_etablissement_dpe",
    ]
    chemin = tmp_path / "dpe.csv"
    pd.DataFrame(lignes, columns=cols).to_csv(chemin, index=False)
    return chemin


def test_rapprochement_et_agregats(tmp_path):
    # 6 ventes bât. A (entrée 6), surfaces distinctes ; un DPE par vente, étiquettes D x5 et G x1
    ventes = [ligne(f"m{i}", str(240000 + 1000 * i), str(50 + 10 * i), lot=str(9000 + i)) for i in range(6)]
    dpes = [["6", "Allée de l'Oseraie", "Etage 1", 50 + 10 * i, "G" if i == 5 else "D", "2024-03-01"] for i in range(6)]
    dpes.append(["6", "Allée de l'Oseraie", "Etage 2", 52, "A", "2019-01-01"])  # trop ancien : ignoré
    dpes.append(["8", "Allée de l'Oseraie", "Etage 2", 50, "A", "2024-03-01"])  # autre entrée : ignoré
    r = construire([csv(tmp_path, ventes)], fichier_dpe(tmp_path, dpes))["dpe"]
    assert r["rapprochement"] == {"ventes": 6, "apparie": 6, "ambigu": 0, "aucun": 0, "par_lot": 0}
    assert r["repartition"]["A"]["D"] == 5 and r["repartition"]["A"]["G"] == 1 and r["repartition"]["A"]["n"] == 8
    assert r["prix"]["TOUS"]["D"]["n"] == 5 and "med" in r["prix"]["TOUS"]["D"]
    assert r["prix"]["TOUS"]["F-G"] == {"n": 1}  # sous le seuil : pas de médiane publiée


def test_ambigu_si_etiquettes_differentes(tmp_path):
    dpes = [
        ["6", "Allée de l'Oseraie", "Etage 1", 60, "D", "2024-03-01"],
        ["6", "Allée de l'Oseraie", "Etage 2", 61, "F", "2024-03-02"],
    ]
    r = construire([csv(tmp_path, [ligne("m1", "240000", "60", lot="9000")])], fichier_dpe(tmp_path, dpes))["dpe"]
    assert r["rapprochement"]["ambigu"] == 1


def test_sans_dpe_pas_de_cle(tmp_path):
    assert "dpe" not in construire([csv(tmp_path, [ligne("m1", "240000", "60")])])


def test_niveau_et_lots_du_texte_libre():
    assert dpe.niveau_de("Etage : Jaune C") == "Galerie jaune"
    assert dpe.niveau_de("Esc:GALERIE BLEU - Etage:3 - Porte:J -") == "Galerie bleue"
    assert dpe.niveau_de("Etage 3ème (galerie bleue); Porte M") == "Galerie bleue"
    assert dpe.niveau_de("Etage 1er; Porte D") == "Galerie rouge"
    assert dpe.niveau_de("RDC Porte face droite") == dpe.niveau_de("rez-de-chaussée, porte face") == "RdC"
    assert dpe.niveau_de("Etage 10") is None and dpe.niveau_de(None) is None
    assert dpe.lots_de("N°Lot : 145 / 167") == frozenset({145, 167}) and dpe.lots_de("Etage 4") == frozenset()


def test_rapprochement_par_lot_prioritaire(tmp_path):
    # surface très différente (la vente est une surface Carrez, le DPE n'est pas homogène) mais lot identique
    dpes = [["6", "Allée de l'Oseraie", "N°Lot : 139 / 167", 80, "F", "2022-01-01"]]
    r = construire([csv(tmp_path, [ligne("m1", "240000", "60", lot="139")])], fichier_dpe(tmp_path, dpes))["dpe"]
    assert r["rapprochement"]["par_lot"] == 1 and r["rapprochement"]["apparie"] == 1


def test_niveau_different_ecarte_le_candidat(tmp_path):
    # lot 139 = rez-de-chaussée ; le DPE de surface voisine est en galerie jaune : pas le même logement
    dpes = [["6", "Allée de l'Oseraie", "Etage jaune", 60, "E", "2024-03-01"]]
    r = construire([csv(tmp_path, [ligne("m1", "240000", "60", lot="139")])], fichier_dpe(tmp_path, dpes))["dpe"]
    assert r["rapprochement"]["aucun"] == 1


def test_colonnes_utiles_sont_demandees_a_l_api():
    from peupleraie.config import DPE_CHAMPS

    assert set(dpe.COLONNES_UTILES) <= set(DPE_CHAMPS)


def _ecarts(classes, effet, bruit, seed=1):
    import numpy as np

    rng = np.random.default_rng(seed)
    c = np.array(classes)
    return pd.DataFrame(
        {"classe": c, "log_ecart": effet * c + rng.normal(0, bruit, len(c)), "log_surface": rng.normal(0, 0.1, len(c))}
    )


def test_lien_negatif_net():
    r = dpe.lien(_ecarts([0, 1, 2, 3] * 15, -0.05, 0.01), tirages=300)
    assert r["verdict"] == "negatif" and r["ic"][1] < 0 and -6 < r["effet"] < -4


def test_lien_non_demontrable_quand_le_bruit_domine():
    r = dpe.lien(_ecarts([0, 1, 2, 3] * 6, 0.0, 0.15), tirages=300)
    assert r["verdict"] == "aucun" and r["ic"][0] <= 0 <= r["ic"][1]


def test_lien_trop_peu_de_ventes():
    assert dpe.lien(_ecarts([0, 1, 2, 3] * 3, -0.05, 0.01))["verdict"] == "trop_peu"
    assert dpe.lien(_ecarts([1] * 30, 0.0, 0.1))["verdict"] == "trop_peu"  # une seule classe
