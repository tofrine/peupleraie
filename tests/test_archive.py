from peupleraie.archive import fusionner


def ecrire(dossier, annee, n, contenu="x"):
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / f"{annee}.csv").write_text("\n".join(f"{contenu}{i}" for i in range(n)) + "\n")


def test_premiere_fois_tout_est_archive(tmp_path):
    data, arc = tmp_path / "data", tmp_path / "arc"
    ecrire(data, 2021, 10), ecrire(data, 2022, 10)
    b = fusionner(data, arc)
    assert b["archivees"] == [2021, 2022] and (arc / "2021.csv").exists()


def test_annee_disparue_de_la_source_est_restauree(tmp_path):
    data, arc = tmp_path / "data", tmp_path / "arc"
    ecrire(arc, 2021, 10), ecrire(data, 2022, 10)
    b = fusionner(data, arc)
    assert b["restaurees"] == [2021] and (data / "2021.csv").read_text() == (arc / "2021.csv").read_text()
    assert (arc / "2022.csv").exists()  # la nouvelle année entre dans l'archive


def test_source_plus_recente_remplace_l_archive(tmp_path):
    data, arc = tmp_path / "data", tmp_path / "arc"
    ecrire(arc, 2024, 10, "ancien"), ecrire(data, 2024, 12, "nouveau")
    assert fusionner(data, arc)["archivees"] == [2024]
    assert "nouveau" in (arc / "2024.csv").read_text()


def test_source_tronquee_n_ecrase_pas_l_archive(tmp_path):
    data, arc = tmp_path / "data", tmp_path / "arc"
    ecrire(arc, 2024, 100, "bon"), ecrire(data, 2024, 20, "tronque")
    b = fusionner(data, arc)
    assert (
        b["gardees"] == [2024] and "bon" in (data / "2024.csv").read_text() and "bon" in (arc / "2024.csv").read_text()
    )


def test_rien_a_faire_si_identique(tmp_path):
    data, arc = tmp_path / "data", tmp_path / "arc"
    ecrire(arc, 2023, 10), ecrire(data, 2023, 10)
    assert fusionner(data, arc) == {"archivees": [], "restaurees": [], "gardees": []}
