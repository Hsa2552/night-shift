// Point d'entrée du module de détection (Hazem). Utilisé par l'interface (Wael).
// Contrat : DetectCorrections, voir ./contract.ts (copie de la proposition commune).

import type { DetectCorrections, DetectionInput, DetectionResult } from './contract.ts'
import { detect } from './engine.ts'

export type * from './contract.ts'
export { WARNINGS } from './engine.ts'

/**
 * Analyse un document et renvoie son type probable et les blocs de correction à masquer.
 * Déterministe : le même document donne toujours le même résultat.
 * Ne lève pas d'exception sur une entrée inattendue : renvoie alors `unknown` avec repli.
 */
export const detectCorrections: DetectCorrections = async (
  input: DetectionInput,
): Promise<DetectionResult> => {
  try {
    return detect(input)
  } catch (error) {
    return {
      kind: 'unknown',
      blocks: [],
      warnings: [
        `Erreur interne de détection : ${error instanceof Error ? error.message : String(error)}`,
      ],
      needsFallback: true,
    }
  }
}
