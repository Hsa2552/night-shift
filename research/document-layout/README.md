# Géométrie adaptative · expérience 4.3

Le laboratoire compare le vrai `layoutPage` du dépôt et deux reconstructions à partir des mêmes fragments PDF.js. Il ne produit aucune classification de corrigé. `collect.mjs` exporte des géométries et identifiants techniques locaux, sans texte. Aucun PDF n’est enregistré dans le dépôt.

## Audit de la reconstruction existante

- Les rangées s’étendent par recouvrement vertical d’au moins 50 % de la plus petite boîte parmi les trois dernières rangées. Une union étendue par un fragment haut peut en absorber d’autres. Les lignes fondées sur la ligne de base sont testées dans le laboratoire.
- L’espace de coupure utilise le maximum entre trois hauteurs de rangée et 5 % de la largeur de page. L’ajout de marges peut donc déplacer le seuil sans changer le contenu. Le laboratoire estime une largeur de caractère par fragment et une distribution de petits écarts.
- La gouttière est unique et recherchée entre 20 et 80 % de largeur. Les bandes de pleine largeur sont définies par son franchissement. Il n’y a pas de paragraphes natifs, donc les zones existantes servent de référence de blocs au niveau le plus proche. L’imbrication et les trois colonnes échappent à cette représentation.
- Les abscisses de caractères sont uniformément réparties sur leur fragment. La phase 4.2 fournit une géométrie de cellules de police avec une autre granularité. Les mesures ici portent sur les groupes de fragments, sans évaluation d’encre par caractère.

## Méthodes

- Voisinage local des fragments. Vote d’orientation à partir des axes PDF.js, ligne de base et recouvrement, estimation robuste des espacements en unités de caractères. Un index en bandes ordonnées limite les comparaisons candidates.
- XY-Cut récursif par projection de boîtes, après reconstruction adaptative des lignes. Analyse des ruptures horizontales et verticales. [Seth et Nagy, approche X-Y](https://sites.ecse.rpi.edu/~nagy/PDF_chrono/1984_Seth_icpr84-xy-tree.pdf)
- Regroupement par plus proches voisins verticaux mutuels, avec distance normalisée par l’interligne médian et MAD. Cette adaptation de Docstrum manipule directement des fragments et lignes PDF. Elle ne reproduit pas l’extraction de composantes connexes à partir d’une image. [O’Gorman, Docstrum](https://ieeexplore.ieee.org/abstract/document/244677)
- Graphe de fragments, lignes, blocs et objets natifs. Arêtes d’appartenance, ordre de lecture, style et proximité mesurée. Les quatre meilleurs voisinages par objet conservent les coûts, recouvrements et inclusions. Tous les résultats restent des observations.

## Premier passage

Le fichier `public-reference.json` contient les bandes de 81 lignes annotées visuellement sur cinq pages publiques. Les annotations ne couvrent que les zones indiquées par leurs coordonnées. Il s’agit de quatre PDF de développement, avec cinq cas synthétiques indépendants et cinq transformations de ces cas. Aucun document réservé n’a été utilisé.

| Ensemble | Méthode | F1 paires de fragments | Ordres concordants | Lignes mélangeant les colonnes/cellules | Blocs IoU ≥ 0,50 |
| --- | --- | ---: | ---: | ---: | ---: |
| 5 pages publiques | Actuelle | 0,9973 | 581/655 | 7 | 5/14 |
| 5 pages publiques | XY-Cut | 0,9992 | 630/655 | 1 | 7/14 |
| 5 pages publiques | Voisins | 0,9992 | 586/655 | 1 | 7/14 |
| 5 synthèses originales | Actuelle | 0,8684 | 452/508 | 5 | 8/18 |
| 5 synthèses originales | XY-Cut | 1,0000 | 484/508 | 0 | 3/18 |
| 5 synthèses originales | Voisins | 1,0000 | 492/508 | 0 | 18/18 |
| 5 variantes | Actuelle | 0,2966 | 290/483 | 11 | 8/18 |
| 5 variantes | XY-Cut | 1,0000 | 453/483 | 0 | 7/18 |
| 5 variantes | Voisins | 1,0000 | 483/483 | 0 | 18/18 |

La F1 agrégée pondère fortement les pages à fragments nombreux. Les boîtes de blocs proviennent d’une annotation physique. Elles ne constituent pas une vérité pédagogique. Le graphe et l’heuristique de proximité actuelle trouvent les trois relations synthétiques annotées. Le premier passage ne montre aucun bénéfice du graphe sur ce critère.

## Reproduire

```sh
python research/document-layout/fixtures.py /tmp/layout-fixtures.json
npm run dev -- --host 127.0.0.1 --port 5203 --strictPort
node research/document-layout/collect.mjs http://127.0.0.1:5203/ /tmp/layout-fixtures.json /chemin/document.pdf > /tmp/layout-trace.json
python research/document-layout/experiment.py /tmp/layout-trace.json --intermediate /tmp/layout-intermediate.json
```

La topologie par page et les graphes sont dans le JSON intermédiaire. L’évaluateur Python utilise seulement la bibliothèque standard.

Sources des pages annotées. [DocLayNet, p. 2 et 4](https://arxiv.org/pdf/2206.01062), [Berkeley, p. 3](https://hkn.eecs.berkeley.edu/examfiles/cs186_sp10_f_sol.pdf), [Lyon 2, p. 1](https://perso.univ-lyon2.fr/~rabdesse/Documents/UFR-SEG/LICENCE/L2/CCC1-2024-2025.pdf), [Washington, p. 1](https://courses.cs.washington.edu/courses/cse122/24wi/exams/Sample_Final_Exam-CSE_122_23au_solutions.pdf).
