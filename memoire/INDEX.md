# Mémoire du projet · Point d'entrée

## Pour les humains : mode d'emploi

1. **Les règles des agents sont dans `AGENTS.md`.** Codex le lit tout seul, Claude Code le lit via `CLAUDE.md`, qui l'importe. Pour vérifier qu'un agent les a bien chargées, demande-lui : « Quelle version des règles as-tu chargée ? ». Réponse attendue : `Règles v1`.
2. **Lance les agents depuis le dossier du dépôt.** Après une modification d'`AGENTS.md`, relance toutes les sessions.
3. **Premier passage** : copie `journal/_modele.md` en `journal/<ton-prenom>.md` et complète le tableau de l'équipe dans `CONTEXTE.md`.
4. **Avant de confier une tâche à un agent** : la tâche existe dans `ETAT.md` avec ton prénom, et tu es sur sa branche.
5. **L'agent propose, l'humain valide.** Seul un humain passe une décision en `[DÉCIDÉ]` et fusionne une PR dans main.
6. **Changer d'outil en cours de tâche** (quotas épuisés, autre machine) : dis à l'agent sortant « fais la passation de T.. », puis à l'agent entrant « reprends T.. ».
7. Prompt de démarrage conseillé : « Lis AGENTS.md, fais le protocole de début de session, puis : [tâche]. »

## Pour les agents : quoi lire selon la tâche

Toujours `ETAT.md` d'abord. Ensuite :

| Tâche | À lire |
|---|---|
| Reprendre une tâche | entrée de passation indiquée dans `ETAT.md` (dans `journal/`) |
| Développer une fonctionnalité | `PRODUIT.md` (périmètre, priorité), `ARCHITECTURE.md`, `CONTRATS.md` |
| Écran ou interface | `DESIGN.md`, `CONTRATS.md`, parcours dans `PRODUIT.md` |
| Choix technique | `ARCHITECTURE.md`, `DECISIONS.md` |
| Correction de bug | `QUALITE.md`, puis le code concerné |
| Tests, validation | `QUALITE.md`, critères d'acceptation du bloc de tâche dans `ETAT.md` |
| README, démo, rendu | `LIVRAISON.md`, `PRODUIT.md`, `QUALITE.md` |
| Règles du hackathon | `CONTEXTE.md` |

## Légende

- **Information** : `[FAIT]` constaté · `[DÉCIDÉ]` validé par un humain (prénom) · `[PROPOSÉ]` · `[HYPOTHÈSE]` · `[OBSOLÈTE]` remplacé, à ne pas réintroduire.
- **Tâche** : `à faire` · `en cours` · `bloquée` · `à reprendre` · `en revue` (PR ouverte) · `fusionnée` · `abandonnée`.
- **Maturité** : `codée` < `compile` < `testée` < `intégrée` < `utilisable` < `démontrable`.
- **Priorité** : `P0` indispensable à la démo · `P1` différenciant · `P2` seulement si le cœur est stable.

## Qui écrit où

| Fichier | Qui écrit | Comment |
|---|---|---|
| `journal/<prenom>.md` | ce membre et ses agents | ajout en fin de fichier uniquement |
| `ETAT.md` | chaque responsable dans son bloc de tâche ; la synthèse en tête, par l'humain qui fusionne dans main | ne jamais modifier le bloc d'un autre |
| `DECISIONS.md`, `QUALITE.md` | tout le monde | ajout en fin de section, identifiant unique (jour, heure, initiales) |
| `CONTRATS.md`, `ARCHITECTURE.md`, `AGENTS.md`, `CLAUDE.md` | verrouillés | accord humain, branche dédiée, commit séparé, fusion rapide, annonce à l'équipe |
| `CONTEXTE.md`, `PRODUIT.md`, `DESIGN.md`, `LIVRAISON.md` | humains, ou agent à leur demande | modification classique |

`main` fait référence pour la mémoire partagée. Ta branche n'en est qu'une vue locale : intègre main régulièrement (`AGENTS.md` §7).

## Modèles d'entrées

- Tâche : en bas de `ETAT.md`
- Décision : en bas de `DECISIONS.md`
- Vérification et problème : dans `QUALITE.md`
- Contrat : en bas de `CONTRATS.md`
- Session et passation : `journal/_modele.md`
