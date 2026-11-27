// Keep page bitmaps within the canvas dimensions supported by mobile Safari.
const MAX_CANVAS_AXIS = 4096
export const MAX_DISPLAY_PIXELS = 8 * 1024 * 1024
export const MAX_RASTER_PIXELS = 4 * 1024 * 1024

export function fitCanvas(width: number, height: number, pixelRatio: number, maxPixels: number) {
  const ratio = Math.min(
    pixelRatio,
    MAX_CANVAS_AXIS / width,
    MAX_CANVAS_AXIS / height,
    Math.sqrt(maxPixels / width / height),
  )
  const scaledWidth = width * ratio
  const scaledHeight = height * ratio
  const roundedWidth = Math.max(1, Math.round(scaledWidth))
  const roundedHeight = Math.max(1, Math.round(scaledHeight))
  if (roundedWidth * roundedHeight <= maxPixels) {
    return { width: roundedWidth, height: roundedHeight }
  }
  return {
    width: Math.max(1, Math.floor(scaledWidth)),
    height: Math.max(1, Math.floor(scaledHeight)),
  }
}
