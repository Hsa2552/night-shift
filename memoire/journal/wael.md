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

### 27/11 23:06 · SESSION · T-WB-1 (glissement du trait) · Codex

- Le trait prend le focus quand la révélation progressive s’active. Le glissement met à jour la frontière au plus une fois par image, tient compte de la fenêtre visible et distingue le simple appui du déplacement. Au relâchement, la dernière position est appliquée et le défilement s’arrête.
- Vérifié : `npm run check` (102 tests), build Ubuntu, gestes souris et tactile émulé dans Edge, défilement au bord, PDF sans texte, rechargement hors ligne. Les quatre parcours d’import et les commandes par bloc passent aussi dans Firefox.
- Non vérifié : gestes sur téléphone physique et Safari. La région du graphique de `mixte.pdf` reste suivie côté détection.

### 27/11 23:09 · SESSION · T-WB-1 (rendu multipage) · Codex

- Les canvas éloignés de la fenêtre libèrent leur bitmap et le recréent à leur retour dans la zone de préchargement. Le défilement ne change aucune couverture.
- Vérifié : document graphique synthétique de huit pages dans Edge, `npm run check` (102 tests), build Ubuntu, parcours Edge et Firefox et nouvel import hors ligne dans Edge.

### 28/11 00:39 · SESSION · T-WB-2 (W6 à W10) · Codex

- Branche `feat/design-mako` issue de `main` après la fusion des PR #3, #8, #9 et #10. Logo redessiné d’après `unspoil-logo-reference.png`, déclinaisons vectorielles et PWA, Geist locale, thème clair/sombre. Chemins d’icônes conservés et coordination Salif dans la PR #12.
- Accueil avec dépôt et exemple PDF synthétique interactif. Lecteur avec navigation neutre, zoom, progression par bloc, chargement couvert et annulation. Revue visuelle sur six tailles dans les deux thèmes et recette Edge sur le build de production, hors ligne et en tactile émulé. Voir `QUALITE.md` V-28-0039-WB.
- QCM ENSAI : la PR #12 propose à Hazem un bloc C1 contenant toutes les cases d’une question. Régions rendues opaques et neutres, commande unique hors des cases, révélation groupée. Les données synthétiques valident l’interface. Le test sur l’annale ENSAI reste à faire avec le détecteur correspondant.

### 28/11 01:18 · SESSION · T-WB-3 · Détection colorimétrique

- Interfaces publiées dans la PR #13 depuis `main` `3ed5e93` pour permettre l'intégration par Hazem. Les nouveaux détecteurs restent dans `src/detection/visual/`.
- Détecteur couleur disponible. Il combine les pixels chromatiques et les positions du texte, avec un paramètre facultatif pour une convention annoncée sur une autre page. C1 inchangé.
- Vérifié : sept tests ciblés, mesure dans Edge sur quatre documents universitaires, dont une annale contenant des réponses rouges et un scan manuscrit sans couche texte. Sur Berkeley, la couleur seule laisse visibles un arbre de la correction et deux sélections jaunes. Voir V-28-0118-WB.
- Suite : analyser les groupes de cases et la grille sur un QCM local, sans publier le document. Intégration du moteur à la charge de Hazem.

### 28/11 01:29 · SESSION · T-WB-3 · Observation d'encre indépendante

- Priorité ajustée par Wael : Hazem développe les QCM AMC. L’analyse couleur fournit désormais le relevé brut par fragment et composante chromatique, y compris les mesures neutres par fragment. Les masques restent une sortie distincte. Les exports et les observations ont été transmis dans la PR #13.
- Vérifié dans Edge : Lyon 2, quatre pages, 23/23 fragments bleus et 7/7 échantillons noirs observés, aucun masque couleur sur les questions. Berkeley conserve les résultats du premier jalon. Voir V-28-0128-WB.
- Audit QCM de la branche de Hazem sur le recueil ENSAI local : toutes les cases noircies couvertes, huit cases vides résiduelles susceptibles de donner un indice. Voir V-28-0129-WB. Les fichiers du moteur et les PDF restent hors de la PR.
- Maturité : relevé testé en isolation, intégration structurelle confiée à Hazem.

### 28/11 02:11 · SESSION · T-WB-4 · Recette du produit intégré

- Build de recette `ef23fa2f25c3066350534472352fc2a63455cec0`. Base `329d297` et moteur `54e0e7b`. Les chemins du moteur et du lecteur restent ceux des responsables. Le SHA est présent dans le HTML et vérifié après rechargement hors ligne.
- Le moteur appelle l’analyseur couleur dans le vrai parcours. Lyon 2 L2 donne 17/17 blocs indépendants dans Edge. Deux annales ENSAI comparées à `329d297` affichent encore des réponses visibles et cinq indices par élimination. L’écart Node/Edge a été reproduit sur Savoie. Voir V-28-0211-WB.
- Le visualiseur conserve la couverture si un résultat « sujet seul » renvoie aussi des blocs. La recette reproductible est dans le README et `scripts/verify-real-pdfs.mjs`. P0 transmis à Hazem. Des annales supplémentaires ont été demandées à Salif pour une recette indépendante.

