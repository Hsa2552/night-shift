import { describe, expect, it } from 'vitest'
import { truthFromRoles } from './metrics.ts'

const unit = (text: string) => ({ pageIndex: 0, text, bbox: { x: 0, y: 0, width: 10, height: 10 } })

describe('truthFromRoles', () => {
  it('applique les plages et le rôle par défaut', () => {
    const units = ['Titre', 'Q1', 'Réponse', 'suite', 'Q2', 'mêlé'].map(unit)
    const truth = truthFromRoles('kind: mixed\n# commentaire\nt 0\nc 2-3\nm 5\n', units)
    expect(truth.kind).toBe('mixed')
    expect(truth.elements.map((e) => e.role)).toEqual(['t', 'q', 'c', 'c', 'q', 'm'])
  })

  it('refuse une ligne invalide', () => {
    expect(() => truthFromRoles('x 1-2', [unit('a')])).toThrow()
  })
})
