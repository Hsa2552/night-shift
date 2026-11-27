// PDF d'exemple SYNTHÉTIQUES créés par l'équipe (contenu inventé), pour tester la détection.
// Régénération : copier ce script dans un dossier hors du dépôt où `npm install pdf-lib@1.17.1`
// a été lancé, puis `node generate.mjs` (pdf-lib n'est volontairement pas une dépendance du projet).
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync } from 'node:fs'

const W = 595
const H = 842
const BLACK = rgb(0, 0, 0)
const BLUE = rgb(0.1, 0.2, 0.8)

async function make(name, pages) {
  const doc = await PDFDocument.create()
  const reg = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  for (const lines of pages) {
    const page = doc.addPage([W, H])
    let y = 780
    for (const l of lines) {
      const o = typeof l === 'string' ? { t: l } : l
      const size = o.size ?? 11
      if (o.y !== undefined) y = o.y
      if (o.rect) {
        // figure sans texte
        page.drawRectangle({
          x: 90,
          y: y - o.rect,
          width: 200,
          height: o.rect,
          borderColor: o.color ?? BLACK,
          borderWidth: 1,
        })
        y -= o.rect + 8
        continue
      }
      page.drawText(o.t, {
        x: o.x ?? 72,
        y,
        size,
        font: o.bold ? bold : reg,
        color: o.color ?? BLACK,
      })
      if (!o.same) y -= size * 1.6
    }
  }
  writeFileSync(`${name}.pdf`, await doc.save())
}

await make('mixte', [
  [
    { t: 'Partiel de probabilites 2025', size: 16, bold: true },
    { t: 'Exercice 1', bold: true },
    '1. Soit X une variable de loi uniforme sur [0, 1]. Calculer E(X).',
    'Correction : par definition, E(X) est l integrale de x sur [0, 1].',
    'On obtient E(X) = 1/2.',
    { rect: 60 },
    '2. Calculer la variance de X.',
    'Correction : V(X) = E(X²) - E(X)² = 1/3 - 1/4 = 1/12.',
    { t: 'Exercice 2', bold: true },
    '1. Donner la solution de l equation P(A) = 0,3 lorsque A est independant de B.',
    'Correction :',
    ...Array.from(
      { length: 24 },
      (_, i) => `Etape ${i + 1} du raisonnement detaille de la correction.`,
    ),
  ],
  [
    'Suite de la correction de la question 1.',
    'Conclusion : P(A) = 0,3.',
    '2. En deduire P(A inter B).',
    'Correction : P(A inter B) = P(A) P(B) = 0,15.',
  ],
])

await make('couleur', [
  [
    { t: 'TD 4 : suites numeriques', size: 16, bold: true },
    'Exercice 1',
    '1. Montrer que la suite u est croissante.',
    { t: 'u(n+1) - u(n) = 1/(n+1) > 0 donc u est croissante.', color: BLUE },
    { t: 'Le resultat est valable pour tout entier n.', color: BLUE },
    '2. Montrer que u est majoree.',
    { t: 'On a u(n) < 2 pour tout n par recurrence.', color: BLUE },
    '3. Conclure sur la convergence.',
    { t: 'Suite croissante et majoree : elle converge.', color: BLUE },
  ],
])

await make('deux-colonnes', [
  [
    { t: 'Fiche de calcul mental', size: 16, bold: true },
    ...[
      ['1. Combien font 12 x 12 ?', 'Reponse : 144'],
      ['2. Combien font 15 x 4 ?', 'Reponse : 60'],
      ['3. Combien font 99 + 101 ?', 'Reponse : 200'],
      ['4. Combien font 7 x 8 ?', 'Reponse : 56'],
    ].flatMap(([q, r]) => [
      { t: q, same: true },
      { t: r, x: 360 },
    ]),
  ],
])

await make('corrige-seul', [
  [
    { t: 'Corrige du partiel d algebre 2025', size: 16, bold: true },
    { t: 'Exercice 1', bold: true },
    'La matrice A est diagonalisable car elle possede 3 valeurs propres distinctes.',
    'Les valeurs propres sont 1, 2 et 3.',
    { t: 'Exercice 2', bold: true },
    'Le noyau de f est engendre par le vecteur (1, -1, 0).',
    { t: 'Exercice 3', bold: true },
    'Le rang vaut 2 d apres le theoreme du rang.',
  ],
])

await make('sujet-seul', [
  [
    { t: 'Examen d analyse 2025', size: 16, bold: true },
    { t: 'Exercice 1', bold: true },
    '1. Etudier la continuite de f sur R.',
    '2. Calculer la derivee de f.',
    { t: 'Exercice 2', bold: true },
    '1. Calculer l integrale de 0 a 1 de x² dx.',
    '2. En deduire la valeur moyenne de x² sur [0, 1].',
  ],
])

await make('fin', [
  [
    { t: 'Annale 2024', size: 16, bold: true },
    { t: 'Exercice 1', bold: true },
    '1. Resoudre x + 1 = 0.',
    '2. Resoudre 2x = 4.',
    { t: 'Exercice 2', bold: true },
    '1. Deriver la fonction x -> x².',
  ],
  [
    { t: 'Corrige', size: 16, bold: true },
    { t: 'Exercice 1', bold: true },
    '1. x = -1.',
    '2. x = 2.',
    { t: 'Exercice 2', bold: true },
    '1. La derivee vaut 2x.',
  ],
])

await make('qcm', [
  [
    { t: 'QCM de culture generale', size: 16, bold: true },
    'Question 1 : Quelle est la capitale de la France ?',
    'A. Lyon',
    'B. Paris',
    'C. Marseille',
    'Reponse : B',
    'Question 2 : Combien font 2 + 2 ?',
    'A. 3',
    'B. 4',
    'C. 5',
    'Reponse : B',
  ],
])

await make('inconnu', [
  [
    { t: 'Notes de cours', size: 16, bold: true },
    'La fonction exponentielle est strictement croissante sur R.',
    'Elle verifie exp(a + b) = exp(a) exp(b) pour tous reels a et b.',
    'On en deduit de nombreuses proprietes utiles en analyse.',
  ],
])

console.log('PDF generes')
