// Client-side image compression using canvas
// Resizes to max 1200px and compresses to JPEG/WebP

export async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
  // Skip if already small enough (under 200KB)
  if (file.size <= 200 * 1024) return file

  // Skip non-image files
  if (!file.type.startsWith('image/')) return file

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img

      // Scale down if wider than maxWidth
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            // Compressed version is smaller — use it
            const ext = file.type === 'image/png' ? 'png' : 'jpg'
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: blob.type }))
          } else {
            // Original is smaller — keep it
            resolve(file)
          }
        },
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        quality
      )
    }
    img.onerror = () => resolve(file) // Fallback to original on error
    img.src = URL.createObjectURL(file)
  })
}
