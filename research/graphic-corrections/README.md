# Diagnostic graphique · phase 4.4

L’adaptateur Edge appelle le sous-détecteur sur le rendu local et les opérations PDF.js. Il mesure séparément les boîtes d’objets, les masques et le rattachement au bloc attendu. Le code bascule entre modalités sans modifier le moteur ni le benchmark officiel. Aucun document réservé n’a été consulté. Les PDF restent locaux et seules les fiches géométriques de sources publiques sont incluses.

## Protocole

- **A historique** appelle le point d’entrée réel `detectCorrections` de `main` à la base `0444703`. Le diagnostic lui fournit les mêmes pages, pixels et observations PDF.js que le module en cours. Il écarte les masques quand le moteur demande le repli. Cette référence n’est pas le candidat indépendant `3709b44`.
- **Physique seule** exécute le module sans ancres ni convention de peinture. **Contexte** active les périmètres annotés de correction mais ne fournit ni les protections explicites de la fiche ni la convention de peinture mixte. **Complet** transmet les trois. Les ablations native, raster et hybride gardent identiques les rôles disponibles et le rendu utilisé pour le score.
- Les périmètres manuels décrivent le contexte, comme une zone sous un énoncé ou une colonne de résultats. Les boîtes de vérité décrivent des objets plus précis. Elles n’entrent pas dans le détecteur. Ce diagnostic évalue ce que l’API peut faire avec un contexte fiable. Le mode **blocs historiques seuls** applique les ajouts sans périmètres manuels et mesure l’intégration actuellement possible sans nouvelles ancres.
- Les cibles de correction sont les pixels non blancs (composante minimale < 232), ou les pixels de la couleur spécifiée à ±18 RGB par canal. Un objet est strictement couvert si tous ses pixels cibles sont couverts par l’union des masques. L’association stricte exige le même résultat dans son bloc attendu. Un énoncé est touché dès le premier pixel couvert. Les cibles publiques sont des extraits annotés et ne suffisent pas à calculer une précision complète par page.
- Trois PDF publics de diagnostic et quatre pages annotées. MIT p. 2 reprend les boîtes publiées dans le diagnostic de Salif. MIT p. 4, Berkeley p. 3 et Washington p. 1 sont annotées sur leur rendu. Washington reprend trois bandes de teinte du diagnostic et protège les propositions. La synthèse couvre trois scènes avec une variante d’échelle, marges, teinte et résolution. Une variante n’est pas un nouveau document indépendant. [MIT 2.007](https://ocw.mit.edu/courses/2-007-design-and-manufacturing-i-spring-2009/559019a24f0c8a3729570785aa963939_MIT2_007s09_sol_exam01.pdf), [Berkeley CS186](https://hkn.eecs.berkeley.edu/examfiles/cs186_sp10_f_sol.pdf), [Washington CSE122](https://courses.cs.washington.edu/courses/cse122/24wi/exams/Sample_Final_Exam-CSE_122_23au_solutions.pdf)

## Résultats Edge

| Méthode | Synthétique strict / 10 | Public strict / 7 | Énoncés publics touchés / 4 | Pixels correction publics | Blocs publics exacts / 7 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Historique | 0 | 1 | 1 | 5 625 / 46 503 | non comparable par identifiant |
| Physique seule | 0 | 0 | 0 | 0 / 46 503 | 0 |
| Contexte sans protections explicites ni peinture mixte | 6 | 1 | 0 | 37 307 / 46 503 | 1 |
| Native, contexte complet | 4 | 0 | 0 | 879 / 46 503 | 0 |
| Raster, contexte complet | 10 | 1 | 0 | 37 307 / 46 503 | 1 |
| Hybride, contexte complet | 10 | 1 | 0 | 37 307 / 46 503 | 1 |
| Blocs historiques seuls + sous-détecteur | 0 | 1 | 1 | 5 625 / 46 503 | non comparable par identifiant |

Aucun des six énoncés synthétiques n’est touché. Les dix corrections synthétiques couvertes par raster/hybride le sont dans le bloc attendu. Sur le public, **trois cibles restent partielles et trois sans masque** en hybride. MIT p. 4 est strictement couverte (33 380 pixels) avec préservation du dessin d’énoncé. Les deux schémas de la p. 2 atteignent 1 400/2 015 et 1 648/1 721 pixels. L’ablation sans rattachement des petites légendes à une figure voisine donnait 1 235 et 1 339. Cette règle exige une figure observée au raster et un même périmètre confirmé. L’écart restant inclut des traits et légendes dissociés. Berkeley p. 3 atteint 879/5 625 pixels de résultat avec préservation des libellés de données. Le moteur historique couvre les résultats et touche les 2 380 pixels de l’énoncé annoté. Les trois aplats de Washington restent visibles. Une surface blanche ne permet pas d’y enlever la teinte avec la garantie de conserver les propositions. Le résultat hybride remonte ce conflit.

La précision de localisation est mesurée par appariement unique à IoU ≥ 0,50. Sur les 16 objets synthétiques, native, raster et hybride retrouvent les 16, avec respectivement 42, 31 et 67 propositions brutes. Le rapport des objets appariés aux propositions est donc 38 %, 52 % et 24 %. Cette métrique au niveau objet compte les propositions de fragments et cellules supplémentaires non appariées. Sur les 11 cibles publiques, les rappels sont 4/11, 5/11 et 5/11. Les IoU médianes des appariements valent 0,695, 0,629 et 0,762. Les 58, 135 et 159 propositions couvrent aussi des objets hors des extraits annotés. L’hybride fournit 112 notes d’ambiguïté et 10 de contradiction sur les quatre pages publiques, dont plusieurs objets par même zone. Une note n’est ni un échec de document ni un déclencheur global de repli.

La variante à 90° est comptée à part. La première version hybride n’y couvrait strictement que 1/5 corrections, car la hauteur apparente des boîtes de texte conduisait à filtrer les traits et dilater les masques à une échelle trop grande. Lorsque cette estimation dépasse de deux fois la taille de police C1, le canal graphique reprend cette taille physique invariante. Le passage atteint alors **5/5 corrections, 0/3 énoncé touché**. Le mécanisme ne réordonne pas le texte d’une page tournée.

Les coûts natif, raster et hybride de ce passage sont respectivement **2,7, 64,6 et 54,9 ms** de médiane sur les pages publiques. Temps cumulés 9,6, 267,6 et 228,3 ms, hors ouverture, extraction des vecteurs et rendu. L’ordre d’exécution et l’échauffement du navigateur diffèrent. Le raster effectue deux balayages pour les séparateurs et conserve deux tableaux d’un octet par pixel pour l’encre et le texte, en plus du RGBA fourni. Les composants et associations peuvent coûter davantage sur des pages riches. Les allocations sont locales à une page. La tolérance des cadres reste 0,4 hauteur de texte estimée. Les gains mesurés ne justifient pas un traitement raster supplémentaire sur toutes les pages.

## Ablation géométrique C1

Avec les traces de la phase 4.3 et **sans** axe ni ligne de base de PDF.js, la variante locale fait passer les lignes mêlant des colonnes ou cellules de 7 à 1 sur les cinq pages annotées (F1 de paires de 0,9973 à 0,9992). La concordance de l’ordre passe de 581/655 à 585/655 pour les seules lignes locales, et à 630/655 avec XY-Cut. L’activation XY-Cut sur trois de ces pages conserve ce dernier score. Sur les cas synthétiques de base, la porte n’active que deux cas sur cinq. Les cinq transformations donnent une F1 de 0,2966 pour l’historique, 0,8666 pour l’alternative et 0,6784 sous activation conditionnelle. Dix mélanges historiques restent sous activation conditionnelle. Cette porte évite une substitution sur toutes les pages et laisse des cas difficiles de côté. La parité des groupes Python/TypeScript est mesurée séparément avec les mêmes lignes de base sur 14 cas horizontaux.

## Décision et intégration

- **B** pour le sous-détecteur raster/hybride avec périmètres confirmés. Le raster seul atteint le même score de couverture sur cette série. Le natif améliore l’IoU médiane des objets appariés et complète la topologie dans le test de cadre partiel. Les limites d’activation et les champs C1 sont décrits dans le [contrat local d’appel](../../src/detection/visual/graphic-corrections/README.md).
- **B** pour les séparateurs fermés, les cellules avec frontières vérifiées, la géométrie alternative et leurs diagnostics. Un cycle peut provenir d’un graphique et une hypothèse ouverte ou sans bord ne génère pas de masque de tableau.
- **C** pour masquer sur perception seule, pour appliquer une couleur de correction universelle ou pour conclure à un gain automatique à partir de ces mesures. La fusion de production et le contrôle indépendant restent nécessaires.

## Reproduire

```sh
python research/graphic-corrections/fixtures.py /tmp/synthetic.pdf /tmp/synthetic.json
python research/graphic-corrections/fixtures.py /tmp/variant.pdf /tmp/variant.json --variant
python research/graphic-corrections/fixtures.py /tmp/rotated.pdf /tmp/rotated.json --rotated
npm run dev -- --host 127.0.0.1 --port 5205 --strictPort
node research/graphic-corrections/evaluate.mjs http://127.0.0.1:5205/ /tmp/synthetic.json /tmp/synthetic.pdf > /tmp/score.json
python research/graphic-corrections/summarize.py /tmp/score.json
npm test -- src/detection/visual/graphic-corrections
```

Utiliser l’environnement PyMuPDF du [laboratoire PDF](../pdf-vector/README.md) pour générer les PDF synthétiques. Ajouter d’autres couples fiche/PDF à la commande Edge pour reproduire les agrégats. Pour la géométrie C1, fournir la trace et l’intermédiaire de la [phase 4.3](../document-layout/README.md) à `check-adaptive-production.mjs`, puis un troisième chemin de sortie. Passer cette sortie à `score-adaptive-production.py`. Le calcul du score est indépendant des observations fournies à la détection.
