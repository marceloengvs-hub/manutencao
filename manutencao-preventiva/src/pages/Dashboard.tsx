import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useEquipamentos } from '../hooks/useEquipamentos'
import { useManutencoes, useAgenda, type ManutencaoWithRelations } from '../hooks/useManutencoes'
import { calculateSchedule, type ScheduleItem } from '../utils/maintenance'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import MaintenanceDetails from '../components/MaintenanceDetails'
import {
  HardDrive, CheckCircle2, AlertTriangle, CalendarClock,
  TrendingUp, Wrench, Shield, Zap, ExternalLink, Clock,
  BarChart3, Trophy, ArrowRight,
} from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
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

/* ────────── SVG Bar Chart (últimos 6 meses) ────────── */

interface MonthData { label: string; value: number }

function MiniBarChart({ data, maxH = 120 }: { data: MonthData[]; maxH?: number }) {
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const barW = 32
  const gap = 16
  const totalW = data.length * (barW + gap) - gap
  const padBottom = 24
  const chartH = maxH + padBottom

  return (
    <svg width="100%" viewBox={`0 0 ${totalW + 16} ${chartH}`} style={{ overflow: 'visible' }}>
      {data.map((d, i) => {
        const h = (d.value / maxVal) * maxH
        const x = i * (barW + gap) + 8
        const y = maxH - h
        return (
          <g key={i}>
            {/* Bar */}
            <rect
              x={x} y={y} width={barW} height={h}
              rx={2}
              fill={i === data.length - 1 ? '#F97316' : 'rgba(249,115,22,0.25)'}
              style={{ transition: 'all 0.5s ease' }}
            />
            {/* Value */}
            {d.value > 0 && (
              <text
                x={x + barW / 2} y={y - 6}
                textAnchor="middle" fontSize="11" fontWeight="600"
                fill="var(--color-text-heading)"
              >
                {d.value}
              </text>
            )}
            {/* Label */}
            <text
              x={x + barW / 2} y={maxH + 16}
              textAnchor="middle" fontSize="10" fontWeight="500"
              fill="var(--color-text-muted)"
              style={{ textTransform: 'capitalize' }}
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ────────── Donut Gauge ────────── */

function DonutGauge({ value, size = 100, stroke = 10 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(Math.max(value, 0), 100)
  const offset = circ - (pct / 100) * circ
  const color = pct >= 80 ? 'var(--color-status-ok)' : pct >= 50 ? 'var(--color-status-warn)' : 'var(--color-status-danger)'

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-elevated)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-heading)', fontFamily: 'var(--font-mono)' }}>
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  )
}

/* ────────── Equipment Bar Chart ────────── */

function EquipmentBarChart({ data, maxH = 140 }: { data: { label: string; value: number }[]; maxH?: number }) {
  const maxVal = Math.max(...data.map(d => d.value), 1)

  return (
    <div style={{ maxHeight: maxH, width: '100%', overflowY: 'auto', paddingRight: 4 }} className="custom-scrollbar">
      <div className="flex flex-col gap-3">
        {data.map((d, i) => (
          <div key={i} className="flex flex-col group">
            <div className="flex justify-between items-end mb-1">
              <span className="text-xs font-medium truncate pr-2 group-hover:text-[var(--color-text-heading)] transition-colors" style={{ color: 'var(--color-text-secondary)' }} title={d.label}>
                {d.label}
              </span>
              <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-muted)' }}>
                {d.value}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-sm overflow-hidden" style={{ background: 'var(--color-surface-elevated)' }}>
              <div
                className="h-full rounded-sm group-hover:bg-[var(--color-accent)] transition-colors duration-300"
                style={{
                  width: `${(d.value / maxVal) * 100}%`,
                  background: 'rgba(249,115,22,0.6)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ════════════════ DASHBOARD ════════════════ */

export default function Dashboard() {
  const { user } = useAuth()
  const { data: equipamentos } = useEquipamentos()
  const { data: manutencoes } = useManutencoes()
  const { data: agendaData } = useAgenda()

  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null)
  const detailItem = manutencoes?.find(m => m.id === selectedDetailId)

  const now = new Date()
  const monthStart = startOfMonth(now)
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const allScheduled = useMemo(() => calculateSchedule(
    agendaData?.protocolos ?? [], agendaData?.equipamentos ?? [], manutencoes ?? [],
  ), [agendaData, manutencoes])

  /* ── KPIs ── */
  const totalMaquinas = equipamentos?.length ?? 0
  const ativas = equipamentos?.filter(e => e.status === 'ativo').length ?? 0
  const concluidas = manutencoes?.filter(
    m => m.status === 'concluida' && new Date(m.completed_at ?? m.created_at) >= monthStart,
  ).length ?? 0
  const atrasadas = allScheduled.filter(s => s.isLate).length
  const previstas = allScheduled.filter(item => item.nextDate <= weekEnd || item.isLate).length

  /* ── Monthly chart (últimos 6 meses) ── */
  const monthlyData = useMemo<MonthData[]>(() => {
    const months: MonthData[] = []
    for (let i = 5; i >= 0; i--) {
      const ref = subMonths(now, i)
      const ms = startOfMonth(ref)
      const me = endOfMonth(ref)
      const count = manutencoes?.filter(m =>
        m.status === 'concluida' &&
        isWithinInterval(new Date(m.completed_at ?? m.created_at), { start: ms, end: me }),
      ).length ?? 0
      months.push({ label: format(ref, 'MMM', { locale: ptBR }), value: count })
    }
    return months
  }, [manutencoes])

  /* ── Taxa de cumprimento ── */
  const complianceRate = useMemo(() => {
    const total = (manutencoes?.filter(m =>
      new Date(m.completed_at ?? m.created_at) >= monthStart,
    ).length ?? 0) + atrasadas
    if (total === 0) return 100
    return Math.round((concluidas / total) * 100)
  }, [manutencoes, concluidas, atrasadas])

  /* ── Distribuição por Equipamento ── */
  const equipDistribution = useMemo(() => {
    if (!equipamentos || !manutencoes) return []
    const counts: Record<string, { nome: string; count: number }> = {}
    for (const eq of equipamentos) counts[eq.id] = { nome: eq.nome, count: 0 }
    for (const m of manutencoes) {
      if (m.status === 'concluida' && counts[m.equipamento_id]) {
        counts[m.equipamento_id].count++
      }
    }
    return Object.entries(counts)
      .map(([id, v]) => ({ label: v.nome, value: v.count }))
      .sort((a, b) => b.value - a.value)
  }, [equipamentos, manutencoes])

  /* ── Ranking de equipamentos ── */
  const equipRanking = useMemo(() => {
    if (!equipamentos || !manutencoes) return []
    const counts: Record<string, { nome: string; count: number }> = {}
    for (const eq of equipamentos) counts[eq.id] = { nome: eq.nome, count: 0 }
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

  /* ── Próxima manutenção urgente ── */
  const urgentTask: ScheduleItem | null = useMemo(() => {
    const late = allScheduled.filter(s => s.isLate)
    if (late.length) return late[0]
    const today = allScheduled.filter(s => s.isTodayItem)
    if (today.length) return today[0]
    return allScheduled[0] ?? null
  }, [allScheduled])

  /* ── Atividade recente ── */
  const recentMaintenance = manutencoes?.slice(0, 8) ?? []

  const statusMap: Record<string, { label: string; cls: string }> = {
    concluida: { label: 'Concluída', cls: 'badge-ok' },
    em_andamento: { label: 'Em Andamento', cls: 'badge-accent' },
    pendente: { label: 'Pendente', cls: 'badge-warn' },
    cancelada: { label: 'Cancelada', cls: 'badge-danger' },
  }

  const kpis = [
    { label: 'Total de Máquinas', value: totalMaquinas, icon: HardDrive, badge: `${ativas} ativas`, badgeClass: 'badge-ok', path: '/equipamentos' },
    { label: 'Concluídas (Mês)', value: concluidas, icon: CheckCircle2, badge: 'No mês atual', badgeClass: 'badge-accent', path: '/historico' },
    { label: 'Atrasadas', value: atrasadas, icon: AlertTriangle, badge: atrasadas > 0 ? 'Requer atenção' : 'Tudo em dia', badgeClass: atrasadas > 0 ? 'badge-danger' : 'badge-ok', path: '/agenda' },
    { label: 'Previstas (Semana)', value: previstas, icon: CalendarClock, badge: 'Próx. 7 dias', badgeClass: 'badge-neutral', path: '/agenda' },
  ]

  return (
    <div>
      {/* ── 1. Saudação personalizada ── */}
      <div className="mb-8 animate-slide-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1" style={{ color: 'var(--color-text-heading)' }}>
          {getGreeting()}, {getFirstName(user)}! 👋
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          {' · '}Visão geral da saúde do laboratório.
        </p>
      </div>

      {/* ── 2. KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi, i) => (
          <Link key={kpi.label} to={kpi.path} className="block no-underline">
            <div className="kpi-card card-interactive h-full animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{kpi.label}</span>
                <kpi.icon size={18} style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <span className="text-3xl font-bold font-mono tabular-nums" style={{ color: 'var(--color-text-heading)' }}>{kpi.value}</span>
              <div className="mt-2"><span className={`badge ${kpi.badgeClass}`}>{kpi.badge}</span></div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── 3. Próxima Manutenção Urgente ── */}
      {urgentTask && (
        <div
          className="card mb-8 animate-fade-in"
          style={{
            borderLeft: `3px solid ${urgentTask.isLate ? 'var(--color-status-danger)' : urgentTask.isTodayItem ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
            background: urgentTask.isLate ? 'rgba(239,68,68,0.04)' : urgentTask.isTodayItem ? 'rgba(249,115,22,0.04)' : undefined,
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: urgentTask.isLate ? 'var(--color-status-danger-bg)' : 'var(--color-accent-muted)',
                  color: urgentTask.isLate ? 'var(--color-status-danger)' : 'var(--color-accent)',
                }}
              >
                <Zap size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    {urgentTask.isLate ? '⚠ Manutenção Atrasada' : urgentTask.isTodayItem ? '⚡ Próxima Manutenção — Hoje' : '📅 Próxima Manutenção'}
                  </span>
                </div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-heading)' }}>{urgentTask.titulo}</h3>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {urgentTask.equipamentoNome}
                  <span className="text-xs font-mono ml-1" style={{ color: 'var(--color-text-muted)' }}>#{urgentTask.equipamentoPatrimonio}</span>
                  {' · '}{format(urgentTask.nextDate, "dd/MM/yyyy")}
                </p>
              </div>
            </div>
            <Link
              to={`/executar?equipamentoId=${urgentTask.equipamentoId}&titulo=${encodeURIComponent(urgentTask.titulo)}&protocoloId=${urgentTask.protocoloId}`}
              className="btn-primary whitespace-nowrap self-start sm:self-center"
            >
              <Wrench size={16} /> Executar Agora
            </Link>
          </div>
        </div>
      )}

      {/* ── 4. Gráfico + Distribuição + Taxa (grid) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">

        {/* 4a. Gráfico de Evolução Mensal */}
        <div className="card xl:col-span-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={18} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-heading)' }}>Evolução Mensal</h2>
            <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>Últimos 6 meses</span>
          </div>
          <div style={{ maxWidth: 400 }}>
            <MiniBarChart data={monthlyData} />
          </div>
        </div>

        {/* 4b. Distribuição por Equipamento */}
        <div className="card xl:col-span-1 animate-fade-in flex flex-col" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-2 mb-5">
            <HardDrive size={18} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-heading)' }}>Por Equipamento</h2>
            <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>Total</span>
          </div>
          <div className="flex-1 min-h-[140px]">
            <EquipmentBarChart data={equipDistribution} maxH={150} />
          </div>
        </div>

        {/* 4c. Taxa de Cumprimento */}
        <div className="card xl:col-span-1 flex flex-col items-center justify-center animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 mb-5 self-start w-full">
            <Shield size={18} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-heading)' }}>Taxa de Cumprimento</h2>
          </div>
          <DonutGauge value={complianceRate} size={130} stroke={12} />
          <p className="text-xs mt-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
            {concluidas} concluída{concluidas !== 1 ? 's' : ''} de {concluidas + atrasadas} prevista{concluidas + atrasadas !== 1 ? 's' : ''} no mês
          </p>
        </div>
      </div>

      {/* ── 5. Ranking + Atividade Recente ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* 5a. Ranking de Equipamentos */}
        <div className="card animate-fade-in" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center gap-2 mb-5">
            <Trophy size={18} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-heading)' }}>Ranking de Equipamentos</h2>
          </div>
          {equipRanking.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>Sem dados ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {equipRanking.map((eq, i) => (
                <div key={eq.id} className="flex items-center gap-3">
                  <span
                    className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      background: i === 0 ? 'var(--color-accent-muted)' : 'var(--color-surface-elevated)',
                      color: i === 0 ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-heading)' }}>{eq.nome}</p>
                    <div className="mt-1 w-full rounded-sm overflow-hidden" style={{ height: 4, background: 'var(--color-surface-elevated)' }}>
                      <div
                        style={{
                          width: `${(eq.count / maxRankCount) * 100}%`,
                          height: '100%',
                          background: i === 0 ? 'var(--color-accent)' : 'rgba(249,115,22,0.4)',
                          borderRadius: 1,
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-mono font-semibold tabular-nums shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                    {eq.count} {eq.count === 1 ? 'manutenção' : 'manutenções'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5b. Atividade Recente Melhorada */}
        <div className="card animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-heading)' }}>Atividade Recente</h2>
            <Link to="/historico" className="ml-auto text-xs flex items-center gap-1 transition-colors" style={{ color: 'var(--color-accent)' }}>
              Ver tudo <ArrowRight size={12} />
            </Link>
          </div>

          {recentMaintenance.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
              Nenhuma manutenção registrada ainda.
            </p>
          ) : (
            <div className="flex flex-col">
              {recentMaintenance.map(m => {
                const st = statusMap[m.status] ?? { label: m.status, cls: 'badge-neutral' }
                const isPreventiva = m.tipo === 'preventiva'
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedDetailId(m.id)}
                    className="flex items-center gap-3 py-2.5 px-3 w-full text-left transition-colors duration-100 group"
                    style={{ borderBottom: '1px solid var(--color-border-default)', background: 'transparent', border: 'none', borderBlockEnd: '1px solid var(--color-border-default)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Ícone tipo */}
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                      style={{
                        background: isPreventiva ? 'var(--color-accent-muted)' : 'var(--color-status-warn-bg)',
                        color: isPreventiva ? 'var(--color-accent)' : 'var(--color-status-warn)',
                      }}
                    >
                      {isPreventiva ? <Shield size={14} /> : <Wrench size={14} />}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block truncate" style={{ color: 'var(--color-text-heading)' }}>{m.titulo}</span>
                      <span className="text-xs block truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {m.equipamentos?.nome ?? '—'}
                        {' · '}{m.profiles?.nome?.split(' ')[0] ?? '—'}
                        {' · '}{new Date(m.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {/* Status + link */}
                    <span className={`badge ${st.cls} shrink-0`}>{st.label}</span>
                    <ExternalLink size={14} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Detalhes ── */}
      <Modal open={!!selectedDetailId} onClose={() => setSelectedDetailId(null)} title="Detalhes da Manutenção" maxWidth="700px">
        {detailItem && <MaintenanceDetails detailItem={detailItem} allManutencoes={manutencoes ?? []} />}
      </Modal>
    </div>
  )
}
