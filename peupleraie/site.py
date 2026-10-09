"""Assemblage de la page : gabarit HTML, styles, script, CSS Leaflet et données, en un seul fichier."""

import datetime
import json
from importlib.resources import files
from pathlib import Path
from typing import Any

ROBOTS = "User-agent: *\nDisallow: /\n"  # page destinée aux copropriétaires : pas d'indexation


def assembler(donnees: dict[str, Any], sortie: Path) -> Path:
    assets = files("peupleraie") / "assets"
    donnees = {**donnees, "updated": datetime.date.today().strftime("%d/%m/%Y")}
    page = (assets / "index.html").read_text(encoding="utf-8")
    morceaux = {
        "/*LEAFLET_CSS*/": (assets / "leaflet.css").read_text(encoding="utf-8"),
        "/*STYLE*/": (assets / "style.css").read_text(encoding="utf-8"),
        "/*APP*/": (assets / "app.js").read_text(encoding="utf-8"),
        "/*DATA*/": json.dumps(donnees, ensure_ascii=False, separators=(",", ":")),
    }
    for marque, contenu in morceaux.items():
        page = page.replace(marque, contenu)
    sortie.mkdir(parents=True, exist_ok=True)
    (sortie / "index.html").write_text(page, encoding="utf-8")
    (sortie / "robots.txt").write_text(ROBOTS)
    return sortie / "index.html"
