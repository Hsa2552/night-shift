# Détecteurs visuels indépendants

Interfaces publiées pour l’intégration par Hazem. Les implémentations seront exportées par `src/detection/visual/index.ts`.

| Export | Entrée | Résultat |
| --- | --- | --- |
| `analyzeColorPage` | `PageData`, `RasterData` | `VisualPageResult<ColorCandidate>` |
| `analyzeQcmPage` | `PageData`, `RasterData` | `VisualPageResult<QcmCandidate>` |

Les opérations sont synchrones et partagent le raster déjà obtenu par le moteur. `PageData.textItems` peut être vide. Les sorties utilisent `PageRegion` et `CorrectionBlock` dans le repère canonique C1. Les identifiants des blocs incluent le détecteur et l’index de page.

`candidates` expose les observations, y compris celles pour lesquelles le module ne peut pas conclure. `blocks` contient les masques appuyés par les indices disponibles. `needsFallback` signale une correction probable encore non couverte ou un raster inexploitable. Le moteur agrège ces indices avec les autres détecteurs et décide du résultat global. Un candidat coloré ambigu ne suffit pas à conclure à un corrigé. Le passage couleur peut être lancé même lorsque la détection textuelle a déjà produit des blocs.

Pour un QCM, un bloc couvre toutes les cases du groupe. Une grille finale peut être couverte en totalité si ses cases et cellules sont identifiées. Chaque rectangle est fourni au visualiseur avec les unités C1.
