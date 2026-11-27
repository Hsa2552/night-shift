# Direction artistique et expérience utilisateur

## Principes UX

- L’accueil présente l’import et montre une correction que l’on peut révéler dans un véritable PDF de démonstration.
- Le lecteur garde le document au centre. Les outils restent dans une barre au-dessus du document, les pages dans un panneau rétractable.
- Le PDF demeure blanc dans les deux thèmes. Les masques sont opaques et ne s’animent jamais. L’analyse, son annulation et les transitions incertaines laissent le document couvert.
- Le compteur affiche les blocs réellement révélés. Le mode progressif annonce la position de son trait et ne compte aucun corrigé.

## Identité visuelle

[DÉCIDÉ] Mako, validé par l’équipe et communiqué par Wael en phase 3.

| Usage | Couleur |
|---|---|
| Fonds et surfaces sombres | `#0B1020`, `#121A2B` |
| Surfaces et textes clairs | `#F8FAFC`, `#E8EEF8` |
| Texte sur fond clair | `#0F172A` |
| Nuances Mako | `#414E91`, `#397EB0`, `#65C9BC`, `#7DD3FC` |
| Accents et signature | `#4F7CFF`, `#3B82F6`, `#2AA7A1` |

Geist variable est embarquée avec sa licence OFL. Les nombres de pages et les niveaux de zoom utilisent une police monospace du système. Les textes de l’interface tutoient l’étudiant. Les transitions durent généralement 180 à 220 ms et respectent la préférence de réduction des animations. Le changement de thème conserve le PDF, la lecture et les corrections révélées.

Le mot-symbole reprend le visuel fourni par l’équipe. L’œil remplace le « o », sa diagonale va du bleu au turquoise et le point final est turquoise. [Déclinaisons SVG](../public/brand). Le favicon, l’icône Apple et les PNG de 192 et 512 px réutilisent les chemins du manifeste existant.

## Écrans et composants

| Composant | Usage | Code |
|---|---|---|
| Identité et thème | Logo, préférence locale et thème système au premier lancement | `src/components/Brand.tsx`, `src/mako.css`, `index.html` |
| Accueil | Import par sélecteur ou dépôt, chargement, exemple synthétique | `src/components/Home.tsx`, `src/components/DemoPreview.tsx` |
| Visualiseur | Modes, pages, zoom, compteur et états d’analyse | `src/viewer/Reader.tsx`, `src/reader.css` |
| Masques | Rectangles C1, révélation par bloc, trait multipage | `src/viewer/DocumentViewer.tsx`, `src/viewer/useProgressiveReveal.ts` |

L’exemple d’accueil est un PDF synthétique produit par l’équipe. Il utilise PDF.js et les mêmes commandes que les fichiers importés, avec deux régions préparées pour la démonstration. Les annales externes de vérification ne sont pas publiées avec le site.

La navigation représente les pages par des silhouettes sans contenu, sur ordinateur comme sur mobile. Un groupe de régions C1 reçoit une seule commande hors de la page. Les petites cases d’un groupe reçoivent le même contour discret. La révélation retire la couverture de toutes les régions ensemble et laisse le PDF original visible. Le détecteur doit fournir les régions de toutes les options pour neutraliser un QCM à cases noircies.

## Responsive et accessibilité

Le panneau de pages devient une liste compacte sous la barre d’outils sur mobile. Le zoom élargit la zone de lecture interne. Les commandes des petits masques restent hors de la page si la région ne peut pas contenir une cible tactile. Les boutons ont des libellés accessibles et des focus visibles. L’activation de la révélation progressive ramène au trait si celui-ci est hors écran. Les flèches, Page précédente/suivante et Début/Fin pilotent le trait au clavier.

[Captures de référence](captures/mako), [recette reproductible](../scripts/verify-mako.cjs) et [résultats](QUALITE.md). Le travail de composition prend pour références [Linear](https://linear.app/), le dépôt direct d’[iLovePDF](https://www.ilovepdf.com/fr/modifier-pdf), l’organisation de [Smallpdf](https://smallpdf.com/fr/modifier-un-pdf), les outils d’[Excalidraw](https://excalidraw.com/), la lecture de [Readwise Reader](https://readwise.io/read), la progression de [Quizlet](https://help.quizlet.com/hc/en-us/articles/360048803491-Using-Progress-for-targeted-studying) et la réactivité de [Raycast](https://www.raycast.com/).

## Reproduire les vérifications

Construire et servir le build de production selon le [README](../README.md). Depuis le dépôt, dans un autre terminal PowerShell, installer Playwright dans un répertoire temporaire pour la recette. Le script utilise Edge par défaut et n’ajoute aucune dépendance à l’application.

```powershell
$qa = Join-Path ([IO.Path]::GetTempPath()) 'unspoil-qa'
npm install --prefix $qa playwright
$env:UNSPOIL_PLAYWRIGHT = Join-Path $qa 'node_modules/playwright'
$env:UNSPOIL_URL = 'http://127.0.0.1:4173/night-shift/'
$env:UNSPOIL_TEST_OFFLINE = '1'
$env:UNSPOIL_CAPTURES = Join-Path $qa 'captures'
node scripts/verify-mako.cjs
```

Adapter l’URL au chemin de base du build. `UNSPOIL_AUTHORIZED_PDF` peut désigner une annale locale autorisée. `UNSPOIL_SKIP_CAPTURES=1` exécute seulement les contrôles fonctionnels. Les captures couvrent 1440 × 900, 1280 × 800, 768 × 1024, 390 × 844, 360 × 800 et 844 × 390, avec une planche de logo à 16, 24 et 32 px.
