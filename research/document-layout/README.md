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

Deux types de dégradation sont visibles. Sur Berkeley p. 3, le mélange de cellules baisse de cinq lignes à une, pendant que les propositions de blocs passent de 2/2 à 1/2. Sur DocLayNet p. 4, l’ordre XY-Cut réussit les 120 paires annotées et la F1 de fragments vaut 0,5 au lieu de 1,0. Cette F1 ne repose que sur quelques fragments multiparts de la page. L’ordre, le découpage physique et l’appartenance à une ligne restent des métriques distinctes.

## Ablations

| Expérience | Résultat vérifié | Décision |
| --- | --- | --- |
| Géométrie locale + voisins | 7 → 1 lignes mélangeant les colonnes/cellules sur le public. F1 des 5 transformations de 0,2966 à 1,0. Les 18 blocs de base et les 18 sous transformations sont retrouvés. Moins de gain sur l’ordre public et 36 propositions de blocs pour 7 cibles appariées sur 14. | **B**. Exploiter les lignes de base, la normalisation et les espacements pour les mises en page difficiles. Garder le découpage actuel pour les familles non confirmées. |
| XY-Cut | Une marge de 0,15 hauteur sur l’interligne habituel fait passer les blocs synthétiques de 3/18 à 17/18, et de 7/18 à 16/18 sous transformations. Résultats publics inchangés, dont 630/655 comparaisons d’ordre. Les liens de la figure à la légende peuvent franchir la coupure d’une bande. | **B**. Indice d’ordre pour les bandes à gouttière observable. La recherche de paragraphes reste complémentaire. |
| Graphe de rattachement | 3/3 liens synthétiques pour les trois méthodes. Sur deux ancres visuelles publiques, 0/2 avec le classement du graphe, 0/2 avec la référence et 1/2 par distance simple sur les lignes XY-Cut. La légende de DocLayNet est privilégiée par la distance simple. L’image d’explication de Washington a une ancre au-delà du voisinage local. | **C** pour le classement automatique essayé. Les coûts et relations restent disponibles pour analyse. Aucun score sémantique n’est livré. |
| Topologie des séparateurs natifs | 4/5 cadres ou tableaux annotés à IoU ≥ 0,50, aucune autre proposition sur les trois pages cibles. Washington 2/2, Berkeley 1/1, DocLayNet 1/2. Le tableau de DocLayNet à filets horizontaux n’a pas de cycle orthogonal détectable. IoU médiane par page sur les objets appariés de 0,978 à 0,992. | **B**, avec prototype TypeScript isolé. Fournit la géométrie pour les cadres ou grilles fermés. |
| Séparateurs via raster | À 1,5× et 2×, les longues traces non interrompues retrouvent 5/5 cibles sur les trois pages numériques, sans candidat supplémentaire. À 1×, 5/5 et un non-apparié. Le scan MIT p. 1 renvoie zéro candidat aux trois résolutions. | **B** comme complément de diagnostic. Le scan testé n’apporte aucun exemple positif de tableau numérisé. |
| Fermeture raster unidimensionnelle | Même rappel que les traces non interrompues. Trois propositions supplémentaires hors cible sur DocLayNet à 1,5× et 2×. | **C**. Relier les cassures dans les lignes de texte crée des intersections parasites. Hough et RANSAC restent non évalués sur cette famille. |

Les cinq variantes isolent la réduction d’échelle, les marges élargies, la rotation de 90°, l’interligne et la taille des boîtes-glyphes. Les modes adaptatifs reçoivent l’axe PDF.js pour les rotations. La référence utilise le contrat C1 actuel, qui ne transporte pas cette information dans chaque fragment. La robustesse à une rotation arbitraire ou à une page mêlant plusieurs orientations n’a pas été mesurée.

## Structure logique native

Sur **93 pages de 9 PDF de développement ou de diagnostic**, `getStructTree()` ne fournit aucun descendant exploitable et aucun identifiant de contenu marqué raccordé à un fragment. Le formulaire et les calques ne fournissent aucune observation sur cet échantillon. Deux documents ont une table de signets, qui donne une navigation de document et aucune position fiable de ligne. Les éventuels conteneurs racines vides ne sont pas comptés.

