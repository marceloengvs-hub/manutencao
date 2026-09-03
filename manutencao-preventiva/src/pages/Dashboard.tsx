import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useEquipamentos } from '../hooks/useEquipamentos'
import { useManutencoes, useAgenda } from '../hooks/useManutencoes'
import { calculateSchedule, type ScheduleItem } from '../utils/maintenance'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import MaintenanceDetails from '../components/MaintenanceDetails'
import {
  HardDrive, CheckCircle2, AlertTriangle, CalendarClock,
  TrendingUp, TrendingDown, Wrench, Shield, Zap, ExternalLink,
  BarChart3, Trophy, ArrowRight, PieChart as PieChartIcon,
  Activity, Layers, Calendar, ChevronRight, Gauge
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, startOfYear, endOfYear, subYears } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/* ────────────────── helpers ────────────────── */

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getFirstName(user: any): string {
  const meta = user?.user_metadata
  const full = meta?.full_name || meta?.name || user?.email || ''
  return full.split(' ')[0] || 'Técnico'
}

interface MonthChartPoint {
  month: string
  fullName: string
  total: number
  acumulado: number
  mom: number | null
}

const CATEGORY_COLORS = [
  '#F97316', // Laranja Maker
  '#10B981', // Verde Esmeralda
  '#3B82F6', // Azul Tecnológico
  '#8B5CF6', // Roxo Violeta
  '#EC4899', // Rosa
  '#06B6D4', // Ciano
  '#EAB308', // Dourado
]

/* ════════════════ DASHBOARD ════════════════ */

