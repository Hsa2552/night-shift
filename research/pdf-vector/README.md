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

### Comparaison avec le raster

Démarrer `npm run dev -- --host 127.0.0.1 --port 5198 --strictPort` sur une branche qui contient `src/detection/boxes.ts`. Le comparateur emploie le lecteur PDF réel et appelle `findBoxes` dans Edge. Il refuse les URL distantes. `UNSPOIL_PLAYWRIGHT_MODULE` peut désigner le chemin absolu de `playwright-core/index.mjs` d’une installation existante.

```sh
node research/pdf-vector/compare-browser.mjs http://127.0.0.1:5198/ "/dossier-local/document.pdf" > /tmp/unspoil-vector/raster.json
python research/pdf-vector/score.py "/dossier-local/document.verite.json" /tmp/unspoil-vector/document.json --raster /tmp/unspoil-vector/raster.json
```

Le format de vérité contient des `elements` avec `pageIndex`, `bbox: {x,y,width,height}` et `filled` pour les cases. Le score associe au plus un candidat à chaque rectangle, par aire d'intersection sur union (IoU) minimale de 0,60. Le score ignore les autres unités de la vérité. Les observations raster et vectorielles sont rattachées à l’empreinte SHA‑256 du PDF.

## Observations disponibles

- `cases` expose le rectangle canonique, la primitive, les états candidats et les opérations de peinture. Une lecture de quatre bords et de l’intérieur du raster classe la visibilité. Un remplissage clair peut porter une lettre imprimée sans constituer une marque. Un trait oblique natif ou un glyphe de coche fournit une observation supplémentaire. Une boîte sur une frontière, recouverte ou trop incertaine reste `ambiguous`.
- `case_size_modes` estime des dimensions récurrentes à partir des cadres vides ou marqués. `right_span` signale un fragment voisin. Ces champs fournissent des indices géométriques indépendants du rôle.
- `text_spans` expose la position, la police, les flags, la direction, la taille et l’encre native. `styles` regroupe par police, teinte, flags et demi-point, avec estimations médianes des positions. `get_bboxlog` permet de distinguer un texte ignoré par le rendu, comme une couche OCR, d’un texte peint. `possibly-covered` signale la présence d’un objet ultérieur englobant. La composition des couches, le découpage et la transparence peuvent encore changer ce que le lecteur voit. [API PyMuPDF](https://pymupdf.readthedocs.io/en/latest/functions.html#get-texttrace)
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

## Mesures intermédiaires

Documents de diagnostic ENSAI. Les cibles géométriques ont été relevées auparavant sur les carrés natifs du PDF. Ce référentiel est approprié pour comparer les candidats bruts, avec un biais favorable à une autre lecture de la même géométrie. Les cases des grilles d’identification sont comprises.

| Pages | Cibles pleines / vides | Vectoriel + contrôle raster | `findBoxes` brut | Médiane IoU vecteur / raster |
| --- | ---: | ---: | ---: | ---: |
| Hybride, 12 p. | 66 / 222 | 288 / 288 | 240 / 288, 48 vides manquées | 1,000 / 0,708 |
| Deux sessions, 4 p. | 22 / 162 | 184 / 184 | 151 / 184, 33 vides manquées | 1,000 / 0,737 |

Les 88 cases pleines sont appariées par les deux méthodes. `findBoxes` brut émet également 602 et 54 candidats non appariés selon ce seuil. Ces nombres incluent les décalages de géométrie et les autres éléments carrés. Ils ne décrivent pas les masques effectivement affichés par le moteur. Le relevé Python complet prend environ 1,38 s et 0,50 s, raster de confirmation inclus. La référence Edge prend environ 0,52 s et 0,15 s pour le raster et `findBoxes` seuls. Ce sont des postes différents, mesurés sur un passage.

**Décision intermédiaire B.** Les rectangles natifs gagnent sur cette famille de QCM, tandis qu’un scan sans vecteurs et les marques typographiques demandent d’autres signaux. La transposition de ces rectangles en PDF.js reste à vérifier au prochain jalon. La mesure ne porte pas sur le rappel des corrections ni sur un corpus indépendant.
