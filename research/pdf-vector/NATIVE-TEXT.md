# Association des couleurs natives aux fragments · phase 4.2

`observeNativePage(page, items)` dans `src/detection/visual/vector/native-page.ts` reçoit le `PDFPageProxy` et les `TextItem` C1 de la même page. Le résultat étend les observations existantes avec `textColors` et `glyphSymbols`. Le lecteur peut transmettre ce résultat par le canal facultatif porté par Salif. Les indices restent ceux du tableau `items` donné par le lecteur, même s’il est réordonné.

## Couleur et fiabilité

- PDF.js 6.5.438 fournit les glyphes Unicode et leurs avances dans ses opérateurs natifs. Le prototype lit les métriques de police dans `commonObjs` après réception de la liste. Il reconstitue le repère canonique à partir des matrices de page, de formulaire et de texte, puis applique avances, caractères et espaces, `TJ`, échelle horizontale et décalage de ligne.
- Le rapprochement restreint les candidats par police et recouvrement, les groupe par ligne et direction, puis cherche une suite Unicode normalisée dans les deux sens. Une opération peut alimenter plusieurs fragments. Un fragment peut combiner plusieurs opérations et peintures. Les glyphes superposés restent dans la provenance. Un accent et sa lettre de base peuvent confirmer la même couleur si toutes les peintures sont d’accord.
- `textColors[].ranges` contient `start` et `end` en unités UTF-16 dans le texte original, `rgb` en sRGB 8 bits, les références aux opérateurs et l’évidence `text-and-geometry`. Les couleurs différentes restent séparées. Un `matched` couvre tous les caractères significatifs. Un `partial` émet les seules plages étayées. `ambiguous` signale des sources incompatibles ou une ambiguïté d’alignement. `unmatched` signifie qu’aucune suite compatible n’a été retrouvée.
- La fiabilité concerne le rattachement à une peinture déclarée avant composition finale. Les duplications contradictoires, modes invisibles, découpages complexes, transparences et peintures non univoques font perdre leur couleur aux caractères concernés. Les polices Type 3 et certaines écritures mixtes ou verticales peuvent rester sans résultat. Le raster conserve sa valeur pour la visibilité et les fragments non associés.

## Mesures · premier jalon

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

Sur Berkeley, le raster rapporte une teinte sur 46 fragments dont la référence est neutre. Les résultats chromatiques tolèrent une distance circulaire de 15° pour les deux méthodes. Le raster rapporte les teintes présentes dans la boîte, y compris des voisins ou du fond. Le vectoriel rapporte des plages de caractères et peut rendre un fragment non associé. Les deux sources sont complémentaires. Le canal natif prend de 8,3 à 14,7 ms par page en médiane par document textuel. L’extraction initiale du texte, l’ouverture et la rasterisation sont exclues de ce chiffre. Le PDF scanné reste plus coûteux à parcourir à cause de ses opérateurs image (40,7 ms par page dans ce passage).

Sources. [Berkeley CS186](https://hkn.eecs.berkeley.edu/examfiles/cs186_sp10_f_sol.pdf), [Lyon 2](https://perso.univ-lyon2.fr/~rabdesse/Documents/UFR-SEG/LICENCE/L2/CCC1-2024-2025.pdf), [Virginia Tech CS3214](https://courses.cs.vt.edu/cs3214/fall2025/documents/CS3214_Fall_2025_Final_Exam_Solutions.pdf), [UW CSE122](https://courses.cs.washington.edu/courses/cse122/24wi/exams/Sample_Final_Exam-CSE_122_23au_solutions.pdf), [Liège MATH0013](https://www.mmm.ulg.ac.be/files/MATH0013/examens_alg/ExamenAlg_Se25_pub.pdf), [MIT 16.30](https://ocw.mit.edu/courses/16-30-estimation-and-control-of-aerospace-systems-spring-2004/resources/final_solna/).

## Reproduire

Avec le serveur local Vite et l’environnement Python défini dans [le laboratoire](README.md).

```sh
npm test -- src/detection/visual/vector
node research/pdf-vector/compare-browser.mjs http://127.0.0.1:5201/ --native-text /chemin/document.pdf > /tmp/unspoil-native-text.json
python research/pdf-vector/score_text.py /tmp/unspoil-native-text.json /chemin/document.pdf
```

Le JSON du navigateur contient des extraits du PDF pour la vérification textuelle. Conserver cette trace localement. `score_text.py` imprime les agrégats et l’empreinte du document. Aucun PDF ou extrait textuel ne fait partie du module.
