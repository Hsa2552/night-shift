// Corrigé annoté : couche d'annotation aplatie par-dessus le sujet (écriture manuscrite d'une
// tablette, réponses entourées, dessins, surlignages). Signature générale, indépendante du
// document : des tracés libres peints APRÈS tout le contenu visible de la page (texte dessiné
// par le document, glyphes en images). Les documents composés entremêlent leurs figures avec
// leur texte ; ils n'activent pas cette analyse.
//
// Ce qui suit le contenu est la correction ; le contenu d'origine est l'énoncé. Une réponse
// entourée : chaque proposition du groupe reçoit le même masque, marges du cercle comprises
// (aucun indice par la forme du masque, aucun fragment d'arc visible).

import type { PageData, PageRegion, Rect } from './contract.ts'

/** Sous-ensemble de l'observation native de Wael (C1 v1.1) utile à cette analyse. */
export interface OverlayVectors {
  textPaint?: { operatorIndex: number; mode: number; visibility: string }[]
  /** Couleur déclarée des fragments : le texte composé est « matched » ; le texte de
   * reconnaissance de l'écriture, invisible, ne l'est pas. */
  textColors?: { textIndex: number; status: string }[]
  graphics?: {
    images: { region: PageRegion; operatorIndex: number; visibility: string }[]
    paths: {
      region: PageRegion
      operatorIndex: number
      visibility: string
      outline: 'rectangles' | 'affine-envelope'
    }[]
  }
}

export interface PageOverlay {
  pageIndex: number
  /** Zones d'annotation à masquer (tracés regroupés), hors réponses entourées. */
  zones: Rect[]
  /** Masques identiques sur chaque proposition d'un groupe dont une est entourée. */
  rings: Rect[]
  /** Zones à retirer de l'analyse textuelle (texte de reconnaissance de l'écriture). */
  textMask: Rect[]
}

/** Nombre minimal de tracés libres postérieurs au contenu pour reconnaître une annotation. */
const MIN_MARKS = 10

const right = (r: Rect) => r.x + r.width
const bottom = (r: Rect) => r.y + r.height
const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(right(a), right(b)) - x,
    height: Math.max(bottom(a), bottom(b)) - y,
  }
}
const grow = (r: Rect, d: number): Rect => ({
  x: r.x - d,
  y: r.y - d,
  width: r.width + 2 * d,
  height: r.height + 2 * d,
})
const touches = (a: Rect, b: Rect) =>
  a.x <= right(b) && b.x <= right(a) && a.y <= bottom(b) && b.y <= bottom(a)

/** Regroupe des rectangles qui se touchent après dilatation de `gap`. */
function cluster(rects: Rect[], gap: number): Rect[] {
  const out: Rect[] = []
  for (const r of rects) {
    let current = r
    for (let k = out.length - 1; k >= 0; k--) {
      if (touches(grow(out[k]!, gap), grow(current, 0))) {
        current = union(current, out[k]!)
        out.splice(k, 1)
      }
    }
    out.push(current)
  }
  // Un regroupement peut en rendre deux autres voisins : on itère jusqu'à stabilité.
  return out.length === rects.length ? out : cluster(out, gap)
}

/**
 * Rangées du contenu d'origine (texte visible et glyphes en images), coupées aux grands blancs.
 * Les glyphes en images sont serrés sur l'encre et comptent tels quels ; les boîtes de police du
 * texte, plus hautes que l'encre (jambages, symboles mathématiques à boîte démesurée), sont
 * ramenées à la hauteur médiane du texte de la rangée.
 */
