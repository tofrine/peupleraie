import pandas as pd

from peupleraie.build import construire

COLS = [
    "id_mutation",
    "date_mutation",
    "nature_mutation",
    "valeur_fonciere",
    "adresse_numero",
    "adresse_nom_voie",
    "id_parcelle",
    "code_commune",
    "lot1_numero",
    "lot2_numero",
    "lot3_numero",
    "type_local",
    "surface_reelle_bati",
    "nombre_pieces_principales",
    "longitude",
    "latitude",
]


def ligne(
    mut,
    valeur,
    surface,
    voie="ALL DE L OSERAIE",
    parcelle="94034000AB0001",
    type_local="Appartement",
    nature="Vente",
    lot="139",
    num="6",
):
    return [
        mut,
        "2024-05-01",
        nature,
        valeur,
        num,
        voie,
        parcelle,
        "94034",
        lot,
        None,
        None,
        type_local,
        surface,
        "3",
        "2.32",
        "48.76",
    ]


def csv(tmp_path, lignes):
    chemin = tmp_path / "2024.csv"
    pd.DataFrame(lignes, columns=COLS).to_csv(chemin, index=False)
    return chemin


def test_vente_retenue_et_localisee(tmp_path):
    r = construire([csv(tmp_path, [ligne("m1", "240000", "60")])])
    assert [b["id"] for b in r["buildings"]] == ["A"]
    (v,) = r["sales"]
    assert v["m2"] == 4000 and v["niv"] == "RdC" and v["esc"] == "A"


def test_exclusions(tmp_path):
    lignes = [
        ligne("m1", "240000", "60", nature="Echange"),
        ligne("m2", "1000", "60"),  # 17 €/m²
        ligne("m3", "240000", "5"),  # < 9 m²
        ligne("m4", "240000", "60", type_local="Maison"),
    ]
    r = construire([csv(tmp_path, lignes)])
    assert r["sales"] == []
    assert len(r["refsales"]) == 1  # la maison reste dans les repères Fresnes


def test_pasteur_distingue_par_parcelle(tmp_path):
    lignes = [
        ligne("m1", "240000", "60", voie="BD PASTEUR", parcelle="94034000V0080", num="58"),
        ligne("m2", "250000", "60", voie="BD PASTEUR", parcelle="94034000V0090", num="30"),
        ligne("m3", "260000", "60", voie="BD PASTEUR", parcelle="94034000V0001", num="65"),
    ]
    r = construire([csv(tmp_path, lignes)])
    assert sorted(v["g"] for v in r["sales"]) == ["F", "H"]


def test_vente_atypique(tmp_path):
    lignes = [ligne(f"m{i}", str(240000 + i), "60", lot=str(140 + i)) for i in range(4)]
    lignes.append(ligne("mx", "120000", "60", lot="150"))  # 2 000 €/m² contre ~4 000
    r = construire([csv(tmp_path, lignes)])
    assert [v["aty"] for v in r["sales"]] == [0, 0, 0, 0, 1]
