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

## Modèle

### D-<jour>-<hhmm>-<initiales> · <titre> · `[PROPOSÉ]` | `[DÉCIDÉ]` (prénom, heure) | `[OBSOLÈTE]` → D-...

- **Contexte** :
- **Décision** :
- **Justification** :
- **Alternatives écartées** :
- **Conséquences** :
- **Responsable** :
