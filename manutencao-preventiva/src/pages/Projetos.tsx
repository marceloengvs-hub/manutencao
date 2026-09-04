import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useProjetos, useCreateProjeto, useUpdateProjeto, useDeleteProjeto } from '../hooks/useProjetos'
import { useEquipamentos } from '../hooks/useEquipamentos'
import { useAuth } from '../contexts/AuthContext'
import { useStorage } from '../hooks/useStorage'
import type { Projeto } from '../lib/database.types'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import ImageUpload from '../components/ImageUpload'
import {
  FolderGit2, Plus, Search, Filter, Download, UserCheck,
  Calendar, Clock, ShieldCheck, ShieldAlert, Users, Wrench,
  CheckCircle2, XCircle, FileText, Image as ImageIcon, Eye,
  Lock, Check, Trash2, Edit3, Sparkles, ExternalLink, X,
  GraduationCap, Briefcase, Award, Presentation, ChevronRight
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { jsPDF } from 'jspdf'
import { applyPlugin } from 'jspdf-autotable'
applyPlugin(jsPDF)
import toast from 'react-hot-toast'

const STATUS_CONFIG: Record<string, { label: string; badgeCls: string }> = {
  em_andamento: { label: 'Em Andamento', badgeCls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  concluido: { label: 'Concluído', badgeCls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  planejamento: { label: 'Em Planejamento', badgeCls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  suspenso: { label: 'Suspenso', badgeCls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
}

const AREAS_SUGERIDAS = [
  'Engenharia Mecânica / Mecatrônica',
  'Engenharia Elétrica / Eletrônica',
  'Design de Produto / Arquitetura',
  'Saúde / Medicina / Odontologia',
  'Ciência da Computação / Robótica',
  'Agronomia / Agropecuária',
  'Biotecnologia / Química',
  'Artes Visuais / Cenografia',
  'Outra',
]

export default function Projetos() {
  const { user } = useAuth()
  const { data: projetos, isLoading } = useProjetos()
  const { data: equipamentos } = useEquipamentos()

  const createProjeto = useCreateProjeto()
  const updateProjeto = useUpdateProjeto()
  const deleteProjeto = useDeleteProjeto()

  const { uploadMultiple: uploadObjeto } = useStorage('evidencias')
  const { uploadMultiple: uploadApresentacao } = useStorage('evidencias')

  // Filtros
  const [search, setSearch] = useState('')
  const [filterParticipante, setFilterParticipante] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [filterRecurso, setFilterRecurso] = useState('')
  const [filterDivulgacao, setFilterDivulgacao] = useState<'todos' | 'autorizado' | 'nao_autorizado'>('todos')

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Projeto | null>(null)
  const [detailItem, setDetailItem] = useState<Projeto | null>(null)
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Formulário State
  const [titulo, setTitulo] = useState('')
  const [numeroSei, setNumeroSei] = useState('')
  const [interessado, setInteressado] = useState('')
  const [orientador, setOrientador] = useState('')
  const [areaAtuacao, setAreaAtuacao] = useState(AREAS_SUGERIDAS[0])
  const [customArea, setCustomArea] = useState('')
  const [status, setStatus] = useState<'em_andamento' | 'concluido' | 'planejamento' | 'suspenso'>('em_andamento')
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dataTermino, setDataTermino] = useState('')
  const [duracaoHoras, setDuracaoHoras] = useState<number>(10)
  const [duracaoDias, setDuracaoDias] = useState<number>(1)
  const [descricao, setDescricao] = useState('')
  const [autorizaDivulgacao, setAutorizaDivulgacao] = useState(true)

  // Participantes IPElab (Tags)
  const [participantesList, setParticipantesList] = useState<string[]>([])
  const [novoParticipante, setNovoParticipante] = useState('')

  // Recursos IPElab selecionados
  const [recursosSelecionados, setRecursosSelecionados] = useState<string[]>([])

  // Mídias do Objeto
  const [fotosObjetoFiles, setFotosObjetoFiles] = useState<File[]>([])
  const [fotosObjetoPreviews, setFotosObjetoPreviews] = useState<string[]>([])

  // Mídias da Apresentação
  const [fotosApresentacaoFiles, setFotosApresentacaoFiles] = useState<File[]>([])
  const [fotosApresentacaoPreviews, setFotosApresentacaoPreviews] = useState<string[]>([])

  // Extrair lista única de participantes IPElab para o filtro
  const todosParticipantesUnicos = useMemo(() => {
    if (!projetos) return []
    const set = new Set<string>()
    projetos.forEach(p => {
      (p.participantes || []).forEach(part => {
        if (part && part.trim()) set.add(part.trim())
      })
    })
    return Array.from(set).sort()
  }, [projetos])

  // Filtragem dos Projetos
  const filteredProjetos = useMemo(() => {
    if (!projetos) return []
    return projetos.filter(p => {
      const searchLower = search.toLowerCase()
      const matchSearch =
        !search ||
        p.titulo.toLowerCase().includes(searchLower) ||
        (p.numero_sei && p.numero_sei.toLowerCase().includes(searchLower)) ||
        p.interessado.toLowerCase().includes(searchLower) ||
        (p.orientador && p.orientador.toLowerCase().includes(searchLower)) ||
        (p.descricao && p.descricao.toLowerCase().includes(searchLower)) ||
        p.area_atuacao.toLowerCase().includes(searchLower)

      const matchParticipante =
        !filterParticipante ||
        (p.participantes || []).some(part => part.toLowerCase().includes(filterParticipante.toLowerCase()))

      const matchStatus = !filterStatus || p.status === filterStatus
      const matchArea = !filterArea || p.area_atuacao === filterArea
      const matchRecurso =
        !filterRecurso ||
        (p.recursos_utilizados || []).some(r => r.toLowerCase().includes(filterRecurso.toLowerCase()))

      const matchDivulgacao =
        filterDivulgacao === 'todos' ||
        (filterDivulgacao === 'autorizado' && p.autoriza_divulgacao) ||
        (filterDivulgacao === 'nao_autorizado' && !p.autoriza_divulgacao)

      return matchSearch && matchParticipante && matchStatus && matchArea && matchRecurso && matchDivulgacao
    })
  }, [projetos, search, filterParticipante, filterStatus, filterArea, filterRecurso, filterDivulgacao])

  // KPIs
  const totalProjetos = projetos?.length || 0
  const concluidosCount = projetos?.filter(p => p.status === 'concluido').length || 0
  const andamentoCount = projetos?.filter(p => p.status === 'em_andamento').length || 0
  const totalHorasLaboratorio = useMemo(() => {
    return (projetos || []).reduce((acc, p) => acc + (Number(p.duracao_horas) || 0), 0)
  }, [projetos])
  const divulgacaoAutorizadaCount = projetos?.filter(p => p.autoriza_divulgacao).length || 0

  // Cálculo exato de dias entre duas datas (sem o +1 que inflava os dias)
  const calculateDays = (dInicio: string, dTermino: string) => {
    if (!dInicio || !dTermino) return 0
    const [y1, m1, day1] = dInicio.split('-').map(Number)
    const [y2, m2, day2] = dTermino.split('-').map(Number)
    const date1 = new Date(y1, m1 - 1, day1)
    const date2 = new Date(y2, m2 - 1, day2)
    const diffTime = date2.getTime() - date1.getTime()
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24))
    return diffDays >= 0 ? diffDays : 0
  }

  // Estado para alternar se a medição é em Horas ou em Dias
  const [tipoMedicao, setTipoMedicao] = useState<'horas' | 'dias'>('horas')

  // Helper para formatar a duração de forma limpa (Horas OU Dias)
  const formatarDuracao = (p: { duracao_horas?: number; duracao_dias?: number; data_inicio?: string; data_termino?: string | null }) => {
    const horas = Number(p.duracao_horas) || 0
    const dias = Number(p.duracao_dias) || 0

    if (horas > 0) {
      return `${horas} hora${horas > 1 ? 's' : ''}`
    }
    if (dias > 0) {
      return `${dias} dia${dias > 1 ? 's' : ''}`
    }
    if (p.data_inicio && p.data_termino) {
      const calc = calculateDays(p.data_inicio, p.data_termino)
      return calc > 0 ? `${calc} dias` : '1 dia'
    }
    return '1 dia'
  }

  // Cálculo automático de dias ao alterar datas
  const handleDataChange = (inicio: string, termino: string) => {
    setDataInicio(inicio)
    setDataTermino(termino)
    if (inicio && termino) {
      const diff = calculateDays(inicio, termino)
      setDuracaoDias(diff)
    }
  }

  const handleAddParticipante = () => {
    if (!novoParticipante.trim()) return
    if (!participantesList.includes(novoParticipante.trim())) {
      setParticipantesList(prev => [...prev, novoParticipante.trim()])
    }
    setNovoParticipante('')
  }

  const handleRemoveParticipante = (nome: string) => {
    setParticipantesList(prev => prev.filter(p => p !== nome))
  }

  const toggleRecurso = (recursoNome: string) => {
    setRecursosSelecionados(prev =>
      prev.includes(recursoNome) ? prev.filter(r => r !== recursoNome) : [...prev, recursoNome]
    )
  }

  const openNewModal = () => {
    setEditItem(null)
    setTitulo('')
    setNumeroSei('')
    setInteressado('')
    setOrientador('')
    setAreaAtuacao(AREAS_SUGERIDAS[0])
    setCustomArea('')
    setStatus('em_andamento')
    setDataInicio(format(new Date(), 'yyyy-MM-dd'))
    setDataTermino('')
    setTipoMedicao('horas')
    setDuracaoHoras(10)
    setDuracaoDias(0)
    setDescricao('')
    setAutorizaDivulgacao(true)
    setParticipantesList([])
    setNovoParticipante('')
    setRecursosSelecionados([])
    setFotosObjetoFiles([])
    setFotosObjetoPreviews([])
    setFotosApresentacaoFiles([])
    setFotosApresentacaoPreviews([])
    setIsModalOpen(true)
  }

  const openEditModal = (p: Projeto) => {
    setEditItem(p)
    setTitulo(p.titulo)
    setNumeroSei(p.numero_sei || '')
    setInteressado(p.interessado)
    setOrientador(p.orientador || '')
    if (AREAS_SUGERIDAS.includes(p.area_atuacao)) {
      setAreaAtuacao(p.area_atuacao)
      setCustomArea('')
    } else {
      setAreaAtuacao('Outra')
      setCustomArea(p.area_atuacao)
    }
    setStatus(p.status)
    setDataInicio(p.data_inicio)
    setDataTermino(p.data_termino || '')
    
    // Identifica se a duração original era medida em Horas ou em Dias
    const hasHoras = Number(p.duracao_horas) > 0
    setTipoMedicao(hasHoras ? 'horas' : 'dias')
    setDuracaoHoras(p.duracao_horas || 0)
    setDuracaoDias(p.duracao_dias || 0)

    setDescricao(p.descricao || '')
    setAutorizaDivulgacao(p.autoriza_divulgacao)
    setParticipantesList(p.participantes || [])
    setRecursosSelecionados(p.recursos_utilizados || [])
    setFotosObjetoFiles([])
    setFotosObjetoPreviews(p.fotos_objeto || [])
    setFotosApresentacaoFiles([])
    setFotosApresentacaoPreviews(p.fotos_apresentacao || [])
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim() || !interessado.trim()) {
      toast.error('Preencha o título do projeto e o nome do interessado.')
      return
    }

    setSubmitting(true)
    try {
      const finalArea = areaAtuacao === 'Outra' && customArea.trim() ? customArea.trim() : areaAtuacao

      // Upload de fotos novas do objeto
      let finalFotosObjeto = [...fotosObjetoPreviews.filter(p => !p.startsWith('blob:'))]
      if (fotosObjetoFiles.length > 0) {
        const uploadedUrls = await uploadObjeto(fotosObjetoFiles, 'projetos_objeto')
        finalFotosObjeto = [...finalFotosObjeto, ...uploadedUrls]
      }

      // Upload de fotos novas da apresentação
      let finalFotosApresentacao = [...fotosApresentacaoPreviews.filter(p => !p.startsWith('blob:'))]
      if (fotosApresentacaoFiles.length > 0) {
        const uploadedUrls = await uploadApresentacao(fotosApresentacaoFiles, 'projetos_apresentacao')
        finalFotosApresentacao = [...finalFotosApresentacao, ...uploadedUrls]
      }

      // Se for Horas, salva apenas Horas (dias = 0). Se for Dias, calcula/salva apenas Dias (horas = 0).
      const finalHoras = tipoMedicao === 'horas' ? Number(duracaoHoras) || 0 : 0
      const finalDias = tipoMedicao === 'dias' 
        ? (Number(duracaoDias) || (dataInicio && dataTermino ? calculateDays(dataInicio, dataTermino) : 1)) 
        : 0

      const payload = {
        titulo: titulo.trim(),
        numero_sei: numeroSei.trim() || null,
        interessado: interessado.trim(),
        orientador: orientador.trim() || null,
        participantes: participantesList,
        area_atuacao: finalArea,
        status,
        data_inicio: dataInicio,
        data_termino: dataTermino || null,
        duracao_horas: finalHoras,
        duracao_dias: finalDias,
        recursos_utilizados: recursosSelecionados,
        descricao: descricao.trim() || null,
        autoriza_divulgacao: autorizaDivulgacao,
        fotos_objeto: finalFotosObjeto,
        fotos_apresentacao: finalFotosApresentacao,
        user_id: user!.id,
      }

      if (editItem) {
        await updateProjeto.mutateAsync({ id: editItem.id, ...payload })
      } else {
        await createProjeto.mutateAsync(payload)
      }

      setIsModalOpen(false)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar projeto.')
    } finally {
      setSubmitting(false)
    }
  }

  // Gerador de Relatório PDF Consolidado
  const handleExportPdf = (participanteFoco?: string) => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' })
      const listToExport = participanteFoco
        ? (projetos || []).filter(p => (p.participantes || []).includes(participanteFoco))
        : filteredProjetos

      if (listToExport.length === 0) {
        toast.error('Nenhum projeto selecionado para exportação.')
        return
      }

      // Cabeçalho institucional
      doc.setFillColor(17, 24, 39)
      doc.rect(0, 0, 297, 25, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('IPElab - Laboratório Maker de Inovação Aberta', 14, 12)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('Relatório Oficial de Participação em Projetos de Pesquisa, Extensão e Prototipagem', 14, 19)

      // Data de emissão e filtro
      doc.setTextColor(100, 116, 139)
      doc.text(`Emitido em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 220, 12)
      if (participanteFoco) {
        doc.text(`Foco Participante: ${participanteFoco}`, 220, 19)
      }

      // Tabela de Dados
      const tableData = listToExport.map(p => [
        p.titulo,
        p.numero_sei || 'N/A',
        `${p.interessado}\n(Orientador: ${p.orientador || 'N/A'})`,
        (p.participantes || []).join(', ') || 'N/A',
        p.area_atuacao,
        (p.recursos_utilizados || []).join(', ') || 'N/A',
        formatarDuracao(p),
        p.status === 'concluido' ? 'Concluído' : 'Em Andamento',
        p.autoriza_divulgacao ? 'Sim' : 'Não'
      ])

      ;(doc as any).autoTable({
        startY: 32,
        head: [['Projeto', 'SEI', 'Interessado / Orientador', 'Equipe IPElab', 'Área', 'Recursos IPElab', 'Duração', 'Status', 'Divulgar?']],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 3, textColor: [30, 41, 59] },
        headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 20 },
          2: { cellWidth: 40 },
          3: { cellWidth: 35 },
          4: { cellWidth: 25 },
          5: { cellWidth: 45 },
          6: { cellWidth: 18 },
          7: { cellWidth: 20 },
          8: { cellWidth: 15 },
        },
      })

      const totalHoras = listToExport.reduce((acc, cur) => acc + (Number(cur.duracao_horas) || 0), 0)
      const finalY = (doc as any).lastAutoTable.finalY + 10
      doc.setFontSize(9)
      doc.setTextColor(51, 65, 85)
      doc.setFont('helvetica', 'bold')
      doc.text(`Total de Projetos: ${listToExport.length}  |  Carga Horária Acumulada de Laboratório: ${totalHoras} Horas`, 14, finalY)

      const filename = participanteFoco
        ? `relatorio_projetos_ipelab_${participanteFoco.toLowerCase().replace(/\s+/g, '_')}.pdf`
        : `relatorio_projetos_ipelab_${format(new Date(), 'yyyy-MM-dd')}.pdf`

      doc.save(filename)
      toast.success('Relatório PDF gerado com sucesso!')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao gerar relatório PDF.')
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Sparkles size={12} className="mr-1" /> Portfólio & Extensão Maker
            </span>
            <span className="text-xs text-white/40 font-mono">Gestão de Demandas & Pesquisa</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Projetos IPElab
          </h1>
          <p className="text-sm text-white/50">
            Registro detalhado de projetos, protótipos confeccionados, participantes internos, processos SEI e relatórios.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleExportPdf(filterParticipante || undefined)}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-colors flex items-center gap-2 cursor-pointer"
            title="Exportar Relatório PDF consolidado"
          >
            <Download size={15} /> Exportar Relatório PDF
          </button>

          <button
            onClick={openNewModal}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} /> Novo Projeto
          </button>
        </div>
      </div>

      {/* ── KPI Cards Analíticos ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total */}
        <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl">
          <div className="flex items-center justify-between text-white/60 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Total de Projetos</span>
            <FolderGit2 size={16} className="text-orange-400" />
          </div>
          <span className="text-2xl font-black font-mono tracking-tight text-white">{totalProjetos}</span>
          <p className="text-[10px] text-white/40 mt-1">Registros no histórico</p>
        </div>

        {/* Concluídos */}
        <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl">
          <div className="flex items-center justify-between text-white/60 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Concluídos</span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <span className="text-2xl font-black font-mono tracking-tight text-emerald-400">{concluidosCount}</span>
          <p className="text-[10px] text-emerald-400/70 mt-1">Protótipos entregues</p>
        </div>

        {/* Em Andamento */}
        <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl">
          <div className="flex items-center justify-between text-white/60 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Em Execução</span>
            <Clock size={16} className="text-blue-400" />
          </div>
          <span className="text-2xl font-black font-mono tracking-tight text-blue-400">{andamentoCount}</span>
          <p className="text-[10px] text-blue-400/70 mt-1">Em fabricação no lab</p>
        </div>

        {/* Horas Dedicadas */}
        <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl">
          <div className="flex items-center justify-between text-white/60 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Horas de Lab</span>
            <Award size={16} className="text-purple-400" />
          </div>
          <span className="text-2xl font-black font-mono tracking-tight text-white">{totalHorasLaboratorio}h</span>
          <p className="text-[10px] text-white/40 mt-1">Tempo operacional total</p>
        </div>

        {/* Divulgação Autorizada */}
        <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl">
          <div className="flex items-center justify-between text-white/60 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Divulgação Liberada</span>
            <Eye size={16} className="text-emerald-400" />
          </div>
          <span className="text-2xl font-black font-mono tracking-tight text-emerald-400">{divulgacaoAutorizadaCount}</span>
          <p className="text-[10px] text-white/40 mt-1">Aptos para mídia social</p>
        </div>
      </div>

      {/* ── Banner de Destaque por Participante Selecionado ── */}
      {filterParticipante && (
        <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Foco no Participante: <span className="text-orange-400">{filterParticipante}</span>
              </h3>
              <p className="text-xs text-white/60">
                Exibindo {filteredProjetos.length} projeto(s) com atuação direta deste membro da equipe IPElab.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportPdf(filterParticipante)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={13} /> Relatório Deste Participante
            </button>
            <button
              onClick={() => setFilterParticipante('')}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              title="Remover filtro de participante"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Barra de Busca e Filtros Avançados ── */}
      <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Buscar por título, SEI, orientador, interessado..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-black/40 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 flex-wrap">
          {/* Filtro por Participante IPElab */}
          <select
            value={filterParticipante}
            onChange={e => setFilterParticipante(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg bg-black/40 border border-white/10 text-white/80 focus:outline-none focus:border-orange-500 max-w-[190px] truncate"
          >
            <option value="">Todos os Participantes</option>
            {todosParticipantesUnicos.map(nome => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>

          {/* Filtro por Status */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg bg-black/40 border border-white/10 text-white/80 focus:outline-none focus:border-orange-500"
          >
            <option value="">Todos Status</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="concluido">Concluído</option>
            <option value="planejamento">Em Planejamento</option>
            <option value="suspenso">Suspenso</option>
          </select>

          {/* Filtro por Autorização de Divulgação */}
          <select
            value={filterDivulgacao}
            onChange={e => setFilterDivulgacao(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-lg bg-black/40 border border-white/10 text-white/80 focus:outline-none focus:border-orange-500"
          >
            <option value="todos">Todas Divulgações</option>
            <option value="autorizado">Autorizada (Mídias)</option>
            <option value="nao_autorizado">Sigiloso / Interno</option>
          </select>

          {(search || filterParticipante || filterStatus || filterArea || filterRecurso || filterDivulgacao !== 'todos') && (
            <button
              onClick={() => {
                setSearch('')
                setFilterParticipante('')
                setFilterStatus('')
                setFilterArea('')
                setFilterRecurso('')
                setFilterDivulgacao('todos')
              }}
              className="p-2 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title="Limpar Filtros"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Lista de Cards de Projetos ── */}
      {filteredProjetos.length === 0 ? (
        <EmptyState
          icon={<FolderGit2 size={48} strokeWidth={1} />}
          title="Nenhum projeto encontrado"
          description={
            search || filterParticipante || filterStatus || filterDivulgacao !== 'todos'
              ? "Tente ajustar os termos de pesquisa ou filtros selecionados."
              : "Cadastre o primeiro projeto do IPElab para iniciar o banco de dados institucional."
          }
          action={
            <button onClick={openNewModal} className="btn-primary text-xs flex items-center gap-1.5 mt-2">
              <Plus size={14} /> Cadastrar Primeiro Projeto
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProjetos.map(proj => {
            const st = STATUS_CONFIG[proj.status] || STATUS_CONFIG.em_andamento
            const dataInicioFmt = format(new Date(proj.data_inicio), 'dd/MM/yyyy')
            const dataTerminoFmt = proj.data_termino ? format(new Date(proj.data_termino), 'dd/MM/yyyy') : 'Em andamento'
            const temFotosObjeto = (proj.fotos_objeto || []).length > 0
            const temFotosApresentacao = (proj.fotos_apresentacao || []).length > 0

            return (
              <div
                key={proj.id}
                className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-5 shadow-xl hover:border-white/20 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar do Card */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${st.badgeCls}`}>
                        {st.label}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-white/70 border border-white/10">
                        {proj.area_atuacao}
                      </span>
                      {proj.numero_sei && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          SEI: {proj.numero_sei}
                        </span>
                      )}
                    </div>

                    {/* Badge de Divulgação */}
                    {proj.autoriza_divulgacao ? (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0"
                        title="Divulgação de imagens do objeto autorizada"
                      >
                        <Eye size={12} /> Divulgação Liberada
                      </span>
                    ) : (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 shrink-0"
                        title="Divulgação restrita / Sigilo institucional"
                      >
                        <Lock size={12} /> Sigiloso / Interno
                      </span>
                    )}
                  </div>

                  {/* Título do Projeto */}
                  <h3 className="text-base font-bold text-white tracking-tight leading-snug mb-2">
                    {proj.titulo}
                  </h3>

                  {/* Resumo / Descrição */}
                  {proj.descricao && (
                    <p className="text-xs text-white/60 line-clamp-2 mb-3">
                      {proj.descricao}
                    </p>
                  )}

                  {/* Pessoas Envolvidas */}
                  <div className="space-y-1.5 text-xs py-2 border-y border-white/[0.06] mb-3">
                    <div className="flex items-center gap-1.5 text-white/80">
                      <span className="text-white/40 font-semibold w-24 shrink-0">Interessado:</span>
                      <strong className="text-white">{proj.interessado}</strong>
                    </div>
                    {proj.orientador && (
                      <div className="flex items-center gap-1.5 text-white/80">
                        <span className="text-white/40 font-semibold w-24 shrink-0">Orientador:</span>
                        <span>{proj.orientador}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-1.5 text-white/80">
                      <span className="text-white/40 font-semibold w-24 shrink-0 pt-0.5">Equipe IPElab:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(proj.participantes || []).length > 0 ? (
                          proj.participantes.map(part => (
                            <span
                              key={part}
                              onClick={() => setFilterParticipante(part)}
                              className="px-2 py-0.5 rounded text-[11px] bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/20 cursor-pointer transition-colors"
                              title={`Filtrar por ${part}`}
                            >
                              {part}
                            </span>
                          ))
                        ) : (
                          <span className="text-white/40 italic">Não informada</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recursos IPElab Utilizados */}
                  {(proj.recursos_utilizados || []).length > 0 && (
                    <div className="mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block mb-1.5">
                        Recursos & Máquinas Utilizadas:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {proj.recursos_utilizados.map(rec => (
                          <span
                            key={rec}
                            className="px-2 py-0.5 rounded text-[11px] bg-white/5 text-white/70 border border-white/10 flex items-center gap-1"
                          >
                            <Wrench size={11} className="text-orange-400" /> {rec}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prazos & Duração */}
                  <div className="flex items-center justify-between text-xs text-white/50 bg-black/20 px-3 py-2 rounded-lg border border-white/5 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-white/40" />
                      <span>{dataInicioFmt} → {dataTerminoFmt}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono">
                      {Number(proj.duracao_horas) > 0 ? (
                        <span className="text-orange-400 font-bold flex items-center gap-1">
                          <Clock size={12} /> {formatarDuracao(proj)}
                        </span>
                      ) : (
                        <span className="text-white/80 font-bold flex items-center gap-1">
                          <Calendar size={12} /> {formatarDuracao(proj)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mini Galeria de Mídias */}
                  {(temFotosObjeto || temFotosApresentacao) && (
                    <div className="flex items-center gap-3 pt-1">
                      {temFotosObjeto && (
                        <div>
                          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1">
                            Objeto ({proj.fotos_objeto.length})
                          </span>
                          <div className="flex items-center gap-1.5">
                            {proj.fotos_objeto.slice(0, 3).map((url, idx) => (
                              <div
                                key={idx}
                                onClick={() => setPreviewImage({ url, title: `Objeto: ${proj.titulo}` })}
                                className="w-12 h-12 rounded-lg overflow-hidden border border-white/15 cursor-pointer hover:border-orange-500 transition-colors group relative"
                              >
                                <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {temFotosApresentacao && (
                        <div>
                          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1">
                            Apresentação ({proj.fotos_apresentacao.length})
                          </span>
                          <div className="flex items-center gap-1.5">
                            {proj.fotos_apresentacao.slice(0, 3).map((url, idx) => (
                              <div
                                key={idx}
                                onClick={() => setPreviewImage({ url, title: `Apresentação: ${proj.titulo}` })}
                                className="w-12 h-12 rounded-lg overflow-hidden border border-white/15 cursor-pointer hover:border-orange-500 transition-colors group relative"
                              >
                                <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer do Card com Ações */}
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <button
                    onClick={() => setDetailItem(proj)}
                    className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    Ver Ficha Completa <ChevronRight size={14} />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(proj)}
                      className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Editar Projeto"
                    >
                      <Edit3 size={15} />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja excluir o projeto "${proj.titulo}"?`)) {
                          deleteProjeto.mutate(proj.id)
                        }
                      }}
                      className="p-1.5 rounded text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Excluir Projeto"
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

      {/* ── Modal de Cadastro e Edição ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editItem ? "Editar Projeto IPElab" : "Cadastrar Novo Projeto IPElab"}
        maxWidth="750px"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Título do Projeto */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Título do Projeto / Proposta *
            </label>
            <input
              type="text"
              placeholder="Ex: Prótese Biomecânica de Membro Superior com Sensores EMG"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-black/50 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-orange-500"
              required
            />
          </div>

          {/* Grid: Número SEI e Área de Atuação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Número do Projeto (SEI / Processo UFG)
              </label>
              <input
                type="text"
                placeholder="Ex: 23070.012345/2026-89"
                value={numeroSei}
                onChange={e => setNumeroSei(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Área de Atuação
              </label>
              <select
                value={areaAtuacao}
                onChange={e => setAreaAtuacao(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white focus:outline-none focus:border-orange-500"
              >
                {AREAS_SUGERIDAS.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {areaAtuacao === 'Outra' && (
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Especifique a Área de Atuação
              </label>
              <input
                type="text"
                placeholder="Digite a área do projeto..."
                value={customArea}
                onChange={e => setCustomArea(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          )}

          {/* Grid: Interessado e Orientador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Nome do Interessado (Demandante / Aluno / Empresa) *
              </label>
              <input
                type="text"
                placeholder="Ex: Carlos Eduardo de Oliveira"
                value={interessado}
                onChange={e => setInteressado(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Nome do Orientador (Professor / Coordenador)
              </label>
              <input
                type="text"
                placeholder="Ex: Prof. Dr. André Silva"
                value={orientador}
                onChange={e => setOrientador(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Participantes IPElab (Tags) */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Participantes IPElab (Membros da equipe interna / bolsistas)
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                placeholder="Digite o nome do participante e clique em Adicionar..."
                value={novoParticipante}
                onChange={e => setNovoParticipante(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddParticipante()
                  }
                }}
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={handleAddParticipante}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
              >
                Adicionar
              </button>
            </div>

            {participantesList.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap p-2.5 rounded-lg bg-black/30 border border-white/5">
                {participantesList.map(nome => (
                  <span
                    key={nome}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-orange-500/15 text-orange-300 border border-orange-500/30"
                  >
                    {nome}
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipante(nome)}
                      className="hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Grid de Datas, Duração e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Data de Início *
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => handleDataChange(e.target.value, dataTermino)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white focus:outline-none focus:border-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Data de Término
              </label>
              <input
                type="date"
                value={dataTermino}
                onChange={e => handleDataChange(dataInicio, e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5 flex items-center justify-between">
                <span>Duração</span>
                <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded border border-white/10 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setTipoMedicao('horas')
                      if (!duracaoHoras) setDuracaoHoras(10)
                    }}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      tipoMedicao === 'horas' ? 'bg-orange-500 text-white font-bold' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Horas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoMedicao('dias')
                      if (dataInicio && dataTermino) {
                        setDuracaoDias(calculateDays(dataInicio, dataTermino))
                      } else if (!duracaoDias) {
                        setDuracaoDias(1)
                      }
                    }}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      tipoMedicao === 'dias' ? 'bg-orange-500 text-white font-bold' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Dias
                  </button>
                </div>
              </label>

              {tipoMedicao === 'horas' ? (
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 10"
                    value={duracaoHoras || ''}
                    onChange={e => setDuracaoHoras(Number(e.target.value))}
                    className="w-full pl-3 pr-14 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white focus:outline-none focus:border-orange-500 font-mono"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-white/40 font-semibold pointer-events-none">
                    horas
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 31"
                    value={duracaoDias || ''}
                    onChange={e => setDuracaoDias(Number(e.target.value))}
                    className="w-full pl-3 pr-12 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white focus:outline-none focus:border-orange-500 font-mono"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-white/40 font-semibold pointer-events-none">
                    dias
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluído</option>
                <option value="planejamento">Em Planejamento</option>
                <option value="suspenso">Suspenso</option>
              </select>
            </div>
          </div>

          {/* Recursos / Equipamentos Utilizados do IPElab */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Recursos Utilizados dentro das opções do IPElab (Máquinas e Equipamentos)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-3 rounded-lg bg-black/30 border border-white/10 custom-scrollbar">
              {(equipamentos || []).map(eq => {
                const checked = recursosSelecionados.includes(eq.nome)
                return (
                  <label
                    key={eq.id}
                    className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer border transition-colors ${
                      checked
                        ? 'bg-orange-500/15 border-orange-500/40 text-white'
                        : 'bg-white/5 border-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRecurso(eq.nome)}
                      className="rounded accent-orange-500"
                    />
                    <span className="truncate">{eq.nome}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Descrição / Escopo */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Descrição / Resumo do Projeto
            </label>
            <textarea
              rows={2}
              placeholder="Objetivos do projeto, processos de fabricação empregados, materiais..."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-black/50 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-orange-500 custom-scrollbar"
            />
          </div>

          {/* ── Seção de Mídia e Sinalização de Divulgação ── */}
          <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-4">
            {/* Toggle de Autorização de Divulgação */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <input
                type="checkbox"
                id="autorizaDivulgacao"
                checked={autorizaDivulgacao}
                onChange={e => setAutorizaDivulgacao(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-orange-500 cursor-pointer"
              />
              <label htmlFor="autorizaDivulgacao" className="text-xs text-white/90 cursor-pointer">
                <strong className="text-orange-400 block mb-0.5">Autorização de Divulgação de Imagens do Objeto</strong>
                O demandante e orientador autorizam a divulgação de fotografias do protótipo/objeto físico em redes sociais, website institucional e relatórios públicos do IPElab.
              </label>
            </div>

            {/* Upload de Fotos do Objeto */}
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Fotos do Objeto / Protótipo Físico
              </label>
              <ImageUpload
                multiple
                previews={fotosObjetoPreviews}
                onUpload={files => {
                  setFotosObjetoFiles(prev => [...prev, ...files])
                  const previews = files.map(f => URL.createObjectURL(f))
                  setFotosObjetoPreviews(prev => [...prev, ...previews])
                }}
                onRemovePreview={idx => {
                  setFotosObjetoFiles(prev => prev.filter((_, i) => i !== idx))
                  setFotosObjetoPreviews(prev => prev.filter((_, i) => i !== idx))
                }}
              />
            </div>

            {/* Upload de Fotos da Apresentação */}
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Fotos da Apresentação / Pôster / Defesa / Slides
              </label>
              <ImageUpload
                multiple
                previews={fotosApresentacaoPreviews}
                onUpload={files => {
                  setFotosApresentacaoFiles(prev => [...prev, ...files])
                  const previews = files.map(f => URL.createObjectURL(f))
                  setFotosApresentacaoPreviews(prev => [...prev, ...previews])
                }}
                onRemovePreview={idx => {
                  setFotosApresentacaoFiles(prev => prev.filter((_, i) => i !== idx))
                  setFotosApresentacaoPreviews(prev => prev.filter((_, i) => i !== idx))
                }}
              />
            </div>
          </div>

          {/* Botões do Formulário */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
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
              {submitting ? 'Salvando...' : editItem ? 'Salvar Alterações' : 'Cadastrar Projeto'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal de Ficha Detalhada do Projeto ── */}
      {detailItem && (
        <Modal
          open={!!detailItem}
          onClose={() => setDetailItem(null)}
          title="Ficha Oficial do Projeto"
          maxWidth="720px"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <span className="text-[11px] font-mono text-orange-400 font-bold block mb-1">
                  SEI: {detailItem.numero_sei || 'Sem processo vinculado'}
                </span>
                <h2 className="text-lg font-bold text-white leading-snug">
                  {detailItem.titulo}
                </h2>
                <span className="text-xs text-white/50">{detailItem.area_atuacao}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_CONFIG[detailItem.status]?.badgeCls}`}>
                  {STATUS_CONFIG[detailItem.status]?.label}
                </span>
                {detailItem.autoriza_divulgacao ? (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <Eye size={12} /> Divulgação Liberada
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                    <Lock size={12} /> Confidencial / Sigiloso
                  </span>
                )}
              </div>
            </div>

            {detailItem.descricao && (
              <div className="p-3 rounded-lg bg-black/30 border border-white/5 text-xs text-white/80 leading-relaxed">
                <span className="font-bold text-white/40 uppercase tracking-wider block mb-1">Resumo / Escopo:</span>
                {detailItem.descricao}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                <span className="font-bold text-white/40 uppercase tracking-wider block mb-1">Responsáveis</span>
                <p className="text-white/80"><strong>Interessado:</strong> {detailItem.interessado}</p>
                <p className="text-white/80"><strong>Orientador:</strong> {detailItem.orientador || 'Não informado'}</p>
              </div>

              <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                <span className="font-bold text-white/40 uppercase tracking-wider block mb-1">Prazos & Tempo</span>
                <p className="text-white/80">
                  <strong>Início:</strong> {format(new Date(detailItem.data_inicio), 'dd/MM/yyyy')}
                </p>
                <p className="text-white/80">
                  <strong>Término:</strong> {detailItem.data_termino ? format(new Date(detailItem.data_termino), 'dd/MM/yyyy') : 'Em andamento'}
                </p>
                <p className="text-orange-400 font-bold font-mono flex items-center gap-1.5">
                  {Number(detailItem.duracao_horas) > 0 ? <Clock size={14} /> : <Calendar size={14} />}
                  Duração: {formatarDuracao(detailItem)}
                </p>
              </div>
            </div>

            {/* Participantes IPElab */}
            <div className="p-3 rounded-lg bg-black/30 border border-white/5 text-xs">
              <span className="font-bold text-white/40 uppercase tracking-wider block mb-1.5">
                Equipe IPElab Envolvida:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(detailItem.participantes || []).length > 0 ? (
                  detailItem.participantes.map(p => (
                    <span key={p} className="px-2.5 py-1 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20 font-semibold">
                      {p}
                    </span>
                  ))
                ) : (
                  <span className="text-white/40">Nenhum participante listado.</span>
                )}
              </div>
            </div>

            {/* Recursos Utilizados */}
            <div className="p-3 rounded-lg bg-black/30 border border-white/5 text-xs">
              <span className="font-bold text-white/40 uppercase tracking-wider block mb-1.5">
                Recursos IPElab Utilizados:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(detailItem.recursos_utilizados || []).length > 0 ? (
                  detailItem.recursos_utilizados.map(r => (
                    <span key={r} className="px-2.5 py-1 rounded bg-white/5 text-white/80 border border-white/10 flex items-center gap-1">
                      <Wrench size={12} className="text-orange-400" /> {r}
                    </span>
                  ))
                ) : (
                  <span className="text-white/40">Nenhum recurso listado.</span>
                )}
              </div>
            </div>

            {/* Galerias de Fotos */}
            {(detailItem.fotos_objeto?.length > 0 || detailItem.fotos_apresentacao?.length > 0) && (
              <div className="space-y-3 pt-2">
                {detailItem.fotos_objeto?.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-2">
                      Fotos do Objeto / Protótipo
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {detailItem.fotos_objeto.map((url, i) => (
                        <div
                          key={i}
                          onClick={() => setPreviewImage({ url, title: `Objeto: ${detailItem.titulo}` })}
                          className="aspect-square rounded-lg overflow-hidden border border-white/10 cursor-pointer hover:border-orange-500 transition-colors group relative"
                        >
                          <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailItem.fotos_apresentacao?.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-2">
                      Fotos da Apresentação / Pôster / Defesa
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {detailItem.fotos_apresentacao.map((url, i) => (
                        <div
                          key={i}
                          onClick={() => setPreviewImage({ url, title: `Apresentação: ${detailItem.titulo}` })}
                          className="aspect-square rounded-lg overflow-hidden border border-white/10 cursor-pointer hover:border-orange-500 transition-colors group relative"
                        >
                          <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-white/10 flex items-center justify-end">
              <button
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Visualizador de Foto Expandida ── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] rounded-xl overflow-hidden border border-white/20 shadow-2xl bg-black/40">
            <div className="p-3 bg-black/70 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white truncate max-w-lg">{previewImage.title}</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded text-white/60 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <img src={previewImage.url} alt="" className="max-w-full max-h-[80vh] object-contain p-2" />
          </div>
        </div>
      )}
    </div>
  )
}
