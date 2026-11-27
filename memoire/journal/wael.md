# Journal de Wael

## Entrées

### 27/11 22:18 · SESSION · T-WB-1 (W1, W2) · Codex

- Disponible : `DocumentViewer` dans `src/viewer/DocumentViewer.tsx`. Masques blancs aux coordonnées canoniques, une commande par bloc pouvant couvrir plusieurs pages, révélation progressive globale à la souris, au tactile et au clavier.
- Vérifié : `npm run check` passe (6 tests, dont 5 sur le lecteur). `npm run build` compile le client, puis la politique Windows bloque le binaire natif Rollup pendant la génération du service worker (`QUALITE.md`, Q-27-2218-WB).
- Non vérifié : build complet en local, PDF réel, geste sur téléphone physique, fonctionnement hors ligne.
- Maturité : testée sur données synthétiques. La page d’accueil du socle est conservée le temps de brancher le lecteur et le détecteur.
- Pour Salif : le lecteur doit fournir les dimensions et l’index de chaque page, rendre dans un canvas avec le même repère et pouvoir annuler ou libérer les rendus en cours au changement de fichier. L’interface a besoin des dimensions avant l’analyse pour permettre la révélation progressive indépendamment de l’extraction de texte.
- Pour Hazem : `DocumentViewer` accepte les blocs du §11, y compris les régions réparties sur plusieurs pages. Le jalon H1 a été repéré sur `feat/detection`.
- Suite : préparer le parcours d’import et connecter les exports PDF et détection au fur et à mesure de leur disponibilité.

### 27/11 22:33 · SESSION · T-WB-1 (W3 à W5) · Codex

- Disponible : `App` charge le PDF local via `openPdf`, utilise `getPageDimensions` avant toute extraction, puis appelle `detectCorrections` à la demande. `PdfCanvas` lance les rendus près de l’écran et annule le rendu en cours lorsque la taille ou le document change.
- Comportement retenu : document couvert à l’ouverture et pendant l’analyse. Les résultats incertains déclenchent la révélation progressive avec une frontière à zéro. Une ouverture ou analyse remplacée peut se terminer sans modifier le document affiché.
- Vérifié : `npm run check` (86 tests), build Ubuntu sous `/night-shift/`, parcours Edge sur huit PDF synthétiques, mode tactile émulé, PDF multipage sans texte et import/détection hors ligne. Voir `QUALITE.md` V-27-2233-WB.
- Limite remontée à Hazem : morceau de bordure du graphique visible dans `mixte.pdf` (PR #6). Téléphone physique et Safari non vérifiés.
- Maturité : intégrée en copie locale avec `feat/pdf` `9b771dd` et `feat/detection` `dca91b3`. PR #3 en brouillon jusqu’à l’intégration des deux dépendances dans `main`.

### 27/11 22:41 · SESSION · T-WB-1 (W5) · Codex

- Vérifié après synchronisation du détecteur : `npm run check` (97 tests), build Ubuntu, Edge avec le hors ligne et les gestes souris/tactile émulé, Firefox avec les quatre parcours synthétiques. Voir `QUALITE.md` V-27-2241-WB.
- Les têtes vérifiées des PR #4 et #6 ont une CI verte. Leur intégration dans `main` est requise pour que la CI de la PR #3 trouve les modules PDF et détection.

### 27/11 22:59 · SESSION · T-WB-1 (intégration sur la branche) · Codex

- Fusionné `origin/main` (`362ef0e`) dans `feat/viewer` après la fusion des PR #7 (contrat C1), #4 (lecteur) et #6 (détecteur). Résolution de `QUALITE.md` en conservant les entrées des trois contributeurs.
- `App` utilise `openPdf` et `detectCorrections` de `main`. Les doubles de test d’`App.test.tsx` servent aux erreurs et aux réponses asynchrones contrôlées.
- Vérifié sur la branche intégrée : `npm run check` (97 tests) et build de production sous Ubuntu, avec le service worker généré pour `/night-shift/`.

### 27/11 23:03 · SESSION · T-WB-1 (masques et commandes) · Codex

- Les rectangles valides sont limités à la page. Si un bloc contient une région non affichable, le document reste couvert et la révélation progressive prend le relais. Le canvas d’une page totalement couverte est aussi masqué en CSS.
- Les commandes affichent le libellé du bloc sur une ligne distincte de l’action. Elles restent hors du PDF et se répartissent en grille selon la largeur de la page.
- Vérifié : `npm run check` (101 tests), build Ubuntu et parcours Edge sur huit PDF synthétiques, écran mobile émulé à 390 px et mode hors ligne. L’alignement ne change pas avec la largeur. Le trait du graphique dans `mixte.pdf` reste visible en dehors de la région détectée (Q-27-2233-WB).
