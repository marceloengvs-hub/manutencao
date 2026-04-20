import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useProtocolos,
  useCreateProtocolo,
  useUpdateProtocolo,
  useDeleteProtocolo,
  useCategorias,
  type ProtocoloWithRelations,
} from '../hooks/useProtocolos'
import { useEquipamentos } from '../hooks/useEquipamentos'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { Plus, Pencil, Trash2, ClipboardList, X, GripVertical, Copy, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

const PERIODICIDADE_OPTIONS = [
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
] as const

type Periodicidade = 'diaria' | 'semanal' | 'mensal'

export default function Protocolos() {
  const { user } = useAuth()
  const { data: protocolos, isLoading } = useProtocolos()
  const { data: categorias } = useCategorias()
  const { data: equipamentos } = useEquipamentos()
  const qc = useQueryClient()
  
  const createProto = useCreateProtocolo()
  const updateProto = useUpdateProtocolo()
  const deleteProto = useDeleteProtocolo()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false)

  // Detecta protocolos duplicados: mesmo título + mesmo equipamento_id (ou mesmo categoria_id sem equipamento)
  const duplicatesToRemove = useMemo(() => {
    if (!protocolos) return []
    const seen = new Map<string, string>() // chave → id do primeiro (mais antigo)
    const toDelete: typeof protocolos = []

    // Ordena do mais antigo para o mais recente para manter o original
    const sorted = [...protocolos].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    for (const proto of sorted) {
      // Chave de unicidade: título + equipamento específico OU título + categoria
      const key = (proto as any).equipamento_id
        ? `eq:${(proto as any).equipamento_id}::${proto.titulo.toLowerCase().trim()}`
        : `cat:${proto.categoria_id ?? 'none'}::${proto.titulo.toLowerCase().trim()}`

      if (seen.has(key)) {
        toDelete.push(proto) // duplicata — será removida
      } else {
        seen.set(key, proto.id) // primeiro encontrado — será mantido
      }
    }
    return toDelete
  }, [protocolos])

  const [isCleaningUp, setIsCleaningUp] = useState(false)

  const handleCleanupDuplicates = async () => {
    if (!duplicatesToRemove.length) return
    setIsCleaningUp(true)
    try {
      const ids = duplicatesToRemove.map(p => p.id)
      const { error } = await supabase.from('protocolos').delete().in('id', ids)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['protocolos'] })
      qc.invalidateQueries({ queryKey: ['agenda'] })
      toast.success(`${ids.length} protocolo${ids.length > 1 ? 's' : ''} duplicado${ids.length > 1 ? 's' : ''} removido${ids.length > 1 ? 's' : ''}!`)
      setCleanupModalOpen(false)
    } catch {
      toast.error('Erro ao remover duplicados.')
    } finally {
      setIsCleaningUp(false)
    }
  }

  const [form, setForm] = useState({
    titulo: '',
    categoria_id: '',
    equipamento_id: '',
    periodicidade: 'semanal' as Periodicidade,
    status: 'ativo' as 'ativo' | 'inativo',
    data_inicio: new Date().toISOString().split('T')[0],
  })
  const [tarefas, setTarefas] = useState<Array<{ id?: string; descricao: string }>>([])
  const [novaTarefa, setNovaTarefa] = useState('')

  const openCreate = () => {
    setEditingId(null)
    setForm({ titulo: '', categoria_id: '', equipamento_id: '', periodicidade: 'semanal', status: 'ativo', data_inicio: new Date().toISOString().split('T')[0] })
    setTarefas([])
    setNovaTarefa('')
    setModalOpen(true)
  }

  const openDuplicate = (proto: ProtocoloWithRelations & { equipamento_id?: string | null }) => {
    setEditingId(null)
    setForm({
      titulo: `${proto.titulo} (Cópia)`,
      categoria_id: '',
      equipamento_id: '',
      periodicidade: proto.periodicidade,
      status: proto.status,
      data_inicio: new Date().toISOString().split('T')[0],
    })
    setTarefas(proto.tarefas_protocolo?.map(t => ({ descricao: t.descricao })) ?? [])
    setNovaTarefa('')
    setModalOpen(true)
  }

  const openEdit = (proto: ProtocoloWithRelations & { equipamento_id?: string | null }) => {
    setEditingId(proto.id)
    setForm({
      titulo: proto.titulo,
      categoria_id: proto.categoria_id || '',
      equipamento_id: proto.equipamento_id || '',
      periodicidade: proto.periodicidade,
      status: proto.status,
      data_inicio: proto.data_inicio,
    })
    setTarefas(proto.tarefas_protocolo?.map(t => ({ id: t.id, descricao: t.descricao })) ?? [])
    setNovaTarefa('')
    setModalOpen(true)
  }

  const addTarefa = () => {
    if (novaTarefa.trim()) {
      setTarefas(t => [...t, { descricao: novaTarefa.trim() }])
      setNovaTarefa('')
    }
  }

  const removeTarefa = (i: number) => setTarefas(t => t.filter((_, idx) => idx !== i))

  const handleSubmit = () => {
    if (!form.titulo) return

    if (editingId) {
      updateProto.mutate({
        id: editingId,
        titulo: form.titulo,
        categoria_id: form.categoria_id || null,
        equipamento_id: form.equipamento_id || null,
        periodicidade: form.periodicidade,
        status: form.status,
        data_inicio: form.data_inicio,
        tarefas,
      })
    } else {
      createProto.mutate({
        titulo: form.titulo,
        categoria_id: form.categoria_id || null,
        equipamento_id: form.equipamento_id || null,
        periodicidade: form.periodicidade,
        status: form.status,
        data_inicio: form.data_inicio,
        user_id: user!.id,
        tarefas: tarefas.map(t => t.descricao),
      })
    }
    setModalOpen(false)
  }

  const handleDelete = (id: string) => {
    deleteProto.mutate(id)
    setDeleteConfirm(null)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--color-text-heading)' }}>Protocolos</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Planos de manutenção preventiva.</p>
        </div>
        <div className="flex gap-2">
          {duplicatesToRemove.length > 0 && (
            <button
              onClick={() => setCleanupModalOpen(true)}
              className="btn-secondary text-sm flex items-center gap-2"
              style={{ color: 'var(--color-status-warning, #f59e0b)', borderColor: 'var(--color-status-warning, #f59e0b)' }}
            >
              <AlertTriangle size={14} />
              {duplicatesToRemove.length} duplicado{duplicatesToRemove.length > 1 ? 's' : ''}
            </button>
          )}
          <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Novo Protocolo</button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : !protocolos?.length ? (
        <EmptyState icon={<ClipboardList size={48} strokeWidth={1} />} title="Nenhum protocolo cadastrado" description="Crie protocolos para definir as tarefas de manutenção de cada tipo de equipamento." action={<button onClick={openCreate} className="btn-primary"><Plus size={16} /> Criar Protocolo</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {protocolos.map((proto, i) => {
            const periLabel = PERIODICIDADE_OPTIONS.find(p => p.value === proto.periodicidade)?.label ?? proto.periodicidade
            const eqSpecific = equipamentos?.find(e => e.id === (proto as any).equipamento_id)

            return (
              <div key={proto.id} className="card card-interactive flex flex-col animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-heading)' }}>{proto.titulo}</h3>
                  <div className="flex gap-1.5 shrink-0">
                    <span className="badge badge-accent">{periLabel}</span>
                    <span className={`badge ${proto.status === 'ativo' ? 'badge-ok' : 'badge-neutral'}`}>{proto.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
                {eqSpecific ? (
                   <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>Ativo: {eqSpecific.nome}</p>
                ) : (
                   proto.categorias && <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>Categoria: {proto.categorias.nome}</p>
                )}
                <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>Início: {new Date(proto.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                {proto.tarefas_protocolo.length > 0 && (
                  <div className="mt-auto pt-3" style={{ borderTop: '1px solid var(--color-border-default)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Tarefas ({proto.tarefas_protocolo.length}):</p>
                    <ul className="flex flex-col gap-1">
                      {proto.tarefas_protocolo.slice(0, 4).map((t, idx) => (
                        <li key={idx} className="text-xs flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                          <span style={{ width: '4px', height: '4px', background: 'var(--color-accent)', borderRadius: '1px', flexShrink: 0 }} />
                          {t.descricao}
                        </li>
                      ))}
                      {proto.tarefas_protocolo.length > 4 && <li className="text-xs" style={{ color: 'var(--color-text-muted)' }}>+{proto.tarefas_protocolo.length - 4} mais...</li>}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => openEdit(proto)} className="btn-secondary flex-1 text-xs py-2"><Pencil size={13} /> Editar</button>
                  <button onClick={() => openDuplicate(proto)} className="btn-secondary flex-none text-xs py-2 px-3" title="Duplicar Protocolo"><Copy size={13} /></button>
                  <button onClick={() => setDeleteConfirm(proto.id)} className="btn-secondary flex-none text-xs py-2 px-3" style={{ color: 'var(--color-status-danger)' }} title="Deletar"><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar Protocolo' : 'Novo Protocolo'}
        maxWidth="640px"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSubmit} className="btn-primary" disabled={!form.titulo}>{editingId ? 'Salvar Alterações' : 'Criar Protocolo'}</button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="form-label">Título do Protocolo *</label>
            <input className="form-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Manutenção Preventiva - Impressora 3D" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Categoria da Máquina</label>
              <select className="form-select" disabled={!!form.equipamento_id} value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                <option value="">Todas / Geral</option>
                {categorias?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Relacionar ao Ativo (Opcional)</label>
              <select className="form-select" value={form.equipamento_id} onChange={e => setForm(f => ({ ...f, equipamento_id: e.target.value, categoria_id: e.target.value ? '' : f.categoria_id }))}>
                <option value="">Aplicar à Categoria</option>
                {equipamentos?.map(eq => <option key={eq.id} value={eq.id}>{eq.nome} (Patrimônio: {eq.patrimonio})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Periodicidade</label>
              <select className="form-select" value={form.periodicidade} onChange={e => setForm(f => ({ ...f, periodicidade: e.target.value as Periodicidade }))}>
                {PERIODICIDADE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'ativo' | 'inativo' }))}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Data de Início</label>
              <input type="date" className="form-input" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="form-label">Tarefas do Protocolo</label>
            <div className="flex gap-2 mb-3">
              <input className="form-input flex-1" value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)} placeholder="Descrição da tarefa..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTarefa())} />
              <button onClick={addTarefa} className="btn-secondary" disabled={!novaTarefa.trim()}><Plus size={16} /></button>
            </div>
            {tarefas.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {tarefas.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border-default)', borderRadius: '2px' }}>
                    <GripVertical size={14} style={{ color: 'var(--color-text-muted)' }} />
                    <span className="flex-1 text-sm" style={{ color: 'var(--color-text-body)' }}>{t.descricao}</span>
                    <button onClick={() => removeTarefa(i)} style={{ color: 'var(--color-status-danger)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px' }}><X size={14} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Adicione as tarefas que compõem este protocolo.</p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmar Exclusão"
        maxWidth="400px"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancelar</button>
            <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="btn-danger">Excluir</button>
          </div>
        }
      >
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Excluir este protocolo também removerá todas as suas tarefas associadas.</p>
      </Modal>

      {/* Modal de limpeza de duplicados */}
      <Modal
        open={cleanupModalOpen}
        onClose={() => setCleanupModalOpen(false)}
        title="Remover Protocolos Duplicados"
        maxWidth="500px"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setCleanupModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button
              onClick={handleCleanupDuplicates}
              className="btn-danger"
              disabled={isCleaningUp}
            >
              {isCleaningUp ? 'Removendo...' : `Remover ${duplicatesToRemove.length} duplicado${duplicatesToRemove.length > 1 ? 's' : ''}`}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Os seguintes protocolos serão <strong>excluídos</strong>. O original (mais antigo) de cada grupo será mantido.
          </p>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {duplicatesToRemove.map(proto => {
              const eq = equipamentos?.find(e => e.id === (proto as any).equipamento_id)
              return (
                <div
                  key={proto.id}
                  className="flex items-center gap-3 px-3 py-2 rounded"
                  style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border-default)' }}
                >
                  <Trash2 size={13} style={{ color: 'var(--color-status-danger)', flexShrink: 0 }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-heading)' }}>{proto.titulo}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {eq ? `Ativo: ${eq.nome}` : proto.categorias ? `Categoria: ${proto.categorias.nome}` : 'Sem vínculo'}
                      {' • '}
                      Início: {new Date(proto.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>
    </div>
  )
}
