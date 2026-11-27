# AGENTS.md · Règles communes des agents (Règles v1)

> Source unique des règles pour **tous** les agents (Codex, Claude Code, autres).
> Codex lit ce fichier nativement. Claude Code le lit via l'import de `CLAUDE.md`.
> Ne recopie pas ces règles ailleurs. Pour les modifier : accord humain, numéro de version incrémenté (`Règles v2`...), puis relance de toutes les sessions d'agents (les deux outils chargent leurs instructions au démarrage).

## 1. Projet

- Hackathon **Night Shift 2026** (ENSAI). Équipe d'étudiants ingénieurs, plusieurs machines, un dépôt GitHub commun, Claude Code et Codex en parallèle.
- Thème : une application, un outil ou un logiciel utile aux étudiants, diffusable à grande échelle.
- Sujet et périmètre : `memoire/PRODUIT.md`. Tant que ce fichier indique « Sujet : NON CHOISI », ne choisis aucun sujet, aucune stack, et ne développe aucune fonctionnalité.
- Règles officielles, jury, équipe : `memoire/CONTEXTE.md`.

## 2. Contraintes non négociables

- **Échéance officielle : samedi 28 novembre 2026, 13h00, heure de Paris.** Après, aucune modification du dépôt : code, documentation, mémoire, commit, push, merge, y compris par un agent ou une automatisation. Même cosmétique.
- Le planning interne et l'heure d'arrêt des agents sont décidés par l'équipe. Dès qu'un humain annonce l'arrêt, tu ne modifies plus rien.
- Ne lance jamais de tâche différée, planifiée ou en arrière-plan capable de modifier le dépôt plus tard.
- Tout est développé pendant le hackathon. Le rendu est ce dépôt.
- Le jury juge l'idée, l'utilité réelle, le besoin, la démo et la vision. La technique sert le produit, elle n'est pas un but.

## 3. Mémoire du projet

La mémoire appartient au dépôt et à l'équipe, pas à un agent ni à un fournisseur d'IA. Une information absente du dépôt n'existe pas pour les autres agents.

Point d'entrée : `memoire/INDEX.md` (quoi lire selon la tâche, statuts, qui écrit où).

| Fichier | Contenu |
|---|---|
| `memoire/CONTEXTE.md` | hackathon, règles officielles, jury, équipe, ressources |
| `memoire/PRODUIT.md` | problème, cibles, proposition de valeur, parcours, P0/P1/P2 |
| `memoire/DESIGN.md` | direction artistique, UX, composants, accessibilité |
| `memoire/ARCHITECTURE.md` | stack, arborescence, modules, flux, commandes (verrouillé) |
| `memoire/CONTRATS.md` | interfaces entre modules (verrouillé) |
| `memoire/DECISIONS.md` | décisions, justifications, alternatives, décisions remplacées |
| `memoire/ETAT.md` | synthèse, tâches, responsables, branches, blocages |
| `memoire/QUALITE.md` | tests, résultats vérifiés, problèmes connus, risques |
| `memoire/LIVRAISON.md` | checklist de rendu, README, démo |
| `memoire/journal/<prenom>.md` | sessions et passations de chaque membre |

- Lis seulement ce dont ta tâche a besoin. Ne relis pas tout le dépôt.
- Statuts d'une information : `[FAIT]` constaté, `[DÉCIDÉ]` validé par un humain (prénom), `[PROPOSÉ]`, `[HYPOTHÈSE]`, `[OBSOLÈTE]`. Une proposition écrite dans un fichier n'est **jamais** une décision. Seul un humain passe une entrée en `[DÉCIDÉ]`.
- Les mémoires propres à un outil (mémoire automatique de Claude Code, préférences locales de Codex) ne font jamais foi. Ce qui compte va dans le dépôt.
- Ne crée pas `CLAUDE.local.md`, `AGENTS.override.md`, ni de `AGENTS.md` ou `CLAUDE.md` dans un sous-dossier, sans décision de l'équipe : les deux outils ne lisent pas les mêmes fichiers et divergeraient.
- Aucun secret dans la mémoire.

## 4. Début de session

