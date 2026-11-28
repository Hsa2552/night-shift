# Tests, qualité et problèmes connus

> Ajout en fin de section. Identifiants : `V-<jour>-<hhmm>-<initiales>` pour une vérification, `Q-<jour>-<hhmm>-<initiales>` pour un problème. Modèles en bas de fichier.
> N'écris ici que des résultats réellement obtenus. Ce qui n'a pas été testé est écrit « non testé ».

## Stratégie de test

- **Logique** (calculs, règles, détection, transformations de données) : tests Vitest, ciblés sur les P0, dans des fichiers `*.test.ts` à côté du code.
- **Composants** : Testing Library, seulement pour les comportements critiques du parcours de démo.
- **Interface sur téléphone** : vérification manuelle structurée, notée ici (appareil, navigateur, étapes, résultat).
- **Avant chaque commit** : `npm run check`. **Sur chaque PR et sur main** : la CI GitHub lance types, lint, formatage, tests et build.
- Parcours de démo vérifié de bout en bout sur main : non

## Vérifications effectuées

### V-27-1959-CC · Socle technique (branche `feat/socle-technique`)

- Par : Claude Code · Commit : voir la branche `feat/socle-technique`
- Commande ou protocole : `npm run check`, `npm run build`, `npm run preview` puis requêtes HTTP sur le site servi, build avec `BASE_PATH=/night-shift/`
- Résultat : types, lint, formatage et test de fumée OK ; build OK ; manifeste servi (nom, icônes 192 et 512, `lang` fr) ; `sw.js`, `registerSW.js` et icônes répondent 200 ; avec `BASE_PATH`, liens, `start_url` et `scope` passent bien sous `/night-shift/`
- Limites : **non testé** : affichage dans un vrai navigateur, installation sur téléphone, fonctionnement hors ligne sur un appareil, exécution de la CI sur GitHub, déploiement Pages

### V-27-2233-WB · Parcours Unspoil dans Edge

- Par : Wael (Codex) · Versions vérifiées en copie d’intégration : interface `4174908`, PDF `9b771dd`, détection `dca91b3`.
- Protocole : `npm run check` (86 tests), build sous Ubuntu avec Node.js 24 et `BASE_PATH=/night-shift/`, puis Edge sur le build de production. Huit PDF synthétiques de `src/detection/samples/` et un PDF graphique synthétique de deux pages sans texte. Émulation tactile à 390 px. Rechargement avec le réseau coupé après activation du service worker.
- Résultat : les quatre classifications et les commandes de masquage répondent comme attendu. Le masque reste aligné au redimensionnement. Le trait avance et remonte au tactile, y compris jusqu’à la seconde page sans texte. Après rechargement hors ligne, le PDF s’ouvre, s’affiche et ses blocs sont détectés et masqués.
- Limites : le premier bloc de `mixte.pdf` laisse visible un trait du graphique (Q-27-2233-WB). Téléphone physique, Safari et installation sur un appareil non testés.

### V-27-2241-WB · Revalidation après le correctif de classification

- Par : Wael (Codex) · Versions vérifiées en copie d’intégration : interface `204ed83`, PDF `9607b59` (rendu inchangé depuis `9b771dd`), détection `9287511`.
- Résultat : `npm run check` passe (97 tests) et le build Ubuntu sous `/night-shift/` passe. Edge confirme le parcours hors ligne et la révélation progressive à la souris et au tactile émulé. Firefox confirme l’import, le masquage, le remasquage et les quatre types sur les fichiers synthétiques correspondants.
- Limites : hors ligne testé sur Edge. Téléphone physique et Safari à vérifier. Le trait du graphique reste suivi dans Q-27-2233-WB.

### V-27-2220-HZ · Détecteur H1 sur données synthétiques (branche `feat/detection`)

- Par : Hazem (Claude Code) · Commit : voir la branche `feat/detection`
- Commande ou protocole : `npm run check` ; tests `src/detection/*.test.ts` sur pages synthétiques générées par `src/detection/fixtures.ts` (aucun vrai PDF)
- Résultat : 60 tests OK. Cas couverts, régions vérifiées ligne par ligne : question puis correction ; alternance avec marqueurs variés ; étapes numérotées dans une correction ; correction dans la colonne de droite ; réponse en fin de ligne ; corrigé regroupé en fin de document ; corrigé seul (découpé, puis non découpable) ; sujet seul ; mot « solution » dans une question ; document ambigu ; document sans texte ; page scannée dans un document mixte ; correction sur deux pages ; QCM à cases cochées et à coche finale ; QCM « Réponse : B » ; déterminisme
- Limites : **non testé sur de vrais PDF**. Conventions reconnues : marqueurs explicites (Correction, Corrigé, Solution, Réponse, Answer, Éléments de correction...) en début de ligne ou suivis de « : » en cours de ligne ; numérotation Partie / Exercice / Question / 1. / 1) / 1.2 / a) ; corrigé en fin de document annoncé par un titre ; titre « Corrigé » en tête de document ; cases cochées de QCM. Non reconnu : corrections sans marqueur textuel (couleur, italique, encadré), texte en image, numérotation décimale du type « 3.14 » prise pour une question

### V-27-2245-HZ · Détecteur sur 8 vrais fichiers PDF générés (banc pdf.js hors dépôt)

- Par : Hazem (Claude Code) · Commit : voir la branche `feat/detection`
- Commande ou protocole : PDF générés par l'équipe avec pdf-lib (`src/detection/samples/generate.mjs`, contenu inventé) ; extraction pdfjs-dist 4.10.38 sous Node (bbox = transformation du viewport à l'échelle 1, hauteur = taille de police) et rendu raster avec @napi-rs/canvas aux échelles 2 puis 1 ; appel de `detectCorrections`. Script du banc non versionné (dépendances hors projet), extraction simplifiée par rapport à `src/pdf/` de Salif
- Résultat : 8 sur 8 classés comme attendu (mixte, couleur, deux colonnes, corrigé en fin, corrigé seul, sujet seul, QCM « Réponse : B », inconnu) ; lignes couvertes par chaque région vérifiées à l'œil dans la sortie du banc. Deux défauts trouvés puis corrigés : document mixte à longue correction classé `correction_only` ; faux avertissement « questions sans corrigé » sur les colonnes côte à côte. `npm run check` : 69 tests OK
- Limites : PDF simples générés par nous, police Helvetica, pas d'annale réelle ; non testé avec `openPdf` de Salif ni dans un navigateur ; un document à réponses en couleur mais aussi titres de corps colorés n'a pas été testé

### V-27-2300-HZ · Temps de détection sur un gros document synthétique

- Par : Hazem (Claude Code) · Commit : voir la branche `feat/detection`
- Commande ou protocole : 100 pages synthétiques (`fakePage`), 45 lignes par page, 4 500 lignes, une correction par question ; `detectCorrections` sans raster, sous Node 24 (tsx) sur le PC de développement, 3 exécutions
- Résultat : 110 à 140 ms par exécution. La mesure a révélé une mauvaise classification (`correction_only` au lieu de `mixed` quand les corrections sont longues), corrigée et couverte par un test
- Limites : machine de bureau, pas de téléphone ; analyse par couleur non mesurée (elle demande le rendu raster de chaque page, coût dépendant du module PDF)

### V-27-2330-HZ · Évaluation avec vérité terrain : fuites et sur-masquage séparés

- Par : Hazem (Claude Code) · Commit : voir la branche `feat/detection-robustesse`
- Commande ou protocole : `UNSPOIL_EVAL_DIR=src/detection/samples npx vitest run src/detection/eval` (outil `src/detection/eval/`, désactivé sans cette variable). Extraction avec `mapTextItem` du module PDF, rendu raster à l'échelle 1 par la fabrique de canvas de pdf.js 6.5 sous Node (`npm install --no-save @napi-rs/canvas`). 15 PDF synthétiques créés par l'équipe, rôle de chaque élément annoté par le générateur (`*.verite.json`). Fuite : élément de correction couvert à moins de 95 % ; sur-masquage : élément d'énoncé couvert à plus de 5 %
- Résultat avant correctifs : type correct 11/15, corrections visibles 45/109, énoncés masqués 0/65. Après : type correct 15/15, corrections visibles 0/109, énoncés masqués 1/65 (bord de la figure de `mixte.pdf` qui chevauche réellement le haut de la question 2 de 0,25 point). Texte seul (`UNSPOIL_EVAL_RASTER=0`) : 13/15, 11/109 visibles (couleurs et figure), 0/65
- Limites : documents créés par nous, donc **aucune mesure de généralisation** ; à refaire sur de vraies annales annotées. Navigateur non testé par cet outil

### V-27-2335-HZ · Défaut Q-27-2233-WB (bord de figure visible dans `mixte.pdf`)

- Par : Hazem (Claude Code)
- Cause : les régions s'arrêtaient avant la ligne de texte suivante ; un graphique de la correction qui descendait jusqu'à cette ligne dépassait du masque.
- Correctif : `src/detection/graphics.ts` suit dans le raster l'encre hors texte qui traverse la limite d'un masque (vers le bas, et vers le haut pour un cadre qui entoure la correction), sans dépasser la moitié de la ligne visible voisine
- Résultat : figure de `mixte.pdf` entièrement couverte, sous Node puis dans Edge avec l'interface (V-27-2355-HZ)

### V-27-2355-HZ · Détecteur avec les vrais modules PDF et interface, dans Edge

- Par : Hazem (Claude Code) · Commit : voir la branche `feat/detection-robustesse`
- Commande ou protocole : copie de travail locale non poussée = `feat/detection-robustesse` + `origin/feat/viewer` (PR #3) ; `vite build` puis `vite preview` ; Edge (headless, playwright-core installé hors dépôt) : import de chaque PDF de `src/detection/samples/`, clic « Masquer les corrigés », capture d'écran et relevé de la position des masques dans le DOM. Également `openPdf` + `detectCorrections` appelés dans la page via le serveur Vite de dev
- Résultat : 15/15 documents avec le comportement attendu dans l'interface. Défauts trouvés ainsi puis corrigés : cadre de `encadre.pdf` visible (ligne précédente non transmise au suivi graphique hors marqueurs en cours de ligne, seuil d'encre trop bas pour un gris clair) ; colonne de réponses de `tableau.pdf` en un seul bloc ; `qcm-cases.pdf` annoncé « Aucun corrigé » à cause de Q-27-2330-HZ (désormais : repli et avertissement). Reste : trace quasi invisible (luminance supérieure à 245) du bas du cadre de `encadre.pdf` ; haut des lettres de la question 2 de `mixte.pdf` légèrement rogné (la figure touche le texte)
- Limites : Edge de bureau seulement ; pas de téléphone ni Safari ; documents synthétiques

### V-27-2306-WB · Parcours intégré, géométrie et lecture progressive

- Par : Wael (Codex) · Branche `feat/viewer`, synchronisée avec `main` (`362ef0e`).
- Protocole : `npm run check`, build Ubuntu avec `BASE_PATH=/night-shift/`, import de huit PDF synthétiques dans Edge et des quatre types de document dans Firefox. Edge en émulation tactile 390 × 844 et réseau coupé après activation du service worker. PDF sans texte de deux pages pour le geste multipage.
- Résultat : 102 tests réussis. Les rectangles partiellement hors page sont limités à la page. Toute région inutilisable maintient le document couvert. Les boutons révèlent et remasquent chaque bloc indépendamment. Un appui simple sur le trait ne révèle rien. Le défilement au bord démarre pendant le glissement et s’arrête au relâchement. L’import, le rendu et l’analyse restent utilisables hors ligne dans Edge.
- Limites : téléphone physique et Safari à vérifier. Le bord du graphique dans `mixte.pdf` reste suivi dans Q-27-2233-WB.

### V-27-2309-WB · Libération des canvas au défilement

- Protocole : build Ubuntu, Edge sur un PDF graphique synthétique de huit pages. Descente à la dernière page puis retour en haut, PDF couvert pendant tout le parcours.
- Résultat : le canvas de la page éloignée repasse à zéro pixel et se recalcule au retour. Les huit masques de couverture restent présents. `npm run check` (102 tests), les parcours Edge et Firefox et le test hors ligne Edge passent après la modification.
- Limites : consommation mémoire globale et temps de rendu sur téléphone physique non mesurés.

### V-28-0005-HZ · Clôture de la phase 2 : main à jour (PR #3 et #8), évaluation et Edge

