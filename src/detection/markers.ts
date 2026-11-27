// Reconnaissance des marqueurs textuels : débuts de questions, débuts de corrections,
// marqueurs de correction en cours de ligne, options de QCM cochées.
// Toutes les fonctions travaillent sur une ligne de texte déjà reconstruite.

/**
 * Minuscules et suppression des accents, en conservant la longueur de la chaîne
 * (chaque caractère est remplacé par un seul caractère) : les indices restent valables
 * sur le texte d'origine.
 */
export function fold(text: string): string {
  let out = ''
  for (const ch of text) {
    const base = ch.normalize('NFD')[0] ?? ch
    const lower = base.toLowerCase()
    // On garde exactement le même nombre d'unités UTF-16 que le caractère d'origine.
    out += lower.length === ch.length ? lower : ch
  }
  return out
}

/** Puces et décorations ignorées en début de ligne. */
const LEADING_DECORATION = /^[\s•▪▸►▶◆◇\-–*·]+/

export type QuestionKind = 'part' | 'exercise' | 'question' | 'numeric' | 'letter'

export interface QuestionMarker {
  kind: QuestionKind
  /** Profondeur hiérarchique : partie 0, exercice 1, question 2, sous-numéro 3, lettre 4. */
  level: number
  /** Valeur normalisée du numéro : '3', 'ii', 'b', '1.2'. */
  value: string
  /** Ponctuation du marqueur, utilisée pour vérifier la continuité d'une numérotation. */
  style: string
  /** Libellé lisible, par exemple « Exercice 2 » ou « 3 ». */
  display: string
  /** Texte qui suit le marqueur. */
  rest: string
}

const STRONG_WORDS: Record<string, { kind: QuestionKind; level: number; name: string }> = {
  partie: { kind: 'part', level: 0, name: 'Partie' },
  part: { kind: 'part', level: 0, name: 'Partie' },
  exercice: { kind: 'exercise', level: 1, name: 'Exercice' },
  exercise: { kind: 'exercise', level: 1, name: 'Exercice' },
  exo: { kind: 'exercise', level: 1, name: 'Exercice' },
  probleme: { kind: 'exercise', level: 1, name: 'Problème' },
  problem: { kind: 'exercise', level: 1, name: 'Problème' },
  question: { kind: 'question', level: 2, name: 'Question' },
  q: { kind: 'question', level: 2, name: 'Question' },
}

const STRONG_RE =
  /^(partie|part|exercice|exercise|exo|probleme|problem|question|q)\s*(?:n\s*[°o]\s*)?\.?\s*(\d{1,3}(?:\.\d{1,2})?|[ivx]{1,5}|[a-h])(?![\w])\s*[.:)\-–—]?\s*/
const DOTTED_RE = /^(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)(?![\d])\s*([.)])?\s+(?=\S)/
const NUMERIC_RE = /^(\d{1,2})\s*([.)])\s+(?=\S)/
const LETTER_RE = /^(?:\(([a-h])\)|([a-h])\))\s+(?=\S)/

/** Reconnaît un marqueur de question en début de ligne. */
export function parseQuestion(text: string): QuestionMarker | null {
  const stripped = text.replace(LEADING_DECORATION, '')
  const folded = fold(stripped)

  const strong = STRONG_RE.exec(folded)
  if (strong) {
    const word = STRONG_WORDS[strong[1]!]!
    const value = strong[2]!
    // « Q » seul n'est accepté qu'avec un numéro, pas avec une lettre (« q a » n'a pas de sens).
    if (strong[1] === 'q' && !/^\d/.test(value)) return null
    // « part » anglais suivi d'un mot courant (« part of ») est exclu par l'exigence d'un numéro.
    return {
      kind: word.kind,
      level: word.level,
      value,
      style: word.kind,
      display: `${word.name} ${/^[a-z]+$/.test(value) ? value.toUpperCase() : value}`,
      rest: stripped.slice(strong[0].length),
    }
  }

  const dotted = DOTTED_RE.exec(folded)
  if (dotted) {
    return {
      kind: 'numeric',
      level: 3,
      value: dotted[1]!,
      style: `dotted${dotted[2] ?? ''}`,
      display: dotted[1]!,
      rest: stripped.slice(dotted[0].length),
    }
  }

  const numeric = NUMERIC_RE.exec(folded)
  if (numeric) {
    return {
      kind: 'numeric',
      level: 2,
      value: String(Number(numeric[1])),
      style: numeric[2]!,
      display: String(Number(numeric[1])),
      rest: stripped.slice(numeric[0].length),
    }
  }

  const letter = LETTER_RE.exec(folded)
  if (letter) {
    const value = (letter[1] ?? letter[2])!
    return {
      kind: 'letter',
      level: 4,
      value,
      style: letter[1] ? '(x)' : 'x)',
      display: `${value})`,
      rest: stripped.slice(letter[0].length),
    }
  }
  return null
}

