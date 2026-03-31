import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
}

export default function Modal({ open, onClose, title, children, footer, maxWidth = '600px' }: ModalProps) {
  const styleId = useId()

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  const overlayId = `modal-overlay-${styleId.replace(/:/g, '')}`
  const panelId = `modal-panel-${styleId.replace(/:/g, '')}`

  const modalContent = (
    <>
      <style>{`
        #${overlayId} {
          position: fixed;
          inset: 0;
          z-index: 10000;
          overflow-y: auto;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 2rem 1rem;
        }
        #${panelId} {
          width: 100%;
          max-width: ${maxWidth};
          margin: auto;
          display: flex;
          flex-direction: column;
          max-height: 90vh;
          background: var(--color-surface-panel);
          border: 1px solid var(--color-border-default);
          border-radius: 2px;
          box-shadow: 0 16px 64px -8px rgba(0, 0, 0, 0.6);
        }
        @media (max-width: 640px) {
          #${overlayId} {
            padding: 0;
            align-items: stretch;
          }
          #${panelId} {
            max-width: 100%;
            max-height: 100dvh;
            height: 100dvh;
            margin: 0;
            border: none;
            border-radius: 0;
          }
        }
      `}</style>
      <div id={overlayId} onClick={onClose}>
        <div id={panelId} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--color-border-default)',
              flexShrink: 0,
            }}
          >
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-heading)', margin: 0 }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.5rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body — scrollable */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              overflowY: 'auto',
              flex: 1,
              minHeight: 0,
            }}
          >
            {children}
          </div>

          {/* Footer — always visible */}
          {footer && (
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--color-border-default)',
                flexShrink: 0,
                background: 'var(--color-surface-panel)',
                paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  )

  // Use Portal so the modal escapes any local z-index stacking context
  return createPortal(modalContent, document.body)
}
