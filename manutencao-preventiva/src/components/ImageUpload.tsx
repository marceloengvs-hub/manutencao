import { useState, useRef, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Camera, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { compressImages } from '../utils/imageCompressor'

interface ImageUploadProps {
  onUpload: (files: File[]) => void
  multiple?: boolean
  previews?: string[]
  onRemovePreview?: (index: number) => void
  uploading?: boolean
}

export default function ImageUpload({ onUpload, multiple = false, previews = [], onRemovePreview, uploading }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const MAX_SIZE = 25 * 1024 * 1024 // Permite até 25MB bruto, pois vamos comprimir
    const filesArray = Array.from(files)
    
    const valid = filesArray.filter(f => f.type.startsWith('image/') && f.size <= MAX_SIZE)
    const invalidType = filesArray.filter(f => !f.type.startsWith('image/'))
    const invalidSize = filesArray.filter(f => f.type.startsWith('image/') && f.size > MAX_SIZE)

    if (invalidType.length > 0) toast.error('Apenas arquivos de imagem são permitidos.')
    if (invalidSize.length > 0) toast.error('Uma ou mais fotos excedem o limite de 25MB.')

    if (valid.length > 0) {
      try {
        setCompressing(true)
        // Comprime as imagens automaticamente no navegador
        const compressed = await compressImages(valid, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.82
        })
        onUpload(compressed)
      } catch (err) {
        console.error('Erro na compressão:', err)
        onUpload(valid) // Fallback caso ocorra algum erro raro
      } finally {
        setCompressing(false)
      }
    }
  }, [onUpload])

  return (
    <div>
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        onClick={() => !compressing && !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = '' // Reseta para permitir selecionar o mesmo arquivo se quiser
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        {compressing ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
            <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-accent)' }}>
              <Sparkles size={14} /> Otimizando foto...
            </span>
          </div>
        ) : uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
            <span className="text-sm">Enviando para o servidor...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); cameraRef.current?.click() }}
                className="btn-secondary flex items-center gap-2 text-sm py-2"
                style={{ background: 'var(--color-surface-hover)' }}
              >
                <Camera size={16} /> Tirar Foto
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
                className="btn-secondary flex items-center gap-2 text-sm py-2"
                style={{ background: 'var(--color-surface-hover)' }}
              >
                <ImageIcon size={16} /> Galeria
              </button>
            </div>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Arraste imagens ou clique. Compressão automática ativa (economia de espaço).
            </span>
          </div>
        )}
      </div>

      {previews.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-4">
          {previews.map((src, i) => (
            <div key={i} className="relative group w-20 h-20 overflow-hidden" style={{ borderRadius: '2px', border: '1px solid var(--color-border-default)' }}>
              {src.startsWith('blob:') || src.startsWith('http') ? (
                <img src={src} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-surface-elevated)' }}>
                  <ImageIcon size={20} style={{ color: 'var(--color-text-muted)' }} />
                </div>
              )}
              {onRemovePreview && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemovePreview(i) }}
                  className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.7)', borderRadius: '2px', border: 'none', cursor: 'pointer', color: '#fff' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
