# Données

## Source

Demandes de valeurs foncières géolocalisées (DGFiP, Etalab), un fichier par année et par commune :
`https://files.data.gouv.fr/geo-dvf/latest/csv/{année}/communes/94/94034.csv`. Seules les cinq dernières années sont publiées, mises à jour au printemps et à l'automne.

## Nettoyage (`peupleraie/build.py`, `peupleraie/config.py`)

- ventes uniquement (« Vente » et « Vente en l'état futur d'achèvement ») ;
- une mutation = un seul appartement, éventuellement avec des dépendances ;
- surface ≥ 9 m², prix entre 1 000 et 12 000 €/m² ;
- doublons retirés ;
- vente « atypique » : prix au m² inférieur à 0,65 × ou supérieur à 1,5 × la médiane du bâtiment (masquée par défaut dans la page).

## Bâtiments

Un bâtiment correspond à une allée (nom de voie DVF). Sur le boulevard Pasteur, la parcelle les distingue : bâtiment H (Allée de la Convention) = parcelle V 90, n° 30–32 ; bâtiment F (Allée Louis Pasteur) = parcelle V 80, n° 58–60. La liste est dans `peupleraie/config.py`.

## Lots et galeries (`peupleraie/lots.py`)

Les lots du bâtiment A sont relevés sur le règlement de copropriété de 1989 : niveau (rez-de-chaussée, galeries rouge, jaune, bleue, verte), escalier A ou B, duplex montant ou descendant, type F1 à F5. Le bâtiment C a le même plan, avec un décalage de 501 sur les numéros de lots (`MEME_PLAN`). Les autres bâtiments ne sont pas renseignés.
