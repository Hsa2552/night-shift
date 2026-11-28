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

### T-WB-2 · Identité Mako et expérience de lecture

- Statut : en revue · Priorité : P0
- Responsable : Wael · Agent : Codex · Branche : `feat/design-mako`
- Dépend de : C1 et des PR #3, #8, #9 et #10 fusionnées dans `main`.
- Critères d’acceptation : identité et thèmes Mako, accueil avec import et exemple, lecteur accessible avec navigation, zoom, masques sûrs et compteur, recette navigateur et captures.
- Maturité : vérifiée sur le build de production dans Edge, y compris le tactile émulé et la reprise hors ligne. Téléphone physique et Safari à vérifier.
- Notes : PR #12. Neutralisation groupée C1 vérifiée sur les exemples. Validation de bout en bout sur le QCM ENSAI à reprendre avec Hazem. Voir `journal/wael.md` et `QUALITE.md`.

### T-WB-1 · Interface et lecture sans spoiler

- Statut : fusionnée · Priorité : P0
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

- Statut : fusionnée · Priorité : P1
- Responsable : Salif · Agent : Codex · Branche : `fix/pdf-robustesse`
- Critères d'acceptation : repère canonique stable sur texte incliné et pages recadrées, taille des bitmaps bornée et ouverture hors ligne du parcours intégré.
- Maturité : testée sur Edge et sur un document synthétique de 80 pages, avec test du parcours intégré et du tactile émulé.
- Notes : protocole de test sur ordinateur et téléphone dans le README. Voir `journal/salif.md`.

### T-S-3 · Validation du lecteur pour la distribution

- Statut : fusionnée · Priorité : P0
- Responsable : Salif · Agent : Codex · Branche : `fix/pdf-distribution`
- Critères d'acceptation : métriques de symboles finies, essais sur annales publiques, mesure multipage, vérification hors ligne et recette HTTPS pour téléphone.
- Maturité : testée sur Edge et WebKit de Windows. Installation sur téléphone physique et déploiement public à vérifier par l'équipe après activation de Pages.
- Notes : PR #9. Mesures dans `QUALITE.md` V-27-2342-S et V-27-2348-S.

### T-S-4 · Distribution et résilience de la PWA