export default function Dashboard() {
  const { user } = useAuth()
  const { data: equipamentos } = useEquipamentos()
  const { data: manutencoes } = useManutencoes()
  const { data: agendaData } = useAgenda()

  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null)
  const [chartView, setChartView] = useState<'mensal' | 'acumulado'>('mensal')

  const detailItem = manutencoes?.find(m => m.id === selectedDetailId)

  const now = new Date()
  const monthStart = startOfMonth(now)
  const prevMonthStart = startOfMonth(subMonths(now, 1))
  const prevMonthEnd = endOfMonth(subMonths(now, 1))
  const yearStart = startOfYear(now)
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const allScheduled = useMemo(() => calculateSchedule(
    agendaData?.protocolos ?? [], agendaData?.equipamentos ?? [], manutencoes ?? [],
  ), [agendaData, manutencoes])

  /* ── 1. KPIs Estratégicos ── */
  const totalMaquinas = equipamentos?.length ?? 0
  const ativas = equipamentos?.filter(e => e.status === 'ativo').length ?? 0
  const taxaOperacional = totalMaquinas > 0 ? Math.round((ativas / totalMaquinas) * 100) : 100

  // Manutenções concluídas no mês corrente
  const concluidasMes = manutencoes?.filter(
    m => m.status === 'concluida' && new Date(m.completed_at ?? m.created_at) >= monthStart,
  ).length ?? 0

  // Manutenções concluídas no mês anterior (para cálculo de MoM)
  const concluidasMesAnterior = manutencoes?.filter(
    m => m.status === 'concluida' &&
      isWithinInterval(new Date(m.completed_at ?? m.created_at), { start: prevMonthStart, end: prevMonthEnd }),
  ).length ?? 0

  // Variação MoM (Month over Month)
  const momGrowth = useMemo(() => {
    if (concluidasMesAnterior === 0) {
      return concluidasMes > 0 ? 100 : 0
    }
    return Math.round(((concluidasMes - concluidasMesAnterior) / concluidasMesAnterior) * 100)
  }, [concluidasMes, concluidasMesAnterior])

  // Total de manutenções no ano corrente (2026)
  const totalAnoAtual = manutencoes?.filter(
    m => m.status === 'concluida' && new Date(m.completed_at ?? m.created_at) >= yearStart,
  ).length ?? 0

  // Total no ano anterior para YoY
  const prevYearStart = startOfYear(subYears(now, 1))
  const prevYearEnd = endOfYear(subYears(now, 1))
  const totalAnoAnterior = manutencoes?.filter(
    m => m.status === 'concluida' &&
      isWithinInterval(new Date(m.completed_at ?? m.created_at), { start: prevYearStart, end: prevYearEnd }),
  ).length ?? 0

  const yoyGrowth = useMemo(() => {
    if (totalAnoAnterior === 0) {
      return totalAnoAtual > 0 ? 100 : 0
    }
    return Math.round(((totalAnoAtual - totalAnoAnterior) / totalAnoAnterior) * 100)
  }, [totalAnoAtual, totalAnoAnterior])

  const atrasadas = allScheduled.filter(s => s.isLate).length
  const previstasSemana = allScheduled.filter(item => item.nextDate <= weekEnd || item.isLate).length

  // Taxa de Cumprimento / SLA Preventivo
  const complianceRate = useMemo(() => {
    const total = concluidasMes + atrasadas
    if (total === 0) return 100
    return Math.round((concluidasMes / total) * 100)
  }, [concluidasMes, atrasadas])

  /* ── 2. Dados Analíticos para o Gráfico de Linha (Últimos 6 meses) ── */
  const chartData = useMemo<MonthChartPoint[]>(() => {
    const points: MonthChartPoint[] = []
    let acum = 0

    for (let i = 5; i >= 0; i--) {
      const ref = subMonths(now, i)
      const ms = startOfMonth(ref)
      const me = endOfMonth(ref)
      const prevRefStart = startOfMonth(subMonths(ref, 1))
      const prevRefEnd = endOfMonth(subMonths(ref, 1))

      const count = manutencoes?.filter(m =>
        m.status === 'concluida' &&
        isWithinInterval(new Date(m.completed_at ?? m.created_at), { start: ms, end: me }),
      ).length ?? 0

      const prevCount = manutencoes?.filter(m =>
        m.status === 'concluida' &&
        isWithinInterval(new Date(m.completed_at ?? m.created_at), { start: prevRefStart, end: prevRefEnd }),
      ).length ?? 0

      acum += count

      let momCalc: number | null = null
      if (prevCount > 0) {
        momCalc = Math.round(((count - prevCount) / prevCount) * 100)
      } else if (count > 0) {
        momCalc = 100
      }

      points.push({
        month: format(ref, 'MMM', { locale: ptBR }),
        fullName: format(ref, 'MMMM / yyyy', { locale: ptBR }),
        total: count,
        acumulado: acum,
        mom: momCalc,
      })
    }
    return points
  }, [manutencoes])

  /* ── 3. Distribuição por Categoria ── */
  const categoryData = useMemo(() => {
    if (!equipamentos || !manutencoes) return []
    const catMap: Record<string, number> = {}

    // Cria mapa de equipamento -> categoria
    const eqToCat: Record<string, string> = {}
    for (const eq of equipamentos) {
      const cName = (eq as any).categorias?.nome || 'Outros'
      eqToCat[eq.id] = cName
    }

    for (const m of manutencoes) {
      if (m.status === 'concluida') {
        const cat = eqToCat[m.equipamento_id] || 'Outros'
        catMap[cat] = (catMap[cat] || 0) + 1
      }
    }

    return Object.entries(catMap)
      .map(([name, value], idx) => ({
        name,
        value,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
  }, [equipamentos, manutencoes])

  const totalManutencoesGeral = useMemo(() => {
    return categoryData.reduce((acc, cur) => acc + cur.value, 0)
  }, [categoryData])

  /* ── 4. Ranking Top 5 Equipamentos ── */
  const equipRanking = useMemo(() => {
    if (!equipamentos || !manutencoes) return []
    const counts: Record<string, { nome: string; categoria: string; count: number }> = {}
    for (const eq of equipamentos) {
      counts[eq.id] = {
        nome: eq.nome,
        categoria: (eq as any).categorias?.nome || 'Geral',
        count: 0
      }
    }
    for (const m of manutencoes) {
      if (m.status === 'concluida' && counts[m.equipamento_id]) {
        counts[m.equipamento_id].count++
      }
    }
    return Object.entries(counts)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [equipamentos, manutencoes])

  const maxRankCount = Math.max(...equipRanking.map(e => e.count), 1)

  /* ── 5. Próxima Manutenção Prioritária ── */
  const urgentTask: ScheduleItem | null = useMemo(() => {
    const late = allScheduled.filter(s => s.isLate)
    if (late.length) return late[0]
    const today = allScheduled.filter(s => s.isTodayItem)
    if (today.length) return today[0]
    return allScheduled[0] ?? null
  }, [allScheduled])

  /* ── 6. Atividades Recentes ── */
  const recentMaintenance = manutencoes?.slice(0, 6) ?? []

  const statusMap: Record<string, { label: string; cls: string }> = {
    concluida: { label: 'Concluída', cls: 'badge-ok' },
    em_andamento: { label: 'Em Andamento', cls: 'badge-accent' },
    pendente: { label: 'Pendente', cls: 'badge-warn' },
    cancelada: { label: 'Cancelada', cls: 'badge-danger' },
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header / Saudação ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity size={12} className="mr-1 animate-pulse" /> Sistema Operacional
            </span>
            <span className="text-xs text-white/40 font-mono">IPElab Maker v2.4</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            {getGreeting()}, {getFirstName(user)}! 👋
          </h1>
          <p className="text-sm text-white/50 capitalize">
            {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            {' — '}Painel de Inteligência e Manutenção Preventiva.
          </p>
        </div>

        {/* Botões de Ação Rápida no Topo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/agenda"
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-all flex items-center gap-1.5"
          >
            <Calendar size={14} /> Ver Agenda
          </Link>
          <Link
            to="/executar"
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/20 transition-all flex items-center gap-1.5"
          >
            <Wrench size={14} /> Nova Execução
          </Link>
        </div>
      </div>

      {/* ── Cards de Métricas Analíticas com MoM e YoY ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Execuções no Mês + MoM */}
        <div className="relative overflow-hidden rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-5 shadow-xl hover:border-orange-500/30 transition-all group">
          <div className="flex items-center justify-between text-white/60 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Concluídas (Mês)</span>
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono tracking-tight text-white">{concluidasMes}</span>
            <div className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${momGrowth >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              {momGrowth >= 0 ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
              {momGrowth >= 0 ? `+${momGrowth}%` : `${momGrowth}%`} MoM
            </div>
          </div>
          <p className="text-[11px] text-white/40 mt-2 flex items-center justify-between">
            <span>vs. mês anterior ({concluidasMesAnterior} un.)</span>
            <span className="text-orange-400/80 font-medium">Ciclo Atual</span>
          </p>
        </div>

        {/* Card 2: Acumulado Anual + YoY */}
        <div className="relative overflow-hidden rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-5 shadow-xl hover:border-blue-500/30 transition-all group">
          <div className="flex items-center justify-between text-white/60 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Acumulado {now.getFullYear()}</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <BarChart3 size={18} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono tracking-tight text-white">{totalAnoAtual}</span>
            <div className="flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <TrendingUp size={12} className="mr-1" />
              {yoyGrowth >= 0 ? `+${yoyGrowth}%` : `${yoyGrowth}%`} YoY
            </div>
          </div>
          <p className="text-[11px] text-white/40 mt-2 flex items-center justify-between">
            <span>Histórico consolidado</span>
            <span className="text-blue-400/80 font-medium">Meta Anual 100%</span>
          </p>
        </div>

        {/* Card 3: Taxa de Conformidade / SLA */}
        <div className="relative overflow-hidden rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-5 shadow-xl hover:border-emerald-500/30 transition-all group">
          <div className="flex items-center justify-between text-white/60 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Taxa de Conformidade</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Shield size={18} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono tracking-tight text-emerald-400">{complianceRate}%</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              SLA Operacional
            </span>
          </div>
          <div className="mt-2 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
              style={{ width: `${complianceRate}%` }}
            />
          </div>
          <p className="text-[11px] text-white/40 mt-2 flex items-center justify-between">
            <span>{atrasadas} ocorrência{atrasadas !== 1 ? 's' : ''} em atraso</span>
            <span className="text-emerald-400 font-medium">Excelente</span>
          </p>
        </div>

        {/* Card 4: Saúde da Frota / Disponibilidade */}
        <div className="relative overflow-hidden rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-5 shadow-xl hover:border-purple-500/30 transition-all group">
          <div className="flex items-center justify-between text-white/60 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Frota do Lab</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <HardDrive size={18} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono tracking-tight text-white">{totalMaquinas}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              {taxaOperacional}% Ativo
            </span>
          </div>
          <p className="text-[11px] text-white/40 mt-2 flex items-center justify-between">
            <span>{ativas} máquinas em operação</span>
            <span className="text-purple-400/80 font-medium">{previstasSemana} prev. semana</span>
          </p>
        </div>
      </div>

      {/* ── Banner de Próxima Manutenção / Foco Rápido ── */}
      {urgentTask && (
        <div
          className={`relative overflow-hidden rounded-xl border p-4 sm:p-5 transition-all shadow-lg ${
            urgentTask.isLate
              ? 'bg-rose-950/20 border-rose-500/30'
              : urgentTask.isTodayItem
              ? 'bg-amber-950/20 border-amber-500/30'
              : 'bg-[#131b2e]/60 border-blue-500/20'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  urgentTask.isLate
                    ? 'bg-rose-500/20 text-rose-400'
                    : urgentTask.isTodayItem
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}
              >
                <Zap size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-white/70">
                    {urgentTask.isLate ? '⚠ Manutenção Crítica / Atrasada' : urgentTask.isTodayItem ? '⚡ Próxima Execução — Hoje' : '📅 Próxima Manutenção Agendada'}
                  </span>
                  <span className="text-xs text-white/40 font-mono">
                    {format(urgentTask.nextDate, "dd/MM/yyyy")}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {urgentTask.titulo}
                </h3>
                <p className="text-xs text-white/60">
                  <span className="font-semibold text-white/80">{urgentTask.equipamentoNome}</span>
                  {' · '}Patrimônio: <span className="font-mono text-white/70">#{urgentTask.equipamentoPatrimonio}</span>
                  {' · '}Periodicidade: <span className="capitalize text-orange-400 font-medium">{urgentTask.periodicidade}</span>
                </p>
              </div>
            </div>

            <Link
              to={`/executar?equipamentoId=${urgentTask.equipamentoId}&titulo=${encodeURIComponent(urgentTask.titulo)}&protocoloId=${urgentTask.protocoloId}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25 transition-all shrink-0 self-start sm:self-center"
            >
              <Wrench size={14} /> Executar Agora
            </Link>
          </div>
        </div>
      )}

      {/* ── Grid Principal: Gráficos e Analytics Avançados ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 1. Gráfico de Linha / Área Interativo (2 Colunas) */}
        <div className="lg:col-span-2 rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-5 shadow-xl flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-orange-400" />
                <h2 className="text-base font-bold text-white">Histórico de Performance</h2>
              </div>
              <p className="text-xs text-white/40 mt-0.5">
                Evolução temporal do volume de ordens preventivas executadas no laboratório.
              </p>
            </div>

            {/* Alternador de Modo do Gráfico */}
            <div className="flex items-center p-0.5 bg-black/40 rounded-lg border border-white/10 self-start sm:self-auto">
              <button
                onClick={() => setChartView('mensal')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  chartView === 'mensal'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Volume Mensal
              </button>
              <button
                onClick={() => setChartView('acumulado')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  chartView === 'acumulado'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Acumulado
              </button>
            </div>
          </div>

          {/* Gráfico Recharts de Linha/Área */}
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#ffffff40"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#ffffff15' }}
                />
                <YAxis
                  stroke="#ffffff40"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as MonthChartPoint
                      return (
                        <div className="rounded-lg bg-[#0e1626]/95 backdrop-blur-md border border-white/15 p-3 shadow-2xl text-xs space-y-1">
                          <p className="font-bold text-white capitalize">{data.fullName}</p>
                          <div className="flex items-center gap-2 text-orange-400 font-mono">
                            <span>Manutenções:</span>
                            <span className="font-bold text-sm text-white">{data.total}</span>
                          </div>
                          <div className="flex items-center gap-2 text-white/50 font-mono">
                            <span>Acumulado:</span>
                            <span className="text-white">{data.acumulado}</span>
                          </div>
                          {data.mom !== null && (
                            <div className="pt-1 border-t border-white/10 flex items-center gap-1 font-semibold">
                              <span className="text-white/60">Variação MoM:</span>
                              <span className={data.mom >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {data.mom >= 0 ? `+${data.mom}%` : `${data.mom}%`}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={chartView === 'mensal' ? 'total' : 'acumulado'}
                  stroke={chartView === 'mensal' ? '#F97316' : '#3B82F6'}
                  strokeWidth={2.5}
                  fill={chartView === 'mensal' ? 'url(#colorVolume)' : 'url(#colorAcumulado)'}
                  activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-white/40">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Ordens Concluídas com Sucesso
            </span>
            <span>Total no período: <strong className="text-white font-mono">{totalManutencoesGeral}</strong></span>
          </div>
        </div>

        {/* 2. Distribuição por Categoria (Donut Chart) */}
        <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <PieChartIcon size={18} className="text-emerald-400" />
                <h2 className="text-base font-bold text-white">Por Categoria</h2>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white/5 text-white/60">
                {categoryData.length} Áreas
              </span>
            </div>
            <p className="text-xs text-white/40 mb-4">
              Participação no total de manutenções realizadas.
            </p>

            {/* Donut Recharts */}
            <div className="h-44 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#111827" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload
                        const pct = totalManutencoesGeral > 0 ? ((d.value / totalManutencoesGeral) * 100).toFixed(1) : 0
                        return (
                          <div className="rounded-lg bg-[#0e1626]/95 border border-white/15 p-2.5 shadow-xl text-xs">
                            <span className="font-bold text-white block">{d.name}</span>
                            <span className="text-white/70 font-mono">{d.value} manutenções ({pct}%)</span>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black font-mono text-white">{totalManutencoesGeral}</span>
                <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Total</span>
              </div>
            </div>
          </div>

          {/* Legenda Customizada das Categorias */}
          <div className="space-y-1.5 pt-3 border-t border-white/[0.06] max-h-36 overflow-y-auto custom-scrollbar pr-1">
            {categoryData.map(cat => {
              const pct = totalManutencoesGeral > 0 ? Math.round((cat.value / totalManutencoesGeral) * 100) : 0
              return (
                <div key={cat.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-white/70 truncate">{cat.name}</span>
                  </div>
                  <span className="text-white/40 font-mono shrink-0 ml-2">
                    {cat.value} <span className="text-white/25">({pct}%)</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Seção Inferior: Ranking e Feed de Atividades ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Top 5 Equipamentos Mais Atendidos */}
        <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-amber-400" />
              <h2 className="text-base font-bold text-white">Top Equipamentos em Preventivas</h2>
            </div>
            <Link to="/equipamentos" className="text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1 font-medium">
              Ver todos <ChevronRight size={14} />
            </Link>
          </div>

          {equipRanking.length === 0 ? (
            <p className="text-xs text-center py-8 text-white/40">Nenhum dado computado ainda.</p>
          ) : (
            <div className="space-y-3.5">
              {equipRanking.map((eq, i) => (
                <div key={eq.id} className="group">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${
                        i === 0 ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20' :
                        i === 1 ? 'bg-slate-300 text-black' :
                        i === 2 ? 'bg-amber-700 text-white' :
                        'bg-white/10 text-white/60'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="font-semibold text-white/90 truncate group-hover:text-orange-400 transition-colors">
                        {eq.nome}
                      </span>
                      <span className="text-[10px] text-white/40 hidden sm:inline">
                        • {eq.categoria}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-white shrink-0">
                      {eq.count} <span className="text-white/40 font-normal text-[11px]">manutenções</span>
                    </span>
                  </div>

                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        i === 0
                          ? 'bg-gradient-to-r from-orange-500 to-amber-400'
                          : 'bg-white/20 group-hover:bg-orange-500/70'
                      }`}
                      style={{ width: `${(eq.count / maxRankCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Feed de Atividades Recentes */}
        <div className="rounded-xl bg-[#111827]/80 backdrop-blur-md border border-white/[0.08] p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-blue-400" />
                <h2 className="text-base font-bold text-white">Atividades Recentes</h2>
              </div>
              <Link to="/historico" className="text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1 font-medium">
                Histórico completo <ArrowRight size={12} />
              </Link>
            </div>

            {recentMaintenance.length === 0 ? (
              <p className="text-xs text-center py-8 text-white/40">Nenhuma manutenção recente encontrada.</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {recentMaintenance.map(m => {
                  const st = statusMap[m.status] ?? { label: m.status, cls: 'badge-neutral' }
                  const isPreventiva = m.tipo === 'preventiva'
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedDetailId(m.id)}
                      className="w-full py-2.5 px-2 flex items-center gap-3 text-left hover:bg-white/[0.02] rounded-lg transition-colors group cursor-pointer"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isPreventiva ? 'bg-orange-500/10 text-orange-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {isPreventiva ? <Shield size={15} /> : <Wrench size={15} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate group-hover:text-orange-400 transition-colors">
                          {m.titulo}
                        </p>
                        <p className="text-[11px] text-white/40 truncate">
                          {m.equipamentos?.nome ?? 'Equipamento'}
                          {' · '}{new Date(m.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>

                      <span className={`badge ${st.cls} shrink-0 text-[10px]`}>{st.label}</span>
                      <ExternalLink size={13} className="text-white/20 group-hover:text-white/60 transition-colors shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal de Detalhes da Manutenção ── */}
      <Modal
        open={!!selectedDetailId}
        onClose={() => setSelectedDetailId(null)}
        title="Detalhes da Ordem de Manutenção"
        maxWidth="700px"
      >
        {detailItem && <MaintenanceDetails detailItem={detailItem} allManutencoes={manutencoes ?? []} />}
      </Modal>
    </div>
  )
}
