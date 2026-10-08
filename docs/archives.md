# Archives DVF

DVF ne publie que les cinq dernières années. Pour ne pas perdre les années qui sortent de la source (2021 en premier), l'Action les conserve dans un **dépôt privé** `peupleraie-archives`, un fichier CSV par année. Le dépôt public ne contient jamais de données brutes.

## Fonctionnement

À chaque passage de l'Action :

1. le dépôt privé est cloné dans `archive/` ;
2. les CSV DVF de l'année en cours et des années précédentes sont téléchargés ;
3. `peupleraie/archive.py` les fusionne avec l'archive : pour une année, la version la plus récente de la source remplace la copie archivée, sauf si elle est nettement plus courte (moins de 90 % des lignes : téléchargement tronqué) ; une année absente de la source est restaurée depuis l'archive ;
4. la page est construite à partir de toutes les années ;
5. les nouveautés sont enregistrées (commit) dans le dépôt privé.

Si data.gouv.fr est injoignable, la page est construite à partir de l'archive seule.

Sans le secret `ARCHIVES_TOKEN`, ces étapes sont ignorées : le site marche, mais sans mémoire des années disparues.

## Mise en place (une seule fois)

1. **Dépôt privé** : sur github.com, *New repository* → nom `peupleraie-archives` → **Private** → cocher **Add a README file** (un dépôt vide ne peut pas être cloné).
2. **Jeton d'accès** : *Settings* (de ton compte, pas du dépôt) → *Developer settings* → *Personal access tokens* → *Fine-grained tokens* → *Generate new token* :
   - nom : `peupleraie-archives` ; durée : la plus longue proposée (à renouveler à l'échéance) ;
   - *Repository access* → *Only select repositories* → `peupleraie-archives` ;
   - *Permissions* → *Repository permissions* → **Contents : Read and write** ;
   - copier le jeton (il ne s'affiche qu'une fois).
3. **Secret** : dépôt `peupleraie` → *Settings* → *Secrets and variables* → *Actions* → *New repository secret* → nom `ARCHIVES_TOKEN`, valeur : le jeton.
4. Lancer l'Action (*Actions* → *Publier* → *Run workflow*). Le dépôt privé doit alors contenir `2021.csv`, `2022.csv`, etc.

Si le jeton expire, l'Action échoue à l'étape de clonage du coffre : renouveler le jeton et remplacer le secret.

## En local

`uv run peupleraie all` utilise le dossier `archive/` s'il existe (clone du dépôt privé) et le met à jour ; sinon il se comporte comme avant.
