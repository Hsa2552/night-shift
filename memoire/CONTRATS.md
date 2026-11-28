# Contrats et interfaces

> **Fichier verrouillé** (`AGENTS.md` §6).
> Un contrat se fixe **avant** que deux personnes ou agents développent en parallèle de part et d'autre d'une interface.
> Pour changer un contrat : accord humain, branche `contrat/<objet>`, commit séparé, fusion rapide dans main, annonce à l'équipe, puis chacun intègre main dans sa branche.
> Le code suit le contrat. Un écart se signale, il ne se corrige pas en silence.

## Conventions générales

- Langue des identifiants dans le code : _à décider_
- Formats communs (dates, identifiants, erreurs) : _à décider_

## Contrats

### C1 · Lecture, détection et affichage du PDF · `[DÉCIDÉ]` (Salif, 27/11/2026)

- **Entre** : le lecteur PDF (Salif), le détecteur (Hazem) et le visualiseur (Wael).
- **Types de référence** : `src/shared/types.ts`, livré avec le lecteur dans la PR #4. Les opérations du lecteur sont exportées par `src/pdf/index.ts`.
- **Repère** : chaque page est indexée à partir de 0. Les dimensions et les rectangles `{ x, y, width, height }` utilisent le viewport de la page à échelle 1, rotation appliquée, origine en haut à gauche, x vers la droite et y vers le bas. Les coordonnées ne varient pas avec le zoom.

#### Cycle de vie et rendu

| API | Comportement |
|---|---|
| `openPdf(file: Blob): Promise<PdfDocument>` | Ouvre un fichier local (`File` ou `Blob`) dans le navigateur. Les octets du PDF restent sur l'appareil. |
| `pdf.pageCount` | Nombre de pages. |
| `pdf.getPageDimensions(pageIndex)` | Renvoie `Promise<PageDimensions>` avec `pageIndex`, `width` et `height`. Disponible avant l'extraction du texte, notamment pour la révélation progressive. |
| `pdf.getPageData(pageIndex)` | Renvoie `Promise<PageData>` avec les dimensions et `textItems`. Chaque fragment contient `text`, `bbox` et, si disponibles, `fontSize`, `fontName` et `hasEOL`. Les rectangles sont estimés à partir des métriques de police. Un fragment vide peut indiquer une fin de ligne, et une page peut n'avoir aucun texte extractible. |
| `pdf.renderPage(pageIndex, canvas, options?)` | Renvoie `Promise<void>`. `width` désigne la largeur CSS souhaitée, par défaut la largeur canonique. `pixelRatio` désigne la densité de pixels du canvas, par défaut celle de l'appareil. `signal` permet d'annuler le rendu. |
| `pdf.getRaster(pageIndex)` | Renvoie à la demande `Promise<RasterData>` avec ses dimensions propres en pixels et `rgba`, un tableau `Uint8ClampedArray` de longueur `width × height × 4`, rangé par lignes depuis le haut gauche. |
| `pdf.close()` | Renvoie `Promise<void>`, ferme le PDF et libère ses ressources. Appeler au remplacement ou au démontage du lecteur. |

L'ouverture peut échouer, notamment pour un fichier invalide ou protégé par mot de passe. Les opérations asynchrones rejettent aussi en cas d'erreur de page ou de rendu. Un indice hors limites est rejeté avec `RangeError`.

#### Détection et masques

- `detectCorrections(input: DetectionInput): Promise<DetectionResult>` reçoit `pages: PageData[]` et éventuellement `getRaster(pageIndex)`. Le détecteur ne dépend pas de React.
- Le résultat contient `kind` (`mixed`, `statement_only`, `correction_only` ou `unknown`), `blocks`, `warnings` et `needsFallback`. `unknown` et `needsFallback` signalent que l'interface doit proposer la révélation progressive.
- Chaque bloc a un `id`, un éventuel `questionLabel` et un tableau `regions`. Chaque région porte `pageIndex` et `bbox`. Un bloc peut couvrir plusieurs rectangles et plusieurs pages. Le visualiseur révèle ou remasque toutes ses régions ensemble.
- Pour placer les masques en CSS, le visualiseur utilise les rapports `x / page.width`, `y / page.height`, `width / page.width` et `height / page.height`. Pour lire le raster, le détecteur applique le rapport de taille raster/page sur chaque axe.

- **Responsable** : Salif, avec Hazem et Wael pour les usages intermodules.
- **Versions** : v1, 27/11/2026 ; v1.1, 28/11/2026.

#### Observations vectorielles facultatives · C1 v1.1

- Validation collective de D-28-0315-HZ et D-28-0319-WB confirmée par Salif le 28/11/2026.
- `PdfDocument` et `DetectionInput` peuvent fournir `getVectors?(pageIndex: number): Promise<VectorPageObservation | undefined>`. L'argument est un indice de page à partir de zéro. La fonction est liée au document ouvert et s'exécute uniquement à la demande.
- `VectorPageObservation` est le type existant de `src/detection/visual/vector/index.ts`, réexporté par les types communs. Ses régions utilisent le repère canonique C1, rotation appliquée. Les commandes de peinture du texte, couleurs, opacités et états `paint-command`, `clipped`, `invisible` et `unresolved` conservent leur sens d'origine. Si le moteur dérive des cases avec `nativeSquares`, il préserve l'état `ambiguous` et l'indication de contrôle de visibilité.
- Les observations n'attribuent aucun rôle d'énoncé ou de corrigé. Une page observée sans objet pertinent renvoie une observation vide. L'absence de fonction ou un résultat `undefined` signifie que le moteur doit poursuivre avec les entrées disponibles, dont le raster si fourni.
- L'extraction indisponible, l'échec de ce canal facultatif ou la fermeture du document donnent `undefined`. Un indice invalide est rejeté par `RangeError`. Après remplacement, le moteur précédent ne peut recevoir que des observations de son ancien document ou un résultat indisponible. Toute opération en cours cesse d'alimenter le parcours de lecture après fermeture ou remplacement.
- Le lecteur ne conserve pas les observations de tout le document. Les implémentations peuvent mutualiser les demandes simultanées d'une page et libèrent leurs références de travail à la fermeture.

## Modèle

### C<n> · <nom> · `[PROPOSÉ]` ou `[DÉCIDÉ]` (prénom)

- **Entre** : <module A> → <module B>
- **Forme** : fonction, endpoint, événement, fichier...
- **Entrée** :
- **Sortie** :
- **Erreurs** :
- **Exemple** :
- **Responsable** :
- **Versions** : v1 (date)
