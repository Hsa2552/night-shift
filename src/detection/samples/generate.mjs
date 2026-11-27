// PDF d'exemple SYNTHÉTIQUES créés par l'équipe (contenu inventé), pour tester la détection.
// Chaque PDF est accompagné de `<nom>.verite.json` : rôle et position de chaque élément
// (q : énoncé, c : correction, t : titre ou texte neutre), et type de document attendu.
// Régénération : copier ce script dans un dossier hors du dépôt où `npm install pdf-lib@1.17.1`
// a été lancé, puis `node generate.mjs` (pdf-lib n'est volontairement pas une dépendance du projet).
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync } from 'node:fs'

const W = 595
const H = 842
const BLACK = rgb(0, 0, 0)
const BLUE = rgb(0.1, 0.2, 0.8)
const GREEN = rgb(0.05, 0.5, 0.15)
const GREY = rgb(0.85, 0.85, 0.85)

// Raccourcis : rôle de chaque ligne.
const T = (t, o = {}) => ({ t, r: 't', ...o })
const Q = (t, o = {}) => ({ t, r: 'q', ...o })
const C = (t, o = {}) => ({ t, r: 'c', ...o })

async function make(name, kind, pages, { header } = {}) {
  const doc = await PDFDocument.create()
  const fonts = {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    ital: await doc.embedFont(StandardFonts.HelveticaOblique),
    zapf: await doc.embedFont(StandardFonts.ZapfDingbats),
  }
  const truth = { kind, elements: [] }
  const add = (pageIndex, r, x, top, width, height, text) =>
    truth.elements.push({ pageIndex, role: r, text, bbox: { x, y: top, width, height } })
  pages.forEach((lines, pageIndex) => {
    const page = doc.addPage([W, H])
    if (header) {
      page.drawText(header, { x: 72, y: H - 40, size: 9, font: fonts.reg, color: BLACK })
      page.drawText(`Page ${pageIndex + 1} / ${pages.length}`, {
        x: 270,
        y: 30,
        size: 9,
        font: fonts.reg,
        color: BLACK,
      })
    }
    let y = 780
    for (const raw of lines) {
      const o = typeof raw === 'string' ? { t: raw, r: 't' } : raw
      const size = o.size ?? 11
      if (o.y !== undefined) y = o.y
      if (o.rect) {
        // Figure sans texte : contour, ou cadre autour des lignes suivantes (o.frame).
        const x = o.x ?? 90
        const w = o.w ?? 200
        const yTop = y + (o.up ?? 0)
        page.drawRectangle({
          x,
          y: yTop - o.rect,
          width: w,
          height: o.rect,
          borderColor: o.color ?? BLACK,
          borderWidth: 1,
          color: o.fill,
        })
        add(pageIndex, o.r, x - 1, H - yTop - 1, w + 2, o.rect + 2, '[figure]')
        if (!o.frame) y -= o.rect + 8
        continue
      }
      const font = fonts[o.font ?? (o.bold ? 'bold' : 'reg')]
      const x = o.x ?? 72
      page.drawText(o.t, { x, y, size, font, color: o.color ?? BLACK })
      const width = font.widthOfTextAtSize(o.t, size)
      add(pageIndex, o.r, x, H - y - 0.75 * size, width, 0.95 * size, o.t)
      if (!o.same) y -= size * (o.lead ?? 1.6)
    }
  })
  writeFileSync(`${name}.pdf`, await doc.save())
  writeFileSync(`${name}.verite.json`, JSON.stringify(truth, null, 1))
}

// --- Jeu de base -----------------------------------------------------------------

await make('mixte', 'mixed', [
  [
    T('Partiel de probabilites 2025', { size: 16, bold: true }),
    Q('Exercice 1', { bold: true }),
    Q('1. Soit X une variable de loi uniforme sur [0, 1]. Calculer E(X).'),
    C('Correction : par definition, E(X) est l integrale de x sur [0, 1].'),
    C('On obtient E(X) = 1/2.'),
    { rect: 60, r: 'c' },
    Q('2. Calculer la variance de X.'),
    C('Correction : V(X) = E(X²) - E(X)² = 1/3 - 1/4 = 1/12.'),
    Q('Exercice 2', { bold: true }),
    Q('1. Donner la solution de l equation P(A) = 0,3 lorsque A est independant de B.'),
    C('Correction :'),
    ...Array.from({ length: 24 }, (_, i) =>
      C(`Etape ${i + 1} du raisonnement detaille de la correction.`),
    ),
  ],
  [
    C('Suite de la correction de la question 1.'),
    C('Conclusion : P(A) = 0,3.'),
    Q('2. En deduire P(A inter B).'),
    C('Correction : P(A inter B) = P(A) P(B) = 0,15.'),
  ],
])

