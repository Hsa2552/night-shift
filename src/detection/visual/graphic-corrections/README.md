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
