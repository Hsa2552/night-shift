# Rendu et démonstration

> Le planning et l'heure d'arrêt sont gérés par l'équipe.
> Contrainte officielle : plus aucune modification du dépôt après **samedi 28 novembre 2026, 13h00, heure de Paris**. Toute la checklist doit donc être terminée avant.

## Checklist de rendu

- [ ] Le dépôt est accessible au jury (public, ou accès donné).
- [ ] Un clone propre s'installe et se lance en suivant uniquement le README.
- [ ] Les tests pertinents ont été lancés, résultats notés dans `QUALITE.md`.
- [ ] La CI GitHub est verte sur le dernier commit de main.
- [ ] Le site déployé (si l'équipe en a un) correspond au dernier commit de main et s'installe sur téléphone.
- [ ] README complet : problème, solution, fonctionnalités réellement disponibles, installation, lancement, tests, limitations, démo, équipe.
- [ ] Ce qui est simulé ou fictif est signalé dans le README et dans l'interface.
- [ ] Aucun secret dans le dépôt ni dans son historique (pas de `.env`, pas de clé dans le code).
- [ ] Tout ce qui doit être rendu est fusionné dans main. Les branches non fusionnées ne font pas partie du rendu.
- [ ] Commit final identifié : `<hash>` (tag `rendu-final` si l'équipe le souhaite).
- [ ] `ETAT.md` et `QUALITE.md` reflètent l'état final réel.
- [ ] Plus aucun agent, tâche planifiée ou automatisation ne peut modifier le dépôt.
- [ ] Lien GitHub transmis aux organisateurs.

## Recette technique pour le jury

1. Dans un clone propre, sélectionner le SHA à distribuer, lancer `npm ci`, `npm run check` et le build de production. Pour Pages, utiliser `BASE_PATH=/night-shift/`. Le repli par hébergement statique à la racine utilise `BASE_PATH=/`.
2. Vérifier le manifeste et le service worker via `npm run test:distribution` et `npm run test:distribution -- update`, après installation des navigateurs Playwright indiquée dans le README. Le script utilise des exemples synthétiques et vérifie les requêtes, les entrées de stockage et l'import hors ligne.
3. Confirmer dans le workflow que le déploiement HTTPS correspond au SHA publié. Préparer `couleur.pdf` et `fin.pdf` sur le téléphone avant la démo. Montrer l'import, le masquage, puis la réouverture et un nouvel import en mode avion depuis l'icône installée. Dans le compte rendu, préciser si l'appareil est physique ou émulé. Pour un essai multipage, relever aussi la taille du PDF.
4. Utiliser le mode `performance` de la recette sur les PDF du corpus référencé dans `QUALITE.md`. Présenter séparément temps de traitement, mémoire du navigateur et consommation réelle sur téléphone lorsqu'elle est mesurée.
5. Garder le build de production local et les exemples synthétiques comme secours de démo. Les limites du détecteur et les validations appareil sont dans `QUALITE.md`.

## Démo (3 minutes strictes)

- Format : direct, vidéo commentée, ou direct avec vidéo de secours
- Parcours montré : parcours principal de `PRODUIT.md`
- Fonctionnalités présentables (maturité `démontrable` dans `ETAT.md`) : _à compléter_
- Preuves de fonctionnement (captures, vidéo, chiffres vérifiés) : _à compléter_
- Plan B si la démo en direct échoue : _à compléter_

## Pitch

_À rédiger une fois le sujet choisi._