/** Valeur suivante d'une numérotation (3 → 4, b → c, 1.2 → 1.3), ou null. */
export function nextValue(value: string): string | null {
  if (/^\d+$/.test(value)) return String(Number(value) + 1)
  if (/^[a-g]$/.test(value)) return String.fromCharCode(value.charCodeAt(0) + 1)
  const dotted = /^(.*\.)(\d+)$/.exec(value)
  if (dotted) return `${dotted[1]}${Number(dotted[2]) + 1}`
  const roman = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']
  const idx = roman.indexOf(value)
  if (idx >= 0 && idx < roman.length - 1) return roman[idx + 1]!
  return null
}

const CORRECTION_WORD =
  '(?:grilles?\\s+de\\s+(?:correction|reponse)s?|cles?\\s+de\\s+correction|answer\\s+keys?|elements?\\s+de\\s+(?:correction|reponse)s?|propositions?\\s+de\\s+(?:correction|corrige)s?|indications?\\s+de\\s+correction|bonnes?\\s+reponses?|corriges?|corrections?|solutions?|reponses?|answers?|correcting)'

/** Ce qui peut suivre le mot-clé pour qu'il s'agisse bien d'un marqueur, et non d'une phrase. */
const CORRECTION_TAIL =
  "(?:\\s*$|\\s*[:.\\-–—)]|\\s+(?:de\\s+l\\s*['’]\\s*exercice|de\\s+la\\s+question|du\\s+probleme|de\\s+la\\s+partie|des\\s+exercices|des\\s+questions|du\\s+sujet|de\\s+l\\s*['’]\\s*examen|du\\s+td|du\\s+tp|du\\s+devoir|du\\s+partiel|detaille|complete?|type|to\\s+(?:exercise|question|problem)|for\\s+(?:exercise|question|problem)|(?:n\\s*[°o]\\s*)?\\d|[ivx]{1,4}\\b|q\\s*\\d|(?:exercices?|exercises?|questions?|problemes?|problems?|parties?)\\s*(?:n\\s*[°o]\\s*)?(?:\\d|[ivx]{1,4}\\b))|\\s+[a-e]\\s*(?:$|[.,;]))"

const CORRECTION_START_RE = new RegExp(`^${CORRECTION_WORD}${CORRECTION_TAIL}`)

/** Titres de section n'ayant rien d'autre que le mot-clé : « Corrigé », « Solutions des exercices ». */
const HEADER_ONLY_RE = new RegExp(
  `^${CORRECTION_WORD}(?:\\s+(?:des\\s+exercices|des\\s+questions|du\\s+sujet|de\\s+l\\s*['’]\\s*examen|du\\s+td|du\\s+tp|du\\s+devoir|du\\s+partiel|detaille(?:e|s|es)?|complete?s?|type))?\\s*[:.]?\\s*$`,
)

export interface CorrectionMarker {
  /** Vrai si la ligne ne contient que le titre (« Corrigé », « Solutions ») : début de section. */
  headerOnly: boolean
  /** Question ou exercice désigné par le titre : « Correction de l'exercice 2 », « Solution 3 ». */
  target?: QuestionMarker
}

