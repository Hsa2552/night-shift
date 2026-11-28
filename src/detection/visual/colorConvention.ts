import type { PageData } from '../../shared/types'
import type { ColorConvention } from './types'

const hueByName: Record<string, number> = {
  red: 0,
  rouge: 0,
  green: 120,
  vert: 120,
  blue: 225,
  bleu: 225,
  purple: 275,
  violet: 275,
}
const declaredColor =
  /\b(?:(?:solutions?|answers?)\s+(?:(?:are|is)\s+(?:shown\s+|printed\s+|written\s+)?in|appear\s+in)|(?:les|la)\s+(?:corrigés?|corrections?|réponses?|solutions?)\s+(?:sont|est)\s+(?:(?:écrites?|indiquées?|affichées?)\s+)?en)\s+(red|rouge|green|vert|blue|bleu|purple|violet)\b/iu

export function pageColorDeclarations(page: PageData) {
  const declarations = []
  const items = page.textItems.filter((item) => item.text.trim())
  // PDF.js can emit one line in several runs, including a separate run for the color name.
  for (let first = 0; first < items.length; first += 1) {
    const baseline = items[first].bbox.y
    const line = [items[first]]
    for (const next of items.slice(first + 1, first + 7)) {
      if (Math.abs(next.bbox.y - baseline) > 3) break
      line.push(next)
    }
    const match = declaredColor.exec(line.map((item) => item.text.trim()).join(' '))
    if (match) declarations.push({ hue: hueByName[match[1].toLowerCase()], items: line })
  }
  return declarations
}

export function readColorConvention(pages: readonly PageData[]): ColorConvention | undefined {
  const hues = new Set(pages.flatMap((page) => pageColorDeclarations(page).map(({ hue }) => hue)))
  const [hue] = hues
  return hues.size === 1 ? { hue } : undefined
}