function contentRows(page: PageData, glyphs: Rect[]): Rect[] {
  const ink = (r: Rect): Rect => ({ ...r, y: r.y + 0.15 * r.height, height: 0.7 * r.height })
  const items = [
    ...page.textItems
      .filter((t) => t.text.trim() !== '')
      .map((t) => ({ r: ink(t.bbox), text: true })),
    ...glyphs.map((r) => ({ r, text: false })),
  ].sort((a, b) => a.r.y + a.r.height / 2 - (b.r.y + b.r.height / 2) || a.r.x - b.r.x)
  const rows: (typeof items)[] = []
  for (const it of items) {
    const cy = it.r.y + it.r.height / 2
    const row = rows.find((list) => {
      const ref = list[0]!.r
      return Math.abs(ref.y + ref.height / 2 - cy) <= Math.max(2.5, 0.3 * ref.height)
    })
    if (row) row.push(it)
    else rows.push([it])
  }
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1]!
  const out: Rect[] = []
  const close = (parts: typeof items) => {
    const texts = parts.filter((p) => p.text).map((p) => p.r)
    const cy = texts.length ? median(texts.map((r) => r.y + r.height / 2)) : 0
    const half = texts.length ? median(texts.map((r) => r.height / 2)) : 0
    const boxes = parts.map((p) =>
      p.text
        ? {
            ...p.r,
            y: cy - Math.min(half, p.r.height / 2),
            height: 2 * Math.min(half, p.r.height / 2),
          }
        : p.r,
    )
    out.push(boxes.reduce((u, r) => union(u, r)))
  }
  for (const row of rows) {
    row.sort((a, b) => a.r.x - b.r.x)
    let parts = [row[0]!]
    for (const it of row.slice(1)) {
      const last = parts.map((p) => p.r).reduce((u, q) => union(u, q))
      if (it.r.x - right(last) > 30) {
        close(parts)
        parts = [it]
      } else parts.push(it)
    }
    close(parts)
  }
  return out
}

/**
 * Couche d'annotation d'une page, ou null si la page n'en porte pas. `marks` : tracés libres
 * postérieurs au contenu ; un tracé seul qui entoure le début d'une rangée de contenu est une
 * réponse entourée.
 */
