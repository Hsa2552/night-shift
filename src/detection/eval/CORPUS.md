# Corpus d'annales réelles pour l'évaluation du détecteur

Les PDF ne sont **pas** dans le dépôt : ils appartiennent à leurs auteurs ou à leurs établissements.
`corpus.tsv` donne pour chacun l'adresse publique d'origine, la partition et l'empreinte SHA-256 du
fichier annoté. `annotations/<partition>/<nom>.roles.txt` ne contient que des numéros de ligne et des
rôles (aucun texte des annales).

- **dev** : documents utilisés pour analyser les échecs et régler les heuristiques.
- **test** : documents d'autres établissements, annotés à l'aveugle (sans sortie du détecteur) puis
  figés avant toute amélioration. On n'en regarde que les totaux pendant le développement.
- **dev-v2-sujets** : extension distincte à trois sujets seuls de Paris-Saclay, Strasbourg et Stanford.
  Les rôles et plages ont été relus sur les sujets, puis les boîtes de texte extraites sans prédiction.
  Le dénominateur de la partition `dev` historique garde ses 11 documents.

Reproduire : télécharger chaque PDF dans `<dossier>/<partition>/<nom>.pdf` (vérifier l'empreinte),
copier les `.roles.txt` à côté, installer localement `npm install --no-save @napi-rs/canvas`, puis
`UNSPOIL_EVAL_DIR=<dossier>/test npx vitest run src/detection/eval`.

Rôles : `q` énoncé, `c` correction, `t` titre ou texte neutre, `m` ligne mêlant les deux ou zone
non annotée (exclue des mesures). Lignes = lignes reconstruites par `layoutPage`, dans l'ordre de
lecture ; une modification de la reconstruction des lignes impose de réannoter.

## Benchmark automatique

```
npm install --no-save @napi-rs/canvas   # rendu raster sous Node (facultatif : sinon texte seul)
npm run benchmark:dev                   # ou benchmark:test, benchmark:all
node scripts/benchmark.mjs ensai-dev --cache <dossier>   # documents locaux non publics
```

- Le lanceur lit `corpus.tsv`, télécharge les PDF publics absents dans le cache
  (`UNSPOIL_CORPUS_DIR`, sinon `~/.cache/unspoil-corpus`, toujours hors du dépôt), vérifie
  leur SHA-256, puis exécute le vrai lecteur (`readPageText`, rendu raster) et le détecteur.
  `--hors-ligne` n'effectue aucun téléchargement.
- Vérité terrain : `annotations/<partition>/<nom>.geo.json` (format `unspoil-verite-geo/1`,
  rectangles dans le repère C1, aucun texte, champ `provenance` : humaine ou automatique).
  Une vérité non publiable (ENSAI : elle contient l'état des cases) reste dans le cache,
  à côté du PDF. Le détecteur évalué ne produit jamais sa propre vérité.
- Rapports dans `<cache>/rapports` : `<partition>-dernier.md` et `.json`, plus une copie
  horodatée. Le format `unspoil-benchmark/2` enregistre le commit, l'état de travail Git,
  les empreintes PDF et annotation, la version du corpus et des métriques, et le moteur
  d'exécution. Les comparaisons automatiques exigent des empreintes et modalités identiques.
- Unités : les lignes reconstruites (annales générales) et les cases (QCM ENSAI) ; ne pas
  comparer des taux calculés sur des unités différentes.
- Workflow manuel : `.github/workflows/benchmark.yml` (publie seulement les rapports).

## Métriques `unspoil-geo/2`

- **Régions brutes**. Les champs historiques `corrections`, `statements` et `blocks` gardent
  les seuils de 95 % et 5 % et mesurent les propositions même si le lecteur reste couvert.
- **Parcours**. `presentation` décrit le masquage automatique avec ses régions après
  validation, le sujet seul, la lecture progressive ou l'erreur. Les résultats incertains,
  contradictoires ou sans masques valides activent la lecture progressive. Une lecture
  progressive ou une erreur compte pour zéro réussite automatique. La couverture vaut `null`
  dans ces modes, car la visibilité dépend de la manipulation de l'étudiant. Une vérité annotée
  `statement_only` exige le vrai parcours sujet seul pour compter comme réussite.
- **Mesure complémentaire stricte**. `strict` mesure la couverture par union des rectangles
  et les énoncés sans intersection. `category` peut distinguer texte, case vide, case remplie
  et figure. Les annotations historiques sans catégorie sont comptées dans `unspecified`.
  Un groupe QCM annoté dont une case est incomplètement couverte, ou dont la géométrie permet de
  séparer les états rempli et vide, est à risque de fuite indirecte. Les profils de masque par
  case sont quantifiés à 2 points. `strictSuccess` exige une couverture complète, tous les énoncés
  préservés, tous les blocs annotés indépendants et aucun risque ainsi mesuré. Les indices fins
  du style et des traits pâles restent à contrôler visuellement.
- **Encre**. Avec `UNSPOIL_BENCH_INK=1`, les pixels du raster canonique sur fond blanc sont
  échantillonnés au centre. Un pixel d'encre a au moins un canal RVB inférieur à 239. Le rapport
  compte les zones annotées avec encre visible ou masquée et les zones sans encre détectée.
  Le résultat dépend du moteur, de la résolution et du seuil. Les fonds teintés et les traits très
  pâles demandent une revue visuelle. Les annotations automatiques ou d'origine inconnue gardent
  leur provenance et doivent être lues séparément des annotations relues.

## Recette navigateur et parité

Construire le checkout choisi avec `npm run build -- --manifest`. Le build doit inclure le
marqueur `unspoil-build` de la recette de production. Lancer depuis le dépôt d'évaluation.

```sh
node scripts/benchmark-browser.mjs /chemin/checkout dev /chemin/cache /chemin/rapport-edge.json
node scripts/pdf-parity.mjs /chemin/checkout /chemin/diagnostic.pdf /chemin/annotation.geo.json /chemin/parite.json
```

Le navigateur de référence est Edge par défaut. `UNSPOIL_CHANNEL` permet de choisir un autre
canal Chromium installé. La recette lit les masques réels, vérifie leur opacité et rejoue chaque
commande de révélation. Elle compare ensuite l'oracle de décision aux masques effectivement
présentés, avec une tolérance de 0,01 point pour la sérialisation CSS. Les temps navigateur
comprennent import et interaction, tandis que le temps Node isole le détecteur. Les deux rapports
JSON emploient le même agrégateur, avec le même dénominateur relatif aux documents mesurables et
des compteurs de provenance distincts.

Le protocole de parité compare le texte et la géométrie des lignes après normalisation des
identifiants de police par document. Les quatre croisements texte/raster alimentent une seule
instance du moteur construit depuis le checkout, et le résultat est comparé au vrai bundle Edge.
Le diagnostic Savoie est une exposition du test historique réservée à la reproductibilité.
`UNSPOIL_PARITY_CONTROLS=1` ajoute les contrôles de transformée, ressources et polices sous Node.

Pour une partition réservée, définir `UNSPOIL_BENCH_MANIFEST` vers un manifeste local exporté
avant évaluation, ajouter la sixième colonne `truth_sha256` et placer les annotations dans le
cache à côté des PDF. Le runner vérifie les deux empreintes avant mesure. Conserver les détails
hors du dépôt et partager uniquement le résumé pendant le développement. Le corpus réservé v1
contient des unités annotées sur un sous-ensemble de pages. Les résultats valent pour cet échantillon.
