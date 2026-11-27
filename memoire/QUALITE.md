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

_Liste des données fictives ou synthétiques, et où elles sont signalées (code, interface, README)._

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
