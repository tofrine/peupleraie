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

## DPE (`peupleraie/dpe.py`)

Source : ADEME, jeu « DPE logements existants (depuis juillet 2021) », licence ouverte, mis à jour chaque semaine. Les DPE de Fresnes sont téléchargés par l'API (`code_insee_ban_eq=94034`) et rattachés aux bâtiments par le nom de rue (et le numéro, pour le boulevard Pasteur). Si le téléchargement échoue, la page est publiée sans l'onglet « Énergie ».

- **Un logement = un DPE** : le plus récent pour un même bâtiment, entrée, niveau et surface.
- **Niveau et lots** : le champ « étage » de l'ADEME est inutilisable ; on lit le texte libre du complément d'adresse (« Etage Rouge », « galerie bleue », « N°Lot : 145 / 167 »).
- **Rapprochement avec une vente** : d'abord par numéro de lot commun avec la vente DVF ; sinon même bâtiment et même entrée, DPE établi de 2 ans avant à 1 mois après la vente, surface à moins de max(3 m², 8 %), même niveau quand il est connu (bât. A et C). Étiquettes divergentes entre candidats : vente « ambiguë », non utilisée.
- **Publié** : effectifs d'étiquettes par bâtiment et prix au m² par classe (A–C, D, E, F–G), ventes atypiques exclues. Aucun chiffre pour moins de 5 logements ou ventes (`MIN_GROUPE`). Jamais de DPE individuel : seul l'onglet « Ventes » (données DVF ouvertes) détaille les ventes.

### Le prix dépend-il de l'étiquette ?

- **Écart au prix typique** : pour chaque vente rapprochée d'un DPE, on compare son prix au m² à la médiane des ventes non atypiques du même bâtiment la même année (au moins 3 ventes). Cela retire l'effet du bâtiment et de l'année.
- **Lien** : régression de l'écart (en logarithme) sur le rang de l'étiquette (A–C = 0, D = 1, E = 2, F–G = 3) et sur la surface relative au bâtiment. L'intervalle de confiance à 95 % vient d'un bootstrap (2 000 tirages, graine fixe). Il faut au moins 20 ventes et deux classes de 5 ventes ; sinon la page le dit (« trop peu de ventes »).
- **Verdict affiché** : « aucun lien démontrable » quand l'intervalle contient 0, « moins cher » ou « plus cher » sinon. C'est une corrélation, jamais une preuve de cause.
