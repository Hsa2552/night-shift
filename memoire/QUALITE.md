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

### V-28-0039-WB · Recette Mako, production et groupes QCM

- Par : Wael (Codex). Build Ubuntu Node.js 24 avec `BASE_PATH=/night-shift/`, puis [recette Playwright](../scripts/verify-mako.cjs) dans Edge sous Windows. Les tests de l’interface sont dans `App.test.tsx` et `viewer/DocumentViewer.test.tsx`.
- Captures : accueil et lecteur clair/sombre en 1440 × 900, 1280 × 800, 768 × 1024, 390 × 844, 360 × 800 et 844 × 390. Le logo et le favicon ont aussi été examinés à 16, 24 et 32 px. [Captures](captures/mako)
- Résultat : dépôt, couverture avant analyse, révélation et remasquage individuels, compteur, thème sans perte d’état ni déplacement, navigation neutre, rectangles alignés au zoom, glissement et clavier passent. Sur 80 pages synthétiques, les canvas éloignés sont libérés sans retirer la couverture. Le nouvel import et l’analyse passent hors ligne après activation du service worker, avec la police et l’exemple local.
- QCM : `qcm-cases.pdf` confirme en navigateur les masques opaques groupés et la commande hors des cases. Un test synthétique de quatre cases confirme l’application du même traitement, la restauration en bloc et le remasquage. Le comportement dépend de la fourniture de toutes les régions par le détecteur.
- Annale externe : [MIT 18.05, examen final 2022](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/mit18_05_s22_exam_final.pdf), 23 pages, ouverte puis analysée localement. Le détecteur a renvoyé un bloc. La vérification porte sur le parcours, sans mesure d’exactitude du bloc.
- Contrastes calculés : 6,75:1 pour le texte secondaire clair, 8,44:1 en sombre, au moins 4,93:1 aux arrêts du bouton dégradé, 9,23:1 pour la commande dans les masques. L’émulation tactile ne valide pas Safari ni un téléphone physique.

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
