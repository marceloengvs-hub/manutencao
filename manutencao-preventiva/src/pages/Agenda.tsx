import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAgenda, useManutencoes } from '../hooks/useManutencoes'
import ProgressBar from '../components/ProgressBar'
import EmptyState from '../components/EmptyState'
import { CalendarClock, AlertTriangle, Clock } from 'lucide-react'
import { addDays, addWeeks, addMonths, isBefore, isToday, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ScheduleItem {
  protocoloId: string
  equipamentoId: string
  titulo: string
  equipamentoNome: string
  equipamentoPatrimonio: string
  categoria: string
  periodicidade: string
  nextDate: Date
  isLate: boolean
  isTodayItem: boolean
  taskCount: number
  completedTasks: number
}

function getNextDate(startDate: Date, periodicidade: string, now: Date, latestCompletedDate?: Date): Date {
  const addFn = periodicidade === 'diaria' ? addDays
    : periodicidade === 'semanal' ? addWeeks
    : addMonths

  // If a maintenance was already completed, the next one strictly follows
  // the exact completion date (e.g., if done on 30/03, next weekly is 06/04)
  if (latestCompletedDate) {
    return addFn(new Date(latestCompletedDate), 1)
  }

  // If never completed, the due date is strictly the start date
  return new Date(startDate)
}

export default function Agenda() {
  const { data: agendaData, isLoading } = useAgenda()
  const { data: manutencoes } = useManutencoes()

  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    if (!agendaData?.protocolos || !agendaData?.equipamentos) return []
    const now = new Date()
    const items: ScheduleItem[] = []

    for (const proto of agendaData.protocolos) {
      const startDate = new Date(proto.data_inicio + 'T00:00:00')
      const catName = proto.categorias?.nome ?? '—'
      const tasks = proto.tarefas_protocolo ?? []
      const taskCount = tasks.length
      
      const matchingEqs = agendaData.equipamentos.filter(
        eq => {
          if ((proto as any).equipamento_id) return eq.id === (proto as any).equipamento_id;
          if (proto.categoria_id) return eq.categoria_id === proto.categoria_id;
          return true; // Apply to all if both are null
        }
      )

      for (const eq of matchingEqs) {
        const related = manutencoes?.filter(
          m => m.protocolo_id === proto.id && m.equipamento_id === eq.id && m.status !== 'cancelada'
        ) ?? []
        
        const latestCompleted = related.find(m => m.status === 'concluida')
        const latestCompletedDate = latestCompleted?.completed_at ? new Date(latestCompleted.completed_at) : undefined

        const nextDate = getNextDate(startDate, proto.periodicidade, now, latestCompletedDate)
        const latestOpen = related.find(m => m.status === 'pendente' || m.status === 'em_andamento')
        const completedTasks = latestOpen ? Object.values(latestOpen.checklist_json ?? {}).filter(Boolean).length : 0

        items.push({
          protocoloId: proto.id,
          equipamentoId: eq.id,
          titulo: proto.titulo,
          equipamentoNome: eq.nome,
          equipamentoPatrimonio: eq.patrimonio,
          categoria: catName,
          periodicidade: proto.periodicidade,
          nextDate,
          isLate: isBefore(nextDate, now) && !isToday(nextDate),
          isTodayItem: isToday(nextDate),
          taskCount,
          completedTasks,
        })
      }
    }
    
    return items.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
  }, [agendaData, manutencoes])

  const periLabel = (p: string) =>
    p === 'diaria' ? 'Diária' : p === 'semanal' ? 'Semanal' : 'Mensal'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--color-text-heading)' }}>Agenda</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Visão de execuções previstas com base nos protocolos ativos.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : scheduleItems.length === 0 ? (
        <EmptyState icon={<CalendarClock size={48} strokeWidth={1} />} title="Nenhuma manutenção agendada" description="Crie protocolos e relacione equipamentos ativos para gerar a agenda." />
      ) : (
        <div className="flex flex-col gap-3">
          {scheduleItems.map((item, i) => (
            <div
              key={`${item.protocoloId}-${item.equipamentoId}-${i}`}
              className="card card-interactive animate-fade-in"
              style={{
                animationDelay: `${i * 30}ms`,
                borderLeftWidth: '3px',
                borderLeftColor: item.isLate ? 'var(--color-status-danger)' : item.isTodayItem ? 'var(--color-accent)' : 'var(--color-border-default)',
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-heading)' }}>{item.titulo}</h3>
                    {item.isLate && <span className="badge badge-danger flex items-center gap-1"><AlertTriangle size={10} /> Atrasada</span>}
                    {item.isTodayItem && <span className="badge badge-accent flex items-center gap-1"><Clock size={10} /> Hoje</span>}
                    {!item.isLate && !item.isTodayItem && <span className="badge badge-neutral">{format(item.nextDate, "dd/MM/yyyy", { locale: ptBR })}</span>}
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-heading)' }}>{item.equipamentoNome} <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>#{item.equipamentoPatrimonio}</span></p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {item.categoria} • {periLabel(item.periodicidade)} •{' '}
                    {item.isLate ? `Deveria ter sido em ${format(item.nextDate, "dd/MM", { locale: ptBR })}` :
                      item.isTodayItem ? 'Prevista para hoje' :
                        `Próxima: ${format(item.nextDate, "dd 'de' MMMM", { locale: ptBR })}`}
                  </p>
                  {item.taskCount > 0 && (
                    <div className="mt-3 max-w-xs">
                      <ProgressBar value={item.completedTasks} max={item.taskCount} />
                    </div>
                  )}
                </div>
                <Link to={`/executar?equipamentoId=${item.equipamentoId}&titulo=${encodeURIComponent(item.titulo)}`} className="btn-primary whitespace-nowrap">Iniciar Execução</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
