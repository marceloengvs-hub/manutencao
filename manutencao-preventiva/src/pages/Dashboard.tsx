import { Link } from 'react-router-dom'
import { useEquipamentos } from '../hooks/useEquipamentos'
import { useManutencoes, useAgenda } from '../hooks/useManutencoes'
import { calculateSchedule } from '../utils/maintenance'
import {
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  TrendingUp,
} from 'lucide-react'

export default function Dashboard() {
  const { data: equipamentos } = useEquipamentos()
  const { data: manutencoes } = useManutencoes()
  const { data: agendaData } = useAgenda()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const allScheduled = calculateSchedule(
    agendaData?.protocolos ?? [],
    agendaData?.equipamentos ?? [],
    manutencoes ?? []
  )

  const totalMaquinas = equipamentos?.length ?? 0
  const concluidas = manutencoes?.filter(
    m => m.status === 'concluida' && new Date(m.completed_at ?? m.created_at) >= monthStart
  ).length ?? 0
  const atrasadas = manutencoes?.filter(
    m => m.status === 'pendente' && new Date(m.created_at) < now
  ).length ?? 0
  
  const previstas = allScheduled.filter(
    item => item.nextDate <= weekEnd || item.isLate
  ).length

  const recentMaintenance = manutencoes?.slice(0, 6) ?? []

  const kpis = [
    {
      label: 'Total de Máquinas',
      value: totalMaquinas,
      icon: HardDrive,
      badge: `${equipamentos?.filter(e => e.status === 'ativo').length ?? 0} ativas`,
      badgeClass: 'badge-ok',
      path: '/equipamentos',
    },
    {
      label: 'Concluídas (Mês)',
      value: concluidas,
      icon: CheckCircle2,
      badge: 'No mês atual',
      badgeClass: 'badge-accent',
      path: '/historico',
    },
    {
      label: 'Atrasadas',
      value: atrasadas,
      icon: AlertTriangle,
      badge: atrasadas > 0 ? 'Requer atenção' : 'Tudo em dia',
      badgeClass: atrasadas > 0 ? 'badge-danger' : 'badge-ok',
      path: '/agenda',
    },
    {
      label: 'Previstas (Semana)',
      value: previstas,
      icon: CalendarClock,
      badge: 'Próx. 7 dias',
      badgeClass: 'badge-neutral',
      path: '/agenda',
    },
  ]

  const statusMap: Record<string, { label: string; cls: string }> = {
    concluida: { label: 'Concluída', cls: 'badge-ok' },
    em_andamento: { label: 'Em Andamento', cls: 'badge-accent' },
    pendente: { label: 'Pendente', cls: 'badge-warn' },
    cancelada: { label: 'Cancelada', cls: 'badge-danger' },
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--color-text-heading)' }}>
          Dashboard
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Visão geral da saúde do laboratório.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi, i) => {
          const Content = (
            <div className="kpi-card card-interactive h-full" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{kpi.label}</span>
                <kpi.icon size={18} style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <span className="text-3xl font-bold font-mono tabular-nums" style={{ color: 'var(--color-text-heading)' }}>{kpi.value}</span>
              <div className="mt-2">
                <span className={`badge ${kpi.badgeClass}`}>{kpi.badge}</span>
              </div>
            </div>
          )

          return (
            <Link key={kpi.label} to={kpi.path} className="block no-underline">
              {Content}
            </Link>
          )
        })}
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} style={{ color: 'var(--color-accent)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-heading)' }}>Atividade Recente</h2>
        </div>

        {recentMaintenance.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
            Nenhuma manutenção registrada ainda.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentMaintenance.map(m => {
              const equipName = m.equipamentos?.nome ?? 'Equipamento'
              const st = statusMap[m.status] ?? { label: m.status, cls: 'badge-neutral' }

              return (
                <div key={m.id} className="flex items-center justify-between py-2.5 px-3 transition-colors duration-100" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-heading)' }}>{m.titulo}</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {equipName} • {new Date(m.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
