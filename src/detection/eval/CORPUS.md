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
