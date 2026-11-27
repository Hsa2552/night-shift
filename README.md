# [Nom du projet à définir] · Night Shift 2026

Dépôt de l'équipe [nom à compléter] pour le hackathon Night Shift 2026 de l'ENSAI.

> Sujet non choisi pour l'instant. Le socle technique est en place ; le reste de ce README sera complété avant le rendu.

## Le problème

_À compléter._

## La solution

_À compléter._

## Fonctionnalités disponibles

_Uniquement ce qui fonctionne réellement. Préciser ce qui est simulé ou utilise des données de démonstration._

## Installation

Prérequis : [Node.js](https://nodejs.org/) 20.19 ou plus récent (22 recommandé).

```bash
git clone https://github.com/Hsa2552/night-shift.git
cd night-shift
npm install
```

## Lancement

```bash
npm run dev        # serveur de développement : http://localhost:5173
npm run build      # build de production dans dist/
npm run preview    # sert le build en local
```

## Tests

```bash
npm run check      # types, lint, formatage et tests
npm test           # tests seuls
```

## Déploiement

L'application est un site statique (dossier `dist/`). Deux options gratuites :

- **Vercel ou Netlify** : importer le dépôt depuis leur site. Vite est détecté automatiquement. Fonctionne avec un dépôt privé et crée une adresse d'aperçu pour chaque branche.
- **GitHub Pages** : le workflow `.github/workflows/deploy-pages.yml` est prêt mais désactivé. Gratuit uniquement si le dépôt est public (ou avec GitHub Pro). Pour l'activer : Settings > Pages > Source : GitHub Actions, puis Settings > Secrets and variables > Actions > Variables : `DEPLOY_PAGES` = `true`.

## Limitations connues

_À compléter._

## Démo

_À compléter._

## Équipe

_À compléter._

---

Organisation interne du dépôt (règles des agents IA, mémoire du projet) : `AGENTS.md`, `CLAUDE.md` et `memoire/INDEX.md`.
