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