1. Vérifie que tu as chargé **Règles v1** (titre de ce fichier). Sinon, lis `AGENTS.md` avant toute action.
2. `git branch --show-current`, `git status`, `git stash list` : repère les modifications locales. Ne les écrase jamais.
3. `git fetch`, puis compare avec `git log --oneline HEAD..origin/main` (et `HEAD..origin/<ta-branche>` si elle existe à distance). Intègre selon §7. Jamais de pull à l'aveugle.
4. Lis `memoire/ETAT.md`, puis les fichiers que `memoire/INDEX.md` indique pour ta tâche.
5. Reprise d'une tâche : lis l'entrée de passation indiquée dans ETAT.
6. Vérifie les décisions et contrats qui touchent ta tâche, et ses dépendances avec le travail des autres.
7. Vérifie que la tâche respecte §2 et tient dans le temps que l'équipe t'a donné. Si tu ne le sais pas, demande.

## 5. Avant une modification significative

- Comprends l'objectif pour l'utilisateur, lis le code existant, liste les fichiers concernés.
- Vérifie dans ETAT que la tâche n'est pas déjà faite ou attribuée à quelqu'un d'autre.
- Vérifie les contrats applicables. Si l'un d'eux doit changer, arrête-toi et demande (§6).
- Définis les critères de « terminé » et identifie les risques d'intégration.
- Choix d'architecture ou de produit non tranché : propose un plan court et demande avant de coder. Choix mineur, local et réversible : décide, et note-le si c'est utile.
- Pose seulement les questions vraiment utiles.

## 6. Collaboration multi-agents

- D'autres humains et agents modifient le dépôt en même temps que toi. Ta conversation n'est partagée avec personne. Leurs changements peuvent invalider tes hypothèses.
- Chaque tâche significative a un responsable humain dans ETAT. Reste dans le périmètre de fichiers de ta tâche.
- Ne réécris pas, n'annule pas et n'écrase pas le travail d'un autre humain ou agent sans son accord.
- Les interfaces communes sont fixées dans `memoire/CONTRATS.md` **avant** les développements parallèles qui en dépendent.
- **Fichiers verrouillés** : `AGENTS.md`, `CLAUDE.md`, `memoire/CONTRATS.md`, `memoire/ARCHITECTURE.md`. Les modifier exige l'accord d'un humain, une branche dédiée (`contrat/...` ou `docs/...`), un commit séparé, une fusion rapide dans main et une annonce à l'équipe.
- Écriture dans les autres fichiers de mémoire : voir `memoire/INDEX.md`, section « Qui écrit où ».
- Claude Code peut relire le code de Codex et inversement. Une relecture ne remplace jamais les tests.

### Passation entre agents (changement d'outil, quotas épuisés, autre machine)

1. Commit WIP et push de la branche : `wip(<module>): passation`.
2. Entrée `PASSATION` en fin de `memoire/journal/<prenom>.md` (modèle : `memoire/journal/_modele.md`).
3. Dans ETAT, la tâche passe en `à reprendre` avec un renvoi vers cette entrée.
4. Le repreneur récupère la branche, lit l'entrée et les contrats, vérifie que le projet se lance **avant** de modifier quoi que ce soit, puis met à jour ETAT (agent, statut).

## 7. Git (mêmes règles pour tous les agents)

- `main` reste toujours démontrable. Personne n'y pousse directement. **Seul un humain fusionne dans main**, via une Pull Request. Un agent peut ouvrir une PR, jamais la fusionner sans demande explicite.
- Une branche par tâche, un responsable par branche : `feat/<objet>`, `fix/<objet>`, `contrat/<objet>`, `docs/<objet>` (minuscules, tirets).
- Tu peux committer et pousser sur ta branche de travail.
- Commits petits, fréquents, relus avant commit. Message : `type(module): résumé` (types : feat, fix, docs, contrat, test, refactor, chore, wip). Le code et la mémoire qui s'y rapporte vont dans le même commit.
- Synchronisation :
  - toujours `git fetch`, puis inspection, avant d'intégrer ;
  - pour intégrer main dans ta branche : `git merge origin/main`. Pas de rebase d'une branche déjà poussée : ainsi, personne n'a jamais besoin de force-push ;
  - sur main en local : `git pull --ff-only` uniquement ;
  - modifications non commitées : commit WIP ou `git stash push -m "<raison>"` avant d'intégrer.
