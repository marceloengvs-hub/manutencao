import { 
  addDays, addWeeks, addMonths, isBefore, isToday 
} from 'date-fns'

export interface ScheduleItem {
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

export function getNextDate(startDate: Date, periodicidade: string, now: Date, latestCompletedDate?: Date): Date {
  const addFn = periodicidade === 'diaria' ? addDays
    : periodicidade === 'semanal' ? addWeeks
    : addMonths

  // Se a data de início é Hoje ou no futuro, ela é a próxima data (usado para reagendamento)
  const isStartFutureOrToday = startDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  if (latestCompletedDate) {
    const latest = new Date(latestCompletedDate)
    const nextInCycle = addFn(latest, 1)

    // Se o usuário definiu uma nova data de início que é posterior à última execução, 
    // ela passa a ser a nova referência, permitindo reagendar para qualquer dia (adiantar ou atrasar)
    if (isStartFutureOrToday && startDate > latest) {
      return startDate
    }

    return nextInCycle
  }
  return new Date(startDate)
}

export function calculateSchedule(
  protocolos: any[],
  equipamentos: any[],
  manutencoes: any[]
): ScheduleItem[] {
  const now = new Date()
  const items: ScheduleItem[] = []

  if (!protocolos || !equipamentos) return []

  for (const proto of protocolos) {
    const startDate = new Date(proto.data_inicio + 'T00:00:00')
    const catName = proto.categorias?.nome ?? '—'
    const tasks = proto.tarefas_protocolo ?? []
    const taskCount = tasks.length
    
    const matchingEqs = equipamentos.filter(
      eq => {
        if (proto.equipamento_id) return eq.id === proto.equipamento_id;
        if (proto.categoria_id) return eq.categoria_id === proto.categoria_id;
        return true;
      }
    )

    for (const eq of matchingEqs) {
      const related = (manutencoes ?? []).filter(
        m => m.protocolo_id === proto.id && m.equipamento_id === eq.id && m.status !== 'cancelada'
      )
      
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
}
