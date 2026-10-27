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
import { Plus, Pencil, Trash2, ClipboardList, X, GripVertical, Copy, AlertTriangle, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react'
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
  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [isCleaningUp, setIsCleaningUp] = useState(false)

  // ─── 1. Auditoria Inteligente de Inconsistências ───────────────────────────
  const auditAnalysis = useMemo(() => {
    if (!protocolos || !equipamentos) {
      return { issues: [], duplicates: [], missingForEquipments: [] }
    }

    const issues: Array<{
      id: string
      type: 'tech_mismatch' | 'title_mismatch' | 'periodicity_mismatch'
      title: string
      desc: string
      protocolo: ProtocoloWithRelations
      fixAction: 'delete' | 'fix_periodicity' | 'rename'
      targetFix?: string
    }> = []

    // 1.1 Incompatibilidades nos Protocolos
    for (const proto of protocolos) {
      const eq = equipamentos.find(e => e.id === (proto as any).equipamento_id)
      const pTitle = proto.titulo.toLowerCase().trim()
      const eqName = eq ? eq.nome.toLowerCase() : ''
      const catName = proto.categorias?.nome?.toLowerCase() || ''

      // A) Protocolo FDM vinculado a impressora de Resina
      if (
        pTitle.includes('fdm') &&
        (eqName.includes('resina') || eqName.includes('ld-002') || eqName.includes('ld-006') || eqName.includes('halot') || eqName.includes('saturn') || catName.includes('resina'))
      ) {
        issues.push({
          id: proto.id,
          type: 'tech_mismatch',
          title: proto.titulo,
          desc: `Protocolo FDM vinculado indevidamente ao ativo de Resina "${eq?.nome ?? 'Resina'}".`,
          protocolo: proto,
          fixAction: 'delete',
        })
      }

      // B) Título "Fibra de corte à laser" vinculado a CNC Router
      if (pTitle.includes('fibra de corte') && (eqName.includes('fcr') || eqName.includes('router') || pTitle.includes('fcr'))) {
        issues.push({
          id: proto.id,
          type: 'title_mismatch',
          title: proto.titulo,
          desc: `Título menciona "Fibra de corte à laser", mas as tarefas são de CNC Router usinagem (Spindle/MDF).`,
          protocolo: proto,
          fixAction: 'delete',
        })
      }

      // C) Título diz Mensal mas periodicidade está Semanal
      if (pTitle.includes('mensal') && proto.periodicidade === 'semanal') {
        issues.push({
          id: proto.id,
          type: 'periodicity_mismatch',
          title: proto.titulo,
          desc: `Título é Mensal, mas a periodicidade e a rotina do sistema estão como SEMANAL.`,
          protocolo: proto,
          fixAction: 'fix_periodicity',
        })
      }

      // D) Protocolos repetidos em caixa baixa ou redundantes residuais
      if (pTitle === 'preventiva semanal - ld-002' || pTitle === 'preventiva semanal - ld-006') {
        issues.push({
          id: proto.id,
          type: 'tech_mismatch',
          title: proto.titulo,
          desc: `Protocolo duplicado/redundante com nomenclatura simplificada.`,
          protocolo: proto,
          fixAction: 'delete',
        })
      }
    }

    // 1.2 Protocolos Duplicados Exatos (por título normalizado + equipamento)
    const seen = new Map<string, string>()
    const duplicates: typeof protocolos = []
    const sorted = [...protocolos].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    for (const proto of sorted) {
      const key = (proto as any).equipamento_id
        ? `eq:${(proto as any).equipamento_id}::${proto.titulo.toLowerCase().trim()}`
        : `cat:${proto.categoria_id ?? 'none'}::${proto.titulo.toLowerCase().trim()}`

      if (seen.has(key)) {
        duplicates.push(proto)
      } else {
        seen.set(key, proto.id)
      }
    }

    // 1.3 Equipamentos Ativos sem nenhum protocolo vinculado
    const activeEquipments = equipamentos.filter(e => e.status === 'ativo')
    const missingForEquipments = activeEquipments.filter(e => {
      const hasSpecific = protocolos.some(p => (p as any).equipamento_id === e.id)
      const hasCat = e.categoria_id && protocolos.some(p => p.categoria_id === e.categoria_id && !(p as any).equipamento_id)
      return !hasSpecific && !hasCat
    })

    return { issues, duplicates, missingForEquipments }
  }, [protocolos, equipamentos])

  const totalAuditIssues = auditAnalysis.issues.length + auditAnalysis.duplicates.length + auditAnalysis.missingForEquipments.length

  // Executa correções pontuais da auditoria
  const handleFixAuditIssue = async (issue: typeof auditAnalysis.issues[0]) => {
    setIsCleaningUp(true)
    try {
      if (issue.fixAction === 'delete') {
        const { error } = await supabase.from('protocolos').delete().eq('id', issue.id)
        if (error) throw error
        toast.success(`Protocolo removido com sucesso!`)
      } else if (issue.fixAction === 'fix_periodicity') {
        const { error } = await supabase.from('protocolos').update({ periodicidade: 'mensal' }).eq('id', issue.id)
        if (error) throw error
        toast.success(`Periodicidade corrigida para Mensal!`)
      }
      qc.invalidateQueries({ queryKey: ['protocolos'] })
      qc.invalidateQueries({ queryKey: ['agenda'] })
    } catch {
      toast.error('Erro ao aplicar correção.')
    } finally {
      setIsCleaningUp(false)
    }
  }

  // Gera protocolos recomendados sob medida para novos equipamentos
  const handleGenerateTailoredProtocols = async (eq: NonNullable<typeof equipamentos>[number]) => {
    if (!user) return
    setIsCleaningUp(true)
    try {
      const eqName = eq.nome.toLowerCase()
      const catResina = categorias?.find(c => c.nome.toLowerCase().includes('resina'))?.id || null
      const catOutro = categorias?.find(c => c.nome.toLowerCase().includes('outro'))?.id || null

      if (eqName.includes('saturn')) {
        // Semanal Saturn 4 Ultra
        await createProto.mutateAsync({
          titulo: `Preventiva Semanal - ${eq.nome}`,
          categoria_id: catResina,
          equipamento_id: eq.id,
          periodicidade: 'semanal',
          status: 'ativo',
          data_inicio: new Date().toISOString().split('T')[0],
          user_id: user.id,
          tarefas: [
            'Inspeção visual e teste de tensão do filme de liberação PFA/FEP do tanque (Vat)',
            'Limpeza da tela LCD de exposição 16K e vidro de proteção com lenço de microfibra e IPA',
            'Checagem e teste do sensor mecânico de detecção de resíduos sólidos no tanque',
            'Limpeza de respingos de resina na mesa de impressão, calhas e gabinete',
            'Verificação do aperto dos parafusos de retenção do tanque e mesa de impressão'
          ]
        })
        // Mensal Saturn 4 Ultra
        await createProto.mutateAsync({
          titulo: `Preventiva Mensal - ${eq.nome}`,
          categoria_id: catResina,
          equipamento_id: eq.id,
          periodicidade: 'mensal',
          status: 'ativo',
          data_inicio: new Date().toISOString().split('T')[0],
          user_id: user.id,
          tarefas: [
            'Limpeza e lubrificação do fuso de esferas e guias lineares duplas do eixo Z com graxa PTFE',
            'Inspeção e teste suave do mecanismo automático de liberação por inclinação (Tilt-Release)',
            'Verificação do ventilador de exaustão e inspeção/substituição do filtro de carvão ativado',
            'Calibração e checagem do nivelamento mecânico do prato de alumínio',
            'Inspeção elétrica da fonte de alimentação e conexões da câmera de monitoramento IA'
          ]
        })
        toast.success(`Protocolos sob medida gerados para ${eq.nome}!`)
      } else if (eqName.includes('mercury')) {
        // Semanal Mercury Plus
        await createProto.mutateAsync({
          titulo: `Preventiva Semanal - ${eq.nome}`,
          categoria_id: catOutro,
          equipamento_id: eq.id,
          periodicidade: 'semanal',
          status: 'ativo',
          data_inicio: new Date().toISOString().split('T')[0],
          user_id: user.id,
          tarefas: [
            'Inspeção visual e filtragem do solvente (IPA/Álcool) no recipiente de lavagem',
            'Limpeza do rotor magnético/hélice do fundo do balde para evitar travamentos por resina curada',
            'Limpeza dos espelhos refletores internos e da cúpula acrílica de proteção UV'
          ]
        })
        // Mensal Mercury Plus
        await createProto.mutateAsync({
          titulo: `Preventiva Mensal - ${eq.nome}`,
          categoria_id: catOutro,
          equipamento_id: eq.id,
          periodicidade: 'mensal',
          status: 'ativo',
          data_inicio: new Date().toISOString().split('T')[0],
          user_id: user.id,
          tarefas: [
            'Higienização profunda do tanque de lavagem selado e descarte/troca do solvente saturado',
            'Teste de funcionamento de todas as fileiras de LEDs UV (405nm) e precisão do timer digital',
            'Teste do sensor de segurança de intertravamento da tampa (desligamento automático dos LEDs)',
            'Inspeção e limpeza do rolamento central do prato giratório de cura 360°'
          ]
        })
        toast.success(`Protocolos sob medida gerados para ${eq.nome}!`)
      } else {
        // Protocolo Genérico adaptado
        await createProto.mutateAsync({
          titulo: `Preventiva Mensal - ${eq.nome}`,
          categoria_id: eq.categoria_id,
          equipamento_id: eq.id,
          periodicidade: 'mensal',
          status: 'ativo',
          data_inicio: new Date().toISOString().split('T')[0],
          user_id: user.id,
          tarefas: [
            'Limpeza geral e desobstrução de áreas móveis e ventiladores',
            'Inspeção de fixações mecânicas, cabos e conexões elétricas',
            'Lubrificação de guias lineares e eixos conforme manual do fabricante',
            'Teste funcional de operação e alinhamento'
          ]
        })
        toast.success(`Protocolo gerado para ${eq.nome}!`)
      }
      qc.invalidateQueries({ queryKey: ['protocolos'] })
      qc.invalidateQueries({ queryKey: ['agenda'] })
    } catch {
      toast.error('Erro ao gerar protocolos.')
    } finally {
      setIsCleaningUp(false)
    }
  }

  // Executa todas as limpezas de uma só vez
  const handleRunFullSanitization = async () => {
    setIsCleaningUp(true)
    try {
      // 1. Deletar issues marcadas para delete
      const deleteIds = [
        ...auditAnalysis.issues.filter(i => i.fixAction === 'delete').map(i => i.id),
        ...auditAnalysis.duplicates.map(d => d.id)
      ]
      if (deleteIds.length > 0) {
        await supabase.from('protocolos').delete().in('id', deleteIds)
      }

      // 2. Corrigir periodicidade
      const fixPeriodicityIds = auditAnalysis.issues.filter(i => i.fixAction === 'fix_periodicity').map(i => i.id)
      if (fixPeriodicityIds.length > 0) {
        await supabase.from('protocolos').update({ periodicidade: 'mensal' }).in('id', fixPeriodicityIds)
      }

      qc.invalidateQueries({ queryKey: ['protocolos'] })
      qc.invalidateQueries({ queryKey: ['agenda'] })
      toast.success('Saneamento de protocolos concluído com sucesso!')
      setAuditModalOpen(false)
    } catch {
      toast.error('Erro durante o saneamento automático.')
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
        <div className="flex flex-wrap items-center gap-2">
          {totalAuditIssues > 0 ? (
            <button
              onClick={() => setAuditModalOpen(true)}
              className="btn-secondary text-sm flex items-center gap-2"
              style={{ color: 'var(--color-status-warning, #f59e0b)', borderColor: 'var(--color-status-warning, #f59e0b)' }}
            >
              <AlertTriangle size={15} />
              <span>Saneamento ({totalAuditIssues} pendência{totalAuditIssues > 1 ? 's' : ''})</span>
            </button>
          ) : (
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-status-ok, #10b981)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
            >
              <CheckCircle2 size={13} />
              <span>Protocolos Consistentes</span>
            </div>
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

      {/* Modal do Assistente de Saneamento Inteligente */}
      <Modal
        open={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        title="Assistente de Saneamento de Protocolos"
        maxWidth="640px"
        footer={
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 w-full">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {totalAuditIssues} pendência{totalAuditIssues > 1 ? 's' : ''} detectada{totalAuditIssues > 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setAuditModalOpen(false)} className="btn-secondary">Fechar</button>
              {(auditAnalysis.issues.length > 0 || auditAnalysis.duplicates.length > 0) && (
                <button
                  onClick={handleRunFullSanitization}
                  className="btn-primary"
                  disabled={isCleaningUp}
                >
                  <Sparkles size={14} />
                  {isCleaningUp ? 'Sanando...' : 'Sanar Inconsistências'}
                </button>
              )}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-5 py-1">
          {/* Seção 1: Inconsistências Críticas */}
          {auditAnalysis.issues.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={15} style={{ color: 'var(--color-status-danger)' }} />
                <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-heading)' }}>
                  Inconsistências de Conteúdo ({auditAnalysis.issues.length})
                </h4>
              </div>
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                {auditAnalysis.issues.map(issue => (
                  <div
                    key={issue.id}
                    className="flex items-start justify-between gap-3 p-3 rounded"
                    style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border-default)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-heading)' }}>{issue.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{issue.desc}</p>
                    </div>
                    <button
                      onClick={() => handleFixAuditIssue(issue)}
                      disabled={isCleaningUp}
                      className="btn-secondary text-xs py-1 px-2.5 shrink-0"
                      style={{
                        color: issue.fixAction === 'delete' ? 'var(--color-status-danger)' : 'var(--color-accent)',
                        borderColor: issue.fixAction === 'delete' ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-accent)'
                      }}
                    >
                      {issue.fixAction === 'delete' ? 'Excluir' : 'Corrigir'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seção 2: Duplicatas Exatas */}
          {auditAnalysis.duplicates.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trash2 size={15} style={{ color: 'var(--color-status-warning)' }} />
                <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-heading)' }}>
                  Protocolos Duplicados ({auditAnalysis.duplicates.length})
                </h4>
              </div>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                {auditAnalysis.duplicates.map(proto => {
                  const eq = equipamentos?.find(e => e.id === (proto as any).equipamento_id)
                  return (
                    <div
                      key={proto.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded"
                      style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border-default)' }}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-heading)' }}>{proto.titulo}</p>
                        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                          {eq ? `Ativo: ${eq.nome}` : 'Categoria geral'} • Início: {new Date(proto.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className="badge badge-warn text-[10px] shrink-0">Duplicado</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Seção 3: Equipamentos Ativos sem Protocolos */}
          {auditAnalysis.missingForEquipments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={15} style={{ color: 'var(--color-accent)' }} />
                <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-heading)' }}>
                  Máquinas Ativas Sem Protocolos ({auditAnalysis.missingForEquipments.length})
                </h4>
              </div>
              <p className="text-xs mb-2.5" style={{ color: 'var(--color-text-secondary)' }}>
                As seguintes máquinas ativas ainda não possuem checklist de manutenção preventiva vinculado:
              </p>
              <div className="flex flex-col gap-2">
                {auditAnalysis.missingForEquipments.map(eq => (
                  <div
                    key={eq.id}
                    className="flex items-center justify-between gap-3 p-3 rounded"
                    style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border-default)' }}
                  >
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-heading)' }}>{eq.nome}</p>
                      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                        Modelo: {eq.modelo || '—'} • Categoria: {eq.categorias?.nome || '—'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleGenerateTailoredProtocols(eq)}
                      disabled={isCleaningUp}
                      className="btn-primary text-xs py-1.5 px-3 shrink-0 flex items-center gap-1.5"
                    >
                      <Plus size={13} />
                      Gerar Sob Medida
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalAuditIssues === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <ShieldCheck size={40} style={{ color: 'var(--color-status-ok)' }} className="mb-2" />
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-heading)' }}>Todos os protocolos estão consistentes!</p>
              <p className="text-xs max-w-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Não foram encontradas incompatibilidades tecnológicas, duplicidades ou máquinas ativas desprotegidas.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
