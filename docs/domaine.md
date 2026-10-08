# Nom de domaine

1. À la racine du dépôt, créer un fichier `CNAME` contenant uniquement le domaine, par exemple `peupleraie.exemple.fr`. Le workflow le copie dans le site.
2. Chez OVH : espace client → *Noms de domaine* → *Zone DNS* → *Ajouter une entrée* :
   - sous-domaine (recommandé) : type **CNAME**, sous-domaine `peupleraie`, cible `tofrine.github.io.` (point final compris) ;
   - domaine nu : quatre entrées **A** vers `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
3. Après la propagation (quelques minutes à quelques heures) : *Settings → Pages*, renseigner le domaine et cocher **Enforce HTTPS**.
