# État du projet

> **Synthèse** : tenue par l'humain qui fusionne dans main.
> **Blocs de tâches** : chaque responsable met à jour **uniquement son bloc**. Garde une ligne vide entre les blocs : Git fusionne alors sans conflit deux mises à jour de tâches différentes.
> Identifiants : `T01`, `T02`... pour les tâches planifiées par l'équipe ; `T-<initiales>-<n>` pour une tâche ajoutée en cours de route.

## Synthèse

- **Mise à jour** : 27/11 20h, socle technique proposé (PR `feat/socle-technique`)
- **Sujet** : non choisi
- **Version démontrable sur main** : aucune (page provisoire seulement)
- **Dernier commit stable de main** : _à compléter_
- **Bloquants** : aucun
- **Prochaines priorités** : choisir le sujet ; remplir `PRODUIT.md` ; découper en tâches P0, P1, P2 ; choisir l'hébergement et le back-end éventuel ; écrire les premiers contrats.

## Tâches actives

### T-WB-1 · Interface et lecture sans spoiler

- Statut : en revue · Priorité : P0
- Responsable : Wael · Agent : Codex · Branche : `feat/viewer`
- Dépend de : rendu canvas et repère canonique de Salif (S3), détecteur de Hazem (H1)
- Critères d'acceptation : masquer les corrigés et les révéler par bloc, proposer une lecture progressive multipage au tactile, gérer les quatre types de document et garder le PDF couvert en cas d'erreur.
- Maturité : intégrée avec le lecteur et le détecteur de `main`. W5 vérifié dans Edge et Firefox sur ordinateur, avec le geste tactile émulé dans Edge.
- Notes : PR #3. Vérification sur téléphone physique à faire. Voir `memoire/journal/wael.md`.

### T00 · Choisir le sujet

- Statut : à faire · Priorité : P0
- Responsable : équipe · Agent : aucun · Branche : aucune
- Dépend de : rien
- Critères d'acceptation : sujet marqué `[DÉCIDÉ]` dans `PRODUIT.md` et dans `DECISIONS.md`
- Maturité : sans objet
- Notes :

### T-S-1 · Lecteur PDF et PWA

- Statut : fusionnée · Priorité : P0
- Responsable : Salif · Agent : Codex · Branche : `feat/pdf`
- Critères d'acceptation : chargement local, extraction, rendu canvas, raster, rotations et ressources PWA.
- Maturité : intégrée et vérifiée dans une copie locale des trois branches. Import hors ligne dans Edge et révélation tactile en émulation.
- Notes : code PR #4, contrat C1 validé et publié dans la PR #7. Voir `journal/salif.md`. Hazem suit T-HZ-1 sur `feat/detection` et Wael suit T-WB-1 sur `feat/viewer`.

### T-S-2 · Robustesse PDF et procédure de test

- Statut : en revue · Priorité : P1
- Responsable : Salif · Agent : Codex · Branche : `fix/pdf-robustesse`
- Critères d'acceptation : repère canonique stable sur texte incliné et pages recadrées, taille des bitmaps bornée et ouverture hors ligne du parcours intégré.
- Maturité : testée sur Edge et sur un document synthétique de 80 pages, avec test du parcours intégré et du tactile émulé.
- Notes : protocole de test sur ordinateur et téléphone dans le README. Voir `journal/salif.md`.

### T01 · Socle technique commun

- Statut : en revue · Priorité : P0
- Responsable : propriétaire du dépôt (Hsa2552) · Agent : Claude Code · Branche : `feat/socle-technique`
- Dépend de : rien
- Critères d'acceptation : `npm install`, `npm run check` et `npm run build` passent sur une machine propre ; CI verte sur la PR ; page provisoire installable comme application
- Maturité : testée (en local, voir `QUALITE.md` V-27-1959-CC). Non testé : vrai navigateur, téléphone, CI sur GitHub
- Notes : décision D-INIT-3 ; description du socle dans `ARCHITECTURE.md`

### T-HZ-2 · Robustesse et généralisation du détecteur (phase 2)

- Statut : en cours · Priorité : P0
- Responsable : Hazem · Agent : Claude Code · Branche : `feat/detection-robustesse`
- Dépend de : contrat C1 (fusionné) ; vraies annales fournies par l'équipe pour l'évaluation locale
- Critères d'acceptation : corrections visibles et énoncés masqués mesurés séparément (`src/detection/eval/`) et en baisse sur de vraies annales ; tests de régression pour chaque défaut corrigé
- Maturité : testée (90 tests, 15 PDF synthétiques annotés). Non testé : vraies annales, navigateur avec l'interface
- Notes : journal `journal/hazem.md`, entrée du 27/11 23:35 ; T-HZ-1 (H1 à H3 initiaux) fusionnée par la PR #6

## Terminées ou abandonnées

_Déplacer ici les blocs `fusionnée` ou `abandonnée` pour garder la liste active courte._

## Modèle de tâche

### T<nn> · <titre court>

- Statut : à faire | en cours | bloquée | à reprendre | en revue | fusionnée | abandonnée · Priorité : P0 | P1 | P2
- Responsable : <prénom> · Agent : Claude Code | Codex | aucun · Branche : <feat/...>
- Dépend de : <T.., C..>
- Critères d'acceptation :
- Maturité : codée | compile | testée | intégrée | utilisable | démontrable
- Notes, blocage, passation : <renvoi vers le journal>