await make('couleur', 'mixed', [
  [
    T('TD 4 : suites numeriques', { size: 16, bold: true }),
    Q('Exercice 1'),
    Q('1. Montrer que la suite u est croissante.'),
    C('u(n+1) - u(n) = 1/(n+1) > 0 donc u est croissante.', { color: BLUE }),
    C('Le resultat est valable pour tout entier n.', { color: BLUE }),
    Q('2. Montrer que u est majoree.'),
    C('On a u(n) < 2 pour tout n par recurrence.', { color: BLUE }),
    Q('3. Conclure sur la convergence.'),
    C('Suite croissante et majoree : elle converge.', { color: BLUE }),
  ],
])

await make('deux-colonnes', 'mixed', [
  [
    T('Fiche de calcul mental', { size: 16, bold: true }),
    ...[
      ['1. Combien font 12 x 12 ?', 'Reponse : 144'],
      ['2. Combien font 15 x 4 ?', 'Reponse : 60'],
      ['3. Combien font 99 + 101 ?', 'Reponse : 200'],
      ['4. Combien font 7 x 8 ?', 'Reponse : 56'],
    ].flatMap(([q, r]) => [Q(q, { same: true }), C(r, { x: 360 })]),
  ],
])

await make('corrige-seul', 'correction_only', [
  [
    T('Corrige du partiel d algebre 2025', { size: 16, bold: true }),
    C('Exercice 1', { bold: true }),
    C('La matrice A est diagonalisable car elle possede 3 valeurs propres distinctes.'),
    C('Les valeurs propres sont 1, 2 et 3.'),
    C('Exercice 2', { bold: true }),
    C('Le noyau de f est engendre par le vecteur (1, -1, 0).'),
    C('Exercice 3', { bold: true }),
    C('Le rang vaut 2 d apres le theoreme du rang.'),
  ],
])

await make('sujet-seul', 'statement_only', [
  [
    T('Examen d analyse 2025', { size: 16, bold: true }),
    Q('Exercice 1', { bold: true }),
    Q('1. Etudier la continuite de f sur R.'),
    Q('2. Calculer la derivee de f.'),
    Q('Exercice 2', { bold: true }),
    Q('1. Calculer l integrale de 0 a 1 de x² dx.'),
    Q('2. En deduire la valeur moyenne de x² sur [0, 1].'),
  ],
])

await make('fin', 'mixed', [
  [
    T('Annale 2024', { size: 16, bold: true }),
    Q('Exercice 1', { bold: true }),
    Q('1. Resoudre x + 1 = 0.'),
    Q('2. Resoudre 2x = 4.'),
    Q('Exercice 2', { bold: true }),
    Q('1. Deriver la fonction x -> x².'),
  ],
  [
    C('Corrige', { size: 16, bold: true }),
    C('Exercice 1', { bold: true }),
    C('1. x = -1.'),
    C('2. x = 2.'),
    C('Exercice 2', { bold: true }),
    C('1. La derivee vaut 2x.'),
  ],
])

await make('qcm', 'mixed', [
  [
    T('QCM de culture generale', { size: 16, bold: true }),
    Q('Question 1 : Quelle est la capitale de la France ?'),
    Q('A. Lyon'),
    Q('B. Paris'),
    Q('C. Marseille'),
    C('Reponse : B'),
    Q('Question 2 : Combien font 2 + 2 ?'),
    Q('A. 3'),
    Q('B. 4'),
    Q('C. 5'),
    C('Reponse : B'),
  ],
])

await make('inconnu', 'unknown', [
  [
    T('Notes de cours', { size: 16, bold: true }),
    T('La fonction exponentielle est strictement croissante sur R.'),
    T('Elle verifie exp(a + b) = exp(a) exp(b) pour tous reels a et b.'),
    T('On en deduit de nombreuses proprietes utiles en analyse.'),
  ],
])

// --- Mises en page plus réalistes ------------------------------------------------------

// Examen avec en-tête et pied de page, barème, sous-questions (a), « Solution. » en italique.
await make(
  'examen-entete',
  'mixed',
  [
    [
      T('Examen final de statistique, duree 2 heures', { size: 14, bold: true }),
      T('Documents interdits. Calculatrice autorisee.'),
      Q('Exercice 1 (6 points)', { bold: true }),
      Q('On lance 100 fois une piece equilibree et on note N le nombre de piles.'),
      Q('(a) Donner la loi de N et son esperance.'),
      C('Solution. N suit une loi binomiale de parametres 100 et 1/2.', { font: 'ital' }),
      C('Son esperance vaut 50.', { font: 'ital' }),
      Q('(b) Calculer la variance de N.'),
      C('Solution. La variance vaut 100 x 1/2 x 1/2 = 25.', { font: 'ital' }),
      Q('Exercice 2 (8 points)', { bold: true }),
      Q('Soit X une variable aleatoire de densite f(x) = 2x sur [0, 1].'),
      Q('(a) Verifier que f est une densite.'),
      C('Solution. f est positive et son integrale sur [0, 1] vaut 1.', { font: 'ital' }),
      Q('(b) Calculer E(X).'),
      C('Solution. E(X) = integrale de 2x² = 2/3.', { font: 'ital' }),
    ],
  ],
  { header: 'Universite fictive, examen 2025' },
)

