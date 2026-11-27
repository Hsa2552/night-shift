# Architecture technique

> **Fichier verrouillé** (`AGENTS.md` §6).
> Chaque choix structurant renvoie à une décision de `DECISIONS.md`.
> **Socle commun en place** (D-INIT-3, `[PROPOSÉ]` jusqu'à validation humaine). Tout ce qui dépend du sujet reste à compléter.

## Stack

| Couche | Choix | Décision |
|---|---|---|
| Langage | TypeScript (mode strict) | D-INIT-3 |
| Interface | React | D-INIT-3 |
| Outil de build et serveur de dev | Vite | D-INIT-3 |
| Application installable, hors ligne | `vite-plugin-pwa` (stratégie `generateSW`) | D-INIT-3 |
| Styles | Tailwind CSS | D-INIT-3 |
| Tests | Vitest, jsdom, Testing Library | D-INIT-3 |
| Lint, formatage | oxlint, Prettier | D-INIT-3 |
| Vérification automatique | GitHub Actions (`.github/workflows/ci.yml`) | D-INIT-3 |
| Hébergement | GitHub Pages (workflow prêt, désactivé) ou Vercel / Netlify | à décider |
| Back-end, données | _selon le sujet_ (aucun pour un outil 100 % navigateur ; Supabase envisagé pour une appli avec comptes) | à décider |

## Arborescence du code

```
.
├── AGENTS.md, CLAUDE.md        règles des agents
├── memoire/                    mémoire du projet
├── index.html                  page HTML d'entrée
├── public/                     icônes et fichiers statiques (icônes provisoires)
├── src/
│   ├── main.tsx                point d'entrée React
│   ├── App.tsx                 page provisoire, à remplacer
│   ├── App.test.tsx            test de fumée
│   ├── index.css               import de Tailwind
│   └── test/setup.ts           configuration des tests
├── vite.config.ts              Vite, PWA, Tailwind, Vitest
└── .github/                    CI, déploiement Pages, modèle de PR
```

Les dossiers propres au produit (`src/<module>/`) seront ajoutés ici une fois le sujet choisi.

## Modules

| Module | Rôle | Dossier | Responsable | Dépend de |
|---|---|---|---|---|
| _à compléter selon le sujet_ | | | | |

## Flux de données

_À compléter selon le sujet._

## Commandes

Node.js 20.19 ou plus récent (22 recommandé, voir `.nvmrc`).

- Installation : `npm install` (ou `npm ci` pour reproduire exactement `package-lock.json`)
- Développement : `npm run dev`, puis http://localhost:5173
- Vérifications : `npm run check` (types, lint, formatage, tests). **À lancer avant chaque commit.**
- Corriger le formatage : `npm run format`
- Tests seuls : `npm test` (ou `npm run test:watch`)
- Build de production : `npm run build`, puis `npm run preview` pour le servir en local
- Ajouter une dépendance : `npm install <paquet>`, et committer `package.json` **et** `package-lock.json` ensemble

## Points d'attention

- **Tester sur téléphone** : le service worker, la caméra et les notifications exigent le HTTPS. L'adresse IP locale (`npm run dev -- --host`) ne suffit pas : passer par un déploiement (Vercel ou Pages).
- **Service worker** : `generateSW` met en cache automatiquement les fichiers du build. Pour des notifications push ou un cache sur mesure, passer à `strategies: 'injectManifest'` dans `vite.config.ts` (décision à noter dans `DECISIONS.md`).
- **Chemin de base** : `BASE_PATH` vaut `/` par défaut ; le workflow Pages le règle sur `/<nom-du-depot>/`. Toujours écrire les chemins d'assets relatifs à la base (`import.meta.env.BASE_URL`), jamais en dur.
- **Fins de ligne** : `.gitattributes` impose LF partout, pour éviter les faux conflits entre Windows et macOS.

## Variables d'environnement

_Aucune pour l'instant. Noms uniquement, jamais les valeurs. Les variables lues par le navigateur commencent par `VITE_` et sont publiques. Les valeurs d'exemple vont dans `.env.example`._

## Principes

- Les modules communiquent uniquement selon `CONTRATS.md`, pour permettre le travail en parallèle.
- Toute nouvelle dépendance doit servir le produit (`AGENTS.md` §10).