export function pageOverlay(
  vectors: OverlayVectors | undefined,
  page: PageData,
): PageOverlay | null {
  const g = vectors?.graphics
  if (!g) return null
  const visibleText = (vectors.textPaint ?? []).filter(
    (t) => t.mode !== 3 && (t.mode & 3) !== 3 && t.visibility !== 'invisible',
  )
  const contentEnd = Math.max(
    -1,
    ...visibleText.map((t) => t.operatorIndex),
    ...g.images.map((i) => i.operatorIndex),
  )
  const drawn = (v: string) => v !== 'invisible' && v !== 'clipped'
  const marks = g.paths
    .filter(
      (p) => p.operatorIndex > contentEnd && p.outline === 'affine-envelope' && drawn(p.visibility),
    )
    .map((p) => p.region.bbox)
    .filter((r) => r.width > 0 || r.height > 0)
  if (marks.length < MIN_MARKS) return null

  const glyphs = g.images
    .filter((i) => i.operatorIndex <= contentEnd && drawn(i.visibility))
    .map((i) => i.region.bbox)
  // Rangées du seul contenu d'origine : le texte de reconnaissance de l'écriture (sous les
  // tracés) en est exclu, sinon il élargit et décale les rangées.
  const inkZones = cluster(marks, 6).map((z) => grow(z, 2))
  const inInk = (r: Rect) => {
    const cx = r.x + r.width / 2
    const cy = r.y + r.height / 2
    return inkZones.some((z) => cx >= z.x && cx <= right(z) && cy >= z.y && cy <= bottom(z))
  }
  const matched = new Set(
    (vectors.textColors ?? []).filter((c) => c.status === 'matched').map((c) => c.textIndex),
  )
  const original = {
    ...page,
    textItems: page.textItems.filter((t, i) => matched.has(i) || !inInk(t.bbox)),
  }
  const rows = contentRows(original, glyphs)

  // Réponses entourées : un tracé assez large qui enveloppe le début d'une rangée de contenu.
  // L'étiquette de la proposition est la rangée enveloppée la plus à gauche (« (C) »), et non
  // le numérateur d'une fraction.
  const centerY = (r: Rect) => r.y + r.height / 2
  const circles: { mark: Rect; label: Rect }[] = []
  for (const m of marks) {
    if (m.width < 25) continue
    const enclosed = rows.filter(
      (r) =>
        r.height >= 4 &&
        m.x <= r.x + 4 &&
        right(m) >= r.x + 15 &&
        centerY(r) >= m.y &&
        centerY(r) <= bottom(m) &&
        m.height <= 3.2 * r.height,
    )
    if (enclosed.length === 0) continue
    const label = enclosed.reduce((a, b) => (b.x < a.x ? b : a))
    circles.push({ mark: m, label })
  }
  const circleMarks = new Set(circles.map((c) => c.mark))

  // Groupes de propositions : étiquettes alignées à gauche, consécutives (pas de rangée qui
  // commence plus à gauche entre deux : ligne de la question suivante).
  const rings: Rect[] = []
  const done = new Set<Rect>()
  for (const { label } of circles) {
    if (done.has(label)) continue
    // Étiquette de proposition « (A) » : texte qui commence ainsi, ou, sans couche texte, glyphe
    // étroit et plus haut que les lettres (parenthèse) en tête de rangée, suivi d'un second.
    const glyphH = glyphs.map((g) => g.height).sort((a, b) => a - b)[glyphs.length >> 1] ?? 0
    const paren = (g: Rect) => g.height >= 1.25 * glyphH && g.width <= 0.5 * g.height
    const isLabel = (r: Rect) => {
      const startText = original.textItems
        .filter(
          (t) =>
            Math.abs(t.bbox.x - r.x) <= 2 && Math.abs(centerY(t.bbox) - centerY(r)) <= r.height,
        )
        .map((t) => t.text)
        .join('')
      if (/^\s*(?:\(?[A-Ha-h]\)|[A-Ha-h][.)])/u.test(startText)) return true
      const first = glyphs.filter(
        (g) => g.x >= r.x - 1 && g.x <= r.x + 2 && Math.abs(centerY(g) - centerY(r)) <= r.height,
      )
      if (!first.some(paren)) return false
      return glyphs.some(
        (g) =>
          paren(g) &&
          g.x > r.x + 5 &&
          g.x < r.x + 22 &&
          Math.abs(centerY(g) - centerY(r)) <= r.height,
      )
    }
    const labelShaped = isLabel(label)
    const aligned = rows
      .filter(
        (r) =>
          Math.abs(r.x - label.x) <= 4 &&
          r.height >= 4 &&
          (!labelShaped || r === label || isLabel(r)),
      )
      .sort((a, b) => a.y - b.y)
    const at = aligned.indexOf(label)
    let lo = at
    let hi = at
    // Pas de rangée étrangère entre deux étiquettes : ni ligne de question (plus à gauche), ni
    // rangée alignée qui n'a pas la forme d'une étiquette (suite de l'énoncé).
    const next = (a: Rect, b: Rect) =>
      b.y - bottom(a) <= 3.5 * Math.max(a.height, b.height) &&
      !rows.some(
        (r) =>
          centerY(r) > bottom(a) &&
          centerY(r) < b.y &&
          (r.x < label.x - 4 || (labelShaped && Math.abs(r.x - label.x) <= 4 && !isLabel(r))),
      )
    while (lo > 0 && next(aligned[lo - 1]!, aligned[lo]!)) lo--
    while (hi < aligned.length - 1 && next(aligned[hi]!, aligned[hi + 1]!)) hi++
    const labels = aligned.slice(lo, hi + 1)
    // Chaque proposition : bande verticale autour de son étiquette, avec toutes ses sous-rangées
    // (exposants, numérateurs, dénominateurs).
    const members = new Set<Rect>()
    const options = labels.map((l, k) => {
      const prev = labels[k - 1]
      const nextLabel = labels[k + 1]
      const from = prev ? (bottom(prev) + l.y) / 2 : l.y - 0.25 * l.height
      const to = nextLabel ? (bottom(l) + nextLabel.y) / 2 : bottom(l) + 0.25 * l.height
      const parts = rows.filter(
        (r) =>
          centerY(r) >= from &&
          centerY(r) <= to &&
          r.x >= l.x - 2 &&
          r.x <= l.x + 300 &&
          r.height <= 1.2 * l.height,
      )
      for (const r of parts) members.add(r)
      members.add(l)
      return parts.reduce((u, r) => union(u, r), l)
    })
    // Gabarit : marges maximales des cercles du groupe autour de leur proposition.
    let mL = 0
    let mR = 0
    let mT = 0
    let mB = 0
    for (const c of circles) {
      const k = labels.indexOf(c.label)
      if (k < 0) continue
      done.add(c.label)
      const o = options[k]!
      mL = Math.max(mL, o.x - c.mark.x)
      mR = Math.max(mR, right(c.mark) - right(o))
      mT = Math.max(mT, o.y - c.mark.y)
      mB = Math.max(mB, bottom(c.mark) - bottom(o))
    }
    // Chaque proposition du groupe est masquée en entier, avec les marges du cercle : un cercle
    // tracé serré autour du texte ne peut pas être caché par des rectangles sans cacher une
    // partie du texte, et un fragment d'arc laissé visible désignerait la réponse. Même gabarit
    // pour toutes les propositions ; arrêt au bord des rangées hors du groupe (question).
    const pad = 1.5
    const outside = rows.filter((o) => !members.has(o))
    for (const r of options) {
      const x0 = r.x - Math.max(0, mL) - pad
      const x1 = right(r) + Math.max(0, mR) + pad
      const overlapsX = (o: Rect) => o.x < x1 && right(o) > x0
      // Les rangées hors du groupe (question) peuvent être mordues de 3 points au plus (zone des
      // jambages), assez pour couvrir un arc qui passe sous elles.
      const bite = (o: Rect) => Math.min(3, 0.3 * o.height)
      const top = Math.max(
        r.y - Math.max(0, mT) - pad,
        ...outside
          .filter((o) => overlapsX(o) && bottom(o) <= r.y + 0.5)
          .map((o) => bottom(o) - bite(o)),
      )
      const low = Math.min(
        bottom(r) + Math.max(0, mB) + pad,
        ...outside.filter((o) => overlapsX(o) && o.y >= bottom(r) - 0.5).map((o) => o.y + bite(o)),
      )
      rings.push({ x: x0, y: top, width: x1 - x0, height: low - top })
    }
  }

  const others = marks.filter((m) => !circleMarks.has(m))
  const zones = cluster(others, 6).map((z) => grow(z, 2))
  return {
    pageIndex: page.pageIndex,
    zones,
    rings: rings.filter((r) => r.width > 0 && r.height > 0),
    textMask: cluster(marks, 6).map((z) => grow(z, 2)),
  }
}

