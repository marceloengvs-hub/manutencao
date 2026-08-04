import { useState, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Camera } from 'lucide-react'
import toast from 'react-hot-toast'

interface ImageUploadProps {
  onUpload: (files: File[]) => void
  multiple?: boolean
  previews?: string[]
  onRemovePreview?: (index: number) => void
  uploading?: boolean
}

export default function ImageUpload({ onUpload, multiple = false, previews = [], onRemovePreview, uploading }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    const filesArray = Array.from(files)
    
    const valid = filesArray.filter(f => f.type.startsWith('image/') && f.size <= MAX_SIZE)
    const invalidType = filesArray.filter(f => !f.type.startsWith('image/'))
    const invalidSize = filesArray.filter(f => f.type.startsWith('image/') && f.size > MAX_SIZE)

    if (invalidType.length > 0) toast.error('Apenas arquivos de imagem são permitidos.')
    if (invalidSize.length > 0) toast.error('Uma ou mais fotos excedem o limite de 10MB.')

    if (valid.length > 0) onUpload(valid)
  }, [onUpload])

  return (
    <div className="flex flex-col gap-3">
      {/* Inputs nativos ocultos vinculados por ID */}
      <input
        id="camera-input-capture"
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        id="gallery-input-file"
        type="file"
        accept="image/*"
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {/* Botões de ação direta (Separados da zona de drag&drop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label
          htmlFor="camera-input-capture"
          className="btn-primary flex items-center justify-center gap-2 py-3 px-4 rounded font-medium text-sm cursor-pointer select-none text-white shadow-sm"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Camera size={18} />
          <span>Tirar Foto</span>
        </label>

        <label
          htmlFor="gallery-input-file"
          className="btn-secondary flex items-center justify-center gap-2 py-3 px-4 rounded font-medium text-sm cursor-pointer select-none"
          style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border-default)' }}
        >
          <ImageIcon size={18} />
          <span>Escolher da Galeria</span>
        </label>
      </div>

      {/* Area de Drag & Drop (opcional/desktop) */}
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        style={{ cursor: 'default', padding: '1rem' }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
            <span className="text-sm">Enviando imagem...</span>
          </div>
        ) : (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Ou arraste e solte arquivos de imagem aqui (máx 10MB)
          </span>
        )}
      </div>

      {/* Previews de fotos anexadas */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-2">
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
                  type="button"
                  onClick={() => onRemovePreview(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity"
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
