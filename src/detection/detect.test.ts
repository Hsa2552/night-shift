// Tests du détecteur sur des pages SYNTHÉTIQUES (fixtures.ts), sans lecteur PDF.
// On vérifie les régions produites (quelles lignes sont couvertes), pas seulement le type.

import { describe, expect, it } from 'vitest'
import type { DetectionResult, PageData } from './contract.ts'
import { A4, blankPage, fakePage, type FakeLine } from './fixtures.ts'
import { detectCorrections, WARNINGS } from './index.ts'

const LINE = 16.5 // interligne des pages synthétiques (11 × 1,5)
const topOf = (n: number, startY = 72) => startY + n * LINE

/** Identifiant du bloc qui couvre le point (x, milieu de la ligne n), ou null. */
function blockAt(result: DetectionResult, page: number, n: number, x = 80): string | null {
  const y = topOf(n) + 5.5
  for (const block of result.blocks) {
    for (const r of block.regions) {
      const b = r.bbox
      if (
        r.pageIndex === page &&
        x >= b.x &&
        x <= b.x + b.width &&
        y >= b.y &&
        y <= b.y + b.height
      ) {
        return block.id
      }
    }
  }
  return null
}

/** Résumé page par page : bloc couvrant chaque ligne (null = visible). */
function coverage(result: DetectionResult, page: number, count: number, x = 80) {
  return Array.from({ length: count }, (_, n) => blockAt(result, page, n, x))
}

const run = (...pages: PageData[]) => detectCorrections({ pages })