/**
 * Blocs révélables : zones et cadres regroupés par bandes verticales (une bande par question ou
 * par travail manuscrit : écart vertical de moins de 15 points).
 */
export function overlayBlocks(overlay: PageOverlay): PageRegion[][] {
  const all = [...overlay.zones, ...overlay.rings].sort((a, b) => a.y - b.y)
  const bands: { top: number; bottom: number; rects: Rect[] }[] = []
  for (const r of all) {
    const band = bands.find((b) => r.y <= b.bottom + 15 && bottom(r) >= b.top - 15)
    if (band) {
      band.rects.push(r)
      band.top = Math.min(band.top, r.y)
      band.bottom = Math.max(band.bottom, bottom(r))
    } else bands.push({ top: r.y, bottom: bottom(r), rects: [r] })
  }
  // Fusion des bandes devenues chevauchantes.
  bands.sort((a, b) => a.top - b.top)
  const merged: typeof bands = []
  for (const b of bands) {
    const last = merged[merged.length - 1]
    if (last && b.top <= last.bottom + 15) {
      last.rects.push(...b.rects)
      last.bottom = Math.max(last.bottom, b.bottom)
    } else merged.push({ ...b, rects: [...b.rects] })
  }
  return merged.map((b) => b.rects.map((bbox) => ({ pageIndex: overlay.pageIndex, bbox })))
}
