from peupleraie.site import assembler


def test_page_assemblee_sans_marque_restante(tmp_path):
    donnees = {"buildings": [], "coverage": {}}
    page = assembler(donnees, tmp_path).read_text(encoding="utf-8")
    for marque in ("/*LEAFLET_CSS*/", "/*STYLE*/", "/*APP*/", "/*DATA*/"):
        assert marque not in page
    assert "const DATA = {" in page and ".chip" in page and "function renderTrend" in page
    assert (tmp_path / "robots.txt").read_text().startswith("User-agent")
