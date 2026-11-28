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

### D-28-0315-HZ · Observations vectorielles attendues par le moteur · `[PROPOSÉ]`

- Proposé par : Hazem (Claude Code), pour Wael (couche vectorielle) et Salif (lecteur, C1).
- Besoin : des observations indépendantes du moteur de rendu. L'écart Node/Edge (Savoie 101/101 sous Node, 51/101 dans Edge, V-28-0211-WB) et les cases au contour pâle viennent du raster ; les opérateurs PDF donnent la même réponse partout.
- Forme proposée, par page, repère canonique C1, sans attribution de rôle :
  - `squares: { bbox: Rect; filled: boolean; stroke: boolean; rgb?: [number, number, number] }[]` : carrés et rectangles quasi carrés dessinés (cases de QCM, grilles) ;
  - `textColors: { textIndex: number; rgb: [number, number, number] }[]` : couleur de remplissage déclarée de chaque fragment de `PageData.textItems` ;
  - `rules: { bbox: Rect; orientation: 'h' | 'v' }[]` : traits et séparateurs ;
  - `images: { bbox: Rect }[]` : images matricielles (manuscrit numérisé, captures).
- Usage par le moteur : `squares` complète puis remplace `findBoxes` (raster) pour les cases ; `textColors` remplace l'échantillonnage du raster pour l'encre des lignes ; `images` sans texte deviennent des zones non analysables (contrôle final de cohérence) ; le raster reste le repli.
- Transport, deux options : (a) champ facultatif `getVectors?(pageIndex)` dans `DetectionInput` : **modification de C1, accord humain nécessaire** ; (b) enregistrement comme l'analyseur colorimétrique (`registerVectorSource`) sans toucher C1, mais état global par document. Recommandation : (a), plus sûre en cas de documents ouverts successivement.
- Alternative écartée : refaire l'extraction vectorielle dans le moteur (doublon du travail de Wael, consigne contraire).

### D-28-0319-WB · Perception hybride des documents · `[PROPOSÉ]`

- Proposée par Wael (Codex) au premier jalon vectoriel. Voir V-28-0319-WB et PR #16.
- Exploiter les opérations natives comme observations locales dans le repère C1. Le raster confirme la visibilité, complète les contours et traite les pages numérisées. Le moteur attribue les rôles et regroupe les observations par question et par session.
- Justification. Les 81 cases vides manquées par `findBoxes` brut dans le diagnostic sont présentes dans les deux relevés natifs. Les cas à glyphes, fond coloré ou scan nécessitent d’autres signaux.
- Raccordement soumis à revue avec Hazem et Salif. Le prototype n’édite aucune interface commune.

### D-28-0437-WB · Géométrie locale et cadres vectoriels · `[PROPOSÉ]`

- Wael propose des observations complémentaires de lignes locales et de cadres à séparateurs croisés. Le nombre de mélanges entre cellules baisse, et les cadres sont précis sur les trois pages annotées. Garder le traitement actuel en dehors des familles confirmées.
- La topologie dispose d’un prototype TypeScript isolé. Le classement automatique du graphe et la fermeture raster n’apportent pas de bénéfice dans le protocole. Les résultats et limites sont consignés dans V-28-0428-WB et V-28-0437-WB, PR #24.

### D-28-0655-HZ · Interface moteur ↔ sous-détecteur graphique de Wael · `[PROPOSÉ]`

- Proposé par : Hazem (Claude Code), pour Wael ; à valider par l'équipe (aucune modification de C1 : interface interne au module de détection, enregistrée comme l'analyseur colorimétrique).
- Le moteur transmet des ancres textuelles, sans rôle graphique : par page, `questions: { label?: string; bbox: Rect }[]` (lignes de question visibles), `blocks: { id: string; label?: string; regions: PageRegion[] }[]` (blocs de correction déjà décidés), `statements: Rect[]` (lignes d'énoncé visibles à préserver).
- Le sous-détecteur renvoie des propositions : `{ region: PageRegion; kind: 'figure' | 'table' | 'frame' | 'rule' | 'highlight'; blockId?: string; evidence: 'contained' | 'adjacent' | 'aligned' | 'ambiguous' }[]`.
- Règles de fusion côté moteur : une proposition rattachée à un bloc (`blockId`, preuve non ambiguë) étend ce bloc ; une proposition qui recouvre une ligne d'énoncé protégée est rejetée ; une proposition `ambiguous` non rattachée alimente le contrôle final (document ambigu, révélation progressive), comme une encre colorée inexpliquée.
- Enregistrement : `registerGraphicDetector(detector | null)` dans `fusion.ts`, appel asynchrone après la construction des blocs de texte, avec `getVectors` et `getRaster` déjà fournis au moteur.
- Cas d'usage immédiats relevés sur le diagnostic public : figure verte de Virginia Tech p. 11 (actuellement abstention), figures et formules du corrigé MIT, tableaux de réponses de Washington.

## Modèle

### D-<jour>-<hhmm>-<initiales> · <titre> · `[PROPOSÉ]` | `[DÉCIDÉ]` (prénom, heure) | `[OBSOLÈTE]` → D-...

- **Contexte** :
- **Décision** :
- **Justification** :
- **Alternatives écartées** :
- **Conséquences** :
- **Responsable** :
