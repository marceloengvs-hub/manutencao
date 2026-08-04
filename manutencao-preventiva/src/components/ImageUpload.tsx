import { useState, useCallback, useRef, useEffect } from 'react'
import { Upload, X, Image as ImageIcon, Camera, RefreshCw, Check } from 'lucide-react'
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

  // Camera Modal States
  const [showCameraModal, setShowCameraModal] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [cameraLoading, setCameraLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

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

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setShowCameraModal(false)
    setCameraLoading(false)
  }, [cameraStream])

  // Start live WebRTC camera stream
  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraLoading(true)
    setShowCameraModal(true)

    // Stop existing stream if switching
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('WebRTC not supported')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      })

      setCameraStream(stream)
      setFacingMode(mode)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
    } catch (err: any) {
      console.warn('Live camera stream failed, falling back to native file input capture:', err)
      setShowCameraModal(false)
      
      // Fallback: trigger native camera input
      const nativeInput = document.getElementById('native-camera-fallback') as HTMLInputElement
      if (nativeInput) {
        nativeInput.value = ''
        nativeInput.click()
      } else {
        toast.error('Não foi possível acessar a câmera. Verifique as permissões do navegador.')
      }
    } finally {
      setCameraLoading(false)
    }
  }

  // Bind video element when modal opens
  useEffect(() => {
    if (showCameraModal && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream
      videoRef.current.play().catch(() => {})
    }
  }, [showCameraModal, cameraStream])

  // Capture frame from video feed to canvas -> File
  const capturePhoto = () => {
    if (!videoRef.current) return

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error('Erro ao capturar foto.')
        return
      }

      const capturedFile = new File(
        [blob],
        `foto-manutencao-${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      )

      onUpload([capturedFile])
      toast.success('Foto capturada!')
      stopCamera()
    }, 'image/jpeg', 0.90)
  }

  // Toggle front/back camera
  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    startCamera(nextMode)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Input de contingência nativo oculto */}
      <input
        id="native-camera-fallback"
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

      {/* Botões de Ação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => startCamera('environment')}
          className="btn-primary flex items-center justify-center gap-2 py-3 px-4 rounded font-medium text-sm cursor-pointer select-none text-white shadow-sm"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Camera size={18} />
          <span>Tirar Foto</span>
        </button>

        <label
          htmlFor="gallery-input-file"
          className="btn-secondary flex items-center justify-center gap-2 py-3 px-4 rounded font-medium text-sm cursor-pointer select-none"
          style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border-default)' }}
        >
          <ImageIcon size={18} />
          <span>Escolher da Galeria</span>
        </label>
      </div>

      {/* Área de Drag & Drop */}
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

      {/* Previews das fotos */}
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

      {/* MODAL CÂMERA AO VIVO */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-between bg-black text-white p-4">
          {/* Top Bar */}
          <div className="flex justify-between items-center z-10 py-2">
            <span className="text-sm font-semibold tracking-wide flex items-center gap-2">
              <Camera size={18} className="text-orange-500" /> Câmera ao Vivo
            </span>
            <button
              type="button"
              onClick={stopCamera}
              className="p-2 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 transition-colors"
            >
              <X size={22} />
            </button>
          </div>

          {/* Video Preview */}
          <div className="relative flex-1 flex items-center justify-center my-2 overflow-hidden rounded-lg bg-neutral-900">
            {cameraLoading && (
              <div className="absolute flex flex-col items-center gap-2 text-neutral-400">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Iniciando câmera...</span>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          {/* Bottom Bar / Camera Controls */}
          <div className="flex items-center justify-around py-4 z-10">
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="p-3 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 transition-colors flex items-center gap-1 text-xs"
              title="Alternar Câmera"
            >
              <RefreshCw size={20} />
            </button>

            {/* Shutter Button */}
            <button
              type="button"
              onClick={capturePhoto}
              disabled={cameraLoading}
              className="w-16 h-16 rounded-full border-4 border-white bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all flex items-center justify-center shadow-lg"
              title="Capturar Foto"
            >
              <div className="w-12 h-12 rounded-full border-2 border-black/20" />
            </button>

            <button
              type="button"
              onClick={stopCamera}
              className="p-3 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 transition-colors text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
