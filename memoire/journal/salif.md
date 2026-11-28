# Journal de Salif

## Entrées

### 27/11 · SESSION · T-S-1 lecteur PDF (S2 à S4) · Codex

- Jalon : `feat/pdf` fournit `openPdf(file)` depuis `src/pdf/index.ts`. Le document expose `pageCount`, `getPageData(index)`, `renderPage(index, canvas, { width, pixelRatio, signal })`, `getRaster(index)` et `close()`.
- Hazem : `src/shared/types.ts` reprend les types proposés en section 11 de `DEBUT_Hackaton.txt`, compatibles structurellement avec H1. Alimenter `DetectionInput.pages` en appelant `getPageData` pour chaque page et passer `pdf.getRaster` au besoin. Les fragments suivent l'ordre de PDF.js et peuvent inclure des fragments vides avec `hasEOL`.
- Wael : conserver un canvas par page. Mettre le conteneur au ratio `page.width / page.height` et convertir les régions en pourcentages de ces dimensions. Fournir la largeur CSS voulue au rendu et annuler le rendu sortant avec un `AbortController` lors d'un redimensionnement ou du remplacement du document. Appeler `close()` en libérant le document.
- Géométrie : indices de pages à partir de zéro, repère du viewport tourné à l'échelle 1, x à droite et y vers le bas. Les rectangles de texte sont estimés à partir des métriques de police. Le raster contient `width × height × 4` octets RGBA en ordre de lignes. Convertir x et y en pixels avec les rapports raster/page propres à chaque axe.
- Erreurs : l'ouverture, l'extraction et le rendu retournent des promesses rejetées en cas d'échec. Les PDF nécessitant un mot de passe sont rejetés. Les PDF sont traités localement.
- Vérifié : `npm run check` (4 tests dont 3 du module PDF), build et import hors ligne dans Edge via un point d'entrée temporaire (voir `QUALITE.md`).
- Suite : valider le contrat dans la mémoire verrouillée et vérifier l'intégration avec H1 et l'interface de Wael.

### 27/11 · SESSION · T-S-1 dimensions seules pour la révélation progressive · Codex

- PR #4. `getPageDimensions(index)` renvoie `{ pageIndex, width, height }` dans le repère canonique, sans extraction du texte. Wael peut construire le lecteur couvert et activer la révélation progressive avant toute analyse.

### 27/11 · SESSION · T-S-1 vérification croisée · Codex

- Les branches de Hazem (`dca91b3`) et de Wael (`992e8fb`) fonctionnent avec le lecteur dans un montage temporaire. Edge classe correctement les huit PDF de test de Hazem hors ligne. Le canvas de visualisation et les masques restent alignés après redimensionnement à 390 px.
- Le raster d'analyse utilise un contexte RGBA pour préserver la neutralité du texte noir et permettre le détecteur couleur. Voir `QUALITE.md` V-27-2226-S.
- La CI de la PR #4 a validé `ee2107d`. L'accord humain sur le contrat verrouillé reste attendu. La proposition de fusion conditionnelle est en revue collective dans la PR brouillon #5.

### 27/11 · SESSION · T-S-1 contrat et application intégrée · Codex

- Salif a validé C1. Le contrat est consigné dans la PR #7 sur `contrat/interfaces-pdf` (CI verte). Les exports correspondants sont dans la PR #4.
- Le parcours réel sur les branches de Wael (`204ed83`) et de Hazem (`86ec9e4`), assemblées avec `feat/pdf`, passe les 94 tests et le build. Edge a importé et analysé les quatre types de PDF synthétiques hors ligne. Le geste tactile et la couverture des pages suivantes ont été vérifiés en émulation. Voir `QUALITE.md` V-27-2236-S.
- Les entrées de Salif sont regroupées pour faciliter la fusion des trois PR sans écraser les vérifications des autres membres. La PR #5 attend l'accord collectif.

### 27/11 · SESSION · T-S-2 robustesse PDF et recette · Codex

- Les PR #7, #4 et #6 sont dans `main`. La PR #3 a intégré `main` et sa tête `0d70cc7` fournit l'interface de la recette intégrée.
- Sur `fix/pdf-robustesse`, les rectangles de texte suivent les axes de la matrice PDF, même avec inclinaison. Les bitmaps peuvent être réduits sur les très grandes pages. Les dimensions CSS, la géométrie canonique et les signatures de C1 sont conservées.
- Vérifié : 90 tests sur la branche PDF, 104 dans la copie intégrée, les deux builds et Edge hors ligne. Le PDF synthétique de 80 pages a exercé le recadrage de la première page et les budgets d'affichage et d'analyse. Voir `QUALITE.md` V-27-2304-S.
- Le README décrit un test commun sur ordinateur et téléphone à partir du même commit. La publication Pages exige l'activation par un mainteneur. Le workflow existant construit uniquement `main`.
- PR #5 : proposition finalisée. La protection serveur de `main`, l'accord de Salif, Hazem et Wael et la fusion humaine des Règles v2 sont des prérequis à l'automatisation.

