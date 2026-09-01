export interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  mimeType?: 'image/jpeg' | 'image/webp'
}

/**
 * Comprime e redimensiona uma imagem no navegador antes do upload para economizar storage e acelerar transferências.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.8,
    mimeType = 'image/jpeg'
  } = options

  // Se não for imagem ou for SVG/GIF animado, mantém o original
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string

      img.onload = () => {
        let width = img.width
        let height = img.height

        // Redimensiona proporcionalmente se exceder os limites
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file)
          return
        }

        // Fundo branco caso haja transparência em PNG ao converter para JPEG
        if (mimeType === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, width, height)
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // Se a compressão ficou maior que o arquivo original, mantém o original
              resolve(file)
              return
            }

            const extension = mimeType === 'image/webp' ? '.webp' : '.jpg'
            const cleanName = file.name.replace(/\.[^/.]+$/, '') + extension
            const compressedFile = new File([blob], cleanName, {
              type: mimeType,
              lastModified: Date.now()
            })

            resolve(compressedFile)
          },
          mimeType,
          quality
        )
      }

      img.onerror = () => resolve(file)
    }

    reader.onerror = () => resolve(file)
  })
}

/**
 * Comprime uma lista de arquivos de imagem em paralelo
 */
export async function compressImages(
  files: File[],
  options?: CompressOptions
): Promise<File[]> {
  return Promise.all(files.map((file) => compressImage(file, options)))
}
