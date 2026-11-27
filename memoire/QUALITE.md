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

## Problèmes connus et risques

_Aucun pour l'instant._

## Données de démonstration

_Liste des données fictives ou synthétiques, et où elles sont signalées (code, interface, README)._

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