### 27/11 · SESSION · T-S-2 extraction par lots et pistes pour le détecteur · Codex

- L'extraction convertit chaque lot du flux PDF.js avant de lire le suivant. La page ne conserve qu'un tableau complet de fragments, dans le format C1. Le test de régression couvre 250 lignes accentuées, deux polices et la conservation des métriques entre lots.
- Un essai dans Edge sur `mixte.pdf` a enregistré 351 opérations PDF.js et un tracé d'environ x 88–293 et y 155–224. Les bornes de cette API sont quantifiées et ne suffisent pas à classer un tracé comme corrigé. Relevé transmis à Hazem dans la PR #6. Le raster actuel peut aussi servir à vérifier la marge sous le masque.
- Vérification du correctif de Wael `96cce8c` : dans le parcours hors ligne sur PDF synthétique de 80 pages, le lecteur garde 3 canvas non vides après le même défilement qui en laissait 13. La première page se rend à nouveau en y revenant. Voir le protocole et les limites dans `QUALITE.md` V-27-2314-S.

### 27/11 · SESSION · T-S-3 distribution · Codex

- Base `ee99d1d`, branche `fix/pdf-distribution`. Les métriques non finies des polices de symboles utilisent un repli fini sans modifier C1. Reproduit sur le PDF de Hazem avant correction et validé dans le lecteur de production après correction.
- Quatre annales publiques, une copie aux quatre rotations et une charge dérivée de 170 pages testées localement. Mesures d'Edge, limites et vérification de WebKit dans `QUALITE.md` V-27-2342-S.
- La recette HTTPS et l'installation sur téléphone sont précisées dans le README. Le propriétaire doit activer Pages avant la vérification de l'URL publique. Aucune modification des paramètres GitHub.
- PR #9 ouverte. Parité en ligne/hors ligne sur neuf rasters dans chaque moteur, refus d'un PDF chiffré avec réouverture réussie, mesures des processus Edge sur trois cycles. La copie d'intégration avec le détecteur `e784dc1` affiche deux blocs de QCM hors ligne. Voir `QUALITE.md` V-27-2348-S.

### 28/11 · SESSION · T-S-4 mise à jour PWA · Codex

- Les PR #9 et #10 sont fusionnées. La branche `fix/pwa-distribution` part de `3ed5e93`.
- Deux builds sur la même origine reproduisaient une erreur 404 du module PDF pendant une mise à jour. Le service worker attend maintenant la fermeture du dernier onglet avant d'activer la nouvelle version. Vérification avant/après dans Edge, dont réouverture hors ligne. Voir `QUALITE.md` V-28-0012-S.
- Dépôt public, Pages désactivé au contrôle. Les réglages attendus du propriétaire et le repli sur un hébergement statique HTTPS sont décrits dans le README.

### 28/11 · SESSION · T-S-4 recette Mako et mémoire · Codex

- PR #11 fusionnée. Après intégration de Mako et du détecteur visuel, reprise des essais sur `fix/recette-distribution` depuis `329d297`.
- Recette sur trois moteurs, deux versions du service worker et observabilité réseau et stockage. Traitement hors ligne, annulation, remplacement, rotations, grande page, symbole, zoom et thème exercés. `npm run check` réussit avec 143 tests et une évaluation facultative ignorée. Build de production réussi.
- Huit cycles locaux sur scan, corrigé illustré et algèbre. Aucun worker du document ne reste après fermeture dans le benchmark. Le résiduel est surtout porté par le processus GPU du navigateur. Voir `QUALITE.md` V-28-0221-S et V-28-0223-S.
- Build de repli `BASE_PATH=/` validé depuis un checkout propre de `329d297`, avec rechargement, import et masquage hors ligne dans Edge. Le ZIP local dans `dev-dist/` contient le site statique sans PDF du corpus. Activation et recette physique attendues.

### 28/11 · SESSION · T-S-5 métriques et référence navigateur · Codex

- Branche `fix/benchmark-parity` basée sur `8cebd09` qui intègre la PR #14. Définition partagée de la décision produit, métriques historiques et strictes, rapports navigateur et diagnostic croisé.
- Référence Node et Edge sur le même SHA, corpus dev historique et mesure d'encre. Toulouse est mesurable, la ligne exclue correspond à une autre annale sans annotation évaluable. Savoie isole l'effet du raster. Voir V-28-0301-S. Aucun réglage du moteur sur ce document du test historique.
- PR #15 encore en revue humaine. Pages reste désactivé. Le corpus réservé est en constitution, et aucun résultat détaillé n'est diffusé à l'équipe.