- Par : Hazem (Claude Code) · Commit : voir la PR #10 (`feat/detection-robustesse`, main `ee99d1d` intégrée)
- Commande ou protocole : `npm run check` (126 tests, 1 ignoré : l'évaluation sans dossier) ; `npm run build` ; évaluation avec la lecture réelle du module PDF (`readPageText`, sans contournement NaN), avec et sans raster ; `vite build` + `vite preview` de la branche, 15 PDF importés dans Edge avec l'interface de main
- Résultat : avec raster, type correct 14/15, corrections hors blocs 6/109 (les 6 cases de `qcm-cases.pdf`, perdues par Q-27-2330-HZ ; le document est classé `unknown` et reste entièrement couvert dans l'interface), énoncés masqués 1/65. Texte seul : 12/15, 18/109, 0/65. Edge : les 15 documents ont le comportement attendu (blocs, libellés, avertissements, repli)
- Limites : corpus synthétique créé par l'équipe ; aucune vraie annale ; téléphone et Safari non testés par moi

### V-28-0115-HZ · QCM corrigés par cases noircies (annales ENSAI « DOC-corrige »), P0

- Par : Hazem (Claude Code) · Branche `feat/detection-generalisation`
- Cause de l'échec initial : cases dessinées (rectangles vectoriels) invisibles au texte extrait ; titre « Correction » répété en tête de chaque page pris pour une correction ; « réponses. » en début de ligne pris pour un marqueur ; numérotation relancée par la seconde session avalée dans une correction.
- Méthode (`src/detection/boxes.ts`, `engine.ts`) : composantes connexes du raster (deux seuils d'encre), case pleine = carré dense, case vide = contour carré à centre clair ; taille de référence prise sur les cases vides ; grilles d'identification exclues (chiffre sous la case) ; emplacements complétés par le texte (suites A, B, C… des propositions et des grilles) et recentrés sur la case dessinée ; un bloc par question et par session (propositions + ligne de la grille) ; même carré blanc pour toutes les cases d'une série ; en-têtes répétés ignorés ; raster en échec = document entièrement couvert.
- Vérité terrain indépendante : opérations vectorielles du PDF (carrés remplis noirs ou blancs). DOC-corrige (1) : **46 cases noircies** (8, 14, 8, 16 par page ; 23 dans les questions, les mêmes 23 dans les grilles) et 74 vides, 80 cases d'identification. Le chiffre de 26 transmis par l'équipe n'a pas pu être reproduit.
- Résultats (cases de réponse visibles / lignes d'énoncé masquées) : 12 annales DOC-corrige distinctes, 6 de développement : 0/602 et 55/476 ; **6 de test jamais ouvertes avant l'évaluation : 1/1012 et 213/1499**, type correct 6/6. Edge avec l'interface : DOC-corrige (1), 120 masques identiques de 14 pt, aucune case noire visible, grille d'identification visible, révélation de « Question 1 » : 6 masques en page 1 et 6 en page 2 retirés, seconde session intacte.
- Limites : une seule convention d'établissement (AMC, ENSAI) ; sur-masquage de 14 % des lignes en test (lettres des propositions dans les cases, marge de sécurité de 1,5 point, consignes) ; non testé sur téléphone ni Safari. PDF ENSAI hors dépôt (droits de diffusion non établis).

### V-28-0120-HZ · Correction d'un défaut de protocole des tests Edge

- Constat : un serveur `vite preview` lancé depuis la copie d'intégration locale n'était pas arrêté par mon script ; les tests Edge suivants ont été servis par ce build-là. **V-28-0005-HZ (phase 2) a donc porté sur le build de la copie d'intégration (`feat/detection-robustesse` + interface de Wael, fusion locale), pas sur la branche à jour.**
- Correctif : script de test qui refuse de démarrer si le port est occupé et arrête le serveur par son port ; tous les résultats Edge de V-28-0115-HZ ont été refaits après correction, port vérifié libre.

### V-28-0125-HZ · Généralisation, corpus réels (phase 3, état intermédiaire)

- Protocole : `src/detection/eval/CORPUS.md` ; dev général 10 annales, test général 12 annales d'autres établissements (annotées à l'aveugle, figées le 28/11 00:28).
- Résultats (corrections visibles / énoncés masqués) : dev 968/2002 et 281/1266 au départ, puis 398/2002 et 661/1266 ; test 691/3348 et 621/2004 au départ, puis 685/3348 et 629/2004, type correct 8/12 puis 10/12.
- Point ouvert : sur le test, documents avec au moins une correction visible 4/9 au départ, 7/9 maintenant ; le détail du test n'est pas consulté pour régler le détecteur, analyse à mener sur le dev. Familles identifiées sur le dev : corrigés sans marqueur (questions puis réponses, retraits), numérotations « A.1. », « VII.1 », « C.I.1. », extraction dégradée (lettres perdues), recueils en deux colonnes.

### V-28-0039-WB · Recette Mako, production et groupes QCM

- Par : Wael (Codex). Build Ubuntu Node.js 24 avec `BASE_PATH=/night-shift/`, puis [recette Playwright](../scripts/verify-mako.cjs) dans Edge sous Windows. Les tests de l’interface sont dans `App.test.tsx` et `viewer/DocumentViewer.test.tsx`.
- Captures : accueil et lecteur clair/sombre en 1440 × 900, 1280 × 800, 768 × 1024, 390 × 844, 360 × 800 et 844 × 390. Le logo et le favicon ont aussi été examinés à 16, 24 et 32 px. [Captures](captures/mako)
- Résultat : dépôt, couverture avant analyse, révélation et remasquage individuels, compteur, thème sans perte d’état ni déplacement, navigation neutre, rectangles alignés au zoom, glissement et clavier passent. Sur 80 pages synthétiques, les canvas éloignés sont libérés sans retirer la couverture. Le nouvel import et l’analyse passent hors ligne après activation du service worker, avec la police et l’exemple local.
- QCM : `qcm-cases.pdf` confirme en navigateur les masques opaques groupés et la commande hors des cases. Un test synthétique de quatre cases confirme l’application du même traitement, la restauration en bloc et le remasquage. Le comportement dépend de la fourniture de toutes les régions par le détecteur.
- Annale externe : [MIT 18.05, examen final 2022](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/mit18_05_s22_exam_final.pdf), 23 pages, ouverte puis analysée localement. Le détecteur a renvoyé un bloc. La vérification porte sur le parcours, sans mesure d’exactitude du bloc.
- Contrastes calculés : 6,75:1 pour le texte secondaire clair, 8,44:1 en sombre, au moins 4,93:1 aux arrêts du bouton dégradé, 9,23:1 pour la commande dans les masques. L’émulation tactile ne valide pas Safari ni un téléphone physique.

### V-28-0200-HZ · BUG-001 (Lyon 2 L2 CCC1, questions colorées, corrections neutres) résolu

- Par : Hazem (Claude Code) · Commits `d386998` (méthode), `e839b26` (intégration du détecteur de Wael), branche `feat/detection-generalisation` à jour de main (`329d297`)
- Cause : aucune correction marquée ; seul le titre « Corrigé » était reconnu, d'où tout le document masqué (ou, avant la phase 3, « Aucun corrigé n'a été détecté »).
- Méthode générique : une teinte qui porte au moins 60 % des questions numérotées et presque uniquement des questions et leurs lignes de suite devient l'encre des questions (aucune couleur supposée) ; chaque question ouvre un bloc jusqu'à la question suivante, un intitulé d'exercice ou un séparateur décoratif ; données avant les questions visibles ; blocs multipages. Fusion avec `analyzeColorPage` de Wael : régions sur une question ou sur la teinte des questions rejetées.
- Résultats (vérité humaine, blocs annotés) : 17/17 blocs entièrement masqués et révélables indépendamment, 0/38 ligne d'énoncé ou de données masquée, type `mixed`. Autre annale de même convention (`lyon2-stat-ccc1`, dev) : 130 → 3 corrections visibles sur 152, 0/46 énoncé masqué. Dans Edge avec l'interface Mako de main : 18 régions (17 blocs, 4.2 sur deux pages), questions bleues, données et définition de F(x) visibles.
- Limites : convention vérifiée sur deux annales du même auteur ; tests synthétiques avec d'autres teintes ; non testé sur téléphone.

### V-28-0205-HZ · Benchmark automatique et intégration du détecteur de Wael

- Par : Hazem (Claude Code) · Commit `e839b26`
- Commande : `npm run benchmark:dev` / `:test` (téléchargement, SHA-256, vrai lecteur et détecteur, rapports Markdown et JSON avec commit, version du corpus, familles, régressions). Partition test téléchargée depuis un cache vide : 12/12 PDF, 36 s.
- Résultats (unités = lignes ou cases ; réussite = aucune correction incomplète, au plus 5 % d'énoncé masqué, pas d'abstention) :
  - dev (11, dont BUG-001) : réussite 3/10 mesurables, abstention 1, taux de fuite 13,1 %, énoncés masqués 50,7 % ;
  - test (12, totaux seulement) : réussite 1/12, abstention 1, fuite 20,5 %, énoncés masqués 31,4 % ; famille « sujet seul » : 0/3 réussite, 36 % d'énoncés masqués (non analysé sur le test, à étudier sur le dev) ;
  - ENSAI dev : fuite 0 %, énoncés masqués 13,0 % ; ENSAI test : fuite 0,1 %, énoncés masqués 14,5 %.
- Intégration du détecteur colorimétrique de Wael par défaut : aucune régression sur les quatre partitions (comparaison automatique du benchmark).
- Limites : vérités dev et test annotées par Hazem seul (pas de second annotateur) ; vérités ENSAI automatiques (opérations vectorielles) ; workflow GitHub `benchmark.yml` non exécuté (à valider par l'équipe).

### V-28-0215-HZ · Améliorations par famille sur le dev (numérotations, extraction dégradée, sections)

- Par : Hazem (Claude Code) · Commits `54e0e7b` (titre de corrigé malgré une extraction dégradée), `fcb54c8` (numérotations hiérarchiques A.1., C.I.1., II.a, VII.1 avec continuité), `c52cf6c` (intitulés « B. Exercice », sous-questions « b. »). Mesures faites sur le contenu de `c52cf6c` (rapport marqué `fcb54c8` + modifications locales, identiques au commit).
- Commande : `node scripts/benchmark.mjs <partition> --cache <cache hors dépôt> --hors-ligne`, raster actif (`@napi-rs/canvas`).
- Résultats, comparés à V-28-0205-HZ :
  - dev (réglages faits sur cette partition) : réussite 3/10 → 7/10 mesurables, abstention 1 → 0, fuite 13,1 % → 0,1 % (2069/2072 corrections entièrement masquées, 3 non masquées dans un document), énoncés masqués 50,7 % → 29,7 % (387/1304) ;
  - test (totaux seulement, aucun réglage) : inchangé, réussite 1/12, fuite 20,5 %, énoncés masqués 31,4 % ;
  - ENSAI dev : fuite 0 %, énoncés masqués 13,0 % ; ENSAI test : fuite 0,1 % (1/1012), énoncés masqués 14,5 % : inchangés.
  - Comparaison automatique : 0 régression sur les quatre partitions ; dev : `tlse-l1pc-2009-corrige` résolu (4/105 énoncés masqués).
- `npm run check` : 179 tests réussis, 2 ignorés ; `npm run build` OK.
- Résultat négatif, non retenu : découper une correction aux questions recopiées en repérant un changement de police dominante a produit 5 régressions sur le dev ; annulé avant commit.
- Suite, commit `63f4d82` (intertitre de la couleur des questions après « ? » masqué avec la correction ; test unitaire qui échoue sans le correctif, vérifié) : dev réussite 8/10, fuite 0 % (2072/2072), énoncés masqués inchangés (29,7 %) ; `lyon2-stat-ccc1` résolu ; test, ENSAI dev et ENSAI test inchangés, 0 régression ; 180 tests, build OK.
- Limites : le gain du dev ne se transfère pas au test (aucune amélioration mesurée) ; restent ouverts le sur-masquage de Bordeaux (309 lignes), labri sans marqueur (73/73 masquées) et la famille « sujet seul » (36 % d'énoncés masqués sur le test, aucun exemple disponible dans le dev).

### V-28-0310-HZ · Phase 4, premier jalon : fusion, conventions locales, QCM, énoncés recopiés

- Par : Hazem (Claude Code). Base : `fd88420` + PR #14 de Wael fusionnée dans la branche (`8cebd09`, sans conflit, 181 tests). PR #15 non fusionnée dans main à 03:10 : main non intégrée.
- Protocole : diagnostic et réglage sur dev et ensai-dev uniquement ; **partitions test et ensai-test non lancées** (évaluation par Salif sur version figée). Commande : `node scripts/benchmark.mjs <partition> --cache <hors dépôt> --hors-ligne`, raster actif. Même corpus et mêmes métriques que V-28-0215-HZ.
- Diagnostic structurel (P0 de Wael, V-28-0211-WB) :
  1. `colorDrafts` ne s'exécutait que si le document n'avait **aucun** bloc : les cases d'un QCM suffisaient à désactiver l'inférence colorimétrique de tout le document hybride (convention unique par PDF) ;
  2. le repli colorimétrique externe n'était pris en compte que pour « sujet seul » : un document `mixed` grâce aux cases ignorait l'encre rouge inexpliquée des pages rédigées ;
  3. la complétion des cases manquantes reposait seulement sur les lettres extractibles A, B, C… ;
  4. famille « énoncés recopiés dans le corrigé » : un bloc de corrigé avalait l'énoncé recopié (Bordeaux, 308 lignes d'énoncé dans un seul bloc).
- Mécanismes et mesures (chacun avec un test unitaire qui échoue sans lui, vérifié) :

| Étape | Commit | dev : réussite / fuite / énoncés masqués / abstentions | ensai-dev : cases visibles / énoncés masqués |
|---|---|---|---|
| Avant (63f4d82 + PR #14) | `8cebd09` | 8/10 · 0 % · 387/1304 (29,7 %) · 0 | 0/602 · 62/476 |
| M1 conventions locales (couleur par unité section × page non expliquée) | `f3a3d8e` | identique | identique |
| M2 contrôle final de la fusion (convergent / contredit / expliqué / ambigu inexpliqué ; mobilier de page et encre avant la 1re question expliqués) | `f3a3d8e` | identique (première version : 2 abstentions à tort sur Lyon, logo répété ; corrigée) | identique |
| M3 cases manquantes par régularité du groupe (interpolation seule) | `5cafcbe` | identique | identique |
| M4 énoncés recopiés (tous les 4-grammes déjà visibles, suites ≥ 2) | `65d8543` | 8/10 · 0 % · **311/1304 (23,8 %)** · 0 | identique |

- Lecture honnête : M1, M2 et M3 n'ont **aucun effet mesurable sur les partitions de développement**, qui ne contiennent ni hybride ni case manquante ; leur bénéfice n'est démontré que sur des cas synthétiques reproduisant les P0 de Wael. Leur effet réel est à mesurer par Salif (ensai-test contient les deux hybrides de 12 pages) et dans Edge.
- Résultats négatifs, non retenus : (a) démasquer les questions par la syntaxe (« ? », verbes d'instruction) dans un corrigé : au mieux +10 lignes d'énoncé visibles, et 4 fuites pour la variante sans « ? » ; (b) lissage séquentiel (ligne courte entre deux lignes visibles) : +2 lignes d'énoncé, **29 fuites** (Toulouse) ; (c) M4 aux seuils 0,6 ou 0,8, ou en suites d'une ligne : 2 à 20 fuites sur Bordeaux, Liège, exo7, labri.
- Conclusion intermédiaire sur la segmentation globale (programmation dynamique O(nK²)) : **non justifiée à ce stade**. Les erreurs restantes du dev viennent d'observations locales insuffisantes (formules courtes, reformulations partielles, corrigé titré sans marqueur chez labri) et non d'incohérences de transitions ; le seul lissage séquentiel testé crée des fuites. Prototype non engagé ; à reconsidérer si les observations vectorielles de Wael apportent de nouveaux coûts locaux fiables.
- Bordeaux, 228 lignes d'énoncé encore masquées : 77 lignes courtes (formules), 87 reprises à moins de 50 %, 64 reprises partielles ; certaines lignes annotées « énoncé » ressemblent à des calculs de corrigé : bruit d'annotation probable (annotateur unique), à confirmer par la validation indépendante de Salif.
- Temps : dev 803 ms par document en moyenne sur une exécution non chargée (`5cafcbe`) ; les mesures à 1,5 s du même soir correspondent à une machine chargée (même écart sur ensai-dev), non à un coût des mécanismes.
- Non vérifié : Edge ; partitions de test ; documents hybrides réels.

### V-28-0415-HZ · Parité Node/Edge du moteur : faux carrés de glyphes et lettres sombres dans les cases

- Par : Hazem (Claude Code). Commits `6829b38` (glyphes), `fc5ce79` (lettre sombre dans une case), mesurés sur `861a75d` (main intégrée, PR #18, #19, #21). Diagnostic sur les seules partitions dev et ensai-dev ; test et réservé non consultés.
- Protocole : benchmark navigateur de Salif (`scripts/benchmark-browser.mjs`, build `--manifest`, Edge, métriques v2, `UNSPOIL_BENCH_INK=1`) et benchmark Node ; croisements texte × raster (Node/Edge) hors dépôt à partir des pages et rasters relevés dans le build Edge (`scripts/pdf-parity.mjs` réutilisé).
- Diagnostic : sur exo7, labri et le sujet de Toulouse, le texte extrait est identique sous Node et Edge ; l'encre des lignes aussi (2 lignes de ponctuation sur 367). Seul le raster change le résultat, par `findBoxes` : le rendu FontFace d'Edge dessine des glyphes en petits carrés pleins ou creux (lettres d'un titre « A. Question de cours », puces « • », « ℝ », « 𝑛 »), reconnus comme cases de QCM. Ces faux blocs perturbaient toute la segmentation (labri : 16 → 7 régions de texte). Second défaut, ensai-dev : dans Edge, la lettre « A » imprimée dans une case vide est plus sombre et faisait rejeter le contour (« centre clair » calculé sur tous les pixels noirs).
- Correctifs, décidés sur le texte extrait et la géométrie, un test unitaire chacun (échec vérifié sans la règle) : forme sur une lettre accolée à une autre (dans un mot, apostrophe comprise) ou sur un signe non alphanumérique autre qu'un symbole de case : glyphe ; lettre isolée dont la forme n'est pas plus grande que le texte (< 1,1 × sa hauteur ; lettres AMC des annales ENSAI de dev : 1,36, lettres de titre : ≤ 0,79) : glyphe ; une case de réponse a une voisine alignée (même rangée, ou même colonne à moins de 20 côtés) ; centre d'un contour jugé sur les seuls pixels de sa composante.
- Première version de la règle d'alignement (rayon de huit côtés) : 5 lignes d'énoncé masquées en plus sur une annale ENSAI (propositions en rangée espacées de 131 points) ; corrigée avant commit.

| Edge, produit réel | Réussites (strictes) | Corrections couvertes | Énoncés masqués | Documents avec fuite |
|---|---|---|---|---|
| dev, `87b6aef` (avant) | 5/10 (2) | 1 984/2 072 (88 visibles : exo7 55, labri 33) | 298/1 304 | 2 |
| dev, `861a75d` | **8/10 (3)** | **2 072/2 072** | 311/1 304 | **0** |
| ensai-dev, `6829b38` | 1/6 | 600/602 (2 cases « A » visibles) | 62/476 | 1 |
| ensai-dev, `861a75d` | 1/6 | **602/602** | 62/476 | **0** |

- Node, `861a75d` : dev 8/10, 2 072/2 072, 311/1 304 ; ensai-dev 602/602, 62/476 : identique à Edge. Le sujet seul de Toulouse est de nouveau présenté comme « sujet seul » dans Edge (0/104 énoncé masqué). Aucun écart entre l'oracle de décision et les masques présentés.
- Temps moyen Edge par document (import et interaction compris) : 2,1 s sur `6829b38`, 4,3 s sur `861a75d` ; non expliqué (transport vectoriel nouvellement raccordé ou charge de la machine), à mesurer à part.
- Non vérifié : partitions test et réservée (évaluation par Salif sur version figée) ; Safari, téléphone.

### V-28-0425-HZ · Cases natives (C1 v1.1) et consignes de notation

- Par : Hazem (Claude Code). Commits `090e86e` (cases natives), `6a78b02` (consigne de notation). Dev, ensai-dev et dev-v2-sujets uniquement.
- Cases natives : `nativeSquares` (Wael) sur `getVectors` complète `findBoxes` ; ajout si le raster montre la case peinte (contour non blanc, seuil 245) ; état natif conservé (`ambiguous` compris, état lu dans le raster). Rappel brut des cases de réponse sur ensai-dev : raster seul 602/602, y compris à demi-résolution : **aucun bénéfice mesurable sur dev**. Bénéfice démontré seulement sur un cas synthétique (case vide pâle, luminance 230, en fin de colonne : visible sans les opérateurs, masquée avec). Aucune régression.
- Consigne de notation : « Solutions that violate … may get partial credit » faisait abstenir le sujet seul de Stanford (indice « corrigé annoncé »). Une ligne de notation (crédit, points, barème, « tiendra compte »…) n'annonce plus un corrigé. dev-v2-sujets : 2/3 → 3/3 ; dev et ensai-dev inchangés.
- Edge, `6a78b02`, produit réel : dev 8/10 (3 strictes), 2 072/2 072, 311/1 304 énoncés masqués, 0 document avec fuite ; ensai-dev 602/602, 62/476 ; dev-v2-sujets 3/3 strictes, 0/292 énoncé masqué. Aucun écart oracle/masques. Temps moyen Edge 2,4 s (dev) : les 4,3 s de `861a75d` relevaient de la charge de la machine.
- Non vérifié : test et réservé (Salif, version candidate `6a78b02`).

### V-28-0655-HZ · Phase 4.3, jalon 1 : couleurs, glyphes et marques natives

- Par : Hazem (Claude Code). Base stable `3709b44` (main avec PR #20, #22 et PR #23 intégrées une fois). Jalon `6f7c4e4`. Partitions : dev, ensai-dev, dev-v2-sujets et diagnostic public `diagnostic-vectoriel-v1` (désigné comme tel par Salif) ; partitions réservées non consultées.
- Protocole : Edge (référence produit), `scripts/benchmark-browser.mjs`, métriques v2 ; ablations par mécanisme désactivé un à un (Node pour les partitions de développement, où Node = Edge, Edge pour le diagnostic).

| Edge | Avant `3709b44` | Jalon `6f7c4e4` |
|---|---|---|
| dev : réussites (strictes), corrections, énoncés masqués | 8/10 (3), 2 072/2 072, 311/1 304 | identique |
| ensai-dev | 1/6, 602/602, 62/476 | **4/6**, 602/602, **20/476** |
| dev-v2-sujets | 3/3 strictes, 0/292 | identique |
| diagnostic : corrections couvertes, énoncés masqués, abstentions | 29/48, 11/24, 0 | **34/48**, **3/24**, 2 |
| Temps moyen Edge | 2,0 à 4,8 s | 1,0 à 2,0 s |

- Ablations (mécanisme retiré → effet) : couleurs natives des lignes → MIT repasse en automatique avec de faux blocs colorés (étiquettes noires sur aplats de figure) et 6/6 corrections visibles ; marques natives (coches, aplats) et gabarits → diagnostic 34 → 13/48 ; cases typographiques → diagnostic 34 → 31/48 ; géométrie native des cases → ensai-dev 20 → 62/476 énoncés masqués, 4 → 1 réussite ; contradiction couleur native / raster dans la fusion → aucun effet mesuré (gardée : complément de la couleur native, test unitaire) ; inférence par portée de question → aucun effet mesuré sur ces corpus (gardée : remplace la règle « page à cases expliquée », test hybride).
- Régression trouvée et corrigée avant commit : les légendes de consigne ENSAI (« Exemple de case bien noircie : ■ », « … mal noircies : □ □ ✓ ⊠ ») devenaient des cases (ensai-dev 20 → 23 énoncés masqués, une réussite perdue) ; écartées (symbole précédé d'un texte terminé par « : »).
- Retirés après ablation, faute de bénéfice : neutralisation des tables des matières, convention de couleur prioritaire sur un titre de corrigé (Virginia Tech s'abstient sans gain de couverture), masquage de l'encre de la teinte des réponses dans la fusion.
- Abstentions du diagnostic : MIT (corrections manuscrites non localisables, abstention correcte) ; Virginia Tech (encre verte sans texte, p. 11, dans une figure : association figure ↔ bloc confiée à Wael).
- Limites : Washington, réponses de tableau en texte noir (3 unités) sans indice physique ; couleur verte de l'aplat visible entre les lettres de la proposition marquée (masque hors lignes de texte seulement) ; Virginia Tech, une case vide fine (1 px au rendu d'échelle 1) non retrouvée dans Edge ; réponses bleues couvertes à 0,88-0,94 de rectangles d'annotation plus hauts que la ligne.
- Pour Salif (métrique, sans modification de ma part) : `groupsWithGeometryCue` compare les masques aux rectangles annotés ; les cases cochées y sont annotées coche comprise (9 pt) et les vides sans (8 pt). Des masques identiques au centième de point par rapport aux vraies cases (vérifié sur Virginia Tech dans Edge) y paraissent distinguables : faux positif d'indice indirect (6 groupes).

### V-28-1115-HZ · Corrigés annotés à la main et QCM cochés d'une croix (documents fournis par l'équipe)

- Par : Hazem (Claude Code), à la demande de Hazem. Commit `e545e68`. Deux PDF fournis localement (dossier « Hackaton » du poste de Hazem), **hors dépôt, non publiés** : un QCM AMC Vrai/Faux à croix tapées (1 page) et un examen de mathématiques corrigé à la main sur tablette (4 pages : options entourées, calculs, dessins, aplats).
- Vérification : visuelle, page par page, sur rendu avec masques opaques (ce que voit l'étudiant) ; pas de vérité géométrique annotée (aucune mesure chiffrée de couverture sur ces deux documents). Résultat Edge identique au résultat Node (mêmes 20 et 207 régions, au point près).
- QCM : 10 blocs (un par question), 2 masques identiques par question (Vrai et Faux), croix invisibles, énoncés lisibles, en-tête AMC non masqué. Avant : 5 questions n'avaient qu'un masque (indice par élimination) et l'en-tête de code était masqué comme des réponses.
- Examen annoté : 13 blocs ; écriture, calculs, dessins et aplats masqués ; figure composée de l'énoncé (question 4) visible ; réponses entourées : toutes les propositions du groupe masquées à l'identique (pas de fragment d'arc visible). Avant : document entièrement couvert (titre « Solutions » lu dans la couche de reconnaissance de l'écriture, repli).
- Mécanismes (généraux, sans règle de fichier ni d'établissement) : case portant une croix tapée = réponse ; case tracée native remplaçant le glyphe « x » vu par le raster ; formes avant la première question exclues ; couche d'annotation = tracés libres peints après tout le contenu visible de la page (aucun document des partitions existantes ne l'active : leurs aplats sont entremêlés au texte) ; texte de cette couche retiré de l'analyse ; étiquettes « (A) » reconnues par le texte ou la forme des parenthèses.
- Non-régression : Edge sur `e545e68`, identique au jalon `6f7c4e4` : dev 8/10 (3 strictes), 2 072/2 072, 311/1 304 ; ensai-dev 4/6, 602/602, 20/476 ; dev-v2-sujets 3/3 strictes ; diagnostic 34/48, 3/24.
- Limites : les propositions d'un groupe dont une est entourée sont masquées en entier (le texte des propositions n'est visible qu'à la révélation) : un cercle serré autour du texte ne peut pas être caché par des rectangles sans en cacher une partie, et un fragment d'arc désignerait la réponse ; une écriture qui chevauche l'énoncé masque aussi cette partie de l'énoncé (question 10 page 2, annotations sur l'énoncé page 3) ; les deux documents ne sont pas dans le benchmark (pas de vérité annotée, documents non publiables).

## Problèmes connus et risques

### Q-27-2218-WB · Génération du service worker bloquée sur le poste Windows de Wael · contourné

- Gravité : le build PWA local ne se termine pas sur ce poste.
- Constat : `npm run build` compile le client, puis Application Control refuse de charger `rollup.win32-x64-msvc.node` lorsque le plugin PWA génère le service worker.
- Contournement : la CI Linux a vérifié le premier jalon et le build Ubuntu du parcours intégré passe.
- Responsable ou tâche : T-WB-1.

### Q-27-2233-WB · Bord du graphique visible dans `mixte.pdf` · ouvert

- Gravité : un élément de corrigé reste visible dans un PDF synthétique de démonstration.
- Reproduction : ouvrir `src/detection/samples/mixte.pdf` dans l’interface intégrée, masquer les corrigés et observer le bas du graphique juste au-dessus de la question 2. Le texte du corrigé est couvert, mais un trait se trouve sous la limite du masque.
- Responsable : détection. Remonté sur [la PR #6](https://github.com/Hsa2552/night-shift/pull/6#issuecomment-7228546114).

### Q-27-2233-WB · Bord du graphique visible dans `mixte.pdf` · résolu

- Constat (Wael) : un trait du graphique du premier bloc restait sous la limite du masque.
- Résolution : suivi des graphiques dans le raster (`src/detection/graphics.ts`), vérifié sous Node et dans Edge avec l'interface et le lecteur à jour de main (V-27-2355-HZ, V-28-0005-HZ). Effet secondaire connu : la figure de ce document touche la question 2, dont le haut des lettres est légèrement rogné.
- Responsable ou tâche : Hazem, T-HZ-2

### Q-27-2330-HZ · Fragments de texte perdus quand pdf.js renvoie des métriques NaN · ouvert

- Gravité : gênant (risque de correction laissée visible)
- Constat et reproduction : pour certaines polices de symboles (ZapfDingbats dans `src/detection/samples/qcm-cases.pdf`), `styles[fontName].ascent` et `.descent` valent `NaN`. `mapTextItem` (`src/pdf/text-geometry.ts`) utilise `??`, qui ne remplace pas `NaN` : le rectangle devient `NaN` et le détecteur ne voit pas le fragment. Une correction écrite dans une telle police ne serait jamais masquée.
- Contournement : dans l'outil d'évaluation seulement (métriques NaN remplacées par les valeurs par défaut). Correctif proposé : `Number.isFinite(style?.ascent) ? style.ascent : ...`, idem pour `descent`
- État au 28/11 00:05 : toujours présent après la PR #8 (`text-geometry.ts` utilise encore `??`). Effet constaté dans Edge sur `qcm-cases.pdf` : le détecteur signale le texte non localisé et l'interface garde le document entièrement couvert (révélation progressive) ; aucune case n'est visible, mais le masquage automatique n'est pas proposé.
- Responsable ou tâche : Salif (module PDF)

## Données de démonstration

L’exercice de l’accueil est le PDF fictif `src/assets/exemple-synthetique.pdf`, signalé dans l’interface et dans le README. Les autres fichiers de la recette viennent du corpus synthétique du détecteur ou sont générés en mémoire par le script de vérification.

## Vérifications du lecteur PDF et de son intégration

### V-27-2218-S · Lecture PDF et cache hors ligne

- Par : Salif (Codex) · Branche : `feat/pdf`.
- Protocole : tests Vitest sur une fixture PDF synthétique, build, puis Edge sur Windows avec le build servi sous `/night-shift/` et un point d'entrée temporaire branché sur l'API PDF.
- Résultat : ouverture et extraction de deux pages de tailles différentes, dont une tournée à 90°, rejet d'un fichier invalide, vérification des indices et fermeture. Dans Edge, les pixels du raster et du canvas redimensionné s'alignent sur les rectangles du texte de test. Après activation du service worker, passage hors ligne, rechargement et nouvel import, résultat identique.
- Limites : annales externes, installation sur téléphone et parcours d'interface intégré non testés dans cette vérification.

### V-27-2226-S · Compatibilité du lecteur avec le détecteur et le visualiseur

- Par : Salif (Codex) · Branches : `feat/pdf`, `feat/detection` (`dca91b3`), `feat/viewer` (`992e8fb`).
- Protocole : build de production avec point d'entrée temporaire assemblant les trois modules. Edge sous `/night-shift/`, puis passage hors ligne et rechargement. Les PDF synthétiques sont ceux de `src/detection/samples/` et une fixture de deux questions avec corrections.
- Résultat : 8 PDF sur 8 classés comme attendu hors ligne, sur les quatre types de documents. L'exemple en couleur appelle `getRaster` et rend trois blocs de correction. Sur la fixture du visualiseur, seuls les corrigés sont recouverts à la largeur de bureau et à 390 px. La révélation et le remasquage agissent sur le bloc sélectionné.
- Correction : avec un canvas opaque par défaut, Edge produisait des franges colorées autour du texte noir et l'exemple couleur passait à tort en sujet seul. L'initialisation du canvas d'analyse avec un contexte RGBA supprime ces franges sans modifier le canvas affiché.
- Limites : montage de vérification distinct du parcours d'import de l'application. Gestes sur téléphone physique, installation mobile et annales externes non testés.

### V-27-2236-S · Parcours de production avec les trois modules

- Par : Salif (Codex) · Versions assemblées dans une copie de vérification : PDF `9b771dd`, détection `86ec9e4` et interface `204ed83`.
- Protocole : `npm run check` et `BASE_PATH=/night-shift/ npm run build`, puis import par l'interface avec Edge sur Windows. Passage hors ligne dès que le service worker est prêt, rechargement et premier import sans réseau.
- Résultat : 94 tests réussis. Sur les PDF synthétiques de Hazem, l'analyse distingue le document mixte avec corrections en couleur, le corrigé seul, le sujet seul et le cas inconnu. Les masques se révèlent et se referment par bloc. Le repli progressif fonctionne à la souris. Un PDF invalide est rejeté. En émulation tactile 390 × 844, le trait révèle la première page, peut revenir en haut et laisse la page suivante couverte.
- Limites : appareil mobile physique, Safari et annales externes non testés. Les trois branches n'étaient pas encore fusionnées sur `main`.

### V-27-2304-S · Géométrie et budgets bitmap sur document multipage

- Par : Salif (Codex) · Branche : `fix/pdf-robustesse`.
- Protocole : tests ciblés sur matrice inclinée, rotation et recadrage, puis build de production sous `/night-shift/`. Dans Edge hors ligne, ouverture d'un PDF synthétique de 80 pages avec une première page recadrée à 15 000 × 8 000 unités et 79 pages ordinaires vides. Lecture séquentielle des dimensions, raster de la page 1, puis rendu à 7 500 pixels CSS avec un ratio demandé de 3.
- Résultat : les dimensions et le repère de l'extraction sont conservés. Le bitmap affiché mesure 3 966 × 2 115 pixels et le raster 2 804 × 1 495 pixels, soit 16 767 920 octets RGBA. Les limites sont de 4 096 pixels par axe, 8 388 608 pixels pour le canvas affiché et 4 194 304 pour le raster d'analyse.
- Temps observés sur une exécution Edge contrôlée : environ 483 ms pour ouvrir le fichier et lire les 80 dimensions et 91 ms pour produire le raster. Le document artificiel est surtout vide. Ces chiffres ne mesurent ni le tas mémoire, ni la performance sur des scans lourds, ni l'autonomie mobile.
- Intégration : 104 tests et build réussis en assemblant le lecteur avec l'interface `0d70cc7`. Import et analyse hors ligne, masques, rejet de fichier invalide et tactile émulé réussis. Déploiement public et smartphone physique non vérifiés.

### V-27-2314-S · Extraction par lots et libération des canvas

- Par : Salif (Codex) · Lecteur `fix/pdf-robustesse`, détection `9287511`, interface `96cce8c`.
- Protocole : test de 250 lignes accentuées sur deux polices. Build de production sous `/night-shift/` et Edge hors ligne. Comparaison du nombre et de la taille des bitmaps après le même défilement des 12 premières pages d'un PDF synthétique de 80 pages de taille identique, avant et après le correctif de Wael.
- Résultat : 91 tests sur la branche PDF, 110 en intégration, builds respectifs réussis. Accents, ordre, police et rectangle conservés lors du passage d'un lot à l'autre. Le parcours des quatre classifications, les masques, le repli progressif et le geste tactile émulé passent hors ligne.
- Rendu multipage : après le défilement, le nombre de canvas non vides passe de 13 à 3 et la capacité RGBA nominale de 59 078 656 à 13 633 536 octets. La première page se rend à nouveau en revenant dessus. Ces chiffres ne représentent pas la consommation totale du navigateur. L'impact du découpage du texte sur le tas et le temps d'analyse n'a pas été mesuré.
- Limites : PDF synthétiques, Edge sur Windows et tactile émulé. Déploiement HTTPS et téléphone physique à vérifier par l'équipe.

### V-27-2342-S · Lecteur sur annales universitaires et build HTTPS

Corpus téléchargé depuis les sites des universités pour les essais locaux. Le dépôt et le build ne contiennent aucune copie de ces annales. Les deux dérivés de test proviennent de MIT OpenCourseWare. [Licence et conditions MIT OCW](https://ocw.mit.edu/pages/privacy-and-terms-of-use/)

| Document original | Octets | Pages avec texte / total | Fragments non vides | Ouverture / extraction / rendus (ms) |
|---|---:|---:|---:|---:|
| [Liège, MATH0013 août 2025, sujet et corrigé](https://www.mmm.ulg.ac.be/files/MATH0013/examens_alg/ExamenAlg_Se25_pub.pdf) | 73 940 | 8 / 8 | 2 595 | 113 / 115 / 137 |
| [MIT 18.05, examen final de probabilités et statistiques](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/mit18_05_s22_exam_final.pdf) | 229 084 | 23 / 23 | 4 602 | 101 / 165 / 102 |
| [Nantes, recueil L1 mathématiques 2012–2013](https://madoc.univ-nantes.fr/pluginfile.php/444678/mod_folder/content/0/Annales%202012-2013/annales%20licence%201/licence1_mathematiques.pdf?forcedownload=1) | 1 458 824 | 27 / 27 | 2 011 | 206 / 171 / 1 396 |
| [MIT 16.30, corrigé manuscrit de contrôle aérospatial](https://ocw.mit.edu/courses/16-30-estimation-and-control-of-aerospace-systems-spring-2004/resources/final_solna/) | 2 691 137 | 0 / 17 | 0 | 215 / 32 / 504 |

- Protocole de mesure — Edge sans fenêtre sous Windows (Core i5-1334U, 16 Go), Node 24.18, build de production sous `/night-shift/`, HTTPS local avec certificat de test. Chaque résultat du tableau est la médiane de trois passages hors ligne. Ouverture chronométrée après l'import du module PDF, extraction séquentielle de toutes les pages et rendu canvas à 600 px CSS à ratio 2 suivi d'un raster d'analyse pour la première, celle du milieu et la dernière page. Les extraits de texte ne sont pas consignés.
- Rendu et géométrie — Au moins une des trois pages échantillonnées de chaque PDF contient de l'encre. Aucun fragment non vide de géométrie non finie. Liège utilise jusqu'à 13 identifiants de police par page. Quatre copies de la première page MIT 18.05 à 0°, 90°, 180° et 270° donnent les dimensions attendues (612 × 792 et 792 × 612 en alternance) et 836 fragments finis.
- Q-27-2330-HZ — Le fichier synthétique `qcm-cases.pdf` de Hazem reproduit des ascendantes et descendantes `NaN` dans PDF.js brut. Après le correctif, ses 15 fragments non vides ont tous une géométrie finie, y compris six fragments de symboles à boîte positive. La reconnaissance du symbole relève du détecteur.
- Charge — Une copie locale comprenant dix répétitions du corrigé manuscrit MIT compte 170 pages et 26 782 662 octets. Sur un passage hors ligne, ouverture 293 ms, extraction 198 ms, rendus des trois pages échantillonnées 466 ms. Après GC forcé, le tas JS mesuré via CDP dans le rendu principal vaut 3 645 152 octets avant, 3 783 728 avec document ouvert et 3 661 564 après fermeture. Ces valeurs ne comprennent pas l'ensemble des processus, les allocations du worker, ni les bitmaps GPU. Elles ne mesurent pas un pic mémoire.
- PWA — Après activation du service worker, rechargement hors ligne puis premier import dans Edge. Les critères d'installabilité du navigateur passent. WebKit 27.2 sous Windows avec profil iPhone émulé passe aussi le rechargement, l'import et le repli progressif sur le scan. Le serveur a refusé les requêtes une fois le réseau simulé coupé. Le build de production et les 111 tests passent.
- Limites — Contrôle échantillonné du rendu sans comparaison pixel à pixel avec un lecteur de référence. Les fragments des équations restent du texte géométrique. Les documents sans couche texte passent par la révélation progressive. Safari sur matériel Apple et l'installation physique ne sont pas validés par WebKit sous Windows. L'adresse publique standard de Pages répondait 404 lors du contrôle. [Portée de Playwright WebKit](https://playwright.dev/docs/browsers#webkit)

### V-27-2348-S · Parité des rasters et mémoire du navigateur

- Protocole — Même build HTTPS local. Comparer les empreintes SHA-256 des rasters RGBA des pages échantillonnées avant et après rechargement sans serveur. Dans un seul profil Edge 158.0.4370.45, ouvrir et fermer trois fois la copie de 170 pages. Relever après GC les octets privés des processus signalés par CDP avec `Get-Process`. Le rendu ne visite que trois pages par cycle, comme dans la mesure précédente.
- Parité — Les neuf rasters de Liège, Nantes et du corrigé manuscrit MIT correspondent bit à bit entre en ligne et hors ligne dans chaque moteur testé (Edge et WebKit). La comparaison se fait à l'intérieur d'un même moteur. Deux variantes non embarquées de Times New Roman ont émis un avertissement de police système. L'essai ne compare pas leur rendu à celui d'une police originale embarquée.
- Mémoire — Total des octets privés d'Edge, en Mo décimaux arrondis. Avant ouverture 312 Mo. Avec le PDF ouvert 534, 556 puis 569 Mo. Après chaque fermeture 462, 486 puis 488 Mo. Le total inclut les autres processus du moteur, dont le GPU et le service réseau, et une partie reste allouée après fermeture. Ces relevés ponctuels ne mesurent pas le pic. Trois cycles ne permettent pas de conclure à une fuite ni à une limite de capacité mobile.
- PDF atypique — Un PDF synthétique chiffré a été refusé sans afficher de canvas. L'ouverture suivante d'une annale de Liège hors ligne a réussi dans le même onglet.
- Intégration — Dans une copie du build avec le détecteur `e784dc1` de Hazem, Edge classe le `qcm-cases.pdf` synthétique en `mixed`, avec deux blocs et aucun avertissement. L'interface affiche six régions masquées et annonce deux blocs hors ligne. La suite d'intégration réussit 127 tests. Le test d'évaluation facultatif passe séparément avec `UNSPOIL_EVAL_DIR` pointant sur les exemples du détecteur.

### V-28-0012-S · Mise à jour du service worker sous deux versions

- Protocole — Générer deux builds sous `/night-shift/` avec des marqueurs distincts et des hashes différents pour le lecteur PDF. Même origine locale, puis remplacer les fichiers servis pendant qu'un onglet de la première version reste ouvert. Installer le nouveau service worker et importer un premier PDF dans cet onglet.
- Avant le correctif — Edge demandait le module PDF de la première version. Le nouveau service worker avait déjà nettoyé ce fichier et le serveur répondait 404. L'application rejetait alors un PDF valide.
- Après le correctif — Edge garde l'ancien service worker actif pendant l'import de l'onglet existant. La nouvelle version s'active après fermeture du dernier onglet et ouvre le PDF sans réseau. Le cache ne contient plus le module PDF de la première version.
- Limites — Deux builds locaux. Le déploiement Pages public et la mise à jour depuis une PWA installée sur téléphone demandent une recette après publication.

### V-28-0221-S · Résilience et confidentialité avec l'interface Mako

- Protocole — Build avec le lecteur, Mako et le détecteur visuel de `329d297`, servi sous `/night-shift/` sur la boucle locale. Profils neufs Edge (Chromium), Firefox et WebKit Windows. Le serveur cesse de répondre pendant la session, puis le navigateur recharge l'application et importe un nouveau document.
- Scénarios — Remplacement d'une ouverture volontairement bloquée, réouverture après PDF invalide ou chiffré, QCM en police de symboles, zoom et thème, rendu annulé pendant son démarrage, rendu multipage sans couche texte et coordonnées finies sur page tournée. Une très grande page conserve sa taille CSS avec un bitmap plafonné.
- Confidentialité — Les requêtes HTTP observées sont des GET sans corps vers l'origine de l'application. Le nom des fichiers de test n'apparaît dans aucun URL observé, ni dans CacheStorage. Le cache de 208 entrées contient des ressources de l'application, dont le worker PDF.js. Le seul stockage local autorisé par le test correspond au thème, et aucune base IndexedDB de document ni clé de session n'est relevée. L'exemple applicatif est synthétique. La page sans texte utilisée pour l'essai contient un lien externe et sa lecture n'a déclenché aucune requête externe.
- Audit — `npm audit --omit=dev` ne signale aucun avis pour les dépendances de production au 28/11. L'audit complet signale quatre entrées modérées rattachées à la chaîne de build Workbox. Elles incluent `glob` et `minimatch`. Les fichiers sélectionnés par les étudiants ne passent pas par ces outils de build. [Avis glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) · [Avis minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249)
- Portée — Inspection des requêtes de l'application et des espaces de stockage web dans les profils testés. Elle ne couvre pas les extensions, les journaux du système ou du navigateur, ni toutes les formes possibles de PDF. Les annonces de compatibilité WebKit concernent Windows. Safari et Chrome sur téléphones physiques restent à tester.

### V-28-0223-S · Huit cycles de lecture, analyse et fermeture

- Protocole — `npm run test:distribution -- performance`, Edge 158.0.4370.45 sous Windows, mode natif activé. L'exemple synthétique de l'accueil reste hors écran pour isoler les fichiers importés. Dans la même session hors ligne, alterner quatre ouvertures du scan de 170 pages avec deux ouvertures du corrigé illustré et deux du document d'algèbre. Pour chaque fichier, extraire toutes les pages, rendre trois pages à 780 px CSS et ratio 2, analyser, mettre le canvas à zéro et attendre la fermeture du worker. Les durées sont des médianes arrondies, et la configuration de la machine figure dans V-27-2342-S.

| Corpus | Cycles | Ouverture (ms) | Extraction (ms) | Trois rendus (ms) | Détection (ms) | Rasters demandés |
|---|---:|---:|---:|---:|---:|---:|
| Scan dérivé de MIT 16.30, 170 pages, 26,8 Mo | 4 | 380 | 247 | 403 | <1 | 0 |
| [MIT 2.007, corrigé illustré](https://ocw.mit.edu/courses/2-007-design-and-manufacturing-i-spring-2009/resources/mit2_007s09_sol_exam01/) | 2 | 295 | 294 | 221 | 566 | 9 |
| Liège, algèbre avec matrices et équations | 2 | 266 | 301 | 214 | 152 | 3 |

- Fermeture — Aucun worker de document après chacun des huit cycles. Du deuxième au dernier cycle, le tas JS après GC est de 4,15 à 4,40 Mo. Les octets privés d'Edge passent de 354 Mo au départ à 542 Mo après le dernier cycle. Le processus GPU passe de 153 à 323 Mo et le processus de rendu de 98 à 126 Mo. Le GPU porte l'essentiel du résiduel observé. Ces instantanés ne suffisent pas à déterminer s'il s'agit de caches du navigateur, d'allocations conservées par son moteur ou d'une fuite. Ils ne mesurent ni le pic, ni la consommation sur téléphone.
- Arbitrage — Le corrigé illustré déclenche neuf rasters. Il s'agit du cas le plus coûteux en analyse. Le cache de ces rasters pendant l'analyse est géré côté détection. Dans le lecteur, le rapport entre densité et mémoire bitmap est quadratique avant plafonnement. Le plafond existant préserve le cadre CSS du document, au prix d'une résolution interne réduite sur les très grandes pages. Deux rendus simultanés à 96 px CSS et ratio 1 valident la faisabilité de petits aperçus. La lisibilité des équations à cette échelle et la protection des aperçus relèvent de la recette de l'interface qui les introduira.

### V-28-0118-WB · Détection colorimétrique indépendante sur quatre documents universitaires

- Protocole : Edge sous Windows, `openPdf`, `getPageData` et `getRaster` sur le serveur Vite local. Déclaration recherchée sur la première page puis analyse isolée par page. Temps du classifieur seul, relevé ponctuel, hors ouverture, extraction et rasterisation. Les PDF n'entrent pas dans le dépôt.
- [Berkeley CS186, examen final 2010](https://hkn.eecs.berkeley.edu/examfiles/cs186_sp10_f_sol.pdf), p. 2 à 4. Annotation visuelle par sous-question, tableau de la p. 3 compté comme une sous-question. Sur 8 réponses, 5 entièrement couvertes, 1 partielle (commentaire rouge couvert, arbre de la réponse visible), 2 visibles (sélections surlignées en jaune). Les 9 zones d'encre rouge annotées sont couvertes sur tous les pixels à dominante rouge (`R - max(G, B) > 18`, `min(G, B) < 230`). Aucun pixel sombre couvert dans les 10 zones d'énoncé échantillonnées. L'arbre et les surlignages restent des indices de réponse. Le classifieur demande le repli p. 4, mais ne signale pas le dessin noir p. 2. Temps des trois pages : 15,5 à 32,1 ms.
- [UCLouvain IEPR1011, janvier 2018](https://perso.uclouvain.be/vincent.legat/documents/iepr1011/iepr1011-examen-janv18-soluce.pdf), p. 2 à 4. Les passages rouges sont des annotations au sein de corrigés également écrits en noir. Aucun masque retourné, corrections laissées visibles par ce détecteur isolé, repli demandé sur les trois pages. Pas de comptage par réponse. Temps : 13,2 à 20,0 ms.
- [Liège MATH0013, août 2025](https://www.mmm.ulg.ac.be/files/MATH0013/examens_alg/ExamenAlg_Se25_pub.pdf), p. 1 à 2. Les pages d'énoncé restent visibles. Sept candidats décoratifs p. 1, aucun masque et aucun repli couleur sur ces pages. Temps : 7,2 à 32,9 ms.
- [MIT 16.30, corrigé manuscrit numérisé](https://ocw.mit.edu/courses/16-30-estimation-and-control-of-aerospace-systems-spring-2004/resources/final_solna/), p. 1 à 3. Aucun fragment textuel, aucun indice couleur ni masque. Les trois pages restent visibles dans le résultat isolé. Le moteur doit conserver son repli pour les pages sans texte. Temps : 4,8 à 5,6 ms.
- Limites : échantillon de pages annotées par un seul lecteur. Les documents du diagnostic initial sont sur la machine de Salif. Aucune mesure de couverture des trois originaux, du moteur intégré ou sur téléphone.

### V-28-0128-WB · Questions bleues et encre noire à Lyon 2

- Protocole : `src/detection/visual/evaluate.mjs` dans Edge avec le lecteur PDF et Vite local. Les quatre pages de [Lyon 2, contrôle de statistique et probabilités 2024–2025](https://perso.univ-lyon2.fr/~rabdesse/Documents/UFR-SEG/LICENCE/L2/CCC1-2024-2025.pdf) sont mesurées à 612 × 792 pixels. Vérité couleur indépendante issue de la couleur PDF `#0012FF` (23 fragments, 9/5/5/4 par page) et de 7 rectangles neutres échantillonnés visuellement dans les données et les réponses. Le mode d’évaluation est décrit dans `src/detection/visual/README.md`.
- Résultat brut : 23/23 fragments bleus appuyés par une observation à 235° et 7/7 zones neutres avec de l’encre neutre signalée. Les composantes des logos restent dans le relevé chromatique indépendamment de leur rôle.
- Résultat du passage de masquage isolé : 0 masque sur les quatre pages (contre un bloc p. 1 dans le jalon précédent). Les énoncés et données initiales restent visibles. Les corrections noires restent visibles dans ce résultat isolé, sans comptage de toutes les corrections. Le repli est signalé p. 1 et 4. L’intégration doit utiliser les transitions chromatiques et la structure des exercices.
- Temps : 15,8 à 38,4 ms par page sur un passage de l’évaluateur, analyse seule. Berkeley p. 2 à 4 revérifié après le changement : mêmes 5 réponses entièrement couvertes, 1 partielle, 2 visibles, 0 des 10 zones d’énoncé touchée. Aucune mesure sur téléphone, ni du moteur intégré avec le nouveau relevé.

### V-28-0129-WB · Audit complémentaire des cases QCM

- Protocole : branche de Hazem `7aa6daf` en copie temporaire, Edge local, recueil ENSAI de 28 pages disponible chez Wael. Vérité géométrique indépendante extraite des rectangles vectoriels noirs et blancs de 10,7 points de côté. Comparaison avec les régions de masquage retournées. Le PDF et ses annotations sont conservés localement. Cette évaluation porte sur le module de Hazem.
- Résultat : 226/226 cases noircies entièrement couvertes, 0 partielle, 0 visible. Huit cases non noircies de propositions à masquer restent partiellement couvertes (2) ou visibles (6). Elles ne correspondent pas à une boîte reconnue dans le raster à ces positions. Ces différences donnent un indice indirect par élimination. Aucun comptage vérifié des énoncés masqués à tort sur ce document. Temps du moteur sur 28 pages : 2 041 ms lors du passage sans instrumentation supplémentaire, dont 913 ms pour les rasters.
- Signalé à Hazem dans la PR #13. Aucun deuxième détecteur géométrique de QCM développé sur cette branche.

### V-28-0211-WB · Recette P0 du produit intégré sur annales réelles

- Build testé `ef23fa2f25c3066350534472352fc2a63455cec0`, base `329d2973609fb8c6babfd92fa6611416e7cc8d3f` et moteur `54e0e7b4e399625310e4c2efb15cecf40c1b9da0`. Production Ubuntu sous `/night-shift/`, Edge 1440 × 900 avec profil neuf et port local distinct. Le SHA lu dans le HTML correspond après rechargement hors ligne. La couverture V8 du bundle confirme les appels effectifs à l’analyseur couleur lors de l’action « Masquer les corrigés » (12 et 4 sur les annales ENSAI, 4 sur Lyon 2). L’analyseur est désormais enregistré par défaut dans le moteur.
- Protocole des mesures ENSAI. Vérité indépendante issue des carrés vectoriels des propositions et grilles, des fragments de correction rouges et des fragments d’énoncé du PDF original. Les cases vides et pleines de chaque groupe de réponses figurent dans les unités à neutraliser. Les grilles d’identification figurent dans les unités à préserver. La recette recueille les rectangles visibles dans le DOM, puis déduit le rattachement aux blocs en activant chaque commande. Calcul avec `scoreGeo` de Hazem, seuils de couverture à 95 % et 5 %. Les PDF, annotations locales et captures restent hors du dépôt. Les unités sont des fragments et des cases, distinctes du nombre de réponses.
- Comparaison avec `329d2973609fb8c6babfd92fa6611416e7cc8d3f` avant intégration du moteur. Les deux builds ont été construits et servis séparément. Le build de référence ne contenait pas encore de métadonnée SHA.

| Document et build | Unités entièrement / partiellement / non couvertes | Énoncés touchés selon le seuil | Blocs indépendants |
| --- | ---: | ---: | ---: |
| ENSAI hybride, 12 p., `329d297` | 124 / 0 / 1 427 sur 1 551 | 354 / 3 746 | 0 / 34 |
| ENSAI hybride, 12 p., `ef23fa2` | 347 / 0 / 1 204 sur 1 551 | 0 / 3 746 | 16 / 34 |
| ENSAI QCM, 4 p., `329d297` | 71 / 7 / 26 sur 104 | 576 / 916 | 0 / 10 |
| ENSAI QCM, 4 p., `ef23fa2` | 103 / 0 / 1 sur 104 | 0 / 916 | 7 / 10 |
| Lyon 2 L2, 4 p., `ef23fa2` | 70 / 0 / 0 sur 70 | 0 / 38 | 17 / 17 |

- Hybride. Sur les p. 1–4, 103/1 303 fragments rouges couverts. Sur les p. 5–12, les 66 cases noircies des propositions et de la grille à 26 lignes sont couvertes. Les 40 cases d’identification restent visibles. Quatre propositions conservent une case vide visible, ce qui donne un indice par élimination. L’analyse prend 3,68 s sur ce passage navigateur.
- QCM à deux sessions. Les 22 cases noircies et les deux grilles de réponses sont couvertes. Les 80 cases d’identification restent visibles. Une case vide de proposition reste visible dans la seconde session et donne un indice. Les numéros répétés ont des commandes distinctes, mais trois groupes sur dix échouent encore au critère géométrique d’indépendance. L’analyse prend 0,82 s sur ce passage.
- Deux annales ENSAI sur deux s’affichent en mode automatique avec des fuites. Sur six PDF testés dans Edge, seul le corrigé manuscrit MIT s’abstient. Le document reste entièrement couvert et la révélation progressive n’expose que la première page au premier déplacement. Les essais confirment la couverture à l’ouverture, l’opacité, l’alignement au zoom, le rendu de la dernière page, le remasquage et la reprise de l’import et de l’analyse hors ligne.
- Corpus indépendant de Hazem sous Node, même SHA et arbre propre. 1/12 documents réussis automatiquement, 1/12 abstention, 2 663/3 348 unités entièrement couvertes, 36 partiellement, 649 visibles. Le moteur masque 629/2 004 lignes d’énoncé au-delà du seuil. Sur Savoie INFO201, le benchmark couvre 101/101 corrections et masque 55/86 énoncés. Le produit dans Edge couvre 51/101 corrections, laisse 4 partielles et 46 visibles, et masque 5/86 énoncés. L’appel direct au moteur confirme l’écart avant le visualiseur (11 blocs et 16 régions sous Node, 8 blocs et 27 régions dans Edge). Les empreintes des rasters et des fragments diffèrent bien que leurs dimensions et effectifs concordent. La cause fine de l’écart reste à isoler. Sur le sujet MIT 18.05, 77/434 unités d’énoncé masquées sont reproduites dans Edge.
- La vidéo locale montre `QCM3.pdf` et une URL de développement sur le port 5173. Le nom et le texte observable ne confirment la correspondance avec aucun des deux PDF fournis. Le SHA de la vidéo ne peut pas être établi.

P0 transmis à Hazem, dans l’ordre :

1. Le passage couleur indique une incertitude sur chacune des quatre pages rédactionnelles. Le moteur exploite ce signal pour `statement_only`, mais son classement `mixed` sur les blocs AMC permet de laisser les réponses rouges visibles. Décider de la couverture par exercice ou conserver le document couvert tant qu’une convention plausible reste sans résolution.
2. Les cinq cases vides résiduelles sont absentes de la sortie brute de `findBoxes`. Vérifier la complétude de chaque groupe avec le contexte et les emplacements voisins avant de rendre un résultat automatique. Une grille de réponses reliée doit suivre le bloc de son groupe et de sa session.
3. L’écart Node/Edge exige une vérification navigateur représentative pour conclure sur l’utilisabilité. Un contrôle des entrées du détecteur doit isoler les différences textuelles et raster, puis établir leur contribution.

Les PDF aveugles supplémentaires ont été demandés à Salif. Cette recette repose sur Edge sous Windows pour l’affichage. Téléphone physique et Safari restent à vérifier. L’interface rejette désormais un résultat contradictoire `statement_only` contenant des blocs et conserve la couverture progressive. `npm run check` passe avec 171 tests réussis et 2 évaluations optionnelles ignorées. Le build de production réussit.

### V-28-0319-WB · Perception vectorielle et comparaison avec les cases raster

- Par Wael (Codex). Protocole et sources dans `research/pdf-vector/`. Référence raster dans Edge sur `edf4b92`, avec le lecteur réel et `findBoxes`. Prototype Edge PDF.js 6.5.438. L’évaluateur consigne aussi les empreintes des sources mises en service.
- Deux annales ENSAI de diagnostic, 12 et 4 pages. Référentiel géométrique de 288 et 184 carrés relevés sur les objets natifs, comprenant des cases d’identification. Appariement un à un, IoU minimale 0,60. Le laboratoire Python avec confirmation raster et le prototype PDF.js retrouvent les 472 cibles dans leur état attendu, médiane IoU 1,000. `findBoxes` brut en retrouve 240 et 151, dont les 88 pleines. Il manque 81 vides, avec 602 et 54 candidats non appariés (autres carrés ou décalages). Le protocole avantage la géométrie native et ne mesure pas la segmentation finale.
- Contrôles publics. Virginia Tech présente 41 glyphes carrés et 20 coches, sans contour carré natif. Washington présente des réponses signalées par un fond vert autour de cases identiques. Sur Lyon 2, les 17 spans natifs bleus éligibles concordent avec le raster et PDF.js relève le même RGB. Liège et Illinois donnent zéro candidat carré, Berkeley un candidat ambigu. Le scan MIT n’a ni texte ni carré natif.
- Temps cumulés. Référence brute raster et cases de 521 et 154 ms. Opérateurs PDF.js et normalisation en 149 et 66 ms. Chronométrages hors ouverture, à interpréter selon les opérations mesurées.
- Limites. Les états TypeScript restent à confirmer après composition. Les vrais PDF publics servent aux contrôles ponctuels, sans inventaire annoté exhaustif de leurs objets. Les partitions réservées de Salif, les masques de bout en bout, Safari et les appareils physiques sont hors de ce relevé. Proposition hybride et interface de revue dans la PR #16.

### V-28-0323-WB · Deux pages publiques annotées depuis le rendu

- Protocole. Annotation visuelle indépendante des boîtes et états, appariement à IoU 0,60. Voir `research/pdf-vector/public-truth/` pour les deux pages et les empreintes des PDF.
- Virginia Tech p. 15. `findBoxes` apparie 11/15 cases et renvoie toutes les cochées comme vides. Les glyphes PyMuPDF apparient les 7 cochées et 3 des 8 vides. À IoU 0,50, les 15 glyphes sont appariés dans leur bon état, avec une médiane IoU 0,608.
- Washington p. 1. Les 4 cases s’apparient dans les comparaisons PDF.js et raster. Les états raster sont tous « vide » et les états natifs sont ambigus. Les trois marqueurs verts apparaissent dans le relevé PDF.js parmi les rectangles englobants. Le raster fournit 88 candidats en dehors des quatre cibles de la page.

### V-28-0301-S · Référence dev et divergence Savoie Node–Edge

- Protocole — `8cebd095e18b4526180a2ecb28f2830be9f065f2` construit depuis un checkout propre. Corpus historique `c74560353248`, mêmes PDF et annotations. Node 24.18.0 avec `@napi-rs/canvas` 1.2.1, Edge 158.0.4370.45 Windows et PDF.js 6.5.438. Mesures géométriques et d'encre `unspoil-geo/2` calculées sur les sorties de ce SHA, avant les évolutions suivantes du moteur.

| Référence dev historique | Mesurables | Réussites | Abstentions | Couverture brute ≥ 95 % | Couverture stricte brute | Zones de correction avec encre visible |
|---|---:|---:|---:|---:|---:|---:|
| Node | 10/11 | 8/10 | 1 | 2 072/2 072 | 2 053/2 072 | 0 |
| Edge | 10/11 | 5/10 | 1 | 1 984/2 072 | 1 968/2 072 | 88 |

- Le rapport v1 donnait zéro abstention Node. Bordeaux fournit 438 zones couvertes au seuil historique, mais demande la lecture progressive. Avec v2, les 438 zones restent dans le score brut et le parcours est compté comme abstention. Aucune divergence entre l'oracle et le parcours réellement observé sur les 11 documents importés sous Edge.
- Toulouse est présent, HTTP 200, et le SHA-256 du manifeste correspond. Les 111 rectangles comprennent 104 unités `q` et 7 titres `t`. Node présente « sujet seul » avec 0/104 unités masquées. Edge présente le masquage automatique et touche 3/104 unités au seuil historique. L'unique document non mesurable est `ens-sleurent-stats`, dont les plages ont toutes le rôle `m`. Aucun téléchargement ni contrôle d'empreinte n'a échoué. La vérité Toulouse est inchangée.
- Savoie, test historique exposé exclusivement pour le diagnostic. Même PDF `c6b2a674…`, annotation `72bd9a27…`, mêmes résultats à `ef23fa2` et `8cebd09`. Node/Node et Edge/Node couvrent 101 unités sur 101. Node/Edge et Edge/Edge couvrent 51, avec 4 couvertures partielles et 46 absentes. Le vrai bundle Edge donne le même résultat et la même empreinte que le croisement Edge/Edge. Les fragments, leur ordre, leurs boîtes, les tailles et la reconstruction des lignes concordent après normalisation du préfixe d'identifiants de police. Les cinq rasters font 595 × 842 pixels sous les deux moteurs. Sur la première page, le RVB diffère sur 34 415 pixels, dont 8 525 changent de classe avec le seuil d'encre. Les observations d'encre changent avec le raster et restent identiques en échangeant le texte.
- Les contrôles Node sur la transformée, les ressources et les polices système ne font pas basculer la sortie. Dans Edge, le contrôle par le module PDF.js brut et le worker du build reproduit les cinq rasters de production pixel pour pixel. Désactiver uniquement les polices système donne les mêmes rasters. Activer `disableFontFace` avec les polices système toujours coupées bascule la sortie de 51 à 101, avec exactement l'empreinte du résultat Node. Le chemin de rendu des glyphes FontFace explique donc l'écart de verdict sur cette annale. Ce contrôle n'implique pas que les rasters Node et Edge en tracés sont identiques. Le mode de rendu du produit reste la référence de classement, et aucune heuristique n'est calibrée sur Savoie.
- Pages était désactivé et l'URL HTTPS standard répondait 404. Le workflow du dépôt est prêt. La vérification du SHA public et l'installation physique attendent l'activation et des appareils.

### V-28-0310-S · Extension sujets seuls et corpus réservé gelé

- La partition `dev-v2-sujets` ajoute Paris-Saclay, Strasbourg et Stanford, avec 292 unités d'énoncé. Les plages ont été relues sur les originaux. Les rectangles proviennent de l'extraction PDF.js sans sortie du détecteur. Sur le moteur `5cafcbe` dans Edge, 2/3 sont montrés comme sujets seuls, 1/3 passe en révélation progressive, aucune erreur et aucun énoncé touché au seuil historique. La recette Node sur le même moteur donne les mêmes modes.
- Le chargeur Node `pdfjs-native-canvas/2` reçoit les répertoires de ressources de la distribution PDF.js, dont WASM. Un scan JBIG2 présentait un rendu vide sous le chargeur Node dépourvu de cette ressource. Le rendu de préparation lit bien les images après ajout du répertoire. Le chargeur Node applique désormais la transformée et la limite raster du lecteur. Les rapports identifient son nouveau profil. Le canvas Node reste distinct de celui du navigateur.
- Corpus réservé v1, gelé le 28/11 à 03:08 Paris avant exécution du détecteur, engagement SHA-256 `544258e372f586fd29e291bd48e8e52946c879bb82af63f6f3a79e2e41f63730` sur le manifeste qui inclut les empreintes des PDF et des annotations. Cinq documents, onze pages échantillonnées et 100 unités visuelles annotées sans prédiction. Familles représentées : sujet seul, alternance, corrigé en fin de partie, QCM vectoriel, document hybride, figures et scan manuscrit. Le panel ne comprend pas de QCM non vectoriel vérifié.
- Edge sur le build candidat propre `5cafcbe`, avec métriques v2. Les 5 documents sont mesurables. Un parcours est une réussite stricte, un est en lecture progressive, trois présentent une autre issue infructueuse. Aucune erreur technique et aucun écart entre oracle et mode/masques observés. Ces chiffres décrivent un échantillon de pages. Les PDF, annotations, choix de pages et résultats individuels restent hors du dépôt.

### V-28-0322-S · Vérification croisée du build de la PR #17

- Les rapports Node et Edge sur le checkout propre `9615001`, moteur de Hazem `65d8543`, ont le même format, les mêmes onze documents et les mêmes empreintes d'annotation. L'ENS sans unité évaluable explique la seule exclusion. Aucune erreur technique ni différence entre oracle et parcours réellement observé dans Edge. La recette d'ouverture et d'analyse après rechargement hors ligne passe sur `fb47938`, qui contient le même code produit.
- Edge produit 5 réussites sur 10, dont 2 strictes, et 1 abstention. Au seuil historique, 1 984/2 072 unités de correction sont couvertes et 298/1 304 unités d'énoncé touchées. Le témoin Edge `8cebd09` comptait 372 unités d'énoncé touchées et les mêmes totaux de réussites et de corrections couvertes. Toulouse affiche encore des masques sur 3/104 unités d'énoncé dans le vrai parcours.
- Node avec le chargeur v2 produit 6 réussites sur 10, dont 2 strictes, et 1 abstention. Il couvre 2 059/2 072 unités de correction et touche 317/1 304 unités d'énoncé. Le profil de rendu diffère du benchmark Node historique, donc l'écart de score Node entre les deux références mélange les changements de moteur et de chargeur.
- La recette refuse une empreinte d'annotation discordante avant d'évaluer le PDF. À 03:22, la PR #15 était toujours ouverte, le dépôt public et Pages désactivé. Aucune mesure d'un SHA publié ni validation sur téléphone physique.

### V-28-0358-WB · Rattachement des couleurs natives au texte C1

- Protocole. PDF.js 6.5.438 dans Edge. Référence PyMuPDF `rawdict` restreinte aux fragments localisés de façon unique. Comparaison avec `observePageInk` sur le raster, teintes à 15°. Huit documents hors partitions réservées, dont les deux ENSAI de diagnostic.
- Résultats. 9 958 fragments sur 10 470 ont une couleur résolue. Les 9 936 de ces fragments vérifiables correspondent exactement à la référence, dont deux bicolores. 204 fragments ambigus et 308 sans association. Sur Lyon 2, 61 des 75 fragments bleus sont associés, contre 75 observés dans le raster. Sur Berkeley, 135 des 135 fragments chromatiques concordent côté natif et 134 côté raster, qui relève aussi une teinte sur 46 fragments neutres de référence. Le scan MIT ne fournit aucun fragment.
- Temps natif médian par page textuelle de 8,3 à 14,7 ms selon le document, hors extraction initiale du texte. Limites et commandes dans `research/pdf-vector/NATIVE-TEXT.md`. Aucune mesure de couverture des corrections ou de raccordement à l’application.

### V-28-0407-WB · Précision des cellules de glyphes et placements d’images

- Protocole. Edge et PDF.js 6.5.438. Boîtes de Virginia Tech p. 15 annotées depuis le rendu. Placements du scan MIT comparés à `get_image_info()` de PyMuPDF.
- Virginia Tech, 20/20 coches avec un recouvrement selon les cellules de glyphes. P. 15, 15/15 cadres à IoU 0,50 et 11/15 à 0,60, avec les 7 coches dans les deux cas. À 0,50, médiane IoU 0,608. Le raster avait 11/15 cadres à 0,60 et traite les 7 coches comme vides. Washington p. 1 expose les trois fonds verts qui couvrent les cases attendues.
- Scan MIT, 37/37 placements à IoU 0,90, médiane 1,000. Règles, trajectoires et surlignages testés sur contrôles synthétiques. La géométrie et les relations n’attribuent aucun rôle. Aucun test de couverture des corrections avant raccordement C1.
- Passage après synchronisation `aac0adf`. Latence médiane native par page de 6,9 à 14,0 ms par document textuel et 38,5 ms pour le scan. La rasterisation et son analyse sont mesurées à part dans le rapport de laboratoire.

### V-28-0359-S · Commandes de révélation et disponibilité du site HTTPS

- Protocole — Build local de production `da87ece` pour la reproduction, puis `npm run build` sur la branche de correctif. Edge sous Windows, 1440 × 900 et 390 × 844, zoom 150 %, défilement rapide entre première et dernière page. Liège MATH0013 (8 pages, 6 blocs), corrigé de Toulouse (6 pages, 27 blocs dont 95 régions groupées), Lyon 2 (aucun masque sur ce build) et QCM synthétique `qcm-cases.pdf` (2 blocs groupés, 6 régions).
- Avant — Toulouse passe de 5 à 4 puis 5 commandes intégrées aux masques après redimensionnement et zoom. Une commande est démontée puis remontée en pied de page. La commande s'y déplaçait aussi lors de la révélation d'un bloc intégré. La barre supérieure reste visible dans les essais, mais « Masquer les corrigés » reste désactivé lorsque des blocs sont révélés, car l'état automatique suffisait à le désactiver.
- Après — Aucun nœud de commande remplacé au changement de largeur ou de zoom. Chaque bloc garde une commande en pied de sa première page. Les masques groupés se révèlent et se remasquent ensemble. « Masquer les corrigés » remasque les blocs déjà révélés sans nouvelle analyse. Les bascules vers la lecture progressive repartent de pages couvertes. Importations, remplacement et analyse hors ligne vérifiés. `node scripts/verify-viewer-controls.mjs <URL locale> assert <PDF> <PDF> …` reproduit la recette.
- Distribution — Pages est en service, HTTPS imposé, déploiement `da87ece` confirmé par GitHub Actions. Le SHA-256 du module JavaScript public correspond au build local propre. Dans Edge en émulation tactile, après précache initial, rechargement, import et analyse réussissent hors ligne sur l'URL HTTPS. Installation et essais sur appareils physiques restent à effectuer. [Déploiement](https://github.com/Hsa2552/night-shift/actions/runs/46099507179)

### V-28-0422-S · Transport seul, parité vectorielle et couverture du diagnostic

- Comparaison à moteur inchangé entre `87b6aef` et `afb48b0`, même corpus dev et mêmes empreintes d'annotation, métriques v2. Les résultats par document concordent dans chaque environnement, hors durée et journal des demandes. Edge compte 5 réussites et Node 6 sur 10 documents mesurables. Le moteur de cette comparaison n'appelle pas le fournisseur vectoriel.
- Build propre `23f906d`, PDF.js 6.5.438, Edge 158.0.4370.45 et Node 24.18.0. Comparaison directe du transport enrichi par document sur Washington, Virginia Tech, Lyon 2, Liège, MIT 16.30 et le scan dérivé de 170 pages. 223/224 pages concordent après normalisation des identifiants de police par document. Les dimensions et les candidats `nativeSquares` concordent sur 224/224. Liège p. 1 diffère sur `fill` pour trois rectangles et trois peintures de texte. Le rapport associe les empreintes des PDF et les deux empreintes de vérités visuelles de Wael lorsque disponibles.
- Aucun worker du document après chacune des six fermetures. Le tas JS après GC va de 3,76 à 3,90 Mo après le premier document. Une fermeture pendant l'appel invalide le résultat en cours. La lecture native à froid après rechargement hors ligne réussit sur Washington. Le scan de 170 pages demandé intégralement prend environ 42 s côté Edge dans cette passe. Cette mesure exclut l'ouverture et ne mesure pas la mémoire native de tous les processus. L'extraction est à la demande. La déduplication de PDF.js ramène le premier paquet vectoriel de 451 à 7,6 ko, puis l'extracteur enrichi atteint 20,2 ko (7,6 ko gzip).
- Témoin avant consommation des vecteurs, `23f906d`. Le diagnostic public annote 48 unités de correction et 24 d'énoncé sur quatre extraits. Couverture stricte dans le parcours Edge : 7/10 cases remplies ou signalées, 8/9 cases vides, 6/11 zones de texte, 8/10 formules, 0/5 figures ou aplats, 0/3 zones de tableau, 7/14 blocs indépendants. Deux des huit groupes de QCM ont un indice de réponse selon le score géométrique. Les documents ENSAI privés ne sont pas disponibles sur cette machine. Le résultat ne couvre ni leurs corrections rédactionnelles ni les pages non annotées du diagnostic public.
- Corpus réservé v1 toujours figé. Sur `23f906d`, 4/5 traités automatiquement, 3/4 échouent strictement et 1/4 présente une correction incomplètement masquée au seuil de 95 %. Une lecture progressive et aucune erreur technique. Seules les mesures agrégées sont partagées. Le dev historique donne 8/10 réussites (3 strictes) avec 2 072/2 072 corrections brutes couvertes.
- Pages sert `65ac20d09ba0abdb149284943ddb372309c56b2e`, confirmé par le workflow et le marqueur HTML public. Le lecteur démarre et analyse Lyon 2 après coupure de réseau et rechargement dans Edge en émulation tactile. Téléphones physiques et installation système restent à vérifier. [Déploiement](https://github.com/Hsa2552/night-shift/actions/runs/46101896870)

### V-28-0428-WB · Géométrie adaptative et séparation des lignes

- Protocole. Vrai `layoutPage` et reconstructions sur les mêmes fragments PDF.js. Cinq pages de quatre PDF publics, 81 lignes annotées sur le rendu. Cinq cas synthétiques et cinq transformations, sans accès aux partitions réservées.
- Sur les pages publiques, lignes mélangeant deux colonnes ou cellules de 7 à 1. Concordance de l’ordre 581/655 en référence, 630/655 avec XY-Cut, 586/655 pour les voisins. Blocs à IoU 0,50 de 5/14 à 7/14 avec les deux méthodes, avec des régressions selon les pages.
- Les voisins retrouvent 18/18 blocs synthétiques de base et 18/18 sous transformations. XY-Cut retrouve 3/18 et 7/18. Le graphe et la proximité brute donnent 3/3 relations synthétiques. Voir `research/document-layout/`. Les observations ne mesurent pas la couverture des corrections.

### V-28-0430-S · Premier moteur hybride dans le lecteur et distribution du visualiseur

- Build propre `bd12a06`, intégrant les cases natives de `090e86e` et le correctif distinct `6a78b02`, observé dans Edge 158.0.4370.45 et Node 24.18.0. Les rapports v2 enregistrent le SHA, l’empreinte de chaque PDF et annotation et les modes réellement présentés. Dans Edge, les observations sont demandées sur 132 pages du dev, 42 du diagnostic public et 39 du réservé. La comparaison avec `23f906d`, document par document sur ces trois partitions, ne révèle aucun changement de verdict ou de couverture avec les cases natives. Le gain a été observé dans le test synthétique des cases pâles.
- Dev historique dans Edge : 8/10 réussites, dont 3 strictes, et 1 abstention. Les trois sujets seuls de l’extension sont classés sans masque sur 292 unités d’énoncé. Cette amélioration vient du correctif des consignes de notation. Les extraits publics conservent 29/48 corrections entièrement couvertes à 95 %, sans réussite stricte sur quatre documents. Le réservé conserve 1 réussite stricte sur cinq et 3 échecs stricts sur les quatre parcours automatiques. Le passage au vecteur a été vérifié hors ligne.
- Test historique agrégé sur le build intégré `3709b44`, avec douze PDF publics dont les empreintes sont vérifiées. Aucun écart entre l’oracle et le parcours affiché dans Edge. Le tableau relève les corrections visibles au seuil de couverture de 95 % dans les parcours automatiques. Le recueil de Nantes avait dépassé le délai de 30 s du script. Avec un délai de 120 s pour l’analyse, la mesure dans Edge a pris 56,6 s, ouverture comprise.
- Reproduction depuis ce SHA. Construire avec `BASE_PATH=/night-shift/` et `npm run build -- --manifest`. Télécharger ou vérifier le corpus avec `node scripts/benchmark.mjs test --cache <cache externe> --out <sortie externe>`. Lancer `node scripts/benchmark-browser.mjs . test <cache externe> <rapport externe.json>` avec `UNSPOIL_BENCH_INK=1` pour mesurer aussi l’encre apparente. Le rapport indique l’empreinte du manifeste, le SHA complet du build et les empreintes document par document.

| Environnement | Mesurables | Traités automatiquement | Réussites à 95 % / strictes | Abstentions | Automatiques avec correction visible |
|---|---:|---:|---:|---:|---:|
| Edge | 12/12 | 8/12 | 0 / 0 | 4 | 6/8 |
| Node | 12/12 | 8/12 | 0 / 0 | 4 | 6/8 |

- La PR #22 est déployée sur Pages. Le marqueur public du build corrigé correspond à `5ad305c4b73de1ec83b85f55443cac02d86ebea5`. Les commandes de révélation et le remasquage global restent stables dans Edge sous redimensionnement, zoom, défilement, remplacement et reprise hors ligne sur Liège, Toulouse et le QCM synthétique. Sur l’intégration `3709b44`, les mêmes essais et le chargement à froid des vecteurs hors ligne passent. `npm run check` compte 230 tests réussis, deux ignorés. Téléphones physiques et installation système restent à vérifier. [Déploiement](https://github.com/Hsa2552/night-shift/actions/runs/46102892739)

### V-28-0437-WB · Topologie et structure logique

- Protocole. Trois pages numériques avec cinq cadres ou tableaux annotés depuis le rendu. Quatre des cinq cibles sont retrouvées par les séparateurs natifs, sans proposition supplémentaire sur ces pages. Le tableau à filets horizontaux reste hors de portée de cette topologie. Parité Python/TypeScript sur les quinze cas de la comparaison.
- À 1,5× et 2×, les traces raster non interrompues retrouvent 5/5 cibles. La fermeture récupère le même nombre et ajoute trois candidats hors cible sur DocLayNet. Aucun candidat sur le scan MIT p. 1.
- Voisinage des objets. Trois relations sur trois avec la proximité simple et le graphe sur l’exemple synthétique. Sur deux ancres publiques, une retrouvée par la proximité des lignes XY-Cut et aucune par le graphe. Le classement évalué n’est pas retenu.
- Arbre logique. 0/93 pages de développement/diagnostic avec liens à du texte. Contrôles W3C de 56 et 13 fragments raccordés. Sept champs sur l’exemple W3C correspondant. Contrôle synthétique avec un champ et un calque reconnus. Le corpus n’évalue pas l’ordre logique de documents multipages, le rappel des corrections ou le masque final.

### V-28-0510-WB · Masques graphiques isolés et ablations

- Protocole Edge sur quatre pages de trois diagnostics publics et trois scènes synthétiques avec variantes. Cibles évaluées par pixels. Périmètres et protections fournis séparément du score. Moteur historique de `main` `0444703`, hors benchmark réservé. Voir `research/graphic-corrections/`.
- L’hybride contextualisé couvre 10/10 cibles synthétiques, sans toucher les 6 énoncés. Sur le public, 37 307/46 503 pixels de correction sont couverts, avec 1/7 cibles strictes, 3 partielles et 3 visibles. Les 4 zones d’énoncé restent intactes. L’historique couvre 5 625 pixels et touche une des quatre zones d’énoncé. L’ajout sans nouveaux périmètres reproduit l’historique.
- Le raster seul donne la même couverture contextualisée. L’IoU médiane sur les appariements publics passe de 0,629 en raster à 0,762 en hybride, rappel 5/11 dans les deux cas. Le natif seul donne 4/11. Les inconnues publiques ne permettent pas de déduire la précision globale des candidats.
- Géométrie C1, cinq pages de phase 4.3. 7 → 1 mélanges de colonnes ou cellules et 581/655 → 630/655 comparaisons d’ordre. L’activation sur trois pages conserve ce score. Parité Python/TypeScript des groupes sur 14 cas horizontaux avec les mêmes lignes de base.
- Rotation synthétique du sous-détecteur graphique. 1/5 → 5/5 cibles strictes après correction de l’échelle graphique à partir de la taille de police C1, 0/3 énoncé touché. La reconstruction de l’ordre du texte tourné n’a pas été résolue. Aucun résultat de masquage intégré au moteur revendiqué.

### V-28-0608-WB · Recette de convergence

- Base `0444703`, moteur `6f7c4e4` dans `3ab2453`, transport #21 et #23 et benchmark de Salif déjà compris, graphique `2cb23cd`. Référence Edge avant raccordement `e132238`, essai avec raster optionnel `71fb462`, puis raccordement natif seul. La PR #27 indique les rapports du SHA final. Les corpus réservés et leurs annotations restent hors de cette recette.
- Edge sur `e132238` et `71fb462` : développement historique 8/10 réussites, 3 strictes, 2 072/2 072 corrections couvertes à 95 % et 311/1 304 énoncés touchés. Trois sujets seuls classés correctement et sans masque, 3/3 stricts. Diagnostic public : 34/48 cibles entièrement couvertes à 95 %, 3/24 lignes d’énoncé touchées, 2 replis, aucune réussite stricte. Aucun écart moteur/lecteur.
- Les six PDF ENSAI-dev identifiés par leur SHA-256 donnent chacun le même résultat moteur et les mêmes masques, marques neutres et blocs révélables avant et après raccordement sur ces deux builds. Les six affichent un masquage automatique. Ceci ne mesure pas la couverture de vérité terrain. Hazem annonçait 4/6 réussites, 602/602 cases couvertes et 20/476 lignes touchées sur son jalon. Ses annotations n’étaient pas disponibles localement.
- Edge, essai `71fb462` sur le QCM `ensai-09e01e2ab125` : 4 pages, 12 blocs révélables, 94 masques. Deux révélations indépendantes, remasquage individuel et global, zoom, défilement, remplacement et lecture progressive sur le MIT. Huit premiers libellés de question repérés par Poppler sur les pages de propositions, aucun pixel de leur boîte chevauché par un masque. Après rechargement hors ligne, nouveau chargement du worker, import, masquage et révélation réussis. Aucune requête externe ou d’envoi pendant la recette. Installation système et appareil physique non testés.
- Deux suites Vitest optionnelles sont ignorées par `npm run check` faute de configuration de leurs corpus. Le benchmark navigateur est exécuté séparément. `npm ci` fonctionne sous Windows. Le build de production est vérifié sous WSL, car le poste Windows bloque le chargement de Rollup pour Workbox. L’audit npm des seules dépendances de production ne trouve aucun avis. Aucun verrou, contrat, réglage GitHub ou seuil du moteur n’a changé.

### V-28-0622-S · Recette de démonstration et évaluation indépendante du SHA figé

- [FAIT] Edge 158.0.4370.45, SHA du HTML ca93897ba1424e7570ab7b9ae271d5df39c13e5a, checkout propre. Cinq suites achevées sans erreur technique ni divergence entre oracle et affichage. Réussites strictes 3/10 sur dev historique, 0/4 sur diagnostic, 0/7 sur dev ZIP, 1/5 sur validation ZIP et 1/5 sur réserve v1.
- [FAIT] Lyon 2 L2 donne 70/70 zones masquées et 17/17 blocs indépendants. Trois répétitions avec zoom, défilement, deux révélations et remasquages individuel puis global. Une répétition hors ligne. Build local et service worker vérifiés. Le QCM d'Illinois couvre 30/30 réponses à 95 %, sans encre visible dans ces zones et avec 30 blocs indépendants.
- [FAIT] Virginia Tech, sortie brute : 6 alertes historiques contre 0 mesurée sur les cadres physiques, une couverture incomplète demeure. Washington garde un indice de couleur visible. Les métriques historiques sont conservées.
- [FAIT] Le PDF invalide et le PDF protégé déclenchent des messages contrôlés. Un import valide ensuite fonctionne. La rotation PDF de 90° d'un QCM synthétique déclenche le mode progressif, tandis que les variantes marge, échelle et décoration conservent les deux commandes.
- Limites vérifiées et protocole complet dans [les résultats de validation](validation-finale/resultats.md). Une relecture humaine du nouveau lot, le test ZIP final et la recette sur téléphone physique restent à faire. ENSAI-dev absent sur ce poste.

### V-28-0821-UX · Recette ergonomique du lecteur

- Comparaison Edge du lecteur sur la base 34b40dc, identique à ca93897 pour le code de l'application, et sur la branche feat/final-reader-ux. Verdicts et géométrie affichée identiques sur six PDF. Illinois PHYS214 30 blocs et 30 régions, QCM de chimie synthétique 2 et 6, Lyon 2 L2 17 et 18, Washington 2 et 44. Wisconsin passe en progressif et le sujet seul de Toulouse reste sans masque.
- Clic et remasquage au même endroit, boutons latéraux non chevauchants, remasquage global, progression, focus clavier, zoom et redimensionnement vérifiés. Pour les pages très denses, le panneau de droite défile dans la hauteur du PDF. Les cadres et l'opacité des masques vérifiés restent identiques. Washington conserve sa fuite colorimétrique préexistante.
- Miniatures schématiques sans contenu quelconque du PDF. Navigation et saisie de page, correction suivante et précédente, plein écran et ajustement à la hauteur vérifiés. Le glissement tactile émulé ne révèle aucun bloc. Le dépôt de fichier, la fermeture du rendu de pages éloignées, les erreurs, l'import hors ligne et le changement de thème ont été exercés.
- npm run check : 255 tests réussis et deux suites d'évaluation désactivées par défaut. Le build de production génère le service worker. Les tests de la recette Edge ne constatent aucune requête vers une autre origine.
- Limites : PDF ENSAI-dev indisponibles localement, tests tactiles sur émulateur, vignette schématique sans rendu du document. Les réglages de lecteur restent propres à la session du document et le thème demeure mémorisé.

## Modèles

### V-<jour>-<hhmm>-<initiales> · <ce qui a été vérifié>

- Par : <prénom> (<outil>) · Commit : <hash>
- Commande ou protocole :
- Résultat :
- Limites :

### Q-<jour>-<hhmm>-<initiales> · <titre> · ouvert | contourné | résolu

- Gravité : bloque la démo | gênant | mineur
- Constat et reproduction :
- Contournement :
- Responsable ou tâche :
