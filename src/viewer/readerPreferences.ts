export interface ReaderPreferences {
  navigation: boolean | null
  correctionSide: 'left' | 'right'
  zoom: number
}

const key = 'unspoil-reader-preferences'
const defaults: ReaderPreferences = { navigation: null, correctionSide: 'right', zoom: 100 }

export function readReaderPreferences(): ReaderPreferences {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(key) ?? 'null',
    ) as Partial<ReaderPreferences> | null
    if (!saved) return defaults
    const { navigation, correctionSide, zoom } = saved
    return {
      navigation: typeof navigation === 'boolean' ? navigation : null,
      correctionSide: correctionSide === 'left' ? 'left' : 'right',
      zoom:
        typeof zoom === 'number' && Number.isInteger(zoom) && zoom >= 25 && zoom <= 200
          ? zoom
          : 100,
    }
  } catch {
    return defaults
  }
}

export function saveReaderPreferences({ navigation, correctionSide, zoom }: ReaderPreferences) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ navigation, correctionSide, zoom }))
  } catch {
    // L’affichage conserve ses préférences en mémoire pour la session.
  }
}
