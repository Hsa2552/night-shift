# Détection colorimétrique indépendante

Les fonctions sont exportées par `src/detection/visual/index.ts` pour l’intégration par Hazem.

| Export | Entrée | Résultat |
| --- | --- | --- |
| `observePageInk` | `PageData`, `RasterData` | `PageInkObservation` ou `null` |
| `analyzeColorPage` | `PageData`, `RasterData`, `ColorConvention?` | `ColorPageResult` |
| `readColorConvention` | `readonly PageData[]` | `ColorConvention` ou `undefined` |

Les opérations sont synchrones et utilisent le raster déjà obtenu par le moteur. `PageData.textItems` peut être vide. Les sorties utilisent `PageRegion` et `CorrectionBlock` dans le repère canonique C1. Les identifiants des blocs incluent le détecteur et l’index de page.

## Observation sans attribution de rôle

`observePageInk` mesure l’encre chromatique et l’encre neutre. Un raster invalide renvoie `null`.

- `text` associe la fenêtre échantillonnée par `textIndex` à un fragment d’origine. `colors` liste les teintes et leurs nombres de pixels. `neutralPixels` compte l’encre noire et grise. Une fenêtre peut contenir les deux. Les fenêtres PDF peuvent se chevaucher.
- `regions` décrit les composantes chromatiques du raster, avec la teinte, le nombre de pixels et les indices des fragments associés. Un tableau `textIndices` vide signale une observation sans texte correspondant.
- Les nombres de pixels dépendent de la résolution du raster. Comparer des proportions au sein d’une même fenêtre ou des teintes entre fenêtres. Les blancs et les couleurs trop faibles sont ignorés.

Sur Lyon 2, les titres bleus des sous-questions aident à repérer les transitions. Les données initiales et les corrections sont toutes deux neutres. Leur rôle se déduit de leur position et de la structure de l’exercice. Si le moteur a besoin aussi des candidats de masquage, un seul appel à `analyzeColorPage` fournit le relevé brut dans `ink`.

## Candidats de masquage

`candidates` expose les observations. `blocks` contient les masques appuyés par les indices disponibles. `needsFallback` signale une correction probable encore non couverte ou un raster inexploitable. Le moteur agrège ces indices avec les autres détecteurs et décide du résultat global. Le passage couleur peut être lancé même lorsque la détection textuelle a déjà produit des blocs.

Le passage couleur regroupe l’encre chromatique par teinte circulaire. Les seuils combinent saturation relative et différence absolue entre canaux. Les composantes de pixels proches sont rapprochées selon la hauteur du texte courant. L’intersection avec les fragments PDF aide à écarter les titres et à distinguer le texte des tracés sans couche texte.

Un marqueur de correction, des motifs géométriques près de questions identifiables ou une convention de couleur explicitement annoncée appuient le masquage. Une série de questions numérotées dans une même teinte limite l’inférence implicite. Pour une convention annoncée en couverture, appeler `readColorConvention(pages)` une fois, puis passer sa sortie à `analyzeColorPage`. Une page sans indice chromatique renvoie des listes de masquage vides, avec ses mesures d’encre neutre. Sa classification et l’éventuel repli relèvent du moteur. Un dessin noir ou un surlignage de réponses d’une autre couleur peuvent rester visibles malgré une convention confirmée.

La détection des cases de QCM est développée par Hazem dans `boxes.ts` sur `feat/detection-generalisation`.

## Évaluation locale

Les tests ciblés se lancent avec `npm test -- src/detection/visual`. Les mesures sur des PDF universitaires et leur portée sont documentées dans `memoire/QUALITE.md`.

Pour reproduire les relevés, lancer `npm run dev` et utiliser Playwright localement. Le banc utilise le Chromium de Playwright ou le navigateur spécifié par `UNSPOIL_EVAL_CHANNEL` (par exemple `msedge`). `UNSPOIL_PLAYWRIGHT_MODULE` peut désigner le chemin absolu vers `playwright/index.mjs` d’une installation existante. `UNSPOIL_EVAL_URL` permet de changer le port du serveur local.

```sh
node src/detection/visual/evaluate.mjs /chemin/vers/document.pdf
node src/detection/visual/evaluate.mjs /chemin/vers/document.pdf /chemin/vers/observations.json
```

Le fichier d’annotations facultatif est un tableau de régions `{ pageIndex, bbox: { x, y, width, height }, hue? }`. Sans `hue`, la mesure attend de l’encre neutre. `observed` indique la présence d’au moins trois pixels compatibles dans un fragment qui intersecte la région. `touchedByMask` compte les régions intersectées par un masque. Ces mesures vérifient le signal et les intersections. Le rapport contient uniquement des agrégats.