### 28/11 · SESSION · T-S-5 corpus et contrôle strict · Codex

- PR #17 ouverte et premier contrôle GitHub réussi. Extension séparée de trois sujets seuls et rapport Node/Edge. Le profil Node a désormais les ressources PDF.js et la géométrie du lecteur.
- Vérité réservée gelée avant toute prédiction, avec empreintes locales et engagement dans `QUALITE.md`. Les seules mesures publiées sont agrégées. Le test des indices de forme dans les groupes QCM est distinct de la couverture historique.
- Contrôle Savoie dans Edge : les cinq rasters témoin sont identiques à ceux de production, même sans polices système. Basculer `disableFontFace` reproduit exactement la sortie Node du détecteur. Mesure par le navigateur de production conservée pour les résultats produit.
- Les deux rapports sur `9615001` concordent avec l'empreinte du build et rendent la perte de parité mesurable. La recette Edge hors ligne passe. Pages et la validation physique restent dépendantes de l'activation par le propriétaire. Voir V-28-0322-S.

### 28/11 · SESSION · T-S-6 raccordement vectoriel · Codex

- Accord collectif confirmé par Salif. Le contrat C1 v1.1 est dans la PR #19. Le transport utilise le type de Wael et transmet la méthode du document à App, au chargeur Node et au benchmark Edge.
- Le fournisseur mutualise uniquement les appels simultanés d'une page. Après fermeture, les demandes en vol ne produisent plus d'observation utilisable. Les tests ciblés de chargement, repli, fermeture et remplacement passent.

### 28/11 · SESSION · T-S-7 commandes de révélation · Codex

- Diagnostic et correctif sur `fix/commandes-revelation`. La commande individuelle reste dans le même pied de page. Le bouton global remasque les régions révélées sans relancer le détecteur. Voir V-28-0359-S pour les essais réels et la validation de Pages.

### 28/11 · SESSION · T-S-6 validation du premier moteur hybride · Codex

- PR #23 : transport enrichi à partir de la couche native de Wael, paquet PDF.js dédupliqué et mesure Node–Edge. Transport seul à résultats identiques. Le moteur case vectorielle + raster a demandé des observations dans le build réel.
- Les résultats publics v2 et les agrégats réservés figurent dans V-28-0422-S et V-28-0430-S. La PR #22 et son déploiement HTTPS ont été vérifiés dans Edge. Les PDF privés ENSAI et les téléphones physiques restent à vérifier.

### 28/11 06:22 · SESSION · T-S-8 validation finale et pitch · Codex

- Validation du SHA figé ca93897 en worktree séparé. Build, cinq benchmarks Edge, recette hors ligne et audit des cadres QCM terminés. Le lot ENSAI-dev n'est pas disponible sur ce poste.
- ZIP : développement complet téléchargé et annotations partielles sur les originaux. Le manifeste et les vérités de développement sont publiables. Le manifeste de validation, le nouveau test et les rapports individuels réservés restent au cache local.
- Démo et secours prêts dans dev-dist/pitch-final. La branche test/validation-finale contient les résultats agrégés et le protocole. Voir V-28-0622-S. Aucun changement de production.

### 28/11 · SESSION · T-S-9 confort utilisateur, jalon P0 · Codex

- PR #31 fusionnée à la demande de Salif après contrôle de son SHA, de sa CI et de sa fusionnabilité. La branche de confort part de `c89fa5c`.
- Le QCM synthétique du dépôt s'ouvre depuis l'accueil et passe par PDF.js et le détecteur. Le lecteur accepte un dépôt de remplacement après ouverture réussie, indique le nombre de pages extraites, confirme la révélation globale et réutilise les masques du document courant lors du retour à l'entraînement.
- Sur la base `c89fa5c`, `npm run check` réussit (260 tests passés, 2 évaluations ignorées) et le build Pages aboutit. Edge confirme deux blocs et six régions opaques sur l'exemple, avec le même résultat en import, via le bouton de démonstration et après rechargement hors ligne.

### 28/11 · SESSION · T-S-9 confort utilisateur, validation · Codex

- Le jalon P0 `eb55b67` a été publié après vérification sur `9811c8a`. Les réglages sauvegardés concernent uniquement le côté des commandes, le zoom et la navigation. Le thème utilise son stockage d’origine.
- L’aide est disponible à la première analyse réussie et depuis le menu du lecteur. L’action d’installation exploite l’invite éventuelle du navigateur. Les aperçus de page restent schématiques.
- Les masques de six PDF coïncident avec ceux du build de base dans Edge. Le PDF de démonstration s’ouvre et s’analyse hors ligne. Les résultats publics et limites figurent dans V-28-0927-S.
