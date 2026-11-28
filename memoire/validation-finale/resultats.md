# Validation indépendante du candidat figé

Le SHA testé est **ca93897ba1424e7570ab7b9ae271d5df39c13e5a**. Wael l'a déclaré figé dans la PR de convergence. Worktree détaché propre, Node 24.18.0 pour le build, PDF.js 6.5.438 et parcours Edge 158.0.4370.45. Le HTML servi a été vérifié devant chaque import. La CI du candidat est verte. [Convergence](https://github.com/Hsa2552/night-shift/pull/27) · [CI](https://github.com/Hsa2552/night-shift/actions/runs/46110798965)

## Résultats dans Edge

Les « masqués » sont les documents affichés avec un masque automatique. Les « intacts » sont les sujets acceptés sans masque. La somme donne le traitement automatique abouti à un affichage, indépendamment de sa réussite. Une réussite historique exige notamment les zones de correction couvertes à 95 % et un sur-masquage limité. Le critère strict exige la couverture complète, la préservation intégrale des zones annotées et la révélation indépendante des blocs annotés, sans indice géométrique QCM détecté par la métrique historique.

| Partition | Évaluables | Masqués + intacts (taux) | Progressifs | Réussite historique / stricte | Corrections couvertes à 95 %, sortie brute | Énoncés touchés, sortie brute | Médiane import + analyse | Erreurs techniques |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Développement historique | 10/11 | 8 + 1 (90 %) | 1/10 | 8/10 · 3/10 | 2 072/2 072 | 311/1 304 | 4,51 s | 0 |
| Diagnostic vectoriel public | 4/4 | 2 + 0 (50 %) | 2/4 | 0/4 · 0/4 | 34/48 | 3/24 | 3,36 s | 0 |
| Développement complémentaire du ZIP | 7/7 | 6 + 0 (86 %) | 1/7 | 1/7 · 0/7 | 56/71 | 16/188 | 3,11 s | 0 |
| Validation indépendante du ZIP | 5/5 | 3 + 1 (80 %) | 1/5 | 3/5 · 1/5 | 402/426 | 44/105 | 2,57 s | 0 |
| Réserve indépendante v1, évaluée une fois sur le SHA figé | 5/5 | 3 + 1 (80 %) | 1/5 | 1/5 · 1/5 | 37/47 | 43/53 | 2,66 s | 0 |

Un document historique a été ouvert et analysé mais ne présente aucune annotation exploitable dans le benchmark. Les durées couvrent l'ouverture et l'analyse sur ce poste. Elles ne mesurent ni l'installation ni un appareil physique. Aucun écart entre l'oracle et l'affichage dans ces cinq suites.

| Partition | Corrections couvertes à 95 %, plans affichés | Énoncés touchés, plans affichés | Affichages automatiques avec correction visible |
| --- | ---: | ---: | ---: |
| Développement historique | 1 634/1 634 | 78/716 | 0/8 |
| Diagnostic vectoriel public | 19/23 | 3/14 | 1/2 |
| Développement du ZIP | 56/61 | 16/172 | 2/6 |
| Validation du ZIP | 402/402 | 44/75 | 0/3 |
| Réserve v1 | 37/40 | 43/48 | 1/3 |

Les zones des documents en mode progressif sont exclues des chiffres des plans affichés. Les valeurs brutes et affichées répondent à deux questions différentes. Le résultat de la réserve est surtout limité par le sur-masquage des énoncés et par un document automatique laissant une correction visible.

## QCM et robustesse

- **Virginia Tech.** La mesure historique signalait six indices de forme sur sept groupes de la sortie brute. Par rapport aux contours physiques mesurés dans le PDF, le compteur tombe à zéro. Un autre groupe présente une couverture incomplète, et la décision du produit reste progressive. Les mesures historiques sont conservées. Voir [audit QCM](audit-qcm.md).
- **Washington.** Le fond vert reste perceptible entre les lettres et dans les espaces des propositions malgré les masques des cases. Le score géométrique sur le groupe affiché est à zéro. Cette observation visuelle est une fuite indirecte avérée.
- **Validation du ZIP.** La mesure historique signale un risque pour deux groupes QCM sur deux parmi les résultats affichés et annotés. Sur la réserve v1, elle ne signale aucun des six groupes affichés et annotés. Ces nombres ne mesurent pas toutes les formes possibles de fuite.
- **ENSAI-dev.** Les six PDF locaux correspondants ne sont pas disponibles sur le poste de Salif. Les chiffres 4/6, 602/602 et 20/476 proviennent de Hazem sur son jalon 6f7c4e4. Ils ne sont pas confirmés sur le SHA figé. [Mesure de Hazem](https://github.com/Hsa2552/night-shift/blob/3ab2453/memoire/QUALITE.md#v-28-0655-hz--phase-43-jalon-1--couleurs-glyphes-et-marques-natives)
- **Variantes d'un QCM synthétique.** Le tracé décoratif, une marge de 36 points et le passage à 75 % conservent six masques et deux commandes. La rotation réelle du PDF de 90° déclenche le repli progressif. Ces variantes partagent le même document source. Elles vérifient des invariances de présentation, sans constituer quatre observations indépendantes.
- **Aucun correctif produit proposé pour le rendu.** L'ajout sur la branche de validation concerne la méthodologie et ses tests synthétiques. Les fonds colorés persistants, la mauvaise détection de certains tableaux et la rotation sont des pistes de travail futur.

## Corpus et limites

Le ZIP fournit 7 références de développement, 5 de validation et 12 de test final. Les 12 PDF de développement et validation sont disponibles avec empreintes. Le développement compte 259 zones annotées, la validation 531. Codex a délimité ces extraits sur les rendus d'origine, avant observation des prédictions. Ces lots n'ont pas bénéficié d'une seconde annotation ni d'une relecture humaine pendant la session. Les fichiers publiés du développement conservent exactement les zones mesurées. La provenance et les empreintes des fichiers d'annotation ont été clarifiées après export.

Le nouveau test du ZIP est distinct de la réserve v1 déjà gelée. Neuf PDF de ce nouveau test ont pu être téléchargés et leurs empreintes verrouillées localement. Deux sources renvoient HTTP 403 et une autre est indisponible. Faute d'annotations fiables pour ce lot, le nouveau test n'a pas été scoré. Le seul résultat réservé présenté ci-dessus provient de la réserve v1.

Seuls les agrégats autorisés figurent ici. Les PDF, manifestes détaillés, annotations et résultats individuels des partitions réservées restent locaux. Les cinq lots sont trop petits pour une conclusion universelle. Le contrôle strict, l'écart entre les corpus et la persistance d'indices colorés doivent accompagner tout chiffre de couverture.
