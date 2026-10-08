"""Assemblage de la page : gabarit HTML + CSS Leaflet + données, en un seul fichier."""

import datetime
import json
from importlib.resources import files
from pathlib import Path
from typing import Any

ROBOTS = "User-agent: *\nDisallow: /\n"  # conditions de réutilisation DVF : pas d'indexation


def assembler(donnees: dict[str, Any], sortie: Path) -> Path:
    assets = files("peupleraie") / "assets"
    donnees = {**donnees, "updated": datetime.date.today().strftime("%d/%m/%Y")}
    page = (assets / "index.html").read_text(encoding="utf-8")
    page = page.replace("/*LEAFLET_CSS*/", (assets / "leaflet.css").read_text(encoding="utf-8"))
    page = page.replace("/*DATA*/", json.dumps(donnees, ensure_ascii=False, separators=(",", ":")))
    sortie.mkdir(parents=True, exist_ok=True)
    (sortie / "index.html").write_text(page, encoding="utf-8")
    (sortie / "robots.txt").write_text(ROBOTS)
    return sortie / "index.html"