const WORD_PREFIX_RE = new RegExp(`^${CORRECTION_WORD}`)
const TARGET_LINK_RE = /^\s*(?:de\s+l\s*['’]\s*|de\s+la\s+|du\s+|to\s+|for\s+|of\s+)?/
const BARE_NUMBER_RE = /^(?:n\s*[°o]\s*)?(\d{1,3})(?!\d|[.,]\d)/

/** Reconnaît une ligne qui commence par un marqueur explicite de correction. */
export function parseCorrectionStart(text: string): CorrectionMarker | null {
  const stripped = text.replace(LEADING_DECORATION, '').trim()
  const folded = fold(stripped)
  if (!CORRECTION_START_RE.test(folded)) return null
  const marker: CorrectionMarker = { headerOnly: HEADER_ONLY_RE.test(folded) }
  const word = WORD_PREFIX_RE.exec(folded)![0]
  const link = TARGET_LINK_RE.exec(folded.slice(word.length))![0]
  const rest = stripped.slice(word.length + link.length)
  const target = parseQuestion(rest)
  if (target && target.kind !== 'letter') {
    marker.target = target
  } else {
    const bare = BARE_NUMBER_RE.exec(fold(rest))
    if (bare) {
      const value = String(Number(bare[1]))
      marker.target = {
        kind: 'question',
        level: 2,
        value,
        style: 'question',
        display: `Question ${value}`,
        rest: rest.slice(bare[0].length),
      }
    }
  }
  return marker
}

/**
 * Marqueur de correction suivi de « : » au milieu d'une ligne, par exemple
 * « 1. Combien font 2 + 2 ? Réponse : 4 ». Renvoie l'indice du marqueur, ou null.
 */
export function findInlineCorrection(text: string): number | null {
  const folded = fold(text)
  const re = new RegExp(`(?:^|[\\s(\\[])(${CORRECTION_WORD})\\s*:`, 'g')
  for (const match of folded.matchAll(re)) {
    const index = match.index + match[0].indexOf(match[1]!)
    if (index > 0) return index
  }
  return null
}

const CHECKED_SYMBOLS = '☑☒■✓✔✅●◉✗✘⊠▣'
const UNCHECKED_SYMBOLS = '☐□○◯❍❏❑❒◻▢'
const LEADING_OPTION_RE = new RegExp(
  `^(\\s*)([${CHECKED_SYMBOLS}${UNCHECKED_SYMBOLS}]|\\[\\s?[xX✓✔]?\\s?\\]|\\(\\s?[xX]?\\s?\\))`,
)
const TRAILING_CHECK_RE = new RegExp(`[${CHECKED_SYMBOLS}]`)
const LETTER_OPTION_RE = /^\s*(?:\(?[A-Ea-e][.)]|[A-Ea-e]\s*[-–:])\s+\S/

export interface OptionLine {
  /** Indices [début, fin[ du symbole de case en début de ligne, s'il existe. */
  box?: { start: number; end: number; checked: boolean }
  /** Indice d'une coche placée après le texte de l'option (« B. Paris ✓ »). */
  trailingCheck?: number
}

/** Reconnaît une option de QCM : case en début de ligne, ou lettre suivie d'une coche. */
export function parseOption(text: string): OptionLine | null {
  const lead = LEADING_OPTION_RE.exec(text)
  if (lead) {
    const symbol = lead[2]!
    const start = lead[1]!.length
    const checked =
      CHECKED_SYMBOLS.includes(symbol) || /[xX✓✔]/.test(symbol.replace(/^\s+|\s+$/g, ''))
    return { box: { start, end: start + symbol.length, checked } }
  }
  if (LETTER_OPTION_RE.test(text)) {
    const check = TRAILING_CHECK_RE.exec(text.slice(2))
    return check ? { trailingCheck: check.index + 2 } : {}
  }
  return null
}

/** Ligne de numéro de page, d'en-tête ou de pied de page sans contenu. */
export function isPageFurniture(text: string): boolean {
  return /^(?:page\s*)?\d{1,4}(?:\s*(?:\/|sur|of)\s*\d{1,4})?$/.test(fold(text).trim())
}

/** Titre de document annonçant un corrigé (et non un sujet accompagné de son corrigé). */
export function isCorrectionTitle(text: string): boolean {
  const folded = fold(text)
  if (!/\b(?:corriges?|corrections?|solutions?|elements\s+de\s+correction)\b/.test(folded)) {
    return false
  }
  return !/\b(?:sujets?|enonces?)\b|\bavec\b|\+/.test(folded)
}

/**
 * Caractère isolé en tête de ligne, suivi d'un texte : candidat « case de QCM » quand la
 * police de symboles est extraite sous forme de lettres (ZapfDingbats « o », « 4 »...).
 */
export function leadingGlyph(text: string): string | null {
  const m = /^(\S)\s+\S/u.exec(text)
  return m ? m[1]! : null
}
