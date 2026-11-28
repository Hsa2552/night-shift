# Association des couleurs natives aux fragments · phase 4.2

`observeNativePage(page, items)` dans `src/detection/visual/vector/native-page.ts` reçoit le `PDFPageProxy` et les `TextItem` C1 de la même page. Le résultat étend les observations existantes avec `textColors` et `glyphSymbols`. Le lecteur peut transmettre ce résultat par le canal facultatif porté par Salif. Les indices restent ceux du tableau `items` donné par le lecteur, même s’il est réordonné.

## Couleur et fiabilité

- PDF.js 6.5.438 fournit les glyphes Unicode et leurs avances dans ses opérateurs natifs. Le prototype lit les métriques de police dans `commonObjs` après réception de la liste. Il reconstitue le repère canonique à partir des matrices de page, de formulaire et de texte, puis applique avances, caractères et espaces, `TJ`, échelle horizontale et décalage de ligne.
- Le rapprochement restreint les candidats par police et recouvrement, les groupe par ligne et direction, puis cherche une suite Unicode normalisée dans les deux sens. Une opération peut alimenter plusieurs fragments. Un fragment peut combiner plusieurs opérations et peintures. Les glyphes superposés restent dans la provenance. Un accent et sa lettre de base peuvent confirmer la même couleur si toutes les peintures sont d’accord.
- `textColors[].ranges` contient `start` et `end` en unités UTF-16 dans le texte original, `rgb` en sRGB 8 bits, les références aux opérateurs et l’évidence `text-and-geometry`. Les couleurs différentes restent séparées. Un `matched` couvre tous les caractères significatifs. Un `partial` émet les seules plages étayées. `ambiguous` signale des sources incompatibles ou une ambiguïté d’alignement. `unmatched` signifie qu’aucune suite compatible n’a été retrouvée.
- La fiabilité concerne le rattachement à une peinture déclarée avant composition finale. Les duplications contradictoires, modes invisibles, découpages complexes, transparences et peintures non univoques font perdre leur couleur aux caractères concernés. Les polices Type 3 et certaines écritures mixtes ou verticales peuvent rester sans résultat. Le raster conserve sa valeur pour la visibilité et les fragments non associés.

## Glyphes et relations géométriques

- `glyphSymbols` retient carrés, cercles, coches et croix lorsque PDF.js fournit leur code Unicode et leurs métriques. Les boîtes C1 décrivent une cellule de police estimée (`font-cell`). Elles peuvent dépasser l’encre ou se trouver légèrement décalées. Une croix arithmétique reste un symbole géométrique sans rôle attribué.
- `markRelations` indique les recouvrements et les marques proches des cadres observés. Le score de recouvrement divise l’intersection par la plus petite aire des deux régions. La distance représente l’écart entre les boîtes en unités C1. Les relations restent multiples en cas de concurrence. `backgroundRelations` signale les remplissages chromatiques locaux qui précèdent la peinture du cadre et le couvrent. Un fond peut être décoratif ou faire partie d’une convention de correction.
- Dans le QCM typographique de Virginia Tech, 41 carrés et 20 coches sont localisés. Les 20 coches recouvrent chacune un cadre. Sur la p. 15 annotée, la méthode repère 15/15 cadres à IoU ≥ 0,50, avec les 7 coches et les 8 cadres vides dans l’état attendu. À IoU ≥ 0,60, elle apparie 11/15 cadres, dont les 7 cochés. La médiane à 0,50 vaut 0,608. Le raster de référence apparie 11 cadres à 0,60 avec une médiane de 0,825, et traite les sept coches comme vides. Les cellules de police et le raster apportent donc des informations différentes.
- Sur la page annotée de Washington, les trois remplissages verts sont associés à trois cadres dessinés. Leur source reste un rectangle coloré dans le flux, sans décision de masquage. Une autre relation au même vert est relevée ailleurs dans ce document, hors page annotée.

## Graphiques

`graphics.images` conserve les placements des images et des masques en C1, y compris les groupes et répétitions reconstruits. `graphics.rules` relève les segments horizontaux ou verticaux et bandes fines tracées, avec leur source trait ou remplissage. `graphics.paths` décrit les cadres et enveloppes des autres tracés, avec peintures RGB disponibles. Une enveloppe affine peut surestimer un tracé tourné, une courbe ou un contour à trous. `graphics.highlights` rapporte les quadrilatères des véritables annotations PDF Highlight en repère C1 et dégrade au rectangle d’annotation si nécessaire. Un surlignage dessiné directement reste dans les tracés ou les fonds.

