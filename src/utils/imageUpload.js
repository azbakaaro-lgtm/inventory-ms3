// Resizes and compresses an uploaded image file entirely in the browser,
// returning a base64 data URL small enough to store directly in a Firestore
// document (no Firebase Storage needed). Keeps things simple for a small
// store logo or payment-method icon — not meant for large photos.
export function fileToResizedDataUrl(file, maxDimension = 200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file does not look like a valid image.'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/png', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
