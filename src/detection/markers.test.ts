import { describe, expect, it } from 'vitest'
import {
  findInlineCorrection,
  fold,
  isCorrectionTitle,
  nextValue,
  parseCorrectionStart,
  parseOption,
  parseQuestion,
} from './markers.ts'

describe('fold', () => {
  it('retire accents et majuscules sans changer la longueur', () => {
    expect(fold('Réponse CORRIGÉ')).toBe('reponse corrige')
    expect(fold('Réponse').length).toBe('Réponse'.length)
  })
})

describe('parseQuestion', () => {
  it.each([
    ['Exercice 3', 'exercise', '3'],
    ['EXERCICE N°2 : intégrales', 'exercise', '2'],
    ['Partie II', 'part', 'ii'],
    ['Question 4. Montrer que...', 'question', '4'],
    ['Q12 Calculer', 'question', '12'],
    ['3. Calculer f(2).', 'numeric', '3'],
    ['3) Calculer f(2).', 'numeric', '3'],
    ['1.2 Montrer que f est continue.', 'numeric', '1.2'],
    ['b) En déduire g.', 'letter', 'b'],
    ['(c) Conclure.', 'letter', 'c'],
  ])('%s', (text, kind, value) => {
    const m = parseQuestion(text)
    expect(m?.kind).toBe(kind)
    expect(m?.value).toBe(value)
  })

  it.each([
    'La question est difficile.',
    'Exercice difficile mais classique.',
    '2x + 3 = 5',
    '3,14 est une approximation.',
    'A. Lyon',
  ])('rejette « %s »', (text) => {
    expect(parseQuestion(text)).toBeNull()
  })
})

describe('parseCorrectionStart', () => {
  it.each([
    ['Correction', true],
    ['Corrigé', true],
    ['Solutions des exercices', true],
    ['Éléments de correction', true],
    ['Correction :', true],
    ['Réponse : 4', false],
    ['Solution. On pose u = x²', false],
    ["Solution de l'exercice 2", false],
    ['Answer: 42', false],
    ['Réponse B', false],
  ])('%s', (text, headerOnly) => {
    expect(parseCorrectionStart(text)).toMatchObject({ headerOnly })
  })

  it.each([
    ["Correction de l'exercice 2", 'exercise', '2'],
    ['Corrigé exercice 3', 'exercise', '3'],
    ['Solution de la question 4', 'question', '4'],
    ['Solution 5.', 'question', '5'],
    ['Answer to question 2', 'question', '2'],
  ])('%s désigne sa cible', (text, kind, value) => {
    const target = parseCorrectionStart(text)?.target
    expect(target?.kind).toBe(kind)
    expect(target?.value).toBe(value)
  })

  it('reconnaît les grilles de réponses', () => {
    expect(parseCorrectionStart('Grille de réponses')).toMatchObject({ headerOnly: true })
    expect(parseCorrectionStart('Answer key')).toMatchObject({ headerOnly: true })
  })

  it.each([
    "Solution de l'équation x² = 4 : rappel",
    'Solutions sont-elles uniques ?',
    'Réponse attendue en trois lignes.',
    'Correctement justifier.',
  ])('rejette « %s »', (text) => {
    expect(parseCorrectionStart(text)).toBeNull()
  })
})

describe('findInlineCorrection', () => {
  it('trouve un marqueur suivi de deux-points en cours de ligne', () => {
    const text = '1. Combien font 2 + 2 ? Réponse : 4'
    expect(findInlineCorrection(text)).toBe(text.indexOf('Réponse'))
  })
  it('ignore le mot sans deux-points', () => {
    expect(findInlineCorrection('1. Donner la solution de x + 1 = 0.')).toBeNull()
  })
})

describe('parseOption', () => {
  it('reconnaît les cases cochées et non cochées', () => {
    expect(parseOption('☑ Paris')?.box?.checked).toBe(true)
    expect(parseOption('☐ Lyon')?.box?.checked).toBe(false)
    expect(parseOption('[x] Paris')?.box?.checked).toBe(true)
    expect(parseOption('[ ] Lyon')?.box?.checked).toBe(false)
  })
  it('reconnaît une coche après une option lettrée', () => {
    expect(parseOption('B. 4 ✓')?.trailingCheck).toBe(5)
    expect(parseOption('A. 3')).toEqual({})
  })
})

describe('divers', () => {
  it('nextValue', () => {
    expect(nextValue('3')).toBe('4')
    expect(nextValue('b')).toBe('c')
    expect(nextValue('1.2')).toBe('1.3')
    expect(nextValue('ii')).toBe('iii')
    expect(nextValue('')).toBeNull()
  })
  it('isCorrectionTitle distingue corrigé seul et sujet avec corrigé', () => {
    expect(isCorrectionTitle('Examen 2024 : corrigé')).toBe(true)
    expect(isCorrectionTitle('Sujet et corrigé 2024')).toBe(false)
    expect(isCorrectionTitle('Examen avec corrections')).toBe(false)
  })
})

describe('extraction dégradée', () => {
  it('reconnaît un titre de corrigé à une lettre près', () => {
    expect(isCorrectionTitle('Devoir Surveillé n 7 : orrigé')).toBe(true)
    expect(isCorrectionTitle('Devoir Surveillé n 7')).toBe(false)
    expect(isCorrectionTitle('Exercices de géométrie')).toBe(false)
  })
})

describe('numérotations hiérarchiques', () => {
  it.each([
    ['A.1. Écrire l’énergie cinétique.', 'a.1'],
    ['C.I.1. Quelles sont les dimensions ?', 'c.i.1'],
    ['C.II.3 On cherche une solution.', 'c.ii.3'],
    ['II.a (6+4) Que signifie ce fait ?', 'ii.a'],
    ['1.b (6) Montrer l’égalité.', '1.b'],
  ])('%s', (text, value) => {
    const m = parseQuestion(text)
    expect(m?.value).toBe(value)
    expect(m?.style).toBe('hier')
  })
  it('« Exercice VII.2 » garde son sous-numéro', () => {
    expect(parseQuestion('Exercice VII.2 Ch7-Exercice2')?.value).toBe('vii.2')
  })
  it('ne prend pas « i.e. » ni « A. Lyon » pour une numérotation hiérarchique', () => {
    expect(parseQuestion('i.e. dans ce cas')).toBeNull()
    expect(parseQuestion('A. Lyon')?.style).not.toBe('hier')
  })
})

describe('intitulés de section et sous-questions « b. »', () => {
  it('« B. Exercice : … » est une partie, « A. Lyon » non', () => {
    expect(parseQuestion('B. Exercice : les satellites de Jupiter')?.kind).toBe('part')
    expect(parseQuestion('A. Question de cours : énergie')?.kind).toBe('part')
    expect(parseQuestion('A. Lyon')).toBeNull()
  })
  it('« b. Écrire le volume… » est une sous-question, « a. Paris » non', () => {
    expect(parseQuestion('b. Écrire le volume de la partie immergée.')?.kind).toBe('letter')
    expect(parseQuestion('a. Paris')).toBeNull()
  })
})
