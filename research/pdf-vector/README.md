# Laboratoire de perception vectorielle PDF

Cette expérimentation locale produit des observations géométriques et stylistiques dans le repère C1. Les cases d’identification, les cases de réponse et les décorations restent des candidats bruts. Le moteur de Hazem conserve le regroupement par question et par session.

## Reproduire

Créer un environnement isolé hors du dépôt. L'exécution a été vérifiée sous Python 3.14 avec les deux versions épinglées. `--no-deps` évite d'installer les composants facultatifs de la distribution PyMuPDF 2.2. [PyMuPDF et sa double licence AGPL/commerciale](https://pymupdf.readthedocs.io/en/latest/about.html) · [Licence BSD de NumPy](https://numpy.org/doc/stable/license.html)

```sh
python -m venv /tmp/unspoil-vector
/tmp/unspoil-vector/bin/python -m pip install --no-deps -r research/pdf-vector/requirements.txt
/tmp/unspoil-vector/bin/python -m unittest discover -s research/pdf-vector -v
/tmp/unspoil-vector/bin/python research/pdf-vector/probe.py "/dossier-local/document.pdf" > /tmp/unspoil-vector/document.json
```

Sous Windows, utiliser `Scripts/python.exe` dans le virtualenv. L’option `--glyphs` ajoute les positions et boîtes des glyphes sans exporter les chaînes du PDF. Garder les PDF et les JSON issus d’annales privées hors du dépôt. Aucun paquet Python ne fait partie de l’exécutable.

### Comparaison dans Edge

Démarrer deux serveurs avec `npm run dev -- --host 127.0.0.1 --port <port> --strictPort`. Utiliser le port 5198 pour la branche de référence qui contient `src/detection/boxes.ts` et le port 5199 pour cette branche. Le premier parcours utilise le lecteur PDF réel et appelle `findBoxes`. Le second appelle le prototype via le même paquet PDF.js et son worker. Le comparateur emploie Edge, refuse les URL distantes et enregistre les empreintes des sources servies. Il enregistre le SHA injecté dans le HTML lorsque la branche le fournit. `UNSPOIL_PLAYWRIGHT_MODULE` peut désigner le chemin absolu de `playwright-core/index.mjs` d’une installation existante.

```sh
node research/pdf-vector/compare-browser.mjs http://127.0.0.1:5198/ "/dossier-local/document.pdf" > /tmp/unspoil-vector/raster.json
node research/pdf-vector/compare-browser.mjs http://127.0.0.1:5199/ --vector "/dossier-local/document.pdf" > /tmp/unspoil-vector/pdfjs.json
/tmp/unspoil-vector/bin/python research/pdf-vector/score.py "/dossier-local/document.verite.json" /tmp/unspoil-vector/document.json --raster /tmp/unspoil-vector/raster.json --pdfjs /tmp/unspoil-vector/pdfjs.json
/tmp/unspoil-vector/bin/python research/pdf-vector/color_agreement.py "/dossier-local/document.pdf" /tmp/unspoil-vector/document.json
npm test -- src/detection/visual/vector
```

Le format de vérité contient des `elements` avec `pageIndex`, `bbox: {x,y,width,height}` et `filled` pour les cases. Le score associe au plus un candidat à chaque rectangle, par aire d'intersection sur union (IoU) minimale de 0,60. Le score ignore les autres unités de la vérité. Les observations raster et vectorielles sont rattachées à l’empreinte SHA‑256 du PDF.

## Observations disponibles

- `cases` expose le rectangle canonique, la primitive, les états candidats et les opérations de peinture. Une lecture de quatre bords et de l’intérieur du raster classe la visibilité. Un remplissage clair peut porter une lettre imprimée sans constituer une marque. Un trait oblique natif ou un glyphe de coche fournit une observation supplémentaire. Une boîte sur une frontière, recouverte ou trop incertaine reste `ambiguous`.
- `case_size_modes` estime des dimensions récurrentes à partir des cadres vides ou marqués. `right_span` signale un fragment voisin. Ces champs fournissent des indices géométriques indépendants du rôle.
- `symbol_cases` rapproche les glyphes de cadre et de coche qui se recouvrent. La même coche ne peut servir qu’à un cadre. Les symboles non appariés restent dans `symbols`.
- `text_spans` expose la position, la police, les flags, la direction, la taille et l’encre native. `styles` regroupe par police, teinte, flags et demi-point, avec estimations médianes des positions et de leurs écarts. `get_bboxlog` permet de distinguer un texte ignoré par le rendu, comme une couche OCR, d’un texte peint. `possibly-covered` signale la présence d’un objet ultérieur englobant. La composition des couches, le découpage et la transparence peuvent encore changer ce que le lecteur voit. [API PyMuPDF](https://pymupdf.readthedocs.io/en/latest/functions.html#get-texttrace)
- `drawings`, `annotations`, `widgets` et `paint_counts` conservent des indices de courbes, tracés, images et surlignages. Une primitive graphique ne détermine pas si l’objet constitue un tableau, une correction ou une illustration.

Extrait synthétique, simplifié pour illustrer l’interface proposée à Hazem :

```json
{
  "pageIndex": 0,
  "bbox": [75, 10, 10, 10],
  "state": "empty",
  "near_document_size": true,
  "possible_mark_path": false,
  "border_ink": [1, 1, 1, 1],
  "interior_ink": 0.24,
  "right_span": 6
}
```

### Prototype TypeScript

`observeVectorPage(page)` prend un `PDFPageProxy` et retourne des rectangles dans `PageRegion` (C1), les peintures de texte, le nombre d’images et les chemins non résolus. Il lit `getOperatorList()` de PDF.js **6.5.438**, empile les états graphiques et compose les matrices du viewport, des transformations locales et des Form XObjects imbriqués. Le décodage de `constructPath` dépend du format interne livré par cette version. Deux tests exécutent PDF.js sur de vrais PDF synthétiques, dont un formulaire imbriqué avec rotation et recadrage.

`nativeSquares(rectangles)` rapproche les opérations de peinture d’une même petite boîte. L’état `nativeState` se lit comme un indice. Une région dans un calque optionnel, un contour rempli à recouvrement, un fond coloré ou certains découpages rendent l’état ambigu. Chaque candidat conserve `needsVisibilityCheck: true`, car la superposition d’une image, d’un autre dessin ou d’un glyphe peut changer sa visibilité. Les courbes sont signalées, les cases tournées hors axe ne sont pas reconstruites.

Pour le texte, les couleurs issues de PDF.js sont normalisées par son worker vers des valeurs utilisables pour le rendu. Le nom de police est son identifiant interne, et la taille n’est qu’une propriété de l’opération de texte. Pour conserver des abscisses fiables, le prototype expose seulement une origine connue, puis attend une nouvelle position explicite après une avance de glyphes. Il rapporte les comptes de symboles par opération sans inventer de boîtes par glyphe. Le laboratoire Python comporte des boîtes de glyphes et un rapprochement des coches.

Exemple synthétique d’un candidat TypeScript réduit aux champs utiles à l’intégration.

```json
{
  "region": { "pageIndex": 0, "bbox": { "x": 75, "y": 10, "width": 10, "height": 10 } },
  "nativeState": "empty",
  "needsVisibilityCheck": true
}
```

Interface proposée à Hazem dans la PR #16. Les observations sont facultatives, indexées en C1. Le moteur associe les cases aux questions et les styles aux conventions locales. Un raccordement au lecteur nécessiterait une revue avec Salif. Le prototype et le laboratoire n’entrent pas dans le parcours de production.

Pour la proposition D-28-0315-HZ, un `filled: boolean` est dérivable uniquement pour les états résolus et visibles. Un carré ambigu mérite un état distinct, notamment sur les QCM à fond coloré. L’ordre de `showText` ne correspond pas à celui des `textItems` du lecteur. Les mesures actuelles ne justifient pas d’attribuer une couleur par simple index. Le prototype ne fournit encore ni séparateurs normalisés ni rectangles d’images. Un transport par document conserverait l’isolation des ouvertures successives et relève d’une décision C1 avec les responsables.

## Mesures

Documents de diagnostic ENSAI. Les cibles géométriques ont été relevées auparavant sur les carrés natifs du PDF. Ce référentiel est approprié pour comparer les candidats bruts, avec un biais favorable à une autre lecture de la même géométrie. Les cases des grilles d’identification sont comprises.

| Pages | Cibles pleines / vides | PyMuPDF + contrôle raster | PDF.js natif | `findBoxes` brut | Médiane IoU vecteur / raster |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hybride, 12 p. | 66 / 222 | 288 / 288 | 288 / 288 | 240 / 288, 48 vides manquées | 1,000 / 0,708 |
| Deux sessions, 4 p. | 22 / 162 | 184 / 184 | 184 / 184 | 151 / 184, 33 vides manquées | 1,000 / 0,737 |

Les trois méthodes retrouvent les 88 cases pleines. Les sorties PyMuPDF et PDF.js n’ont aucun carré candidat ambigu ou non apparié sur ces deux PDF. `findBoxes` brut émet également 602 et 54 candidats non appariés à ce seuil. Le passage à 0,50 conserve les mêmes résultats. Ces nombres incluent les décalages de géométrie et les autres éléments carrés. La correction de groupes de Hazem après `findBoxes` est hors du périmètre de ce score.

Temps cumulés par document. Le laboratoire Python complet prend 1,38 s et 0,50 s avec contrôles raster et relève aussi les styles. Edge prend 0,52 s et 0,15 s pour la rasterisation et `findBoxes` sur `edf4b92`. Le prototype Edge prend 0,15 s et 0,07 s pour `getOperatorList`, normalisation et regroupement des carrés, sur le passage de vérification. Les temps couvrent des opérations différentes et excluent l’ouverture du document. L’empreinte SHA-256 de la version servie du parseur TypeScript est `c12c27ac22899282820ccb38186655423195e392781c414de823e39af68bed1c`.

### Autres familles réelles publiques

| Famille | Observation |
| --- | --- |
| QCM typographique, 16 p. | Virginia Tech. Les deux outils relèvent 41 glyphes carrés et 20 coches. Le laboratoire Python apparie les 20 coches et rapporte 21 cadres vides. La vérification visuelle de la p. 15 confirme 7 cochées et 8 vides. Aucun rectangle natif candidat. `findBoxes` renvoie 13 candidats p. 15, pour 15 cases visibles avant appariement. [Virginia Tech CS3214 2025](https://courses.cs.vt.edu/cs3214/fall2025/documents/CS3214_Fall_2025_Final_Exam_Solutions.pdf) |
| QCM signalé par la couleur du fond, 9 p. | Washington. Quatre cases à contour identique observées p. 1, trois propositions signalées par le fond vert. PDF.js retourne quatre carrés d'état ambigu, PyMuPDF zéro candidat carré selon le filtre courant. `findBoxes` fournit 92 candidats bruts p. 1, sans annotation géométrique exhaustive. [UW CSE122](https://courses.cs.washington.edu/courses/cse122/24wi/exams/Sample_Final_Exam-CSE_122_23au_solutions.pdf) |
| Questions bleues, corrections et données noires, 4 p. | Lyon 2. Les 17 spans natifs bleus éligibles ont une couleur `#0012ff` compatible avec le raster. Le prototype relève aussi `#0012ff` sur 129 opérations de texte. Les unités diffèrent. [Lyon 2 L2 2024–2025](https://perso.univ-lyon2.fr/~rabdesse/Documents/UFR-SEG/LICENCE/L2/CCC1-2024-2025.pdf) |
| Énoncés et graphisme, 2 à 14 p. | L’énoncé coloré de Liège présente un span `#007682` compatible sur 1 015 des 1 018 pixels chromatiques échantillonnés, zéro carré candidat. Illinois présente 340 dessins dans PyMuPDF et zéro candidat carré avec chacun des deux extracteurs. Berkeley présente un candidat carré ambigu côté PDF.js. Les mêmes références donnent 30 candidats raster sur Illinois et 69 sur Berkeley, sans annotation exhaustive de leurs objets graphiques. [Liège MATH0013](https://www.mmm.ulg.ac.be/files/MATH0013/examens_alg/ExamenAlg_Se25_pub.pdf), [Illinois CS473](https://courses.grainger.illinois.edu/cs473/fa2024/exams/f24-final-practice.pdf), [Berkeley CS186](https://hkn.eecs.berkeley.edu/examfiles/cs186_sp10_f.pdf) |
| Corrigé manuscrit numérisé, 17 p. | MIT. Aucun texte natif ni carré candidat. PDF.js signale 37 opérations image. Le cas relève du raster. [MIT 16.30](https://ocw.mit.edu/courses/16-30-estimation-and-control-of-aerospace-systems-spring-2004/resources/final_solna/) |

Le relevé de couleurs vérifie la compatibilité des pixels chromatiques observés avec l’encre native et un fond blanc. Il écarte les spans sans preuve suffisante et ceux dont le recouvrement est possible. Dans le PDF hybride, 882 des 884 spans rouge opaque testables selon la géométrie contiennent au moins trois pixels chromatiques. Ces 882 spans dépassent le seuil de 90 % de pixels compatibles. Le test PyMuPDF partage son moteur avec le raster de vérification, donc il mesure une cohérence de rendu. Les couleurs des opérations PDF.js sont des observations complémentaires.

**Décision B · approche hybride.** La géométrie vectorielle a récupéré 81 cadres vides sur les deux PDF de diagnostic, avec la même précision dans PDF.js et PyMuPDF. Les glyphes, la coloration autour des cases, les superpositions et les pages numérisées exigent des signaux complémentaires. L’intégration proposée conserve le raster pour vérifier la visibilité et complète les candidats issus des contours. Les 472 cibles du diagnostic, les contrôles publics ponctuels et les tests synthétiques servent à évaluer la perception. La généralisation du masquage requiert encore une évaluation indépendante de la composition par le moteur.
