// @vitest-environment node
/// <reference types="node" />
//
// Évaluation du détecteur sur un dossier de PDF locaux (jamais envoyés ailleurs).
// Désactivée par défaut. Usage :
//   UNSPOIL_EVAL_DIR=chemin/vers/pdf npx vitest run src/detection/eval
// (UNSPOIL_EVAL_RASTER=0 pour évaluer le texte seul, UNSPOIL_EVAL_VERBOSE=1 pour les régions.)
// Pour chaque `x.pdf`, la vérité terrain est lue dans `x.verite.json` (voir metrics.ts).
// Sans vérité, le test écrit `x.a-annoter.json` : les lignes du document avec le rôle
// deviné par le détecteur, à corriger à la main (q, c ou t) puis à renommer en `x.verite.json`.
// Le rendu raster (couleurs, figures) n'est utilisé que si `@napi-rs/canvas` est installé
// localement (`npm install --no-save @napi-rs/canvas`) ; ce paquet n'est volontairement pas
// une dépendance du projet.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'
import { readPageText } from '../../pdf/read-text.ts'
import type { DetectionInput, PageData, RasterData } from '../contract.ts'
import { detectCorrections } from '../index.ts'
import { answerBoxes, findBoxes } from '../boxes.ts'
import { layoutPage } from '../layout.ts'
import { coverage, evaluate, truthFromRoles, type Truth, type TruthElement } from './metrics.ts'

const dir = process.env.UNSPOIL_EVAL_DIR

async function load(file: string): Promise<DetectionInput & { raster: boolean }> {
  const fontsDir = join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/')
    .split('\\')
    .join('/')
  const doc = await getDocument({
    data: new Uint8Array(readFileSync(file)),
    standardFontDataUrl: fontsDir,
    useSystemFonts: false,
  }).promise
  const pages: PageData[] = []
  for (let p = 0; p < doc.numPages; p++) {
    const page = await doc.getPage(p + 1)
    const { width, height, transform } = page.getViewport({ scale: 1 })
    // Même lecture que le module PDF (readPageText), sans contournement : on mesure l'application réelle.
    const textItems = await readPageText(page, transform, false)
    pages.push({ pageIndex: p, width, height, textItems })
  }
  // Même principe que getRaster du module PDF : échelle 1, fond blanc. La fabrique de
  // canvas de pdf.js sous Node exige @napi-rs/canvas : sans lui, pas de raster.
  const factory = doc.canvasFactory as {
    create(w: number, h: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }
  }
  let raster = process.env.UNSPOIL_EVAL_RASTER !== '0'
  if (raster)
    try {
      factory.create(1, 1)
    } catch {
      raster = false
    }
  const getRaster = raster
    ? async (pageIndex: number): Promise<RasterData> => {
        const page = await doc.getPage(pageIndex + 1)
        const viewport = page.getViewport({ scale: 1 })
        const { canvas, context } = factory.create(
          Math.round(viewport.width),
          Math.round(viewport.height),
        )
        await page.render({ canvasContext: context, canvas, viewport, background: '#fff' }).promise
        const { width, height } = canvas
        return { width, height, rgba: context.getImageData(0, 0, width, height).data }
      }
    : undefined
  return { pages, getRaster, raster }
}

const short = (e: TruthElement) => `p${e.pageIndex + 1} « ${(e.text ?? '').slice(0, 50)} »`