Sur le scan MIT, les 37 placements (36 images et 1 masque) correspondent aux 37 images de la référence PyMuPDF à IoU ≥ 0,90, médiane 1,000. Les règles, figures et annotations sont vérifiées par tests synthétiques, dont un vrai PDF de test annoté et tourné. Les tracés de Berkeley sont disponibles comme indices bruts. Leur classification en figures, encadrés, tableaux ou blocs de correction reste à évaluer par le moteur.

## Mesures de couleur

Tests dans Edge sur huit PDF publics ou de diagnostic. Les références sont dérivées séparément des caractères, couleurs de spans et positions de PyMuPDF `rawdict`. Une référence n’est comptée que lorsqu’une suite textuelle unique est retrouvée dans la boîte. Cette comparaison étaye la couleur déclarée, y compris deux fragments bicolores. Elle ne certifie pas chaque glyphe des fragments que PyMuPDF et PDF.js structurent différemment. Les partitions réservées sont exclues.

| Document | Fragments significatifs | Associés | Ambigus / sans association | Réf. PyMuPDF | Associés avec référence, RGB exact | Fragments chromatiques d’accord, natif / raster |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Berkeley, corrigé avec rouge et formules | 1 095 | 1 071 | 15 / 9 | 1 095 | 1 071 / 1 071 | 135 / 134 sur 135 |
| Lyon 2, questions bleues | 1 653 | 1 594 | 9 / 50 | 1 642 | 1 594 / 1 594 | 61 / 75 sur 75 |
| ENSAI hybride, 12 p. | 3 106 | 3 045 | 39 / 22 | 3 092 | 3 044 / 3 044 | 1 015 / 1 027 sur 1 036 |
| ENSAI deux sessions, 4 p. | 751 | 738 | 13 / 0 | 751 | 738 / 738 | aucun |
| Virginia Tech, coches typographiques | 847 | 817 | 26 / 4 | 843 | 817 / 817 | 180 / 183 sur 183 |
| Washington, QCM sur fonds colorés | 423 | 421 | 2 / 0 | 423 | 421 / 421 | aucun caractère chromatique référencé |
| Liège, sujet seul avec couleur et formules | 2 595 | 2 272 | 100 / 223 | 2 506 | 2 251 / 2 251 | 1 / 2 sur 2 |
| MIT, scan manuscrit (17 p.) | 0 | 0 | 0 / 0 | 0 | — | — |
| Total | 10 470 | 9 958 | 204 / 308 | 10 352 | 9 936 / 9 936 | — |

Sur Berkeley, le raster rapporte une teinte sur 46 fragments dont la référence est neutre. Les résultats chromatiques tolèrent une distance circulaire de 15° pour les deux méthodes. Le raster rapporte les teintes présentes dans la boîte, y compris des voisins ou du fond. Le vectoriel rapporte des plages de caractères et peut rendre un fragment non associé. Le coût du canal natif est détaillé dans les sorties de l’évaluateur, avec la rasterisation et l’analyse de l’encre comptées à part. Ces temps sont des relevés ponctuels dépendant de la complexité et de la machine.

Sources. [Berkeley CS186](https://hkn.eecs.berkeley.edu/examfiles/cs186_sp10_f_sol.pdf), [Lyon 2](https://perso.univ-lyon2.fr/~rabdesse/Documents/UFR-SEG/LICENCE/L2/CCC1-2024-2025.pdf), [Virginia Tech CS3214](https://courses.cs.vt.edu/cs3214/fall2025/documents/CS3214_Fall_2025_Final_Exam_Solutions.pdf), [UW CSE122](https://courses.cs.washington.edu/courses/cse122/24wi/exams/Sample_Final_Exam-CSE_122_23au_solutions.pdf), [Liège MATH0013](https://www.mmm.ulg.ac.be/files/MATH0013/examens_alg/ExamenAlg_Se25_pub.pdf), [MIT 16.30](https://ocw.mit.edu/courses/16-30-estimation-and-control-of-aerospace-systems-spring-2004/resources/final_solna/).

## Reproduire

Avec le serveur local Vite et l’environnement Python défini dans [le laboratoire](README.md).

```sh
npm test -- src/detection/visual/vector
node research/pdf-vector/compare-browser.mjs http://127.0.0.1:5201/ --native-text /chemin/document.pdf > /tmp/unspoil-native-text.json
python research/pdf-vector/score_text.py /tmp/unspoil-native-text.json /chemin/document.pdf
```

Ajouter `--glyph-truth research/pdf-vector/public-truth/virginia-tech.json --glyph-iou 0.50` pour vérifier les cellules du PDF public correspondant. Le JSON du navigateur contient des extraits du PDF pour la vérification textuelle. Conserver cette trace localement. `score_text.py` imprime les agrégats et l’empreinte du document. Aucun PDF ou extrait textuel ne fait partie du module.
