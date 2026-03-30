import { useState, useRef, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Camera } from 'lucide-react'

interface ImageUploadProps {
  onUpload: (files: File[]) => void
  multiple?: boolean
  previews?: string[]
  onRemovePreview?: (index: number) => void
  uploading?: boolean
}

export default function ImageUpload({ onUpload, multiple = false, previews = [], onRemovePreview, uploading }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024)
    if (valid.length > 0) onUpload(valid)
  }, [onUpload])

  return (
    <div>
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
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
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
            <span className="text-sm">Enviando...</span>
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
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Arraste imagens ou clique nas opções. Máx 5MB.</span>
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