// Correction encadrée : titre « Correction » puis texte dans un cadre gris, figure dedans.
await make('encadre', 'mixed', [
  [
    T('TD 2 : geometrie', { size: 16, bold: true }),
    Q('Question 1. Tracer un triangle rectangle de cotes 3, 4 et 5.'),
    // Cadre : commence 12 points au-dessus du titre, se termine avant la question 2.
    { rect: 111, up: 12, w: 450, x: 66, r: 'c', frame: true, color: GREY },
    C('Correction', { bold: true, x: 76 }),
    C('On verifie que 3² + 4² = 5² : le triangle est rectangle.', { x: 76 }),
    { rect: 50, x: 100, w: 120, r: 'c' },
    C('Le triangle est trace ci-dessus.', { x: 76 }),
    Q('Question 2. Calculer son aire.'),
    C('Correction : aire = 3 x 4 / 2 = 6.'),
  ],
])

// Tableau question / réponse sans « Réponse : » dans les cellules, en-têtes de colonnes.
await make('tableau', 'mixed', [
  [
    T('Vocabulaire anglais', { size: 16, bold: true }),
    T('Question', { bold: true, same: true }),
    T('Reponse', { bold: true, x: 360 }),
    ...[
      ['1. Traduire « maison »', 'house'],
      ['2. Traduire « voiture »', 'car'],
      ['3. Traduire « arbre »', 'tree'],
      ['4. Traduire « livre »', 'book'],
    ].flatMap(([q, r]) => [Q(q, { same: true }), C(r, { x: 360 })]),
  ],
])

// QCM à cases (ZapfDingbats : case vide et case cochée).
await make('qcm-cases', 'mixed', [
  [
    T('QCM de chimie', { size: 16, bold: true }),
    Q('Question 1 : Quel est le symbole du sodium ?'),
    C('❏', { font: 'zapf', same: true, x: 72 }),
    Q('So', { x: 90 }),
    C('✔', { font: 'zapf', same: true, x: 72 }),
    Q('Na', { x: 90 }),
    C('❏', { font: 'zapf', same: true, x: 72 }),
    Q('Sd', { x: 90 }),
    Q('Question 2 : Quelle est la formule de l eau ?'),
    C('✔', { font: 'zapf', same: true, x: 72 }),
    Q('H2O', { x: 90 }),
    C('❏', { font: 'zapf', same: true, x: 72 }),
    Q('HO2', { x: 90 }),
    C('❏', { font: 'zapf', same: true, x: 72 }),
    Q('H2O2', { x: 90 }),
  ],
])

// QCM dont la bonne option est écrite en vert, sans autre marque.
await make('qcm-couleur', 'mixed', [
  [
    T('QCM de geographie', { size: 16, bold: true }),
    Q('Question 1 : Quelle est la capitale de l Espagne ?'),
    C('A. Barcelone'),
    C('B. Madrid', { color: GREEN }),
    C('C. Seville'),
    Q('Question 2 : Quel est le plus long fleuve de France ?'),
    C('A. La Loire', { color: GREEN }),
    C('B. La Seine'),
    C('C. Le Rhone'),
  ],
])

// Corrigé seul, titres « Solution N. » sans exercice, sur deux pages.
await make('corrige-solutions', 'correction_only', [
  [
    T('Corrige du TD 5', { size: 16, bold: true }),
    C('Solution 1. On factorise le polynome : (x - 1)(x + 2).'),
    C('Les racines sont donc 1 et -2.'),
    C('Solution 2. La derivee de x ln x vaut ln x + 1.'),
    ...Array.from({ length: 22 }, (_, i) => C(`Detail ${i + 1} du calcul de la solution 2.`)),
  ],
  [
    C('Fin du calcul de la solution 2.'),
    C('Solution 3. La limite vaut 0 par croissances comparees.'),
  ],
])

// Sujet seul avec figure, sous-questions et texte introductif.
await make('sujet-figure', 'statement_only', [
  [
    T('Devoir maison de geometrie', { size: 16, bold: true }),
    Q('Exercice 1', { bold: true }),
    Q('On considere la figure ci-dessous.'),
    { rect: 80, r: 'q' },
    Q('1. Calculer la longueur du segment AB.'),
    Q('2. Montrer que le triangle ABC est isocele.'),
    Q('Exercice 2', { bold: true }),
    Q('1. Enoncer le theoreme de Thales.'),
    Q('2. L appliquer a la configuration de l exercice 1.'),
  ],
])

console.log('PDF et verites generes')
