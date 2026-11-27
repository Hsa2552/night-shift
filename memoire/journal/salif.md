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
