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

### D-27-2200-S · Unspoil · `[DÉCIDÉ]` (équipe, 27/11 vers 22 h)

- **Contexte** : l'équipe a arrêté le périmètre dans `DEBUT_Hackaton.txt` et Salif a lancé le développement.
- **Décision** : réaliser une PWA de masquage des corrections dans le PDF original, avec détection déterministe et révélation progressive en secours. Les PDF restent sur l'appareil.
- **Responsables** : Salif pour le lecteur PDF et la PWA, Hazem pour la détection, Wael pour le lecteur côté interface et les interactions.

### D-27-2222-S · Fusion conditionnelle des PR ordinaires · `[PROPOSÉ]`

**Champ.** Une fois les Règles v2 en vigueur, un agent peut fusionner immédiatement une PR dont il est responsable, sur une branche du dépôt, dans son périmètre et ciblant `main`. Les approbations de produit et d'architecture, les fichiers verrouillés, les dépendances nouvelles, les workflows et permissions GitHub, le déploiement et les conflits d'attribution restent soumis à validation et fusion humaines. Tout changement dont le périmètre est incertain suit ce même circuit.

**Synchronisation au premier plan.**

1. Au démarrage et avant chaque jalon ou push, lancer `git status --short --branch` et `git fetch origin`. Comparer `HEAD` avec `origin/main` et la branche distante de travail. Préserver les modifications locales et le travail d'autrui.
2. Intégrer `origin/main` avec `git merge origin/main` sur une branche de travail propre. Sur un `main` local, avancer uniquement en fast-forward. En cas de conflit appartenant à un autre membre, lui transmettre le détail et poursuivre une tâche indépendante. Après intégration, relire les contrats concernés, exécuter `npm ci` si le verrou a changé, puis les tests et le build.
3. Publier les jalons testés dans la branche et la PR. Pour une dépendance en attente, vérifier GitHub, travailler sur une tâche indépendante puis, si nécessaire, attendre au premier plan avec vérifications espacées de 30 à 60 secondes et une durée maximale convenue. Les sessions arrêtées ne laissent aucun processus capable de modifier le dépôt.

**Conditions cumulatives de fusion.**

- PR ouverte, sortie du brouillon, diff relu, aucun conflit, aucune demande de changement non résolue et revues requises par GitHub satisfaites. Le compte utilise ses permissions ordinaires et les identifiants de l'environnement.
- Sur `main`, un humain a rendu obligatoire la CI et l'exigence GitHub de branche à jour avant fusion. La vérification locale du dernier `origin/main` demeure nécessaire. L'exigence serveur protège aussi la fenêtre entre cette vérification et la fusion. Une protection non vérifiable ou une file de fusion obligatoire impose une fusion humaine.
- Refaire `git fetch origin` et vérifier que le SHA de la PR correspond exactement à la branche locale testée et intègre le dernier `origin/main`. `npm run check` et `npm run build` doivent réussir. Le workflow `CI` du dépôt, événement `pull_request`, et son job `verifier` doivent être terminés avec succès sur le SHA de tête testé. Une exécution ancienne, ignorée, annulée ou encore en cours est insuffisante.
- Vérifier avant la commande qu'aucun humain n'a annoncé l'arrêt et que l'heure de Paris précède le samedi 28 novembre 2026 à 13 h. Sur un échec d'autorisation, une tête déplacée, une base modifiée ou un état ambigu, interrompre la tentative et rejouer la synchronisation et les vérifications si la fusion reste autorisée.
- Utiliser la fusion synchrone GitHub `PUT /repos/{owner}/{repo}/pulls/{number}/merge` avec `sha` égal à la tête testée et la méthode de fusion validée par l'équipe. Vérifier la réponse et rafraîchir `origin/main`. Les options d'administration, l'auto-merge GitHub, la file d'attente et les automatisations différées sont exclues de ce protocole. Vérifier l'état de la PR avant tout nouvel essai si l'appel réseau a expiré.

**Mise en vigueur.** Salif, Hazem et Wael valident dans la PR le périmètre, les exceptions, la méthode de fusion et la protection serveur exigée. Le propriétaire vérifie les permissions et applique lui-même les protections convenues. Au dernier relevé, GitHub indique `protected: false` pour `main` et aucune règle active n'est remontée. Ensuite, la branche dédiée porte la mise à jour de `AGENTS.md` en Règles v2 et de la consigne correspondante dans `memoire/INDEX.md`. Un humain fusionne la PR. L'équipe vérifie les protections, annonce l'activation et relance toutes les sessions. Les Règles v1 restent en vigueur jusqu'à cette activation.

**Responsable.** Salif. La PR #5 soumet le protocole à l'équipe.

## Modèle

### D-<jour>-<hhmm>-<initiales> · <titre> · `[PROPOSÉ]` | `[DÉCIDÉ]` (prénom, heure) | `[OBSOLÈTE]` → D-...

- **Contexte** :
- **Décision** :
- **Justification** :
- **Alternatives écartées** :
- **Conséquences** :
- **Responsable** :
