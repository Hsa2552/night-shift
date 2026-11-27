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
