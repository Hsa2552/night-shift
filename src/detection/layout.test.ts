import { describe, expect, it } from 'vitest'
import { A4, fakeItem, fakePage } from './fixtures.ts'
import { layoutPage } from './layout.ts'

describe('layoutPage', () => {
  it('regroupe les fragments d’une même ligne et les joint dans l’ordre', () => {
    const page = {
      pageIndex: 0,
      ...A4,
      textItems: [fakeItem('monde', 110, 100.5), fakeItem('Bonjour', 70, 100)],
    }
    const { lines } = layoutPage(page)
    expect(lines).toHaveLength(1)
    expect(lines[0]!.text).toBe('Bonjour monde')
    expect(lines[0]!.charX).toHaveLength('Bonjour monde'.length)
  })

  it('lit une page à deux colonnes colonne par colonne', () => {
    const left = ['G1', 'G2', 'G3', 'G4']
    const right = ['D1', 'D2', 'D3', 'D4']
    const items = [
      fakeItem('Titre pleine largeur du document de test', 72, 60),
      ...left.map((t, n) => fakeItem(`${t} texte de colonne gauche`, 50, 100 + n * 16)),
      ...right.map((t, n) => fakeItem(`${t} texte de colonne droite`, 320, 100 + n * 16)),
    ]
    const layout = layoutPage({ pageIndex: 0, ...A4, textItems: items })
    expect(layout.columns).toBe(2)
    expect(layout.lines.map((l) => l.text.slice(0, 2))).toEqual([
      'Ti',
      'G1',
      'G2',
      'G3',
      'G4',
      'D1',
      'D2',
      'D3',
      'D4',
    ])
    const leftArea = layout.lines[1]!.area
    const rightArea = layout.lines[5]!.area
    expect(leftArea.x1).toBeLessThanOrEqual(320)
    expect(rightArea.x0).toBeGreaterThanOrEqual(leftArea.x1)
  })

  it('une page à une colonne avec lignes longues reste à une colonne', () => {
    const page = fakePage(
      0,
      Array.from(
        { length: 10 },
        (_, n) => `Ligne ${n} : un texte suffisamment long pour traverser toute la page de test.`,
      ),
    )
    expect(layoutPage(page).columns).toBe(1)
  })

  it('ignore les numéros de page en pied de page', () => {
    const page = fakePage(0, ['Contenu', { text: '3 / 12', y: 810 }])
    expect(layoutPage(page).lines.map((l) => l.text)).toEqual(['Contenu'])
  })

  it('signale une page sans texte', () => {
    expect(layoutPage({ pageIndex: 0, ...A4, textItems: [] }).hasText).toBe(false)
  })
})
