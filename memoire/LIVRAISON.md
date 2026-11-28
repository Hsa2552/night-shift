# Rendu et démonstration

> Le planning et l'heure d'arrêt sont gérés par l'équipe.
> Contrainte officielle : plus aucune modification du dépôt après **samedi 28 novembre 2026, 13h00, heure de Paris**. Toute la checklist doit donc être terminée avant.

Les procédures détaillées de test navigateur, de déploiement et d’installation sont dans le [guide de recette](RECETTE.md).

## Convergence finale

Le candidat est identifié par le SHA de tête de la [PR #27](https://github.com/Hsa2552/night-shift/pull/27), branche `feat/convergence-phase-5`. L'équipe relit cette PR et la fusionne manuellement après avoir vérifié le résultat de la CI sur ce SHA. La PR #26 est reprise dans son historique. La PR #5 reste hors livraison. Les corrections facultatives de la validation indépendante restent sur leurs branches.

### À midi

1. Vérifier le SHA et la CI de la PR #27. Fusionner humainement. Relever le nouveau SHA de `main`; le commit de fusion peut différer du SHA testé sur la PR.
2. Synchroniser les trois postes. Commencer par `git status --short --branch` et `git stash list`. Si le poste contient des travaux, les committer sur leur branche ou les sauvegarder avec `git stash push -u -m "avant livraison Unspoil"`. Les retrouver ensuite sur la branche d’origine. Si `main` a divergé et refuse une avance rapide, préparer un worktree séparé à partir de `origin/main`.

   ```sh
   git fetch origin
   git switch main
   git pull --ff-only origin main
   npm ci
   git rev-parse HEAD
   git rev-parse origin/main
   ```

3. Vérifier l’exécution **Déploiement GitHub Pages** lancée par le push de fusion. Attendre les jobs `build` et `deploy`, puis ouvrir le site dans un profil neuf. Dans la console, exécuter `document.querySelector('meta[name="unspoil-build"]').content`. Comparer le résultat au **SHA de main** relevé à l’étape 2. [Actions](https://github.com/Hsa2552/night-shift/actions/workflows/deploy-pages.yml) · [Application](https://hsa2552.github.io/night-shift/)
4. Fermer les onglets Unspoil et les fenêtres de l’application installée avant de la rouvrir. Si le marqueur reste ancien après succès du déploiement, comparer en navigation privée. Si seul le profil habituel est ancien, vérifier le service worker dans **Outils de développement → Application → Service Workers**. En dernier recours, effacer les données du site depuis ce panneau, puis recharger en ligne avant de tester hors ligne.
5. Importer le QCM retenu par Salif. Vérifier le masquage, révéler deux blocs de façon indépendante, puis remasquer. Le candidat a été testé avec le QCM local `ensai-09e01e2ab125`, quatre pages. En cas de doute, utiliser le build de secours et ce même PDF. Garder `src/detection/samples/fin.pdf` comme exemple synthétique de secours.

### Secours statique

Sur le poste de Wael, l’archive et le dossier de secours sont dans `%USERPROFILE%\Unspoil-livraison`. L’archive contient le build statique et ses ressources locales. Elle ne contient aucun PDF privé. Depuis le dossier parent de la copie `night-shift` extraite de l’archive, lancer :

```sh
python -m http.server 4170 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:4170/night-shift/` dans Edge. Python 3 suffit pour servir les fichiers. Après décompression, aucun téléchargement ni installation de dépendance npm n’est requis. Importer séparément le PDF depuis le disque. Le nom de l’archive et le marqueur HTML identifient le commit exact.

Pour le reconstruire, sélectionner le SHA de la PR dans un worktree propre avec `git worktree add --detach ../unspoil-recette SHA_COMPLET`. Lancer `npm ci` puis `BASE_PATH=/night-shift/ npm run build -- --manifest` sous Linux ou WSL. Dans PowerShell, définir `$env:BASE_PATH = '/night-shift/'` avant `npm run build -- --manifest`. Copier le contenu de `dist/` dans un dossier nommé `night-shift` sous la racine du serveur de secours. Sur le poste de Wael, le build WSL contourne une politique Windows qui bloque la bibliothèque native Rollup.

### Vérifications et limites

Les rapports Edge comparent la sortie de production au moteur sur les mêmes PDF autorisés. Le benchmark exécuté par Salif sur la partition indépendante demeure séparé. Les scores ENSAI de Hazem reposent sur ses annotations locales. La comparaison de convergence sur les six PDF compare les sorties et les commandes, avec empreintes identiques, sans recalculer ces annotations. Voir [QUALITE.md](QUALITE.md#v-28-0608-wb--recette-de-convergence) et la PR pour le résultat du SHA final.

Le moteur conserve la révélation progressive en cas d’incertitude. Les figures mixtes sans périmètre établi, les aplats superposés et les tableaux de rôle ambigu restent des limites. Les modules graphiques et géométriques sont conservés. L’analyse graphique native reçoit les blocs propriétaires et les protections existantes. L’extension automatique des masques, le balayage raster du sous-détecteur et le remplacement des lignes historiques restent inactifs.

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