### 28/11 03:19 · SESSION · T-WB-5 · Perception PDF native

- PR #16 issue de `main` `329d297`. Laboratoire PyMuPDF et prototype PDF.js indépendants. Le lecteur, le moteur et C1 restent intacts. Observations proposées par page et dans le repère C1.
- Vérifié sur deux annales ENSAI de diagnostic. Les deux extracteurs vectoriels retrouvent 472/472 candidats, contre 391/472 avec les cases raster brutes. Contrôles de familles publiques, notamment glyphes superposés, bleu des questions et scan sans vecteurs. Voir V-28-0319-WB.
- Approche hybride proposée. Les opérateurs et la couleur sont des indices locaux, à confirmer par le raster quand la visibilité ou l’état est indéterminé. Association aux questions et fusion en revue avec Hazem. Aucun raccordement au lecteur sans coordination avec Salif.
- Recette précédente. PR #14 fusionnée par l’équipe dans la branche de Hazem au commit `8cebd09`. PR #15 encore ouverte à la dernière vérification de ce jalon.

### 28/11 03:23 · SESSION · T-WB-5 · Contrôle public indépendant

- Mesure géométrique des cases sur une page de Virginia Tech et une de Washington. Enregistrement des seules coordonnées et de l’état observé sur ces deux sources publiques. Les résultats confirment la complémentarité des indices natifs et raster. Voir V-28-0323-WB.

### 28/11 03:58 · SESSION · T-WB-6 · Couleur native des fragments

- Branche dédiée depuis `da87ece`, après fusion de la PR #16. Rattachement par géométrie et séquence Unicode avec provenance et plages multicolores. Publication du jalon pour Hazem et Salif. Voir V-28-0358-WB.
- À suivre dans ce périmètre. Localisation et mesure des symboles, relations avec les marques et fonds. Le raccordement du lecteur et le regroupement documentaire demeurent dans leurs branches respectives.

### 28/11 04:07 · SESSION · T-WB-6 · Glyphes et géométrie des tracés

- PR #20 complétée avec les cellules de glyphes, leurs relations de recouvrement et de voisinage, les fonds colorés, les placements image, les traits et les surlignages. Vérifié sur Virginia Tech, Washington et MIT, puis documenté dans V-28-0407-WB. Les boîtes glyphes sont des estimations et les rôles restent à attribuer dans le moteur.

### 28/11 04:28 · SESSION · T-WB-7 · Géométrie adaptative

- Audit de `layout.ts` et comparaison avec une base adaptative, XY-Cut et des voisins de type Docstrum. Premiers résultats publiés pour Hazem dans la branche dédiée. Aucune modification du moteur ou du lecteur. Voir V-28-0428-WB.

### 28/11 04:37 · SESSION · T-WB-7 · Fermeture des cadres et limites du graphe

- PR #24 complétée. Prototype TypeScript de topologie des séparateurs, comparé à Python. Comparaison de l’ordre, étude des balises/MCID et contrôle raster à trois résolutions. Le classement du graphe et la fermeture raster n’améliorent pas les cibles observées. Voir V-28-0437-WB.

### 28/11 04:50 · SESSION · T-WB-8 · Premier sous-détecteur graphique

- API locale publiée pour Hazem. Les figures natives dans un périmètre de correction confirmé peuvent être rattachées à un bloc ou former une proposition. Trois tests couvrent le rattachement, les ancres sans périmètre, les protections et les conflits. La mesure du masquage sur PDF publics suit.

### 28/11 04:54 · SESSION · T-WB-8 · Géométrie alternative

- Parité avec les groupes Python sur 14 cas horizontaux de la phase 4.3. Activation conditionnelle par gouttière répétée, indices du lecteur préservés. Deux tests ciblent les invariances et le document simple. Le moteur historique reste en place.

### 28/11 05:03 · SESSION · T-WB-8 · Figures mixtes et cadres

- Fusion native/raster de séparateurs, cellules fusionnées et bande de peinture locale. Blocage d’une peinture mixte si une partie menace l’énoncé. Contrôles ciblés de changement de couleur et résolution, conflit de texte et fermeture hybride.

### 28/11 05:10 · SESSION · T-WB-8 · Recette graphique isolée

- Une figure MIT intégralement protégée et deux partielles. Le raster seul rejoint l’hybride sur la couverture. La fusion des blocs historiques seule ne produit aucun gain. Protocole Edge, chiffres et limites dans V-28-0510-WB.
- Échelle graphique corrigée pour la rotation du viewport avec taille de police C1. Prototype conditionnel documenté et transmis à Hazem dans la PR #26.
