# Sous-détecteur graphique

Le moteur appelle `detectGraphicCorrections({ page, vectors, raster, anchors, existingBlocks, protectedRegions })` après identification des ancres et avant fusion finale. Il conserve sa classification textuelle, ses conventions colorimétriques et ses groupes de QCM. Le module travaille sur une seule page en repère C1, sans accès au lecteur et sans effet de bord.

```ts
const graphics = detectGraphicCorrections({
  page,
  vectors,
  raster,
  anchors: [{ id: 'correction-2', role: 'correction', reliability: 'confirmed',
    region: correctionHeading, scope: confirmedCorrectionRegion, blockId: 'question-2' }],
  existingBlocks,
  protectedRegions,
})
// graphics.additions : rattacher uniquement au bloc de même id.
// graphics.newBlocks : propositions de nouveaux groupes indépendamment révélables.
// graphics.unresolved : observations locales pour le contrôle de cohérence global.
```

`scope` est facultatif. Le renseigner uniquement si le moteur établit le périmètre pédagogique complet, y compris les illustrations. Il ne correspond pas à une simple distance au titre ou au rectangle englobant entre deux titres. Une ancre sans périmètre donne du contexte, sans autoriser un masquage. Une région déjà couverte intégralement par un seul bloc peut également établir le rattachement. Les zones d’énoncé, notamment les données indispensables, sont à transmettre dans `protectedRegions`.

Le premier jalon accepte les images et peintures natives dans une correction établie. Il refuse les contradictions de propriétaires, les peintures incertaines et les collisions au bord. L’état `declared` indique une commande de peinture, sans preuve de composition finale. L’état pédagogique, la confiance, les contradictions et les masques sont retournés dans des champs distincts. Le moteur décide de la fusion et du repli.

## Géométrie alternative

`reconstructAdaptiveLayout(page, baselineY?)` expose lignes, indices d’origine, alignements, gouttières, espacements robustes et blocs candidats XY-Cut ou voisins. L’activation proposée demande un chevauchement répété de rangées de part et d’autre d’une gouttière, et ne remplace aucun appel à `layoutPage`. Sans information supplémentaire, les lignes de base sont estimées à partir des boîtes C1. La rotation de 90° vérifiée dans le laboratoire Python utilisait un axe indisponible dans cette API de production.

Le script `research/document-layout/check-adaptive-production.mjs` compare les groupes de fragments TypeScript aux traces Python pour les 14 cas horizontaux de phase 4.3, avec les mêmes lignes de base de référence. Le test local vérifie également la stabilité sans axe fourni sous changement d’échelle et de marges, et l’absence de recommandation sur une seule colonne.

## Graphiques mixtes et tableaux

- `raster` est le rendu courant C1 fourni par le lecteur. L’encre graphique raster et les longues traces continues complètent les opérations natives. Le résultat indique leurs deux provenances séparément. Pour les ablations, `modality` s’utilise dans le laboratoire.
- `mixedFigures` décrit des régions où une couleur **localement confirmée** distingue le tracé de correction. Le prototype identifie des bandes d’encre séparées dans le rendu et garde la figure de référence hors des masques. Transmettre aussi les zones d’encre d’énoncé ou de données requises dans `protectedRegions`. Un conflit sur une bande annule l’ensemble des bandes de la même correction colorée. Une peinture ambiguë, un fond qui colore les propositions ou une figure monochrome indissociable exigent un autre traitement. La région seule d’une figure mixte n’autorise jamais son masquage intégral.
- `frames` expose l’enveloppe, les axes, les fragments de cellule et des cellules fusionnées horizontalement lorsque les bords des deux côtés sont établis. Une frontière incertaine ou une cellule traversée par un fragment reste sans géométrie de masquage. Les lignes horizontales et alignements de texte sont des hypothèses ouvertes. Une grille ne détermine pas le rôle du contenu.
- Le moteur garde ses propres protections QCM et peut transmettre `decorativeRegions` pour les éléments déjà identifiés comme décoratifs. Les superpositions, figures mixtes et conflits sont visibles dans `unresolved`. Traiter comme signal de repli une contradiction sur une correction déjà établie, pas chaque primitive graphique sans rôle identifié.