describe.skipIf(!dir)('évaluation sur PDF locaux', () => {
  it('mesure fuites et sur-masquage', { timeout: 600_000 }, async () => {
    const files = readdirSync(dir!)
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .sort()
    const lines: string[] = []
    let corrections = 0
    let leaked = 0
    let questions = 0
    let overmasked = 0
    let kindOk = 0
    let evaluated = 0
    let docsWithCorrections = 0
    let docsLeaking = 0
    let docsLeakingShown = 0
    let docsOvermasked = 0
    let fallbacks = 0
    for (const f of files) {
      const path = join(dir!, f)
      const input = await load(path)
      if (lines.length === 0) lines.push(`Raster : ${input.raster ? 'oui' : 'non (texte seul)'}`)
      const result = await detectCorrections(input)
      if (process.env.UNSPOIL_EVAL_BOXES && input.getRaster) {
        // Diagnostic : cases de QCM trouvées dans le raster, page par page.
        for (const page of input.pages) {
          const boxes = findBoxes(await input.getRaster(page.pageIndex), page)
          const kept = new Set(answerBoxes(boxes))
          lines.push(
            `   ${f} p${page.pageIndex + 1} : ${boxes.length} cases (pleines ${boxes.filter((b) => b.filled).length}) ; ` +
              boxes
                .map(
                  (b) =>
                    `${b.filled ? '■' : '□'}${b.char ?? '?'}${kept.has(b) ? '' : '×'}@${Math.round(b.bbox.x)},${Math.round(b.bbox.y)}/${b.bbox.width.toFixed(1)}`,
                )
                .join(' '),
          )
        }
      }
      const truthPath = path.replace(/\.pdf$/i, '.verite.json')
      const rolesPath = path.replace(/\.pdf$/i, '.roles.txt')
      // Unités d'annotation : les lignes reconstruites, numérotées dans l'ordre de lecture.
      const units = input.pages.flatMap((page) =>
        layoutPage(page).lines.map((l) => ({
          pageIndex: page.pageIndex,
          text: l.text,
          bbox: l.bbox,
          font: l.fontNames.join('+'),
        })),
      )
      if (!existsSync(truthPath) && existsSync(rolesPath)) {
        const truth = truthFromRoles(readFileSync(rolesPath, 'utf8'), units)
        // Éléments supplémentaires annotés hors lignes (cases de QCM relevées dans les
        // opérations vectorielles du PDF, par exemple) : `x.cases.json`.
        const extraPath = path.replace(/\.pdf$/i, '.cases.json')
        if (existsSync(extraPath)) {
          truth.elements.push(...(JSON.parse(readFileSync(extraPath, 'utf8')) as TruthElement[]))
        }
        writeFileSync(truthPath, JSON.stringify(truth, null, 1))
      }
      if (!existsSync(truthPath)) {
        // Listing à annoter. Sans UNSPOIL_EVAL_GUESS, aucun rôle deviné : annotation à l'aveugle.
        const regions = result.blocks.flatMap((b) => b.regions)
        const guess = process.env.UNSPOIL_EVAL_GUESS === '1'
        const listing = units.map((u, i) => {
          const g = guess ? (coverage(u.bbox, u.pageIndex, regions) > 0.5 ? 'c' : 'q') + '\t' : ''
          return `${g}${i}\tp${u.pageIndex + 1}\tx${Math.round(u.bbox.x)}\t${u.text}\t${u.font}`
        })
        writeFileSync(path.replace(/\.pdf$/i, '.lignes.txt'), listing.join('\n'))
        lines.push(`${f} : ${units.length} lignes, sans vérité (listing à annoter écrit)`)
        continue
      }
      if (process.env.UNSPOIL_EVAL_VERBOSE) {
        for (const b of result.blocks) {
          const r = b.regions.map(({ pageIndex, bbox }) =>
            [pageIndex, bbox.x, bbox.y, bbox.width, bbox.height].map((v) => +v.toFixed(1)),
          )
          lines.push(`   ${f} ${b.id} [${b.questionLabel ?? '-'}] ${JSON.stringify(r)}`)
        }
      }
      const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as Truth
      if (process.env.UNSPOIL_EVAL_TRACE && f.startsWith(process.env.UNSPOIL_EVAL_TRACE)) {
        // Trace ligne par ligne : zone, rôle annoté, bloc couvrant (diagnostic local).
        const trace = input.pages.flatMap((page) =>
          layoutPage(page).lines.map((l) => {
            const block = result.blocks.find((b) =>
              b.regions.some((r) => coverage(l.bbox, page.pageIndex, [r]) > 0.5),
            )
            const role = truth.elements.find(
              (e) =>
                e.pageIndex === page.pageIndex &&
                Math.abs(e.bbox.y - l.bbox.y) < 0.5 &&
                Math.abs(e.bbox.x - l.bbox.x) < 0.5,
            )?.role
            return `${role ?? '?'}\t${block?.id ?? '-'}\t${l.area.id}\tp${page.pageIndex + 1}\t${l.text.slice(0, 70)}`
          }),
        )
        writeFileSync(path.replace(/\.pdf$/i, '.trace.txt'), trace.join('\n'))
      }
      const ev = evaluate(truth, result)
      evaluated++
      corrections += ev.corrections
      leaked += ev.leaked.length
      questions += ev.questions
      overmasked += ev.overmasked.length
      if (ev.kindOk) kindOk++
      if (ev.corrections > 0) docsWithCorrections++
      if (ev.leaked.length > 0) docsLeaking++
      // Un document « unknown » est entièrement couvert par l'interface : rien n'y est affiché.
      if (ev.leaked.length > 0 && result.kind !== 'unknown') docsLeakingShown++
      if (ev.overmasked.length > 0) docsOvermasked++
      if (result.needsFallback) fallbacks++
      lines.push(
        `${ev.kindOk ? 'OK ' : 'KO '} ${f} : attendu ${ev.expectedKind}, obtenu ${ev.kind} ; ` +
          `corrections visibles ${ev.leaked.length}/${ev.corrections} ; ` +
          `énoncés masqués ${ev.overmasked.length}/${ev.questions}` +
          (result.needsFallback ? ' ; repli proposé' : ''),
      )
      for (const e of ev.leaked) lines.push(`     visible : ${short(e)}`)
      for (const e of ev.overmasked) lines.push(`     masqué  : ${short(e)}`)
    }
    lines.push(
      `TOTAL ${evaluated} documents évalués : type correct ${kindOk}/${evaluated} ; ` +
        `corrections visibles ${leaked}/${corrections} ; énoncés masqués ${overmasked}/${questions}`,
      `DOCUMENTS : avec au moins une correction visible ${docsLeaking}/${docsWithCorrections} ` +
        `(affichée hors repli complet : ${docsLeakingShown}) ; ` +
        `avec au moins un énoncé masqué ${docsOvermasked}/${evaluated} ; repli proposé ${fallbacks}/${evaluated}`,
    )
    const report = lines.join('\n')
    writeFileSync(join(dir!, 'rapport-evaluation.txt'), report)
    console.log(report)
    expect(evaluated + files.length).toBeGreaterThan(0)
  })
})