- Statut : en revue · Priorité : P0
- Responsable : Salif · Agent : Codex · Branches : `fix/pwa-distribution` (PR #11 fusionnée), `fix/recette-distribution` (recette Mako)
- Critères d'acceptation : une mise à jour du cache préserve la lecture en cours, les essais de confidentialité et de libération sont reproductibles, et le propriétaire dispose de la procédure HTTPS.
- Maturité : correctif intégré. Recette de production avec Mako testée sur Edge, Firefox et WebKit. Mesures reproductibles hors ligne.
- Blocage externe : Pages est actif. La recette sur téléphone physique reste à faire.

### T-S-5 · Parité Node–navigateur et validation scientifique

- Statut : fusionnée (PR #17, puis #18) · Priorité : P0
- Responsable : Salif · Agent : Codex · Branche : `fix/benchmark-parity`
- Dépend de : benchmark et marqueur de build intégrés par la PR #14 à `feat/detection-generalisation`. C1 reste applicable.
- Critères d'acceptation : mêmes décisions d'affichage dans le produit et le score, référence Node/Edge avec empreintes, exclusions documentées, corpus réservé avant évaluation et vérification HTTPS après activation humaine.
- Maturité : oracle partagé, score strict et recette réelle testés. Savoie isolé au raster. Trois sujets seuls supplémentaires mesurés, et corpus réservé gelé puis mesuré dans Edge. Voir `QUALITE.md` V-28-0301-S et V-28-0310-S.
- Notes : PR #17 vers la branche de Hazem qui contient le benchmark.
- Blocage externe : Pages est actif. La recette physique dépend de l'accès aux appareils.

### T-S-7 · Stabilité des commandes de révélation

- Statut : fusionnée · Priorité : P0
- Responsable : Salif · Agent : Codex · Branche : `fix/commandes-revelation`. Travail signalé à Wael dans la PR #18.
- Critères d'acceptation : une commande stable par bloc, indépendant du zoom et du rendu ; remasquage global synchronisé ; remplacement et lecture progressive sûrs.
- Maturité : reproduite sur le build de `main` `da87ece`, corrigée et testée sur de vraies annales et un QCM synthétique dans Edge. Recette et limites dans `QUALITE.md` V-28-0359-S.

### T-S-6 · Transport et validation des observations vectorielles

- Statut : fusionnée · Priorité : P0
- Responsable : Salif · Agent : Codex · Branches : `feat/transport-vectoriel` (PR #21), `fix/validation-vectorielle` (PR #23), fusionnées dans la branche de Hazem
- Dépend de : validation collective C1 v1.1, PR #19. Base de contrôle commune : `87b6aef` (PR #17 intégrée à la branche de Hazem).
- Critères d'acceptation : lecture vectorielle à la demande et par document, dégradation vers le raster, essais Node et Edge sur les mêmes PDF et absence de changement de verdict au transport seul.
- Maturité : transport raccordé au lecteur, à App et aux recettes de benchmark. Le premier moteur hybride est mesuré dans Edge et Node. Les résultats et limites sont dans V-28-0422-S et V-28-0430-S.

### T01 · Socle technique commun

- Statut : en revue · Priorité : P0
- Responsable : propriétaire du dépôt (Hsa2552) · Agent : Claude Code · Branche : `feat/socle-technique`
- Dépend de : rien
- Critères d'acceptation : `npm install`, `npm run check` et `npm run build` passent sur une machine propre ; CI verte sur la PR ; page provisoire installable comme application
- Maturité : testée (en local, voir `QUALITE.md` V-27-1959-CC). Non testé : vrai navigateur, téléphone, CI sur GitHub
- Notes : décision D-INIT-3 ; description du socle dans `ARCHITECTURE.md`

### T-HZ-2 · Robustesse et généralisation du détecteur (phase 2)

- Statut : fusionnée (PR #10) · Priorité : P0
- Responsable : Hazem · Agent : Claude Code · Branche : `feat/detection-robustesse`
- Dépend de : contrat C1 (fusionné) ; vraies annales fournies par l'équipe pour l'évaluation locale
- Critères d'acceptation : corrections visibles et énoncés masqués mesurés séparément (`src/detection/eval/`) et en baisse sur de vraies annales ; tests de régression pour chaque défaut corrigé
- Maturité : intégrée (main à jour, vérifiée dans Edge avec l'interface et le lecteur ; évaluation V-28-0005-HZ). Non testé : vraies annales, téléphone
- Notes : journal `journal/hazem.md`, entrées du 27/11 23:35 à 28/11 00:05 ; T-HZ-1 fusionnée par la PR #6 ; dépendance ouverte : Q-27-2330-HZ (Salif)

### T-HZ-3 · Généralisation du détecteur sur annales réelles (phase 3)

- Statut : en cours · Priorité : P0
- Responsable : Hazem · Agent : Claude Code · Branche : `feat/detection-generalisation`
- Dépend de : rien de bloquant ; contrat C1 inchangé
- Critères d'acceptation : mesures avant/après sur corpus réels dev et test séparés ; QCM ENSAI DOC-corrige sans indice visuel
- Maturité : intégrée (189 tests, benchmark automatique, détecteur de Wael fusionné) ; QCM ENSAI et BUG-001 vérifiés dans Edge. Non testé : téléphone, Safari
- Phase 4 (fusion, conventions locales, QCM, sur-masquage) : premier jalon `65d8543`, voir V-28-0310-HZ. Phase 4.2 : parité Node/Edge du moteur (V-28-0415-HZ), cases natives C1 v1.1 et consignes de notation (V-28-0425-HZ) ; candidat à évaluer par Salif sur test : `6a78b02`. Phase 4.3 jalon 1 (couleurs, glyphes et marques natives) : `6f7c4e4`, V-28-0655-HZ ; interface graphique proposée à Wael : D-28-0655-HZ.
- Notes : journal entrées du 28/11 01:25, 02:00, 02:20 et 03:15 ; `QUALITE.md` V-28-0115-HZ à V-28-0310-HZ ; PR à ouvrir (lien dans le journal) ; à valider par l'équipe : `benchmark.yml` et scripts `benchmark:*` de `package.json`

### T-WB-3 · Détecteurs visuels déterministes

- Statut : en revue · Priorité : P0
- Responsable : Wael · Agent : Codex · Branche : `feat/visual-detection`
- Dépend de : raster et géométrie C1. Hazem compose les résultats dans le moteur.
- Critères d'acceptation : relevé d'encre indépendant du rôle, candidat de correction colorée quand les indices le permettent, bilan sur de vraies annales et tests de régression.
- Maturité : testée en isolation avec le lecteur PDF dans Edge et par tests unitaires, dont le cas des questions bleues et données/corrections noires. Intégration structurelle par Hazem.
- Notes : PR #13. Vérifications V-28-0118-WB et V-28-0128-WB. Détecteur QCM développé par Hazem, relu en isolation par Wael (V-28-0129-WB).

### T-WB-4 · Recette intégrée et couverture de sécurité

- Statut : en revue · Priorité : P0
- Responsable : Wael · Agent : Codex · Branche : `fix/recette-production`
- Dépend de : moteur de Hazem, lecteur réel et C1. Comparaison indépendante supplémentaire demandée à Salif.
- Critères d’acceptation : SHA vérifié par le navigateur et après rechargement hors ligne, appel couleur observé dans le build, verdict mesuré sur les annales et transmission des P0 au responsable du moteur.
- Maturité : recette reproductible et correctif d’interface testés. Lyon 2 validé dans Edge. Les deux annales ENSAI échouent encore au masquage automatique. Voir V-28-0211-WB.

### T-WB-5 · Perception vectorielle des PDF

- Statut : en revue · Priorité : P0
- Responsable : Wael · Agent : Codex · Branche : `feat/perception-vectorielle`
- Dépend de : repère C1, lecteur et comparaison brute avec `findBoxes`. Hazem garde la fusion des observations.
- Maturité : laboratoire Python et prototype PDF.js testés en isolation sur PDF réels et contrôles synthétiques. Approche hybride proposée. Raccordement au moteur et évaluation indépendante à réaliser après revue.
- Notes : PR #16, `research/pdf-vector/` et V-28-0319-WB. La PR #15 conditionne séparément la synchronisation de la recette de phase 3.

### T-WB-6 · Couleurs natives et glyphes

- Statut : en revue · Priorité : P0
- Responsable : Wael · Agent : Codex · Branche : `feat/perception-textuelle-native`
- Dépend de : repère C1 et tableau de fragments fourni par le lecteur. Salif raccorde le canal au lecteur. Hazem exploite les observations.
- Maturité : association des couleurs, glyphes, relations et géométrie graphique testées en isolation. Comparaison Edge sur huit PDF, tests PDF.js Node et résultats dans `research/pdf-vector/NATIVE-TEXT.md`. PR #20. Raccordement et validation moteur à faire dans les branches responsables.

### T-WB-7 · Géométrie adaptative et graphes documentaires

- Statut : en revue · Priorité : P0
- Responsable : Wael · Agent : Codex · Branche : `feat/research-adaptive-layout`
- Dépend de : C1 et perception vectorielle. Expériences indépendantes du moteur et du benchmark officiel.
- Maturité : comparatif sur pages réelles et variantes synthétiques. Prototype TypeScript isolé de topologie des séparateurs, comparé à Python. PR #24. Résultats et limites dans `research/document-layout/`.

### T-WB-8 · Corrections graphiques et géométrie adaptative

- Statut : en revue · Priorité : P0
- Responsable : Wael · Agent : Codex · Branche : `feat/graphic-corrections-adaptive-layout`
- Dépend de : observations C1 du lecteur et ancres pédagogiques du moteur. Hazem garde la fusion globale.
- Maturité : sous-détecteur isolé testé sous Edge sur pages publiques et contrôles synthétiques. Géométrie alternative et cadres disponibles séparément. Les expériences nécessitent des périmètres pédagogiques fiables, à raccorder par Hazem. PR #26 et `research/graphic-corrections/README.md`.

### T-S-8 · Validation indépendante et préparation du pitch

- Statut : en revue (PR #31) · Priorité : P0
- Responsable : Salif · Agent : Codex · Branche : test/validation-finale
- Maturité : recette démontrable sur `ca93897` dans Edge, y compris hors ligne. Lyon 2, Illinois et un QCM synthétique sont prêts dans le dossier local. Le candidat de convergence a été intégré dans `main` par la PR #27.
- Mesures : développement historique, diagnostic, nouveau développement, validation indépendante, réserve v1 et audit des indices QCM. Voir V-28-0622-S et validation-finale/resultats.md.
- Limites : fichiers ENSAI-dev indisponibles sur ce poste. Nouveau test ZIP sans annotations consolidées. Seuls les agrégats autorisés sont publiés.

### T-WB-9 · Convergence et livraison finale

- Statut : fusionnée (PR #27, `34b40dc`) · Priorité : P0
- Responsable : Wael · Agent : Codex · Branche : `feat/convergence-phase-5`
- Candidat final vérifié : `ca93897ba1424e7570ab7b9ae271d5df39c13e5a`, après le candidat intermédiaire `e1322384e3f874c3a6b4b249f3505a108104f849`. Moteur `6f7c4e4`, historique Hazem `3ab2453`, géométrie et graphisme Wael `2cb23cd`, transport et benchmark Salif déjà inclus.
- Maturité : parcours QCM démontré dans le build de convergence sous Edge, dont l’import hors ligne. Aucun changement de masque sur les six PDF ENSAI-dev dans la comparaison de raccordement. Raccordement graphique natif conservateur, périmètres sans preuve et balayage raster optionnel laissés hors du parcours automatique.
- Notes : recette V-28-0608-WB et procédure de contrôle de Pages dans `LIVRAISON.md`.

### T-UX-51 · Ergonomie du lecteur et expérience d'entraînement

- Statut : fusionnée (PR #28, `dcbf709`) · Priorité : P0
- Responsable : équipe · Agent : Codex · Branche : feat/final-reader-ux
- Critères : clic et remasquage dans le PDF, commandes latérales hors du document, état par CorrectionBlock, suivi permanent.
- Maturité : parcours Edge après redimensionnement, zoom et rechargement hors ligne. Comparaison exacte des blocs et régions affichés sur six PDF du développement ou de démonstration. Navigation ciblée, concentration, plein écran, zoom à la hauteur, miniatures schématiques et raccourcis vérifiés dans Edge. Fichiers ENSAI-dev indisponibles sur ce poste.

### T-WB-11 · README final pour le jury

- Statut : fusionnée (PR #29, `536a122`) · Priorité : P1
- Responsable : Wael · Agent : Codex · Branche : `docs/readme-final`
- Maturité : captures de la recette ergonomique `b7ef36e` réalisées dans Edge sur un QCM synthétique. Résultats attribués au candidat `ca93897` et à la validation de Salif. Procédures techniques déplacées dans `RECETTE.md`.

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
