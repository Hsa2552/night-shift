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

## Problèmes connus et risques

_Aucun pour l'instant._

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
