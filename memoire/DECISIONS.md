# Journal des décisions

> Ajout en fin de section uniquement. On ne supprime jamais une décision : on la marque `[OBSOLÈTE]` avec un renvoi vers celle qui la remplace, pour qu'aucun agent ne la réintroduise.
> Identifiant : `D-<jour>-<hhmm>-<initiales>`, par exemple `D-27-2140-AM`.
> Seul un humain passe une décision en `[DÉCIDÉ]`, en indiquant son prénom et l'heure.

## Décisions

### D-INIT-1 · Mémoire commune aux agents · `[PROPOSÉ]`

- **Contexte** : Claude Code et Codex travaillent en parallèle sur le dépôt, depuis plusieurs machines, sans partager leurs conversations.
- **Décision** : une source unique de règles, `AGENTS.md`, importée par `CLAUDE.md`, et une mémoire en Markdown dans `memoire/`, versionnée avec le code.
- **Justification** : Codex lit `AGENTS.md` nativement. Claude Code lit `CLAUDE.md` et les fichiers qu'il importe avec `@`. Un seul fichier de règles ne peut pas diverger.
- **Alternatives écartées** : deux fichiers de règles indépendants (divergence au fil du hackathon) ; lien symbolique `CLAUDE.md` vers `AGENTS.md` (pose problème sous Windows et empêche l'agent d'éditer le fichier) ; mémoires propres à chaque outil (invisibles pour l'autre).
- **Conséquences** : toute règle commune s'écrit dans `AGENTS.md` ; après modification, numéro de version incrémenté et sessions relancées.
- **Responsable** : _prénom de l'humain qui valide_

### D-INIT-2 · Workflow Git · `[PROPOSÉ]`

- **Contexte** : plusieurs humains et agents poussent en parallèle pendant la nuit ; main doit rester démontrable.
- **Décision** : une branche par tâche ; fusion dans main par un humain uniquement, via Pull Request ; main intégrée dans les branches par `git merge`, jamais par rebase d'une branche poussée ; aucune opération destructrice sans accord humain.
- **Justification** : sans rebase de branches poussées, personne n'a besoin de force-push ; les historiques des autres ne sont jamais réécrits.
- **Alternatives écartées** : push direct sur main (main cassée en pleine nuit) ; rebase systématique (force-push obligatoire, risque d'écraser le travail d'un autre).
- **Conséquences** : historique avec des commits de fusion, accepté pour un hackathon.
- **Responsable** : _prénom de l'humain qui valide_

### D-INIT-3 · Socle technique commun · `[PROPOSÉ]`

- **Contexte** : le sujet n'est pas choisi, mais les deux pistes candidates (Unspoil, Mardi 15h) prévoient la même base : une application web installable écrite en TypeScript avec React et Vite. L'équipe a demandé de préparer le dépôt pour pouvoir coder dès le choix du sujet.
- **Décision** : TypeScript strict, React, Vite, `vite-plugin-pwa`, Tailwind CSS, Vitest et Testing Library, oxlint et Prettier, CI GitHub Actions sur chaque PR, workflow GitHub Pages prêt mais désactivé. Aucun back-end, aucune fonctionnalité produit.
- **Justification** : base commune aux deux pistes ; langage que Claude Code et Codex maîtrisent le mieux ; une application installable impose JavaScript ; les types partagés servent de contrats entre agents ; Prettier et `.gitattributes` évitent les faux conflits entre machines.
- **Alternatives écartées** : Python (ni caméra, ni notifications, ni rendu PDF dans le navigateur) ; Next.js (rendu serveur inutile pour une application statique) ; ESLint (remplacé par oxlint, fourni par le modèle Vite actuel).
- **Conséquences** : le back-end (Supabase ou aucun) et la stratégie du service worker restent à décider avec le sujet ; `memoire/ARCHITECTURE.md` décrit le socle et les commandes. Fusionner la PR revient à valider cette décision : passer alors le statut en `[DÉCIDÉ]`.
- **Responsable** : _prénom de l'humain qui valide_

### D-27-2222-S · Fusion conditionnelle des PR ordinaires · `[PROPOSÉ]`

- **Contexte** : l'addendum de lancement demande de réduire les attentes entre jalons. GitHub indique que `main` n'a pas de protection de branche classique et ne renvoie aucune règle active pour cette branche. Le compte Git utilisé sur ce poste a le droit de pousser et aucun droit administrateur. La CI est active et son succès est vérifiable sur les PR.
- **Décision proposée** : après validation collective et intégration des Règles v2, un agent pourra fusionner immédiatement sa propre PR ordinaire dans `main`. Les PR touchant les fichiers verrouillés, les conflits d'attribution et les décisions produit ou d'architecture gardent la validation et la fusion humaines.
- **Conditions cumulatives** : PR ouverte et prête, limitée au périmètre de l'agent. Vérifications locales vertes. Branche à jour de `origin/main`, état fusionnable et revues requises satisfaites. Workflow CI de PR terminé avec succès sur le SHA de tête précis et testé. Aucun arrêt annoncé. Heure vérifiée à Paris et strictement avant le 28 novembre 2026 à 13 h.
- **Exécution proposée** : refaire `git fetch origin` et relire l'état GitHub juste avant la fusion. Figer le SHA et utiliser `gh pr merge --match-head-commit` ou l'équivalent GitHub qui reçoit le SHA attendu. En cas de rejet, identifier le motif et recommencer les vérifications si la branche a bougé. Aucune fusion différée, aucun contournement des protections et aucun réglage GitHub modifié.
- **Mise en vigueur** : obtenir l'accord de l'équipe, passer `AGENTS.md` en Règles v2 et actualiser la consigne correspondante de `memoire/INDEX.md` sur la branche dédiée. Après fusion humaine, annoncer l'entrée en vigueur et relancer les sessions d'agents. Les Règles v1 régissent les fusions jusqu'à cette intégration.
- **Responsable de la proposition** : Salif.

## Modèle

### D-<jour>-<hhmm>-<initiales> · <titre> · `[PROPOSÉ]` | `[DÉCIDÉ]` (prénom, heure) | `[OBSOLÈTE]` → D-...

- **Contexte** :
- **Décision** :
- **Justification** :
- **Alternatives écartées** :
- **Conséquences** :
- **Responsable** :
