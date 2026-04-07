import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useEquipamentos } from '../hooks/useEquipamentos'
import { useProtocolos, type ProtocoloWithRelations } from '../hooks/useProtocolos'
import { useCreateManutencao, useAddEvidencia } from '../hooks/useManutencoes'
import { useStorage } from '../hooks/useStorage'
import { useAuth } from '../contexts/AuthContext'
import ImageUpload from '../components/ImageUpload'
import EmptyState from '../components/EmptyState'
import { CheckSquare, Square, Camera } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Executar() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const prefillEqId = searchParams.get('equipamentoId')
  const prefillTitle = searchParams.get('titulo')
  const prefillProtoId = searchParams.get('protocoloId')
  
  const { data: equipamentos } = useEquipamentos()
  const { data: protocolos } = useProtocolos()
  const createManutencao = useCreateManutencao()
  const addEvidencia = useAddEvidencia()
  const { uploadMultiple, uploading } = useStorage('evidencias')

  const [equipamentoId, setEquipamentoId] = useState(prefillEqId ?? '')
  const [protocoloId, setProtocoloId] = useState(prefillProtoId ?? '')
  const [tipo, setTipo] = useState<'preventiva' | 'corretiva'>('preventiva')
  const [titulo, setTitulo] = useState(prefillTitle ?? '')
  const [observacoes, setObservacoes] = useState('')
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [customTasks, setCustomTasks] = useState<string[]>([])
  const [newCustomTask, setNewCustomTask] = useState('')
  const [fotoFiles, setFotoFiles] = useState<File[]>([])
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([])
  const [dataExecucao, setDataExecucao] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

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

  // Auto-detect protocol based on Title
  useEffect(() => {
    if (tipo !== 'preventiva' || !titulo.trim() || !matchingProtocolos) {
      // If there's only one protocol and title is empty, we can still auto-select it
      if (matchingProtocolos?.length === 1 && !titulo.trim()) {
        setProtocoloId(matchingProtocolos[0].id)
        setTitulo(matchingProtocolos[0].titulo)
      }
      return
    }

    const search = titulo.toLowerCase()
    const match = matchingProtocolos.find(p => {
      const pTitle = p.titulo.toLowerCase()
      return pTitle.includes(search) || search.includes(pTitle)
    })

    if (match) {
      setProtocoloId(match.id)
    }
  }, [titulo, matchingProtocolos, tipo])

  const allTasks = useMemo(() => {
    if (tipo === 'corretiva') return []
    const proto = matchingProtocolos.find(p => p.id === protocoloId)
    if (!proto) return []
    
    return proto.tarefas_protocolo.map(t => ({
      id: t.id,
      descricao: t.descricao,
      protocoloTitulo: proto.titulo
    }))
  }, [matchingProtocolos, protocoloId, tipo])

  const handleSelectEquipamento = useCallback((id: string) => {
    setEquipamentoId(id)
    setProtocoloId('')
    setTitulo('')
    setChecklist({})
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

  const handleAddCustomTask = () => {
    if (!newCustomTask.trim()) return
    setCustomTasks(prev => [...prev, newCustomTask.trim()])
    setNewCustomTask('')
  }

  const removeCustomTask = (index: number) => {
    setCustomTasks(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!equipamentoId || !titulo) {
      toast.error('Preencha o ativo e o título da manutenção.')
      return
    }

    setSubmitting(true)
    try {
      const finalChecklist: Record<string, { concluida: boolean; descricao: string }> = {}
      
      // Adiciona tarefas do protocolo (preventiva)
      allTasks.forEach(task => {
        finalChecklist[task.id] = {
          concluida: !!checklist[task.id],
          descricao: task.descricao
        }
      })

      // Adiciona tarefas personalizadas (corretiva ou extras)
      customTasks.forEach(task => {
        finalChecklist[`custom:${task}`] = {
          concluida: true,
          descricao: task
        }
      })

      // É considerada concluída se:
      // 1. Todas as tarefas do protocolo foram marcadas (se houver tarefas)
      // 2. OU se é uma preventiva que o usuário está finalizando (mesmo sem tarefas detectadas)
      // 3. OU se é uma corretiva com tarefas personalizadas
      const hasProtoTasks = totalTasks > 0
      const allProtoTasksDone = hasProtoTasks && completedCount === totalTasks
      const isComplete = (tipo === 'preventiva') || (allProtoTasksDone) || (tipo === 'corretiva' && customTasks.length > 0)
      
      // Combina a data selecionada com o horário atual para precisão
      const now = new Date()
      const execDate = new Date(dataExecucao)
      execDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds())
      const finalTimestamp = execDate.toISOString()

      const manutencao = await createManutencao.mutateAsync({
        equipamento_id: equipamentoId,
        protocolo_id: protocoloId || null,
        tipo,
        titulo,
        status: isComplete ? 'concluida' : 'em_andamento',
        tecnico_id: user!.id,
        checklist_json: finalChecklist,
        observacoes: observacoes || null,
        created_at: finalTimestamp,
        completed_at: isComplete ? finalTimestamp : null,
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
      setCustomTasks([])
      setFotoFiles([])
      setFotoPreviews([])
      toast.success('Manutenção finalizada com sucesso!')
    } catch {
      toast.error('Erro ao finalizar manutenção.')
    } finally {
      setSubmitting(false)
    }
  }


  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--color-text-heading)' }}>Executar Manutenção</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Preencha o checklist e envie as evidências fotográficas.</p>
      </div>

      <div className="card">
        <div className="mb-6">
          <label className="form-label">Selecionar Ativo *</label>
          <select 
            className="form-select w-full" 
            value={equipamentoId} 
            onChange={e => handleSelectEquipamento(e.target.value)}
          >
            <option value="">Selecione um ativo...</option>
            {equipamentos?.map(eq => (
              <option key={eq.id} value={eq.id}>
                {eq.nome} - Patrimônio: {eq.patrimonio}
              </option>
            ))}
          </select>
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
          <div>
            <label className="form-label">Data de Execução</label>
            <input 
              type="date" 
              className="form-input" 
              value={dataExecucao} 
              onChange={e => setDataExecucao(e.target.value)} 
              max={new Date().toISOString().split('T')[0]}
            />
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
          ) : tipo === 'preventiva' && !protocoloId ? (
            <div className="text-center py-6 border-2 border-dashed rounded-lg" style={{ borderColor: 'var(--color-border-default)' }}>
              <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
                Dica: Digite "semanal" ou "mensal" no título para carregar o checklist automaticamente.
              </p>
              {matchingProtocolos.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {matchingProtocolos.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => { setProtocoloId(p.id); setTitulo(p.titulo); }}
                      className="text-[10px] px-2 py-1 rounded bg-accent/10 hover:bg-accent/20 transition-colors uppercase font-bold tracking-wider"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      {p.titulo}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : tipo === 'preventiva' && allTasks.length === 0 ? (
            <EmptyState title="Sem tarefas definidas" description="Este protocolo não possui tarefas cadastradas." />
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

        {tipo === 'corretiva' && (
          <div className="mb-6 pt-4 border-t border-dashed" style={{ borderColor: 'var(--color-border-default)' }}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-heading)' }}>
              <CheckSquare size={16} /> Ações da Intervenção
            </h3>
            <div className="flex gap-2 mb-4">
              <input 
                className="form-input" 
                value={newCustomTask} 
                onChange={e => setNewCustomTask(e.target.value)}
                placeholder="Ex: Troca de fusível, Reparo em fiação..."
                onKeyDown={e => e.key === 'Enter' && handleAddCustomTask()}
              />
              <button type="button" onClick={handleAddCustomTask} className="btn-secondary px-4">Adicionar</button>
            </div>
            
            {customTasks.length > 0 && (
              <div className="flex flex-col gap-2">
                {customTasks.map((task, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded bg-opacity-10 bg-accent transition-colors group" style={{ backgroundColor: 'rgba(249, 115, 22, 0.05)' }}>
                    <CheckSquare size={16} style={{ color: 'var(--color-status-ok)' }} />
                    <span className="flex-1 text-sm">{task}</span>
                    <button onClick={() => removeCustomTask(idx)} className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-status-danger)' }}>Remover</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
          <button onClick={() => { setEquipamentoId(''); setTitulo(''); setObservacoes(''); setChecklist({}); setFotoFiles([]); setFotoPreviews([]) }} className="btn-secondary">Limpar</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={!equipamentoId || !titulo || submitting}>{submitting ? 'Finalizando...' : 'Finalizar Manutenção'}</button>
        </div>
      </div>
    </div>
  )
}