- **Interdit sans accord humain explicite** : `push --force` (y compris `--force-with-lease`), `reset --hard`, rebase d'une branche partagée, suppression de branche distante, `checkout`, `restore` ou `clean` qui effacent des modifications, fusion dans main, modification des réglages GitHub.
- Conflit : ne supprime jamais un côté arbitrairement. Si le code en conflit appartient à un autre, demande-lui. Une fusion sans conflit Git ne garantit pas la cohérence : relance le projet et les tests.

## 8. Après une tâche significative

1. Relis ton diff. Lance les tests pertinents, ciblés d'abord. Vérifie que l'existant n'est pas cassé.
2. Mets à jour ton bloc de tâche dans ETAT (statut, maturité atteinte) et ton journal.
3. Décision importante : entrée dans `DECISIONS.md`. Nouveau problème, limite ou risque : `QUALITE.md`.
4. Écris clairement ce qui **n'a pas** été testé.
5. Commit cohérent, puis push sur ta branche.
6. Compte rendu court à l'humain : fait, vérifié, non vérifié, suite.

Modification triviale : le message de commit suffit.

## 9. Qualité et honnêteté

- Maturité d'une fonctionnalité : `codée` < `compile` < `testée` < `intégrée` < `utilisable` < `démontrable`. Annonce le niveau réellement atteint. Du code généré n'est pas une fonctionnalité terminée.
- Interdit : inventer des résultats, des tests utilisateurs ou des mesures ; prétendre avoir lancé un test ; cacher une erreur ou une limite ; modifier un test pour faire passer un code faux ; présenter des données fictives comme réelles ; confondre maquette, prototype simulé et fonctionnalité réelle.
- Données de démo et exemples synthétiques : toujours signalés comme tels, dans le code, l'interface et le README.
- Mesure quantitative : protocole, données, résultats et limites dans `QUALITE.md`.

## 10. Principes de développement

- Valeur utilisateur d'abord. Solution simple si elle suffit. Pas de complexité sans bénéfice visible.
- Toujours une version démontrable de bout en bout. Intégrer souvent. Une fonctionnalité fiable vaut mieux que plusieurs incomplètes.
- P0 avant P1 avant P2. Une P2 ne met jamais une P0 en danger. Les priorités évoluent avec le temps restant : c'est l'équipe qui les ajuste.
- Bibliothèques éprouvées, licences respectées, aucune dépendance inutile ou douteuse.
- Modules découplés pour permettre le travail parallèle. Erreurs et entrées invalides gérées.
- Le projet doit s'installer, se lancer et se tester depuis le dépôt, avec les commandes documentées dans le README.

## 11. Sécurité

- Jamais de mot de passe, clé API, token ou clé privée dans le dépôt ni dans la mémoire. Variables d'environnement, `.env` ignoré par Git, `.env.example` sans valeurs réelles si besoin.
- Pas de données personnelles ni de documents privés publiés sans autorisation. N'envoie pas de fichiers sensibles à des services externes.
- Vérifie tes permissions avant toute action sur GitHub ou un service tiers. Ne contourne pas les règles du hackathon.

## 12. Économie des ressources IA

- Lecture ciblée, résumés structurés plutôt qu'historiques, réutilisation des décisions déjà prises.
- Mode plan (ou équivalent) et modèle puissant pour la conception et les décisions complexes. Modèle plus économique pour l'implémentation courante.
- Pas de refonte non justifiée, pas de discussion répétée. Tests ciblés avant tests complets. Comptes rendus courts.

## 13. Incertitude, contradiction, blocage

Ordre de priorité en cas de contradiction :

1. règles officielles du hackathon ;
2. décisions humaines validées et demandes explicites des membres ;
3. code et résultats de tests vérifiés (état réel de l'implémentation) ;
4. `memoire/CONTRATS.md` ;
5. reste de la mémoire ;
6. propositions et hypothèses, quel que soit l'agent qui les a écrites.

- Une documentation ancienne n'annule jamais un changement plus récent. Tes propres décisions n'ont pas priorité parce qu'elles viennent de ton environnement.
- Contradiction importante : signale-la, identifie son origine, propose une résolution, et marque l'information remplacée `[OBSOLÈTE]`.
- Demande humaine contraire à une décision validée ou à un contrat : signale le conflit avant d'agir.
- Blocage : note-le dans ton bloc de tâche, propose une alternative, et préviens l'humain responsable.