describe('detectCorrections', () => {
  it('question suivie de sa correction : seule la correction est masquée', async () => {
    const result = await run(
      fakePage(0, [
        'Exercice 1',
        '1. Calculer 2 + 2.',
        'Correction : 2 + 2 = 4.',
        'On vérifie facilement le résultat.',
        '2. Calculer 3 × 3.',
        'Correction : 3 × 3 = 9.',
      ]),
    )
    expect(result.kind).toBe('mixed')
    expect(result.needsFallback).toBe(false)
    expect(result.warnings).toEqual([])
    expect(result.blocks).toHaveLength(2)
    expect(coverage(result, 0, 6)).toEqual([null, null, 'c1', 'c1', null, 'c2'])
    expect(result.blocks.map((b) => b.questionLabel)).toEqual([
      'Exercice 1, question 1',
      'Exercice 1, question 2',
    ])
    // Le masque couvre la largeur de la page (figures éventuelles comprises).
    expect(result.blocks[0]!.regions[0]!.bbox.x).toBe(0)
    expect(result.blocks[0]!.regions[0]!.bbox.width).toBe(A4.width)
  })

  it('longue correction après des questions courtes : document mixte', async () => {
    const steps = Array.from({ length: 30 }, (_, n) => `Étape ${n + 1} du raisonnement détaillé.`)
    const result = await run(
      fakePage(0, ['1. Calculer 2 + 2.', 'Correction :', ...steps, '2. Calculer 3 + 3.']),
    )
    expect(result.kind).toBe('mixed')
    expect(blockAt(result, 0, 0)).toBeNull()
    expect(blockAt(result, 0, 32)).toBeNull()
  })

  it('plusieurs questions et corrections alternées, marqueurs variés', async () => {
    const result = await run(
      fakePage(0, [
        'Question 1 : Définir une variable aléatoire.',
        'Réponse : une application mesurable.',
        'Question 2 : Donner la loi de X.',
        'Solution. X suit une loi binomiale.',
        'Les paramètres sont n et p.',
        'Question 3 : Calculer E(X).',
        'Answer: E(X) = np.',
      ]),
    )
    expect(result.kind).toBe('mixed')
    expect(coverage(result, 0, 7)).toEqual([null, 'c1', null, 'c2', 'c2', null, 'c3'])
    expect(result.blocks.map((b) => b.questionLabel)).toEqual([
      'Question 1',
      'Question 2',
      'Question 3',
    ])
  })

  it('les étapes numérotées d’une correction ne la terminent pas', async () => {
    const result = await run(
      fakePage(0, [
        '1. Calculer la dérivée de f.',
        'Correction :',
        '1) On applique la formule du produit.',
        '2) On simplifie.',
        '2. Étudier les variations de f.',
        'Correction : f est croissante.',
      ]),
    )
    expect(coverage(result, 0, 6)).toEqual([null, 'c1', 'c1', 'c1', null, 'c2'])
  })

  it('correction placée à droite de la question, dans une autre colonne', async () => {
    const rows: FakeLine[] = []
    const questions = [
      '1. Combien font 2 + 2 ?',
      '2. Combien font 3 + 3 ?',
      '3. Combien font 4 + 4 ?',
    ]
    const answers = ['Réponse : 4', 'Réponse : 6', 'Réponse : 8']
    questions.forEach((q, n) => {
      rows.push({ text: q, x: 72, y: topOf(n * 2) })
      rows.push({ text: answers[n]!, x: 360, y: topOf(n * 2) })
    })
    const result = await run(fakePage(0, rows))
    expect(result.kind).toBe('mixed')
    expect(result.blocks).toHaveLength(3)
    // Questions visibles à gauche, réponses masquées à droite, chacune dans son bloc.
    expect(coverage(result, 0, 6, 80)).toEqual([null, null, null, null, null, null])
    expect(coverage(result, 0, 6, 380)).toEqual(['c1', 'c1', 'c2', 'c2', 'c3', 'c3'])
    expect(result.blocks.map((b) => b.questionLabel)).toEqual([
      'Question 1',
      'Question 2',
      'Question 3',
    ])
  })

  it('réponse sur la même ligne que la question : seule la fin de ligne est masquée', async () => {
    const result = await run(
      fakePage(0, [
        '1. Quelle est la capitale de la France ? Réponse : Paris',
        '2. Quelle est la capitale de l’Italie ? Réponse : Rome',
      ]),
    )
    expect(result.kind).toBe('mixed')
    expect(result.blocks).toHaveLength(2)
    // Début de ligne (question) visible, fin de ligne (réponse) masquée.
    expect(coverage(result, 0, 2, 80)).toEqual([null, null])
    expect(coverage(result, 0, 2, 72 + 50 * 5.5)).toEqual(['c1', 'c2'])
  })

  it('corrigé regroupé en fin de document, découpé par question', async () => {
    const result = await run(
      fakePage(0, [
        'Exercice 1',
        '1. Résoudre x + 1 = 0.',
        '2. Résoudre 2x = 4.',
        'Exercice 2',
        '1. Dériver x².',
      ]),
      fakePage(1, [
        'Corrigé',
        'Exercice 1',
        '1. x = -1.',
        '2. x = 2.',
        'Exercice 2',
        '1. La dérivée vaut 2x.',
      ]),
    )
    expect(result.kind).toBe('mixed')
    expect(coverage(result, 0, 5)).toEqual([null, null, null, null, null])
    expect(coverage(result, 1, 6)).toEqual(['c1', 'c1', 'c1', 'c2', 'c3', 'c3'])
    expect(result.blocks.map((b) => b.questionLabel)).toEqual([
      'Exercice 1, question 1',
      'Exercice 1, question 2',
      'Exercice 2, question 1',
    ])
  })

  it('« Correction de l’exercice N » en fin de document : libellé tiré du titre', async () => {
    const result = await run(
      fakePage(0, [
        'Exercice 1',
        '1. Résoudre x + 1 = 0.',
        '2. Résoudre 2x = 4.',
        'Exercice 2',
        '1. Dériver x².',
        '2. Intégrer 2x.',
      ]),
      fakePage(1, [
        "Correction de l'exercice 1",
        '1. x = -1.',
        '2. x = 2.',
        "Correction de l'exercice 2",
        '1. La dérivée vaut 2x.',
        '2. Une primitive est x².',
      ]),
    )
    expect(result.kind).toBe('mixed')
    expect(coverage(result, 0, 6)).toEqual([null, null, null, null, null, null])
    expect(coverage(result, 1, 6)).toEqual(['c1', 'c1', 'c2', 'c3', 'c3', 'c4'])
    expect(result.blocks.map((b) => b.questionLabel)).toEqual([
      'Exercice 1, question 1',
      'Exercice 1, question 2',
      'Exercice 2, question 1',
      'Exercice 2, question 2',
    ])
  })

  it('« Solution N » après chaque question : le libellé suit le numéro du titre', async () => {
    const result = await run(
      fakePage(0, [
        '1. Calculer 2 + 2.',
        '2. Calculer 3 + 3.',
        'Solution 1. On trouve 4.',
        'Solution 2. On trouve 6.',
      ]),
    )
    expect(coverage(result, 0, 4)).toEqual([null, null, 'c1', 'c2'])
    expect(result.blocks.map((b) => b.questionLabel)).toEqual(['Question 1', 'Question 2'])
  })

  it('corrigé uniquement : tout est masqué, découpé par exercice, titre visible', async () => {
    const result = await run(
      fakePage(0, [
        "Corrigé de l'examen 2025",
        'Exercice 1',
        'La dérivée vaut 2x.',
        'Exercice 2',
        "L'intégrale vaut 1/3.",
        'On vérifie par dérivation.',
      ]),
    )
    expect(result.kind).toBe('correction_only')
    expect(result.needsFallback).toBe(false)
    expect(coverage(result, 0, 6)).toEqual([null, 'c1', 'c1', 'c2', 'c2', 'c2'])
    expect(result.blocks.map((b) => b.questionLabel)).toEqual(['Exercice 1', 'Exercice 2'])
  })

  it('corrigé uniquement sans numérotation : repli proposé', async () => {
    const result = await run(
      fakePage(0, ['Solutions', 'La dérivée vaut 2x.', "L'intégrale vaut 1/3."]),
    )
    expect(result.kind).toBe('correction_only')
    expect(result.needsFallback).toBe(true)
    expect(result.warnings).toContain(WARNINGS.unsegmented)
    expect(coverage(result, 0, 3)).toEqual([null, 'c1', 'c1'])
  })

  it('sujet uniquement : aucun masque, aucun repli', async () => {
    const result = await run(
      fakePage(0, [
        'Examen de probabilités',
        'Exercice 1',
        '1. Calculer P(A).',
        '2. Calculer P(B).',
        'Exercice 2',
        '1. Montrer que X est intégrable.',
      ]),
    )
    expect(result).toEqual({
      kind: 'statement_only',
      blocks: [],
      warnings: [],
      needsFallback: false,
    })
  })

  it('réponses sans marqueur dans une autre police : pas de promesse « aucun corrigé »', async () => {
    const answer = (text: string) => ({ text, font: 'Italique' })
    const result = await run(
      fakePage(0, [
        '1. Calculer la dérivée de f.',
        answer('La dérivée de f vaut deux fois x.'),
        '2. Calculer la primitive de f.',
        answer('Une primitive de f est x au cube sur trois.'),
      ]),
    )
    expect(result.kind).toBe('unknown')
    expect(result.needsFallback).toBe(true)
    expect(result.warnings).toContain(WARNINGS.suspicious)
    expect(result.blocks).toEqual([])
  })

  it('formules dans une autre police : le sujet seul reste reconnu', async () => {
    const formula = (text: string) => ({ text, font: 'CMMI10' })
    const result = await run(
      fakePage(0, [
        '1. Calculer la dérivée de f définie par :',
        formula('f(x) = x² + 3x'),
        '2. Calculer la primitive de g définie par :',
        formula('g(x) = 1/x'),
      ]),
    )
    expect(result.kind).toBe('statement_only')
  })

  it('question contenant le mot « solution » : pas un marqueur', async () => {
    const result = await run(
      fakePage(0, [
        'Exercice 1',
        "1. Donner la solution de l'équation x + 1 = 0.",
        '2. Les solutions sont-elles uniques ?',
        'Solutions des systèmes linéaires : rappel de cours.',
        '3. Résoudre le système.',
      ]),
    )
    expect(result.kind).toBe('statement_only')
    expect(result.blocks).toEqual([])
  })

  it('document ambigu sans structure : inconnu, repli', async () => {
    const result = await run(
      fakePage(0, ['Notes de cours', 'La fonction est continue.', 'On en déduit le résultat.']),
    )
    expect(result.kind).toBe('unknown')
    expect(result.needsFallback).toBe(true)
    expect(result.blocks).toEqual([])
    expect(result.warnings).toContain(WARNINGS.unknown)
  })

  it('une seule question sans corrigé ne suffit pas à conclure « sujet seul »', async () => {
    const result = await run(fakePage(0, ['1. Calculer 2 + 2.', 'Puis expliquer la méthode.']))
    expect(result.kind).toBe('unknown')
    expect(result.needsFallback).toBe(true)
  })

  it('document sans texte extractible : inconnu, repli, aucun masque', async () => {
    const result = await run(blankPage(0), blankPage(1))
    expect(result).toEqual({
      kind: 'unknown',
      blocks: [],
      warnings: [WARNINGS.noText],
      needsFallback: true,
    })
  })

  it('page scannée dans un document mixte : masquée entièrement et repli signalé', async () => {
    const result = await run(
      fakePage(0, [
        '1. Calculer 2 + 2.',
        'Correction : 4.',
        '2. Calculer 3 + 3.',
        'Correction : 6.',
      ]),
      blankPage(1),
    )
    expect(result.kind).toBe('mixed')
    expect(result.needsFallback).toBe(true)
    expect(result.warnings).toContain(WARNINGS.textlessPages([2]))
    const last = result.blocks[result.blocks.length - 1]!
    expect(last.regions).toEqual([{ pageIndex: 1, bbox: { x: 0, y: 0, ...A4 } }])
  })

  it('correction qui s’étend sur deux pages : un seul bloc, deux régions', async () => {
    const result = await run(
      fakePage(0, [
        'Exercice 1',
        '1. Démontrer le théorème.',
        'Correction :',
        'Première étape du raisonnement.',
        'Deuxième étape du raisonnement.',
      ]),
      fakePage(1, [
        'Suite de la démonstration.',
        'Fin.',
        '2. Énoncer le corollaire.',
        'Correction : immédiat.',
      ]),
    )
    expect(result.kind).toBe('mixed')
    expect(coverage(result, 0, 5)).toEqual([null, null, 'c1', 'c1', 'c1'])
    expect(coverage(result, 1, 4)).toEqual(['c1', 'c1', null, 'c2'])
    const first = result.blocks[0]!
    expect(first.regions.map((r) => r.pageIndex)).toEqual([0, 1])
    // Bas de la page 0 entièrement couvert ; haut de la page 1 couvert depuis le bord.
    const [r0, r1] = first.regions
    expect(r0!.bbox.y + r0!.bbox.height).toBe(A4.height)
    expect(r1!.bbox.y).toBe(0)
  })

  it('QCM avec cases cochées : toutes les cases du groupe sont masquées, pas le texte', async () => {
    const result = await run(
      fakePage(0, [
        'Question 1 : Quelle est la capitale de la France ?',
        '☐ Lyon',
        '☑ Paris',
        '☐ Marseille',
        'Question 2 : Combien font 2 + 2 ?',
        'A. 3',
        'B. 4 ✓',
        'C. 5',
      ]),
    )
    expect(result.kind).toBe('mixed')
    expect(result.blocks).toHaveLength(2)
    const [boxes, checks] = result.blocks
    expect(boxes!.questionLabel).toBe('Question 1')
    expect(boxes!.regions).toHaveLength(3)
    // Les trois masques de cases ont la même taille : le masque ne trahit pas la bonne réponse.
    const widths = boxes!.regions.map((r) => Math.round(r.bbox.width))
    expect(new Set(widths).size).toBe(1)
    // Le texte des options reste visible.
    expect(coverage(result, 0, 4, 72 + 3 * 5.5)).toEqual([null, null, null, null])
    expect(coverage(result, 0, 4, 74)).toEqual([null, 'c1', 'c1', 'c1'])
    expect(checks!.questionLabel).toBe('Question 2')
    expect(checks!.regions).toHaveLength(3)
  })

  it('QCM avec « Réponse : B » en fin de ligne', async () => {
    const result = await run(
      fakePage(0, [
        '1. Capitale de la France ?',
        'A. Lyon   B. Paris',
        'Réponse : B',
        '2. Capitale de l’Italie ?',
        'A. Rome   B. Milan',
        'Réponse : A',
      ]),
    )
    expect(coverage(result, 0, 6)).toEqual([null, null, 'c1', null, null, 'c2'])
  })

  it('est déterministe', async () => {
    const page = fakePage(0, ['1. Calculer 2 + 2.', 'Correction : 4.', '2. Calculer 3 + 3.'])
    expect(await run(page)).toEqual(await run(page))
  })
})
