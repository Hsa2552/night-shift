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

### T00 · Choisir le sujet

- Statut : à faire · Priorité : P0
- Responsable : équipe · Agent : aucun · Branche : aucune
- Dépend de : rien
- Critères d'acceptation : sujet marqué `[DÉCIDÉ]` dans `PRODUIT.md` et dans `DECISIONS.md`
- Maturité : sans objet
- Notes :

### T-S-1 · Lecteur PDF et PWA

- Statut : en revue · Priorité : P0
- Responsable : Salif · Agent : Codex · Branche : `feat/pdf`
- Critères d'acceptation : chargement local, extraction, rendu canvas, raster, rotations et ressources PWA.
- Maturité : intégrée et vérifiée dans une copie locale des trois branches. Import hors ligne dans Edge et révélation tactile en émulation.
- Notes : code PR #4, contrat C1 validé et publié dans la PR #7. Voir `journal/salif.md`. Hazem suit T-HZ-1 sur `feat/detection` et Wael suit T-WB-1 sur `feat/viewer`.

### T01 · Socle technique commun

- Statut : en revue · Priorité : P0
- Responsable : propriétaire du dépôt (Hsa2552) · Agent : Claude Code · Branche : `feat/socle-technique`
- Dépend de : rien
- Critères d'acceptation : `npm install`, `npm run check` et `npm run build` passent sur une machine propre ; CI verte sur la PR ; page provisoire installable comme application
- Maturité : testée (en local, voir `QUALITE.md` V-27-1959-CC). Non testé : vrai navigateur, téléphone, CI sur GitHub
- Notes : décision D-INIT-3 ; description du socle dans `ARCHITECTURE.md`

### T-HZ-1 · Module de détection des corrigés (H1, H2, H3)

- Statut : en cours · Priorité : P0
- Responsable : Hazem · Agent : Claude Code · Branche : `feat/detection`
- Dépend de : contrat commun (proposition §11, copiée dans `src/detection/contract.ts`) ; S2 de Salif pour les tests sur vrais PDF
- Critères d'acceptation : `detectCorrections` renvoie type, blocs et régions corrects sur les quatre configurations ; tests sur données synthétiques puis sur vrais PDF
- Maturité : testée (synthétique, puis 8 PDF générés via un banc pdf.js). Non testé : annales réelles, intégration dans l'interface
- Notes : journal `journal/hazem.md`, entrées du 27/11 22:20 et 22:45

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
