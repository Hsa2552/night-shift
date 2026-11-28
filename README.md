# Unspoil · Night Shift 2026

Dépôt du projet Unspoil pour le hackathon Night Shift 2026 de l'ENSAI.

Unspoil permet de réviser avec une annale au format PDF sans voir ses corrigés à l'avance. Le lecteur conserve la mise en page et masque les corrections qu'il détecte. La révélation progressive permet de découvrir manuellement le document, même sans texte extractible. Les fichiers restent sur l'appareil.

## Installation

Prérequis : [Node.js](https://nodejs.org/) 22.13 ou plus récent (version LTS recommandée).

```bash
git clone https://github.com/Hsa2552/night-shift.git
cd night-shift
npm ci
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

Pour tester la distribution depuis un clone propre, installer les moteurs puis lancer la recette de production. Les builds de test restent dans `dev-dist/`.

```sh
npm ci
npx playwright-core install chromium firefox webkit
npm run test:distribution
npm run test:distribution -- update
```

Pour mesurer séparément l'ouverture, l'extraction, trois rendus et la détection, passer des chemins locaux. Répéter un chemin pour mesurer plusieurs cycles dans la même session. Le rapport Chromium inclut le tas JavaScript et le nombre de workers PDF.js restants après fermeture. Sous Windows, définir `UNSPOIL_NATIVE_MEMORY=1` pour ajouter les octets privés par type de processus. `UNSPOIL_CHROMIUM_PATH` permet d'utiliser Edge à la place du Chromium fourni.

```sh
npm run test:distribution -- performance src/detection/samples/mixte.pdf src/detection/samples/fin.pdf
```

## Déploiement

Publier le contenu de `dist/` sur un hébergement statique HTTPS à partir du commit que l'équipe souhaite tester. Utiliser le chemin de base `/` pour un domaine dédié.

Pour GitHub Pages, le workflow `.github/workflows/deploy-pages.yml` construit le site sous `/night-shift/`. Un mainteneur choisit **GitHub Actions** comme source dans **Settings → Pages**, puis crée la variable d'Actions `DEPLOY_PAGES=true`. [Configuration de la source GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

1. Quand le commit à distribuer est sur `main`, vérifier que l'exécution **Déploiement GitHub Pages** a réussi sur ce SHA. Si nécessaire, lancer le workflow manuellement en sélectionnant `main`.
2. Récupérer l'URL du déploiement dans le job `deploy`. Le mainteneur vérifie la redirection HTTP vers HTTPS et active **Enforce HTTPS** si nécessaire. [HTTPS sur GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
3. Ouvrir cette URL sur le téléphone et suivre la vérification ci-dessous depuis l'icône installée. Le serveur de prévisualisation sur le réseau local sert à contrôler l'affichage. L'essai d'installation utilise l'URL HTTPS.

Lors d'une nouvelle publication, les fenêtres déjà ouvertes gardent la version qui a chargé leur lecteur PDF. Fermer toutes les fenêtres Unspoil, y compris les onglets du navigateur, puis rouvrir l'application. Une fois le nouveau service worker activé, ses fichiers sont disponibles hors ligne et les anciens fichiers devenus inutiles sont retirés du précache.

**Solution de repli**. Avec l'accord du propriétaire, construire le même SHA avec `BASE_PATH=/` et déposer le dossier `dist/` par **Direct Upload** dans un projet Cloudflare Pages. Le site est alors servi à la racine d'une URL HTTPS `pages.dev`. Partager l'URL du déploiement qui correspond au SHA vérifié. [Documentation Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

Pour reproduire le même chemin en local, construire et prévisualiser avec `BASE_PATH` dans le même terminal.

```sh
BASE_PATH=/night-shift/ npm run build
BASE_PATH=/night-shift/ npm run preview
```

```powershell
$env:BASE_PATH = '/night-shift/'
npm run build
npm run preview
```

Ouvrir `http://localhost:4173/night-shift/`, en adaptant le port si Vite en affiche un autre.

## Procédure commune de vérification

Partir du même commit intégrant le lecteur, le détecteur et l'interface. Les PDF de [src/detection/samples](src/detection/samples) sont des exemples synthétiques créés pour les tests.

1. **Sur ordinateur**, lancer `npm ci`, `npm run check`, `npm run build`, puis `npm run preview`. Ouvrir l'URL locale indiquée par Vite.
2. **Sur téléphone**, transférer `couleur.pdf`, `sujet-seul.pdf` et `fin.pdf` sur l'appareil. Ouvrir l'URL HTTPS déployée. Sur Android, ouvrir le menu de Chrome et choisir **Ajouter à l'écran d'accueil → Installer** si l'option est proposée. Sur iPhone, ouvrir Safari, puis **Partager → Sur l'écran d'accueil → Ouvrir comme app web**. [Installation sur iPhone](https://support.apple.com/fr-ca/guide/iphone/iphea86e5236/ios)
3. **Masques**. Importer `couleur.pdf`. La page s'ouvre couverte. Cliquer sur **Masquer les corrigés**, puis révéler et remasquer un bloc. Redimensionner la fenêtre ou tourner le téléphone et vérifier l'alignement. Avec `sujet-seul.pdf`, vérifier le message « Aucun corrigé n’a été détecté ».
4. **Multipage**. Importer `fin.pdf`, activer la révélation progressive et déplacer le trait dans les deux sens. Vérifier que la page suivante reste couverte jusqu'au passage du trait. Si disponible, refaire le test avec un PDF autorisé de 50 pages ou plus, revenir au début puis remplacer le document.
5. **Hors ligne**. Attendre le chargement du site et recharger une fois en ligne. Sur téléphone, ouvrir une fois l'app depuis l'icône installée. Activer le mode avion et couper le Wi-Fi. Fermer complètement l'app, rouvrir depuis l'icône, puis importer un autre PDF déjà enregistré dans **Fichiers**. Vérifier le masquage, le geste tactile et la rotation encore en mode avion.
6. Reporter le SHA, l'appareil, le navigateur et les résultats dans [memoire/QUALITE.md](memoire/QUALITE.md). Pour un masque décalé, indiquer le PDF, la page et l'orientation.

## Limitations connues

La détection dépend de conventions documentaires. Un document atypique ou un scan peut nécessiter la révélation progressive. Le lecteur réduit la résolution interne des bitmaps sur les très grandes pages pour maîtriser la mémoire.

## Démo

L’accueil contient « Exemple synthétique », un exercice de probabilités inventé pour essayer la révélation sans importer de fichier. La [recette navigateur et les captures Mako](memoire/DESIGN.md#reproduire-les-vérifications) sont disponibles dans la mémoire du projet.

Le dossier des exemples contient `mixte.pdf`, `corrige-seul.pdf`, `sujet-seul.pdf` et `inconnu.pdf` pour montrer les quatre résultats possibles.

## Équipe

Salif (lecteur PDF et PWA), Hazem (détection) et Wael (interface).

---

Organisation interne du dépôt (règles des agents IA, mémoire du projet) : `AGENTS.md`, `CLAUDE.md` et `memoire/INDEX.md`.
