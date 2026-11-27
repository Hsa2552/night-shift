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
