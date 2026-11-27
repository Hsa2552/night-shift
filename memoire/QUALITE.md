# Tests, qualité et problèmes connus

> Ajout en fin de section. Identifiants : `V-<jour>-<hhmm>-<initiales>` pour une vérification, `Q-<jour>-<hhmm>-<initiales>` pour un problème. Modèles en bas de fichier.
> N'écris ici que des résultats réellement obtenus. Ce qui n'a pas été testé est écrit « non testé ».

## Stratégie de test

- **Logique** (calculs, règles, détection, transformations de données) : tests Vitest, ciblés sur les P0, dans des fichiers `*.test.ts` à côté du code.
- **Composants** : Testing Library, seulement pour les comportements critiques du parcours de démo.
- **Interface sur téléphone** : vérification manuelle structurée, notée ici (appareil, navigateur, étapes, résultat).
- **Avant chaque commit** : `npm run check`. **Sur chaque PR et sur main** : la CI GitHub lance types, lint, formatage, tests et build.
- Parcours de démo vérifié de bout en bout sur main : non

## Vérifications effectuées

### V-27-1959-CC · Socle technique (branche `feat/socle-technique`)

- Par : Claude Code · Commit : voir la branche `feat/socle-technique`
- Commande ou protocole : `npm run check`, `npm run build`, `npm run preview` puis requêtes HTTP sur le site servi, build avec `BASE_PATH=/night-shift/`
- Résultat : types, lint, formatage et test de fumée OK ; build OK ; manifeste servi (nom, icônes 192 et 512, `lang` fr) ; `sw.js`, `registerSW.js` et icônes répondent 200 ; avec `BASE_PATH`, liens, `start_url` et `scope` passent bien sous `/night-shift/`
- Limites : **non testé** : affichage dans un vrai navigateur, installation sur téléphone, fonctionnement hors ligne sur un appareil, exécution de la CI sur GitHub, déploiement Pages

### V-27-2233-WB · Parcours Unspoil dans Edge

- Par : Wael (Codex) · Versions vérifiées en copie d’intégration : interface `4174908`, PDF `9b771dd`, détection `dca91b3`.
- Protocole : `npm run check` (86 tests), build sous Ubuntu avec Node.js 24 et `BASE_PATH=/night-shift/`, puis Edge sur le build de production. Huit PDF synthétiques de `src/detection/samples/` et un PDF graphique synthétique de deux pages sans texte. Émulation tactile à 390 px. Rechargement avec le réseau coupé après activation du service worker.
- Résultat : les quatre classifications et les commandes de masquage répondent comme attendu. Le masque reste aligné au redimensionnement. Le trait avance et remonte au tactile, y compris jusqu’à la seconde page sans texte. Après rechargement hors ligne, le PDF s’ouvre, s’affiche et ses blocs sont détectés et masqués.
- Limites : le premier bloc de `mixte.pdf` laisse visible un trait du graphique (Q-27-2233-WB). Téléphone physique, Safari et installation sur un appareil non testés.

## Problèmes connus et risques

### Q-27-2218-WB · Génération du service worker bloquée sur le poste Windows de Wael · contourné

- Gravité : le build PWA local ne se termine pas sur ce poste.
- Constat : `npm run build` compile le client, puis Application Control refuse de charger `rollup.win32-x64-msvc.node` lorsque le plugin PWA génère le service worker.
- Contournement : la CI Linux a vérifié le premier jalon et le build Ubuntu du parcours intégré passe.
- Responsable ou tâche : T-WB-1.

### Q-27-2233-WB · Bord du graphique visible dans `mixte.pdf` · ouvert

- Gravité : un élément de corrigé reste visible dans un PDF synthétique de démonstration.
- Reproduction : ouvrir `src/detection/samples/mixte.pdf` dans l’interface intégrée, masquer les corrigés et observer le bas du graphique juste au-dessus de la question 2. Le texte du corrigé est couvert, mais un trait se trouve sous la limite du masque.
- Responsable : détection. Remonté sur [la PR #6](https://github.com/Hsa2552/night-shift/pull/6#issuecomment-7228546114).

## Données de démonstration

_Liste des données fictives ou synthétiques, et où elles sont signalées (code, interface, README)._

## Modèles

### V-<jour>-<hhmm>-<initiales> · <ce qui a été vérifié>

- Par : <prénom> (<outil>) · Commit : <hash>
- Commande ou protocole :
- Résultat :
- Limites :

### Q-<jour>-<hhmm>-<initiales> · <titre> · ouvert | contourné | résolu

- Gravité : bloque la démo | gênant | mineur
- Constat et reproduction :
- Contournement :
- Responsable ou tâche :
