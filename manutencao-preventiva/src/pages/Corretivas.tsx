import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useEquipamentos } from '../hooks/useEquipamentos'
import { useManutencoes, useCreateManutencao, useUpdateManutencao, useDeleteManutencao, useAddEvidencia, type ManutencaoWithRelations } from '../hooks/useManutencoes'
import { useStorage } from '../hooks/useStorage'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import ImageUpload from '../components/ImageUpload'
import {
  AlertTriangle, CheckCircle2, Clock, Wrench, Plus, Search,
  Filter, Calendar, ChevronRight, Sparkles, HardDrive, Trash2,
  ExternalLink, ArrowRight, ShieldAlert, Cpu, Check, X, AlertOctagon,
  Clock3, PackageCheck, FileText, Image as ImageIcon
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'

interface CorrectiveData {
  defeito: string
  causa_raiz: string
  solucao: string
  pecas: string
  severidade: 'baixa' | 'media' | 'alta' | 'critica'
  tempo_parada_minutos: number
}

const SEVERITY_CONFIG: Record<string, { label: string; badgeCls: string; borderCls: string }> = {
  critica: { label: 'Crítica (Parada)', badgeCls: 'bg-rose-500/10 text-rose-400 border-rose-500/20', borderCls: 'border-l-rose-500' },
  alta: { label: 'Alta', badgeCls: 'bg-orange-500/10 text-orange-400 border-orange-500/20', borderCls: 'border-l-orange-500' },
  media: { label: 'Média', badgeCls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', borderCls: 'border-l-amber-500' },
  baixa: { label: 'Baixa', badgeCls: 'bg-blue-500/10 text-blue-400 border-blue-500/20', borderCls: 'border-l-blue-500' },
}

const STATUS_CONFIG: Record<string, { label: string; badgeCls: string }> = {
  concluida: { label: 'Resolvido', badgeCls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pendente: { label: 'Aguardando Peça / Ação', badgeCls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  em_andamento: { label: 'Em Diagnóstico', badgeCls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
}

export default function Corretivas() {
  const { user } = useAuth()
  const { data: equipamentos } = useEquipamentos()
  const { data: allManutencoes, isLoading } = useManutencoes()

  const createManutencao = useCreateManutencao()
  const updateManutencao = useUpdateManutencao()
  const deleteManutencao = useDeleteManutencao()
  const { uploadMultiple } = useStorage('evidencias')
  const addEvidencia = useAddEvidencia()

  // Filtros
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSeveridade, setFilterSeveridade] = useState('')
  const [filterEquipamento, setFilterEquipamento] = useState('')

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<ManutencaoWithRelations | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Formulário
  const [formEquipamentoId, setFormEquipamentoId] = useState('')
  const [formTitulo, setFormTitulo] = useState('')
  const [formDataEvento, setFormDataEvento] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [formStatus, setFormStatus] = useState<'concluida' | 'pendente' | 'em_andamento'>('concluida')
  const [formSeveridade, setFormSeveridade] = useState<'baixa' | 'media' | 'alta' | 'critica'>('media')
  const [formDefeito, setFormDefeito] = useState('')
  const [formCausaRaiz, setFormCausaRaiz] = useState('')
  const [formSolucao, setFormSolucao] = useState('')
  const [formPecas, setFormPecas] = useState('')
  const [formTempoParada, setFormTempoParada] = useState<number>(0)
  const [fotoFiles, setFotoFiles] = useState<File[]>([])
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([])

  // Modal de Visualização de Foto
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Filtra apenas corretivas
  const corretivas = useMemo(() => {
    if (!allManutencoes) return []
    return allManutencoes.filter(m => m.tipo === 'corretiva')
  }, [allManutencoes])

  // KPIs
  const totalCorretivas = corretivas.length
  const concluidasCount = corretivas.filter(c => c.status === 'concluida').length
  const pendentesCount = corretivas.filter(c => c.status === 'pendente' || c.status === 'em_andamento').length
  const totalDowntimeMinutos = useMemo(() => {
    return corretivas.reduce((acc, cur) => {
      const cData = (cur.checklist_json as unknown as CorrectiveData) || {}
      return acc + (Number(cData.tempo_parada_minutos) || 0)
    }, 0)
  }, [corretivas])

  // Filtragem da Lista
  const filteredList = useMemo(() => {
    return corretivas.filter(item => {
      const cData = (item.checklist_json as unknown as CorrectiveData) || {}
      const eqNome = item.equipamentos?.nome || ''
      const eqPatrimonio = item.equipamentos?.patrimonio || ''

      const searchLower = search.toLowerCase()
      const matchSearch =
        !search ||
        item.titulo.toLowerCase().includes(searchLower) ||
        eqNome.toLowerCase().includes(searchLower) ||
        eqPatrimonio.toLowerCase().includes(searchLower) ||
        (cData.defeito && cData.defeito.toLowerCase().includes(searchLower)) ||
        (cData.causa_raiz && cData.causa_raiz.toLowerCase().includes(searchLower)) ||
        (cData.solucao && cData.solucao.toLowerCase().includes(searchLower)) ||
        (cData.pecas && cData.pecas.toLowerCase().includes(searchLower))

      const matchStatus = !filterStatus || item.status === filterStatus
      const matchSeveridade = !filterSeveridade || cData.severidade === filterSeveridade
      const matchEquipamento = !filterEquipamento || item.equipamento_id === filterEquipamento

      return matchSearch && matchStatus && matchSeveridade && matchEquipamento
    })
  }, [corretivas, search, filterStatus, filterSeveridade, filterEquipamento])

  const openNewModal = () => {
    setEditItem(null)
    setFormEquipamentoId(equipamentos?.[0]?.id || '')
    setFormTitulo('')
    setFormDataEvento(format(new Date(), 'yyyy-MM-dd'))
    setFormStatus('concluida')
    setFormSeveridade('media')
    setFormDefeito('')
    setFormCausaRaiz('')
    setFormSolucao('')
    setFormPecas('')
    setFormTempoParada(0)
    setFotoFiles([])
    setFotoPreviews([])
    setIsModalOpen(true)
  }

  const openEditModal = (item: ManutencaoWithRelations) => {
    setEditItem(item)
    const cData = (item.checklist_json as unknown as CorrectiveData) || {}
    setFormEquipamentoId(item.equipamento_id)
    setFormTitulo(item.titulo)
    setFormDataEvento(format(new Date(item.created_at), 'yyyy-MM-dd'))
    setFormStatus((item.status as any) || 'concluida')
    setFormSeveridade(cData.severidade || 'media')
    setFormDefeito(cData.defeito || '')
    setFormCausaRaiz(cData.causa_raiz || '')
    setFormSolucao(cData.solucao || '')
    setFormPecas(cData.pecas || '')
    setFormTempoParada(cData.tempo_parada_minutos || 0)
    setFotoFiles([])
    setFotoPreviews((item.evidencias || []).map(e => e.foto_url))
    setIsModalOpen(true)
  }

  const handleAddPhotos = (files: File[]) => {
    setFotoFiles(prev => [...prev, ...files])
    const newPreviews = files.map(f => URL.createObjectURL(f))
    setFotoPreviews(prev => [...prev, ...newPreviews])
  }

  const handleRemovePhoto = (index: number) => {
    setFotoFiles(prev => prev.filter((_, i) => i !== index))
    setFotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formEquipamentoId || !formTitulo.trim() || !formDefeito.trim()) {
      toast.error('Preencha o equipamento, título e a descrição do defeito.')
      return
    }

    setSubmitting(true)
    try {
      const correctivePayload: CorrectiveData = {
        defeito: formDefeito.trim(),
        causa_raiz: formCausaRaiz.trim(),
        solucao: formSolucao.trim(),
        pecas: formPecas.trim(),
        severidade: formSeveridade,
        tempo_parada_minutos: Number(formTempoParada) || 0,
      }

      // Constrói timestamp com data selecionada e horário atual
      const [y, m, d] = formDataEvento.split('-').map(Number)
      const dateObj = new Date()
      dateObj.setFullYear(y, m - 1, d)
      const timestamp = dateObj.toISOString()

      let targetId = editItem?.id

      if (editItem) {
        await updateManutencao.mutateAsync({
          id: editItem.id,
          equipamento_id: formEquipamentoId,
          tipo: 'corretiva',
          titulo: formTitulo.trim(),
          status: formStatus,
          checklist_json: correctivePayload as any,
          observacoes: formPecas ? `Peças: ${formPecas}` : null,
          created_at: timestamp,
          completed_at: formStatus === 'concluida' ? timestamp : null,
        })
      } else {
        const created = await createManutencao.mutateAsync({
          equipamento_id: formEquipamentoId,
          protocolo_id: null,
          tipo: 'corretiva',
          titulo: formTitulo.trim(),
          status: formStatus,
          tecnico_id: user!.id,
          checklist_json: correctivePayload as any,
          observacoes: formPecas ? `Peças: ${formPecas}` : null,
          created_at: timestamp,
          completed_at: formStatus === 'concluida' ? timestamp : null,
        })
        targetId = created.id
      }

      // Upload de fotos
      if (fotoFiles.length > 0 && targetId) {
        const urls = await uploadMultiple(fotoFiles, `corretiva_${targetId}`)
        for (const url of urls) {
          await addEvidencia.mutateAsync({ manutencao_id: targetId, foto_url: url })
        }
      }

      setIsModalOpen(false)
      toast.success(editItem ? 'Manutenção corretiva atualizada!' : 'Manutenção corretiva registrada!')
    } catch (error) {
      console.error(error)
      toast.error('Erro ao salvar registro de corretiva.')
    } finally {
      setSubmitting(false)
    }
  }

  // Ação rápida: marcar como Resolvido
  const handleQuickResolve = async (item: ManutencaoWithRelations) => {
    try {
      await updateManutencao.mutateAsync({
        id: item.id,
        status: 'concluida',
        completed_at: new Date().toISOString(),
      })
      toast.success('Incidente marcado como Resolvido!')
    } catch {
      toast.error('Erro ao atualizar status.')
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert size={12} className="mr-1" /> Ocorrências & Quebras
            </span>
            <span className="text-xs text-white/40 font-mono">Registro de Não Conformidades</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Manutenções Corretivas
          </h1>
          <p className="text-sm text-white/50">
            Registro de incidentes, falhas de hardware/software, diagnóstico de causa raiz e substituição de peças.
          </p>
        </div>

        <button
          onClick={openNewModal}
          className="px-4 py-2.5 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 transition-all flex items-center gap-2 shrink-0 self-start md:self-auto cursor-pointer"
        >
          <Plus size={16} /> Registrar Manutenção Corretiva
        </button>
      </div>

      {/* ── KPI Cards Analíticos ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total de Falhas */}
        <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl">
          <div className="flex items-center justify-between text-white/60 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Total de Ocorrências</span>
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/70">
              <Wrench size={16} />
            </div>
          </div>
          <span className="text-2xl font-black font-mono tracking-tight text-white">{totalCorretivas}</span>
          <p className="text-[11px] text-white/40 mt-1">Incidentes registrados nos ativos</p>
        </div>

        {/* Card 2: Resolvidas */}
        <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl">
          <div className="flex items-center justify-between text-white/60 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Resolvidas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <span className="text-2xl font-black font-mono tracking-tight text-emerald-400">{concluidasCount}</span>
          <p className="text-[11px] text-emerald-400/70 mt-1">Máquinas reparadas e liberadas</p>
        </div>

        {/* Card 3: Pendentes / Aguardando Peça */}
        <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl">
          <div className="flex items-center justify-between text-white/60 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Aguardando Peça / Ação</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <AlertTriangle size={16} />
            </div>
          </div>
          <span className="text-2xl font-black font-mono tracking-tight text-amber-400">{pendentesCount}</span>
          <p className="text-[11px] text-amber-400/70 mt-1">Requerem reposição ou diagnóstico</p>
        </div>

        {/* Card 4: Tempo de Parada Acumulado */}
        <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl">
          <div className="flex items-center justify-between text-white/60 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Downtime Acumulado</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Clock3 size={16} />
            </div>
          </div>
          <span className="text-2xl font-black font-mono tracking-tight text-white">
            {totalDowntimeMinutos >= 60
              ? `${Math.floor(totalDowntimeMinutos / 60)}h ${totalDowntimeMinutos % 60}m`
              : `${totalDowntimeMinutos} min`}
          </span>
          <p className="text-[11px] text-white/40 mt-1">Horas totais de máquinas inoperantes</p>
        </div>
      </div>

      {/* ── Barra de Busca e Filtros ── */}
      <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Buscar por defeito, máquina, causa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-black/40 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {/* Filtro de Status */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg bg-black/40 border border-white/10 text-white/80 focus:outline-none focus:border-orange-500"
          >
            <option value="">Todos os Status</option>
            <option value="concluida">Resolvidas</option>
            <option value="pendente">Aguardando Peça</option>
            <option value="em_andamento">Em Diagnóstico</option>
          </select>

          {/* Filtro de Severidade */}
          <select
            value={filterSeveridade}
            onChange={e => setFilterSeveridade(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg bg-black/40 border border-white/10 text-white/80 focus:outline-none focus:border-orange-500"
          >
            <option value="">Todas Severidades</option>
            <option value="critica">Crítica (Parada)</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>

          {/* Filtro de Equipamento */}
          <select
            value={filterEquipamento}
            onChange={e => setFilterEquipamento(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg bg-black/40 border border-white/10 text-white/80 focus:outline-none focus:border-orange-500 max-w-[180px] truncate"
          >
            <option value="">Todos Equipamentos</option>
            {(equipamentos || []).map(eq => (
              <option key={eq.id} value={eq.id}>{eq.nome}</option>
            ))}
          </select>

          {(search || filterStatus || filterSeveridade || filterEquipamento) && (
            <button
              onClick={() => {
                setSearch('')
                setFilterStatus('')
                setFilterSeveridade('')
                setFilterEquipamento('')
              }}
              className="p-2 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title="Limpar Filtros"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Lista de Ocorrências Corretivas ── */}
      {filteredList.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert size={48} strokeWidth={1} />}
          title="Nenhuma manutenção corretiva encontrada"
          description={
            search || filterStatus || filterSeveridade || filterEquipamento
              ? "Tente ajustar os filtros de busca para encontrar o registro desejado."
              : "Excelente notícia! Nenhuma quebra ou falha mecânica registrada no momento."
          }
          action={
            <button onClick={openNewModal} className="btn-primary text-xs flex items-center gap-1.5 mt-2">
              <Plus size={14} /> Registrar Novo Incidente
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredList.map(item => {
            const cData = (item.checklist_json as unknown as CorrectiveData) || {}
            const sev = SEVERITY_CONFIG[cData.severidade || 'media'] || SEVERITY_CONFIG.media
            const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.concluida
            const dataFmt = format(new Date(item.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
            const hasPhotos = (item.evidencias || []).length > 0

            return (
              <div
                key={item.id}
                className={`rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] border-l-4 ${sev.borderCls} p-5 shadow-xl hover:border-white/20 transition-all`}
              >
                {/* Header do Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0 border border-white/10 flex items-center justify-center">
                      {item.equipamentos?.foto_url ? (
                        <img src={item.equipamentos.foto_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <HardDrive size={18} className="text-white/40" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white tracking-tight">
                          {item.equipamentos?.nome || 'Equipamento'}
                        </h3>
                        <span className="text-xs font-mono text-white/40">
                          #{item.equipamentos?.patrimonio || 'S/N'}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 flex items-center gap-1.5">
                        <Calendar size={12} /> {dataFmt}
                        {item.profiles?.nome && (
                          <span>• Técnico: <strong className="text-white/70">{item.profiles.nome.split(' ')[0]}</strong></span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Badges de Status e Severidade */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${sev.badgeCls}`}>
                      Severidade: {sev.label}
                    </span>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${st.badgeCls}`}>
                      {st.label}
                    </span>
                    {cData.tempo_parada_minutos > 0 && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/60 border border-white/10 flex items-center gap-1">
                        <Clock size={11} /> {cData.tempo_parada_minutos} min de parada
                      </span>
                    )}
                  </div>
                </div>

                {/* Título e Conteúdo do Chamado */}
                <div className="space-y-3">
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <AlertOctagon size={16} className="text-orange-400 shrink-0" />
                    {item.titulo}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {/* Defeito */}
                    <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                      <span className="font-bold text-white/40 uppercase tracking-wider block mb-1">
                        Defeito / Problema Apresentado
                      </span>
                      <p className="text-white/80 leading-relaxed">
                        {cData.defeito || item.observacoes || 'Não especificado.'}
                      </p>
                    </div>

                    {/* Causa Raiz */}
                    <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                      <span className="font-bold text-white/40 uppercase tracking-wider block mb-1">
                        Causa Raiz / Diagnóstico
                      </span>
                      <p className="text-white/80 leading-relaxed">
                        {cData.causa_raiz || 'Diagnóstico em análise ou não detalhado.'}
                      </p>
                    </div>

                    {/* Solução Aplicada */}
                    <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                      <span className="font-bold text-white/40 uppercase tracking-wider block mb-1">
                        Ação Corretiva Realizada
                      </span>
                      <p className="text-white/80 leading-relaxed">
                        {cData.solucao || 'Aguardando intervenção técnica.'}
                      </p>
                    </div>
                  </div>

                  {/* Peças de Reposição */}
                  {cData.pecas && (
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-300">
                      <PackageCheck size={16} className="shrink-0 text-amber-400" />
                      <span><strong>Peça de Reposição / Substituída:</strong> {cData.pecas}</span>
                    </div>
                  )}

                  {/* Galeria de Evidências Fotográficas */}
                  {hasPhotos && (
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-2">
                        Evidências Registradas ({item.evidencias.length})
                      </span>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {item.evidencias.map(ev => (
                          <div
                            key={ev.id}
                            onClick={() => setPreviewImage(ev.foto_url)}
                            className="w-16 h-16 rounded-lg overflow-hidden border border-white/15 shrink-0 cursor-pointer hover:border-orange-500 transition-colors group relative"
                          >
                            <img src={ev.foto_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Search size={14} className="text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer do Card: Ações */}
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-xs text-white/40 font-mono">
                    ID: {item.id.slice(0, 8)}...
                  </span>

                  <div className="flex items-center gap-2">
                    {item.status !== 'concluida' && (
                      <button
                        onClick={() => handleQuickResolve(item)}
                        className="px-3 py-1.5 rounded text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check size={14} /> Marcar como Resolvido
                      </button>
                    )}

                    <button
                      onClick={() => openEditModal(item)}
                      className="px-3 py-1.5 rounded text-xs font-semibold bg-white/5 hover:bg-white/10 text-white/80 transition-colors cursor-pointer"
                    >
                      Editar Registro
                    </button>

                    <button
                      onClick={() => {
                        if (confirm('Tem certeza que deseja excluir esta manutenção corretiva?')) {
                          deleteManutencao.mutate(item.id)
                        }
                      }}
                      className="p-1.5 rounded text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal de Cadastro / Edição ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editItem ? "Editar Manutenção Corretiva" : "Registrar Manutenção Corretiva"}
        maxWidth="680px"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Equipamento */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Equipamento / Ativo *
            </label>
            <select
              value={formEquipamentoId}
              onChange={e => setFormEquipamentoId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-black/50 border border-white/15 text-white focus:outline-none focus:border-orange-500"
              required
            >
              {(equipamentos || []).map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.nome} (#{eq.patrimonio || 'S/N'})
                </option>
              ))}
            </select>
          </div>

          {/* Título da Falha */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Título do Incidente / Falha *
            </label>
            <input
              type="text"
              placeholder="Ex: Travamento de software por armazenamento cheio"
              value={formTitulo}
              onChange={e => setFormTitulo(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-black/50 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-orange-500"
              required
            />
          </div>

          {/* Grid de Metadados: Data, Severidade, Status, Downtime */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Data do Evento *
              </label>
              <input
                type="date"
                value={formDataEvento}
                onChange={e => setFormDataEvento(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white focus:outline-none focus:border-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Severidade
              </label>
              <select
                value={formSeveridade}
                onChange={e => setFormSeveridade(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="critica">Crítica (Parada)</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Status Atual
              </label>
              <select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="concluida">Resolvido</option>
                <option value="pendente">Aguardando Peça</option>
                <option value="em_andamento">Em Diagnóstico</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Parada (minutos)
              </label>
              <input
                type="number"
                min="0"
                value={formTempoParada}
                onChange={e => setFormTempoParada(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>
          </div>

          {/* Defeito Apresentado */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Defeito / Comportamento Anômalo *
            </label>
            <textarea
              rows={2}
              placeholder="Descreva detalhadamente os sintomas apresentados pela máquina..."
              value={formDefeito}
              onChange={e => setFormDefeito(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-orange-500 custom-scrollbar"
              required
            />
          </div>

          {/* Causa Raiz */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Causa Raiz / Diagnóstico Técnico
            </label>
            <textarea
              rows={2}
              placeholder="Qual foi o motivo da quebra/falha (ex: memória cheia, desgaste de microswitch, aquecimento)..."
              value={formCausaRaiz}
              onChange={e => setFormCausaRaiz(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-orange-500 custom-scrollbar"
            />
          </div>

          {/* Solução Aplicada */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Ação Corretiva Realizada
            </label>
            <textarea
              rows={2}
              placeholder="Quais procedimentos foram realizados para sanar o problema..."
              value={formSolucao}
              onChange={e => setFormSolucao(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-orange-500 custom-scrollbar"
            />
          </div>

          {/* Peças */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Peças Necessárias / Substituídas (se houver)
            </label>
            <input
              type="text"
              placeholder="Ex: Sensor de filamento Creality K1 Max, Correia GT2 6mm..."
              value={formPecas}
              onChange={e => setFormPecas(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Fotos e Evidências */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Fotos da Falha / Evidências do Reparo
            </label>
            <ImageUpload
              multiple
              previews={fotoPreviews}
              onUpload={handleAddPhotos}
              onRemovePreview={handleRemovePhoto}
            />
          </div>

          {/* Botões do Formulário */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white shadow-lg shadow-orange-500/25 transition-all cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? 'Salvando...' : editItem ? 'Salvar Alterações' : 'Registrar Ocorrência'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal de Visualização da Foto Expandida ── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] rounded-xl overflow-hidden border border-white/20 shadow-2xl">
            <img src={previewImage} alt="Evidência" className="max-w-full max-h-[85vh] object-contain" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
