import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useEquipamentos } from '../hooks/useEquipamentos'
import { useProtocolos, type ProtocoloWithRelations } from '../hooks/useProtocolos'
import { useCreateManutencao, useAddEvidencia } from '../hooks/useManutencoes'
import { useStorage } from '../hooks/useStorage'
import { useAuth } from '../contexts/AuthContext'
import ImageUpload from '../components/ImageUpload'
import EmptyState from '../components/EmptyState'
import { Wrench, Search, CheckSquare, Square, Camera } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Executar() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const prefillEqId = searchParams.get('equipamentoId')
  const prefillTitle = searchParams.get('titulo')
  
  const { data: equipamentos } = useEquipamentos()
  const { data: protocolos } = useProtocolos()
  const createManutencao = useCreateManutencao()
  const addEvidencia = useAddEvidencia()
  const { uploadMultiple, uploading } = useStorage('evidencias')

  const [equipamentoId, setEquipamentoId] = useState(prefillEqId ?? '')
  const [tipo, setTipo] = useState<'preventiva' | 'corretiva'>('preventiva')
  const [titulo, setTitulo] = useState(prefillTitle ?? '')
  const [observacoes, setObservacoes] = useState('')
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [fotoFiles, setFotoFiles] = useState<File[]>([])
  
  // Update search string if prepopulated and equipamentos loads
  useEffect(() => {
    if (prefillEqId && equipamentos) {
      const eq = equipamentos.find(e => e.id === prefillEqId)
      if (eq) setSearchEq(eq.nome)
    }
  }, [prefillEqId, equipamentos])
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([])
  const [searchEq, setSearchEq] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const selectedEq = equipamentos?.find(e => e.id === equipamentoId)

  const matchingProtocolos = useMemo<ProtocoloWithRelations[]>(() => {
    if (!selectedEq || !protocolos) return []
    return protocolos.filter(p => {
      if (p.status !== 'ativo') return false;
      if (p.equipamento_id) return p.equipamento_id === selectedEq.id;
      if (p.categoria_id) return p.categoria_id === selectedEq.categoria_id;
      return true;
    })
  }, [selectedEq, protocolos])

  const allTasks = useMemo(() => {
    const tasks: Array<{ id: string; descricao: string; protocoloTitulo: string }> = []
    for (const p of matchingProtocolos) {
      for (const t of p.tarefas_protocolo) {
        tasks.push({ id: t.id, descricao: t.descricao, protocoloTitulo: p.titulo })
      }
    }
    return tasks
  }, [matchingProtocolos])

  const handleSelectEquipamento = useCallback((id: string, nome: string) => {
    setEquipamentoId(id)
    setChecklist({})
    setSearchEq(nome)
    setShowDropdown(false)
  }, [])

  const toggleCheck = (taskId: string) => {
    setChecklist(prev => ({ ...prev, [taskId]: !prev[taskId] }))
  }

  const handleAddPhotos = (files: File[]) => {
    setFotoFiles(prev => [...prev, ...files])
    const previews = files.map(f => URL.createObjectURL(f))
    setFotoPreviews(prev => [...prev, ...previews])
  }

  const handleRemovePhoto = (index: number) => {
    setFotoFiles(prev => prev.filter((_, i) => i !== index))
    setFotoPreviews(prev => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const completedCount = Object.values(checklist).filter(Boolean).length
  const totalTasks = allTasks.length

  const handleSubmit = async () => {
    if (!equipamentoId || !titulo) {
      toast.error('Preencha o ativo e o título da manutenção.')
      return
    }

    setSubmitting(true)
    try {
      const isComplete = completedCount === totalTasks && totalTasks > 0
      const manutencao = await createManutencao.mutateAsync({
        equipamento_id: equipamentoId,
        protocolo_id: matchingProtocolos[0]?.id ?? null,
        tipo,
        titulo,
        status: isComplete ? 'concluida' : 'em_andamento',
        tecnico_id: user!.id,
        checklist_json: checklist,
        observacoes: observacoes || null,
        completed_at: isComplete ? new Date().toISOString() : null,
      })

      if (fotoFiles.length > 0) {
        const urls = await uploadMultiple(fotoFiles, manutencao.id)
        for (const url of urls) {
          await addEvidencia.mutateAsync({ manutencao_id: manutencao.id, foto_url: url })
        }
      }

      setEquipamentoId('')
      setTitulo('')
      setObservacoes('')
      setChecklist({})
      setFotoFiles([])
      setFotoPreviews([])
      setSearchEq('')
      toast.success('Manutenção finalizada com sucesso!')
    } catch {
      toast.error('Erro ao finalizar manutenção.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredEqs = equipamentos?.filter(e =>
    e.nome.toLowerCase().includes(searchEq.toLowerCase()) ||
    e.patrimonio.toLowerCase().includes(searchEq.toLowerCase())
  ) ?? []

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--color-text-heading)' }}>Executar Manutenção</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Preencha o checklist e envie as evidências fotográficas.</p>
      </div>

      <div className="card">
        <div className="mb-6" style={{ position: 'relative' }}>
          <label className="form-label">Selecionar Ativo *</label>

          {selectedEq ? (
            <div className="flex items-center gap-2 p-3" style={{ background: 'var(--color-accent-muted)', borderRadius: '2px', border: '1px solid var(--color-border-accent)' }}>
              <Wrench size={16} style={{ color: 'var(--color-accent)' }} />
              <span className="text-sm font-medium flex-1" style={{ color: 'var(--color-accent)' }}>{selectedEq.nome}</span>
              <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>#{selectedEq.patrimonio}</span>
              <button
                onClick={() => { setEquipamentoId(''); setSearchEq(''); setShowDropdown(true) }}
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Alterar
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input
                  className="form-input pl-10"
                  value={searchEq}
                  onChange={e => { setSearchEq(e.target.value); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Buscar por nome ou patrimônio..."
                />
              </div>

              {showDropdown && (
                <>
                  {/* Invisible backdrop to close dropdown when clicking outside */}
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 5 }}
                    onClick={() => setShowDropdown(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: '100%',
                      zIndex: 10,
                      marginTop: '4px',
                      maxHeight: '240px',
                      overflowY: 'auto',
                      background: 'var(--color-surface-panel)',
                      border: '1px solid var(--color-border-hover)',
                      borderRadius: '2px',
                      boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.5)',
                    }}
                  >
                    {filteredEqs.length === 0 ? (
                      <p className="text-xs p-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
                        Nenhum equipamento cadastrado.
                      </p>
                    ) : (
                      filteredEqs.map(eq => (
                        <button
                          key={eq.id}
                          onClick={() => handleSelectEquipamento(eq.id, eq.nome)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.625rem 0.75rem',
                            fontSize: '0.875rem',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid var(--color-border-default)',
                            color: 'var(--color-text-body)',
                            cursor: 'pointer',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 500, color: 'var(--color-text-heading)' }}>{eq.nome}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {eq.modelo} • {eq.categorias?.nome ?? 'Sem categoria'}
                            </span>
                          </div>
                          <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>#{eq.patrimonio}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="form-label">Tipo</label>
            <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value as 'preventiva' | 'corretiva')}>
              <option value="preventiva">Preventiva</option>
              <option value="corretiva">Corretiva</option>
            </select>
          </div>
          <div>
            <label className="form-label">Título *</label>
            <input className="form-input" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Manutenção semanal #12" />
          </div>
        </div>

        <div className="my-6" style={{ height: '1px', background: 'var(--color-border-default)' }} />

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-heading)' }}>Checklist</h3>
            {totalTasks > 0 && <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{completedCount}/{totalTasks}</span>}
          </div>
          {!equipamentoId ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>Selecione um equipamento para carregar as tarefas.</p>
          ) : allTasks.length === 0 ? (
            <EmptyState title="Sem tarefas definidas" description="Nenhum protocolo ativo encontrado para este equipamento." />
          ) : (
            <div className="flex flex-col gap-2">
              {allTasks.map(task => {
                const checked = checklist[task.id] ?? false
                return (
                  <button key={task.id} onClick={() => toggleCheck(task.id)} className={`checklist-item ${checked ? 'checked' : ''}`} style={{ cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    {checked ? <CheckSquare size={20} style={{ color: 'var(--color-status-ok)', flexShrink: 0 }} /> : <Square size={20} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
                    <span className="flex-1 text-sm">{task.descricao}</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{task.protocoloTitulo}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="my-6" style={{ height: '1px', background: 'var(--color-border-default)' }} />

        <div className="mb-6">
          <label className="form-label">Observações</label>
          <textarea className="form-input" rows={3} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Anotações adicionais..." />
        </div>

        <div className="mb-6">
          <label className="form-label flex items-center gap-2"><Camera size={14} /> Evidências Fotográficas</label>
          <ImageUpload multiple onUpload={handleAddPhotos} previews={fotoPreviews} onRemovePreview={handleRemovePhoto} uploading={uploading} />
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
          <button onClick={() => { setEquipamentoId(''); setTitulo(''); setObservacoes(''); setChecklist({}); setFotoFiles([]); setFotoPreviews([]); setSearchEq('') }} className="btn-secondary">Limpar</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={!equipamentoId || !titulo || submitting}>{submitting ? 'Finalizando...' : 'Finalizar Manutenção'}</button>
        </div>
      </div>
    </div>
  )
}
