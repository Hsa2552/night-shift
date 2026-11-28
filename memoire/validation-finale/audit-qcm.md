# Audit des indices indirects dans les QCM

## Protocole

La mesure historique compare les masques aux rectangles annotés. Un rectangle de case cochée peut inclure les traits de la coche qui débordent. La mesure complémentaire compare les profils de masques par rapport au cadre physique, mesuré dans le PDF d'origine, à un point PDF près sur chacun des quatre paramètres. Elle exige un cadre localisé pour chaque option d'un groupe qui contient à la fois des cases vides et remplies. La couverture continue d'utiliser les rectangles d'origine, y compris la marque qui dépasse. Les seuils, mesures et rapports historiques n'ont pas changé.

Sur la page 15 de Virginia Tech, les carrés et les coches sont deux glyphes distincts. Les 15 carrés de sept groupes ont été localisés à partir du glyphe carré, puis mesurés sur le trait de cadre dans un raster à 20 pixels par point, sans utiliser les masques ni retoucher les annotations. Les masques bruts d'Edge ont été mesurés sur 6f7c4e4 et e132238.

| PDF et sortie mesurée | Groupes avec cadres | Indices de forme historiques | Indices de forme sur cadres | Groupes avec couverture incomplète |
| --- | ---: | ---: | ---: | ---: |
| Virginia Tech, page 15, sortie brute, 6f7c4e4 | 7 | 6 | 0 | 1 |
| Virginia Tech, page 15, sortie brute, e132238 | 7 | 6 | 0 | 1 |

Les six alertes de forme s'expliquent par la différence des rectangles de référence. Une couverture incomplète demeure. Le document passe en révélation progressive dans le parcours Edge de ces deux versions.

## Contrôle visuel complémentaire

Sur Washington, page 1 partie A, certains fonds verts restent visibles entre et autour des caractères après le masquage dans Edge. L'indice colorimétrique subsiste même lorsque les cases sont masquées. Le même document conserve des réponses visibles dans le tableau de la partie B. Ce PDF est écarté de la démonstration automatique. Le score de géométrie des cases seul ne détecte pas l'indice de fond.

## Régressions couvertes

Les tests synthétiques vérifient trois situations. Un contour identique reste symétrique avec une coche débordante, une forme effectivement différente est détectée et une marque débordante encore visible reste une couverture incomplète. Une absence de cadres vérifiés laisse le groupe hors de la mesure complémentaire.
