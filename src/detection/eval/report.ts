import type { DocumentScore, provenanceKind } from './geo.ts'
import type { scoreVisibleInk } from './strict.ts'

export interface DocReport extends Partial<DocumentScore> {
  partition: string
  name: string
  family: string
  status:
    'évalué' | 'absent' | 'empreinte différente' | 'sans vérité' | 'vérité différente' | 'erreur'
  detail?: string
  provenance?: string
  annotationSource?: ReturnType<typeof provenanceKind>
  pdfSha256?: string
  truthSha256?: string
  truthVersion?: string
  ink?: Awaited<ReturnType<typeof scoreVisibleInk>>
  durationMs?: number
  raster?: boolean
  oracleMatches?: boolean
}

export function aggregate(docs: DocReport[]) {
  const done = docs.filter((d) => d.status === 'évalué' && d.measurable !== false)
  const sum = (f: (d: DocReport) => number) => done.reduce((a, d) => a + f(d), 0)
  const corr = sum((d) => d.corrections?.total ?? 0)
  const full = sum((d) => d.corrections?.full ?? 0)
  const stmts = sum((d) => d.statements?.total ?? 0)
  const masked = sum((d) => d.statements?.masked ?? 0)
  return {
    documents: docs.length,
    evaluated: done.length,
    notMeasurable: docs.filter((d) => d.status === 'évalué' && d.measurable === false).length,
    errors: docs.filter((d) => d.status !== 'évalué').length,
    kindCorrect: done.filter((d) => d.kindExpected === d.kindObtained).length,
    corrections: {
      total: corr,
      full,
      partial: sum((d) => d.corrections?.partial ?? 0),
      none: sum((d) => d.corrections?.none ?? 0),
    },
    leakRate: corr === 0 ? 0 : (corr - full) / corr,
    statements: { total: stmts, masked },
    overmaskRate: stmts === 0 ? 0 : masked / stmts,
    abstentions: done.filter((d) => d.abstained).length,
    successes: done.filter((d) => d.success).length,
    presentationMismatches: docs.filter((d) => d.oracleMatches === false).length,
    annotations: {
      humanReviewed: done.filter((d) => d.annotationSource === 'human-reviewed').length,
      automatic: done.filter((d) => d.annotationSource === 'automatic').length,
      unspecified: done.filter((d) => !d.annotationSource || d.annotationSource === 'unspecified')
        .length,
    },
    strictSuccesses: done.filter((d) => d.presentation?.strictSuccess).length,
    presentation: {
      automatic: docs.filter((d) => d.presentation?.mode === 'automatic').length,
      statementOnly: docs.filter((d) => d.presentation?.mode === 'statement_only').length,
      progressive: docs.filter((d) => d.presentation?.mode === 'progressive').length,
      errors: docs.filter((d) => d.status === 'erreur').length,
    },
    documentsWithLeak: done.filter((d) => (d.corrections?.total ?? 0) > (d.corrections?.full ?? 0))
      .length,
    meanDurationMs: done.length === 0 ? 0 : Math.round(sum((d) => d.durationMs ?? 0) / done.length),
  }
}
