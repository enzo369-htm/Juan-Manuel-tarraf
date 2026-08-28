/** Series canvases: max ~2400px, JPEG 0.82. Re-encode if the file is already huge. */
const SERIES_MAX_BYTES = 1_200_000

/** Hero: keep the original when it already fits. Only shrink huge files. */
export const HERO_IMAGE_MAX_DIM = 4500
export const HERO_IMAGE_QUALITY = 0.92
/** Stay under Vercel’s ~4.5MB function body. */
export const HERO_UPLOAD_MAX_BYTES = 4_200_000

function toJpegFile(blob: Blob, name: string) {
  return new File([blob], name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}

async function encodeJpeg(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, width, height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

export async function downscaleImage(file: File, maxDim = 2400, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const { width, height } = bitmap
  const scale = Math.min(1, maxDim / Math.max(width, height))
  if (scale === 1 && file.size < SERIES_MAX_BYTES) {
    bitmap.close()
    return file
  }

  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const blob = await encodeJpeg(bitmap, w, h, quality)
  bitmap.close()
  if (!blob) return file
  if (blob.size >= file.size && scale === 1) return file

  return toJpegFile(blob, file.name)
}

/** High-quality path for hero gates and the hero background. */
export async function prepareHeroImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const { width, height } = bitmap
  const scale = Math.min(1, HERO_IMAGE_MAX_DIM / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)

  if (scale === 1 && file.size <= HERO_UPLOAD_MAX_BYTES) {
    bitmap.close()
    return file
  }

  let quality = HERO_IMAGE_QUALITY
  let blob = await encodeJpeg(bitmap, w, h, quality)
  if (!blob) {
    bitmap.close()
    return file
  }
  while (blob.size > HERO_UPLOAD_MAX_BYTES && quality > 0.84) {
    quality -= 0.04
    const next = await encodeJpeg(bitmap, w, h, quality)
    if (!next) break
    blob = next
  }
  bitmap.close()

  if (blob.size >= file.size && scale === 1 && file.size <= HERO_UPLOAD_MAX_BYTES) {
    return file
  }

  return toJpegFile(blob, file.name)
}
