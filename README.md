# Peupleraie

Comparateur interactif des ventes d'appartements (DVF, croisées avec les DPE de l'ADEME) au Domaine de la Peupleraie, à Fresnes : par année, surface, bâtiment, avec min / médiane / max au m², plan cliquable et repères sur toute la commune.

Les données officielles sont téléchargées, nettoyées et republiées automatiquement sur GitHub Pages.

## Installation

Prérequis : Python 3.12+ et [uv](https://docs.astral.sh/uv/).

```
> uv sync
```

## Usage

```
> uv run peupleraie all        # télécharge, nettoie, assemble
> uv run peupleraie fetch      # une seule étape : fetch | build | site
> uv run peupleraie rapprochement  # privé : ventes et DPE, vente par vente, dans prive/
```

La page est écrite dans `site/index.html` : un seul fichier, à ouvrir dans un navigateur.

Tests et style :

```
> uv run pytest
> uv run ruff check
```

## Publication

`.github/workflows/publier.yml` reconstruit et publie la page le 20 avril, mai, octobre et novembre (DVF est mis à jour deux fois par an), à chaque push sur `main`, et à la demande (onglet *Actions* → *Run workflow*).

Mise en place, une seule fois : *Settings → Pages → Source : GitHub Actions*. Pour un nom de domaine, voir [docs/domaine.md](docs/domaine.md).

## Documentation

- [docs/donnees.md](docs/donnees.md) : source, règles de nettoyage, bâtiments et lots
- [docs/domaine.md](docs/domaine.md) : domaine OVH et HTTPS

La page n'est pas indexée par les moteurs de recherche (`robots.txt` et balise `noindex`), comme le demandent les conditions de réutilisation de DVF.
