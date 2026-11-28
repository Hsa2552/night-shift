# Détecteurs visuels indépendants

Les fonctions sont exportées par `src/detection/visual/index.ts` pour l’intégration par Hazem.

| Export | Entrée | Résultat |
| --- | --- | --- |
| `analyzeColorPage` | `PageData`, `RasterData`, `ColorConvention?` | `VisualPageResult<ColorCandidate>` |
| `readColorConvention` | `readonly PageData[]` | `ColorConvention` ou `undefined` |
| `analyzeQcmPage` (interface publiée) | `PageData`, `RasterData` | `VisualPageResult<QcmCandidate>` |

Les opérations sont synchrones et partagent le raster déjà obtenu par le moteur. `PageData.textItems` peut être vide. Les sorties utilisent `PageRegion` et `CorrectionBlock` dans le repère canonique C1. Les identifiants des blocs incluent le détecteur et l’index de page.

`candidates` expose les observations, y compris celles pour lesquelles le module ne peut pas conclure. `blocks` contient les masques appuyés par les indices disponibles. `needsFallback` signale une correction probable encore non couverte ou un raster inexploitable. Le moteur agrège ces indices avec les autres détecteurs et décide du résultat global. Un candidat coloré ambigu ne suffit pas à conclure à un corrigé. Le passage couleur peut être lancé même lorsque la détection textuelle a déjà produit des blocs.

Pour un QCM, un bloc couvre toutes les cases du groupe. Une grille finale peut être couverte en totalité si ses cases et cellules sont identifiées. Chaque rectangle est fourni au visualiseur avec les unités C1.

## Couleur

Le passage couleur regroupe l’encre chromatique par teinte circulaire. Les seuils combinent saturation relative et différence absolue entre canaux. Les composantes de pixels proches sont rapprochées selon la hauteur du texte courant. L’intersection avec les fragments PDF aide à écarter les titres et à distinguer le texte des tracés sans couche texte.

Un marqueur de correction, des motifs géométriques près de questions identifiables ou une convention de couleur explicitement annoncée appuient le masquage. Pour une convention annoncée en couverture, appeler `readColorConvention(pages)` une fois, puis passer sa sortie à `analyzeColorPage`. Une page sans indice chromatique renvoie des listes vides. Sa classification et l’éventuel repli restent à la charge du moteur. Un dessin noir ou un surlignage de réponses d’une autre couleur peuvent rester visibles malgré une convention confirmée.

Les tests ciblés se lancent avec `npm test -- src/detection/visual`. L’évaluation sur des PDF universitaires et la portée des mesures sont documentées dans `memoire/QUALITE.md`.