Le contrôle public W3C à deux colonnes fournit 19 identifiants de contenu marqué et rattache 56 fragments dans l’ordre déclaré. Son exemple de formulaire balisé rattache 13 fragments et fournit 7 champs interactifs. Le laboratoire lie les feuilles de type `content` aux groupes actifs pendant l’extraction des fragments. La fiabilité de l’ordre pédagogique et la cohérence entre pages restent à vérifier avant emploi. Le contrôle synthétique expose un champ et un calque optionnel. **B** comme source facultative lorsqu’un lien est effectivement présent. [W3C, ordre de lecture PDF](https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF3), [contrôle à deux colonnes](https://www.w3.org/WAI/WCAG21/working-examples/pdf-reading-order/reading-order-2cols-word.pdf), [PDF W3C balisé](https://www.w3.org/WAI/WCAG21/working-examples/pdf-interactive-form-fields/form-fields-keybd.pdf)

## Coûts et interface proposée

- La médiane par page publique de ce passage est de 0,50 ms pour la référence dans Edge, 3,43 ms pour XY-Cut, 3,39 ms pour les voisins et 3,94 ms avec les arêtes en Python. L’acquisition PDF, la rédaction des annotations et le calcul des métriques sont exclus. Le langage et le périmètre mesuré diffèrent. L’analyse raster seule sur les mêmes pages prend 38 à 66 ms environ à 1,5× selon la page et la variante, hors rendu.
- Le modèle réestime quatre échelles et une dispersion sur la page. Hauteur médiane, largeur de caractère, coupure horizontale, interligne et MAD de l’interligne. Aucun coefficient n’est appris sur ces documents ni sélectionné par nom de PDF. Il reste des constantes dimensionnelles documentées dans le code. Deux conditions d’orientation, quatre coefficients de fusion par voisins verticaux, une marge supplémentaire dans l’ablation XY-Cut et un seul coefficient de tolérance physique dans le prototype de cadres. Les autres limites fixent la fenêtre locale de recherche et le nombre d’arêtes. Ces expériences réduisent principalement les seuils en points ou en fraction de largeur de page.
- L’index ordonne les bandes en `O(n log n)`. Les requêtes de voisinage consultent des bandes et tailles de fenêtre bornées. La sortie du graphe est `O(fragments + lignes + objets)` avec au plus quatre arêtes classées par objet. XY-Cut retrie chaque sous-ensemble, soit `O(n log² n)` sur des coupures équilibrées et un coût quadratique à un facteur logarithmique près dans le pire cas non équilibré. Le prototype de cadres trie les segments et énumère uniquement les enregistrements dont l’abscisse entre dans l’intervalle d’un trait horizontal. Une grille dense peut encore produire un nombre quadratique d’intersections.
- Pour Hazem, les observations expérimentales exportent `parts` (indices des fragments du même lot), `box` (coordonnées C1), `model.spacing` et les blocs candidats. `locateRuledRegions` fournit des axes horizontaux et verticaux, une boîte et le nombre de croisements. La boîte décrit l’enveloppe du réseau survivant, et non toutes ses cellules ni une décision de masquage. Les relations restent locales à la page. Les transitions réelles entre deux pages et les cadres imbriqués connectés n’ont pas d’évaluation indépendante. Aucun changement de contrat C1.

Exemple synthétique de sortie intermédiaire de `locateRuledRegions`.

```json
{
  "box": [0.1, 0.1, 40.1, 10.1],
  "horizontal": [0.1, 10.1],
  "vertical": [0.1, 40.1],
  "crossings": 4
}
```

## Reproduire

```sh
python research/document-layout/fixtures.py /tmp/layout-fixtures.json
npm run dev -- --host 127.0.0.1 --port 5203 --strictPort
node research/document-layout/collect.mjs http://127.0.0.1:5203/ /tmp/layout-fixtures.json /chemin/document.pdf > /tmp/layout-trace.json
python research/document-layout/experiment.py /tmp/layout-trace.json --intermediate /tmp/layout-intermediate.json
node research/document-layout/check-rulings.mjs /tmp/layout-trace.json /tmp/layout-intermediate.json
python -m unittest discover -s research/document-layout
```

Le JSON intermédiaire contient les indices de fragments, les projections et les liens d’objets, sans texte. L’évaluateur Python utilise seulement la bibliothèque standard. Le contrôle de parité TypeScript utilise Node 24. Avec le [venv PDF existant](../pdf-vector/README.md), `raster_rules.py document.pdf 1 --scale 1.5` compare les deux traitements raster. `make_pdf_control.py /tmp/controle.pdf` crée le document synthétique pour tester les champs et calques.

Sources des pages annotées. [DocLayNet, p. 2 et 4](https://arxiv.org/pdf/2206.01062), [Berkeley, p. 3](https://hkn.eecs.berkeley.edu/examfiles/cs186_sp10_f_sol.pdf), [Lyon 2, p. 1](https://perso.univ-lyon2.fr/~rabdesse/Documents/UFR-SEG/LICENCE/L2/CCC1-2024-2025.pdf), [Washington, p. 1](https://courses.cs.washington.edu/courses/cse122/24wi/exams/Sample_Final_Exam-CSE_122_23au_solutions.pdf).
