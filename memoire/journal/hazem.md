# Journal de Hazem

> Copier ce fichier en `journal/<prenom>.md` (minuscules, sans accent). Seuls ce membre et ses agents y écrivent, toujours en fin de fichier.
> Entrées courtes. Jamais de copie de conversation.

## Entrées

### 27/11 22:20 · SESSION · T-HZ-1 module détection (jalon H1) · Claude Code

- Jalon disponible : **H1**, premier détecteur déterministe testé sur données synthétiques, branche `feat/detection`.
- Exporté : `detectCorrections(input)` dans `src/detection/index.ts` (async, ne lève jamais d'exception, renvoie `unknown` + repli en cas d'erreur) et la constante `WARNINGS` (textes des avertissements, en français, affichables tels quels).
- Contrat utilisé : copie locale de la proposition §11 dans `src/detection/contract.ts`, sans écart. À remplacer par un réexport de `src/shared/` dès que Salif publie le contrat validé.
- Fichiers : `src/detection/` (`contract.ts`, `markers.ts`, `layout.ts`, `engine.ts`, `index.ts`, `fixtures.ts`, tests `*.test.ts`).
- Utilisable par : Wael (W4) dès maintenant avec `fixtures.ts` (`fakePage`, `blankPage`) pour générer des `PageData` synthétiques ; Salif : le détecteur a besoin de `PageData.textItems` avec `bbox` en repère canonique (origine en haut à gauche, y vers le bas), `fontSize` et `fontName` si disponibles. `getRaster` n'est pas encore utilisé.
- Vérifié : `npm run check` OK (types, lint, formatage, 60 tests dont 18 de bout en bout du détecteur). Voir `QUALITE.md` V-27-2220-HZ.
- Non vérifié : **aucun vrai PDF** (le lecteur de Salif n'existe pas encore) ; build de production non relancé.
- Maturité : testée (données synthétiques).
- Décisions : aucune décision commune ; choix locaux décrits dans QUALITE (conventions reconnues et limites).
- Suite : tester sur les vraies `PageData` dès S2 ; couleur et raster (P1) ; documents multicolonnes réels.

### 27/11 22:45 · SESSION · T-HZ-1 module détection (vers H2, H3) · Claude Code

- Correction de l'entrée précédente : `npm run build` avait bien été lancé après le commit `1b5e570`, résultat OK.
- Fait : détection par couleur (`color.ts`, utilise `getRaster` seulement si aucun marqueur textuel n'est trouvé) ; garde-fou « police suspecte » (réponses sans marqueur dans une police absente des questions : `unknown` + repli au lieu de « aucun corrigé ») ; correction de la classification `mixed` / `correction_only` ; avertissement « questions sans corrigé » corrigé pour les colonnes côte à côte.
- PDF d'exemple créés par l'équipe (contenu inventé) dans `src/detection/samples/` avec leur générateur : utilisables pour la démo par Wael et Salif.
- Banc d'essai sur vrais fichiers PDF : voir `QUALITE.md` V-27-2245-HZ.
- Contrat : `src/shared/types.ts` de la branche `feat/pdf` (Salif) est identique à `src/detection/contract.ts`. Je le remplacerai par un réexport dès la fusion de `feat/pdf` dans main.
- Pour Salif : le rendu raster a besoin de `standardFontDataUrl` (sans lui, les polices standard ne sont pas dessinées dans le raster) ; ton `openPdf` le fournit déjà, à garder disponible hors ligne.
- Maturité : testée (synthétique et banc pdf.js hors dépôt). Non intégrée : pas encore appelée par l'interface.
- Suite : intégrer main dès la fusion de `feat/pdf` ; tests sur de vrais PDF via `openPdf` ; aide à l'intégration W4.

### 27/11 22:55 · SESSION · T-HZ-1 compatibilité avec `feat/pdf` et `feat/viewer` · Claude Code

- Vérifié : banc pdf.js relancé avec `mapTextItem` de `feat/pdf` (commit `716f64a`, copie locale hors dépôt) à la place de mon extraction simplifiée : mêmes 8 résultats sur 8, régions décalées d'un ou deux points seulement. Raster à l'échelle 1 (celle de `getRaster` de Salif) : détection par couleur OK.
- Lu : `DocumentViewer` de `feat/viewer` (commit `992e8fb`) accepte directement `DetectionResult.blocks` (types structurellement identiques). Aucun adaptateur nécessaire.
- Non vérifié : appel réel `openPdf` puis `detectCorrections` puis `DocumentViewer` dans un navigateur (attend la fusion des trois branches).
