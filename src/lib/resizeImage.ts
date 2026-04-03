/**
 * Client-side image resize using Canvas.
 * GIF files are not resized (canvas would lose animation).
 * Returns null if resizing fails.
 */
export async function resizeImage(
  file: File,
  maxWidth = 1200,
  quality = 0.8,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(objectUrl); resolve(null); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => { URL.revokeObjectURL(objectUrl); resolve(blob) },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null) }
    img.src = objectUrl
  })
}

/** 4.5MB 超の GIF はアップロード不可 */
export const GIF_SIZE_LIMIT = 4.5 * 1024 * 1024
