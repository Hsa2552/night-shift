# Corpus d'annales réelles pour l'évaluation du détecteur

Les PDF ne sont **pas** dans le dépôt : ils appartiennent à leurs auteurs ou à leurs établissements.
`corpus.tsv` donne pour chacun l'adresse publique d'origine, la partition et l'empreinte SHA-256 du
fichier annoté. `annotations/<partition>/<nom>.roles.txt` ne contient que des numéros de ligne et des
rôles (aucun texte des annales).

- **dev** : documents utilisés pour analyser les échecs et régler les heuristiques.
- **test** : documents d'autres établissements, annotés à l'aveugle (sans sortie du détecteur) puis
  figés avant toute amélioration. On n'en regarde que les totaux pendant le développement.

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
  horodatée. Ils donnent le commit, la version du corpus, les erreurs de téléchargement, et
  par document, par famille et au total : type attendu et obtenu, corrections entièrement /
  partiellement / non masquées (par surface : 95 % et 5 %), lignes d'énoncé masquées,
  abstention (`unknown`, document couvert), réussite automatique, temps, ainsi que les
  régressions et résolutions par rapport à l'exécution précédente.
- Unités : les lignes reconstruites (annales générales) et les cases (QCM ENSAI) ; ne pas
  comparer des taux calculés sur des unités différentes.
- Workflow manuel : `.github/workflows/benchmark.yml` (publie seulement les rapports).
