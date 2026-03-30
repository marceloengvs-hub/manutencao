import { useState } from 'react'
import {
  useEquipamentos,
  useCreateEquipamento,
  useUpdateEquipamento,
  useDeleteEquipamento,
} from '../hooks/useEquipamentos'
import { useCategorias } from '../hooks/useProtocolos'
import { useStorage } from '../hooks/useStorage'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import ImageUpload from '../components/ImageUpload'
import EmptyState from '../components/EmptyState'
import { Plus, Pencil, Trash2, HardDrive, Search } from 'lucide-react'
import type { Equipamento } from '../lib/database.types'

type EqStatus = 'ativo' | 'inativo' | 'manutencao'

const STATUS_OPTIONS: Array<{ value: EqStatus; label: string; cls: string }> = [
  { value: 'ativo', label: 'Ativo', cls: 'badge-ok' },
  { value: 'inativo', label: 'Inativo', cls: 'badge-neutral' },
  { value: 'manutencao', label: 'Manutenção', cls: 'badge-warn' },
]

export default function Equipamentos() {
  const { user } = useAuth()
  const { data: equipamentos, isLoading } = useEquipamentos()
  const { data: categorias } = useCategorias()
  const createEq = useCreateEquipamento()
  const updateEq = useUpdateEquipamento()
  const deleteEq = useDeleteEquipamento()
  const { upload, uploading } = useStorage('equipamentos')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Equipamento | null>(null)
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const [form, setForm] = useState({
    nome: '',
    modelo: '',
    categoria_id: '',
    patrimonio: '',
    descricao: '',
    status: 'ativo' as EqStatus,
  })
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string[]>([])

  const openCreate = () => {
    setEditing(null)
    setForm({ nome: '', modelo: '', categoria_id: '', patrimonio: '', descricao: '', status: 'ativo' })
    setFotoUrl(null)
    setFotoPreview([])
    setModalOpen(true)
  }

  const openEdit = (eq: Equipamento) => {
    setEditing(eq)
    setForm({
      nome: eq.nome,
      modelo: eq.modelo,
      categoria_id: eq.categoria_id || '',
      patrimonio: eq.patrimonio,
      descricao: eq.descricao || '',
      status: eq.status,
    })
    setFotoUrl(eq.foto_url)
    setFotoPreview(eq.foto_url ? [eq.foto_url] : [])
    setModalOpen(true)
  }

  const handlePhotoUpload = async (files: File[]) => {
    const url = await upload(files[0])
    if (url) {
      setFotoUrl(url)
      setFotoPreview([url])
    }
  }

  const handleSubmit = async () => {
    if (!form.nome || !form.patrimonio) return

    if (editing) {
      updateEq.mutate({
        id: editing.id,
        nome: form.nome,
        modelo: form.modelo,
        patrimonio: form.patrimonio,
        descricao: form.descricao,
        categoria_id: form.categoria_id || null,
        foto_url: fotoUrl,
        status: form.status,
      })
    } else {
      createEq.mutate({
        nome: form.nome,
        modelo: form.modelo,
        patrimonio: form.patrimonio,
        descricao: form.descricao,
        categoria_id: form.categoria_id || null,
        foto_url: fotoUrl,
        status: form.status,
        user_id: user!.id,
      })
    }
    setModalOpen(false)
  }

  const handleDelete = (id: string) => {
    deleteEq.mutate(id)
    setDeleteConfirm(null)
  }

  const filtered = equipamentos?.filter(eq =>
    eq.nome.toLowerCase().includes(search.toLowerCase()) ||
    eq.patrimonio.toLowerCase().includes(search.toLowerCase()) ||
    eq.modelo.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--color-text-heading)' }}>
            Equipamentos
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Gerencie todos os ativos do laboratório.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Novo Equipamento
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar por nome, modelo ou patrimônio..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<HardDrive size={48} strokeWidth={1} />}
          title="Nenhum equipamento encontrado"
          description={search ? 'Tente outro termo de busca.' : 'Comece cadastrando o primeiro equipamento do laboratório.'}
          action={!search ? <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Cadastrar</button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((eq, i) => {
            const cat = eq.categorias?.nome ?? '—'
            const st = STATUS_OPTIONS.find(s => s.value === eq.status) ?? STATUS_OPTIONS[0]

            return (
              <div
                key={eq.id}
                className="card card-interactive p-0 overflow-hidden flex flex-col animate-fade-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div
                  className="h-36 flex items-center justify-center overflow-hidden"
                  style={{ background: 'var(--color-surface-elevated)', borderBottom: '1px solid var(--color-border-default)' }}
                >
                  {eq.foto_url ? (
                    <img src={eq.foto_url} alt={eq.nome} className="w-full h-full object-contain p-2" />
                  ) : (
                    <HardDrive size={40} style={{ color: 'var(--color-text-muted)' }} />
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-heading)' }}>{eq.nome}</h3>
                    <span className={`badge ${st.cls} shrink-0`}>{st.label}</span>
                  </div>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>{eq.modelo}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cat: {cat}</p>
                  <p className="text-xs font-mono mt-auto pt-3" style={{ color: 'var(--color-text-muted)' }}>#{eq.patrimonio}</p>
                </div>
                <div className="flex" style={{ borderTop: '1px solid var(--color-border-default)' }}>
                  <button onClick={() => openEdit(eq)} className="btn-ghost flex-1 py-2.5 text-sm gap-1.5">
                    <Pencil size={14} /> Editar
                  </button>
                  <div style={{ width: '1px', background: 'var(--color-border-default)' }} />
                  <button onClick={() => setDeleteConfirm(eq.id)} className="btn-ghost flex-1 py-2.5 text-sm gap-1.5" style={{ color: 'var(--color-status-danger)' }}>
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Equipamento' : 'Novo Equipamento'}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="form-label">Nome do Equipamento *</label>
            <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Ender 3 Pro" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Modelo</label>
              <input className="form-input" value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} placeholder="Ex: V2 2024" />
            </div>
            <div>
              <label className="form-label">Nº Patrimônio *</label>
              <input className="form-input font-mono" value={form.patrimonio} onChange={e => setForm(f => ({ ...f, patrimonio: e.target.value }))} placeholder="Ex: LAB-3D-001" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Categoria</label>
              <select className="form-select" value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {categorias?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as EqStatus }))}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Descrição / Observações</label>
            <textarea className="form-input" rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Observações gerais..." />
          </div>
          <div>
            <label className="form-label">Foto do Equipamento</label>
            <ImageUpload onUpload={handlePhotoUpload} previews={fotoPreview} onRemovePreview={() => { setFotoUrl(null); setFotoPreview([]) }} uploading={uploading} />
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSubmit} className="btn-primary" disabled={!form.nome || !form.patrimonio}>
              {editing ? 'Salvar Alterações' : 'Cadastrar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirmar Exclusão" maxWidth="400px">
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>Tem certeza que deseja excluir este equipamento? Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancelar</button>
          <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="btn-danger">Excluir</button>
        </div>
      </Modal>
    </div>
  )
}
