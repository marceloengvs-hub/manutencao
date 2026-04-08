import { 
  addDays, isBefore, isToday, startOfDay 
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

/**
 * Calcula a próxima data de manutenção com base na periodicidade e na última execução.
 * - semanal: +7 dias
 * - mensal:  +30 dias
 * - diaria:  +1 dia
 */
export function getNextDate(
  startDate: Date,
  periodicidade: string,
  latestCompletedDate?: Date
): Date {
  const intervalDays = periodicidade === 'diaria' ? 1 : periodicidade === 'semanal' ? 7 : 30
  const manualDate = startOfDay(new Date(startDate))

  if (latestCompletedDate) {
    const base = startOfDay(new Date(latestCompletedDate))
    const autoNext = addDays(base, intervalDays)

    // Se o usuário reagendou para uma data posterior ao próximo ciclo automático,
    // respeita a escolha manual (data_inicio foi atualizado pelo reagendamento)
    if (manualDate > autoNext) {
      return manualDate
    }

    return autoNext
  }

  // Sem execução: usa data_inicio como referência
  return manualDate
}

export function calculateSchedule(
  protocolos: any[],
  equipamentos: any[],
  manutencoes: any[]
): ScheduleItem[] {
  const now = startOfDay(new Date())
  const items: ScheduleItem[] = []

  if (!protocolos || !equipamentos) return []

  for (const proto of protocolos) {
    const startDate = new Date(proto.data_inicio + 'T00:00:00')
    const catName = proto.categorias?.nome ?? '—'
    const tasks = proto.tarefas_protocolo ?? []
    const taskCount = tasks.length

    const matchingEqs = equipamentos.filter(eq => {
      if (proto.equipamento_id) return eq.id === proto.equipamento_id
      if (proto.categoria_id) return eq.categoria_id === proto.categoria_id
      return true
    })

    for (const eq of matchingEqs) {
      // Manutenções relacionadas a este protocolo+equipamento, exceto canceladas
      const related = (manutencoes ?? []).filter(
        m =>
          m.equipamento_id === eq.id &&
          (m.protocolo_id === proto.id ||
            m.titulo.toLowerCase().trim() === proto.titulo.toLowerCase().trim()) &&
          m.status !== 'cancelada'
      )

      // Última manutenção concluída, ordenada pela data real de execução (desc)
      const completedOnes = related
        .filter(m => m.status === 'concluida')
        .sort((a, b) => {
          // Usa completed_at se disponível, senão created_at (registros legados)
          const dateA = new Date(a.completed_at ?? a.created_at).getTime()
          const dateB = new Date(b.completed_at ?? b.created_at).getTime()
          return dateB - dateA
        })

      const latestCompleted = completedOnes[0]

      // Data base para cálculo: completed_at (preferencial) ou created_at (fallback)
      const latestCompletedDate = latestCompleted
        ? startOfDay(new Date(latestCompleted.completed_at ?? latestCompleted.created_at))
        : undefined

      // Periodicidade efetiva: usa a do protocolo da última manutenção concluída,
      // com fallback para o protocolo da agenda (para manutenções sem protocolo vinculado)
      const effectivePeriodicidade =
        (latestCompleted as any)?.protocolos?.periodicidade ?? proto.periodicidade

      // Próxima data = data da última conclusão + intervalo baseado na periodicidade real
      const nextDate = getNextDate(startDate, effectivePeriodicidade, latestCompletedDate)

      // Se ainda está dentro do ciclo (próxima data no futuro) e não é hoje,
      // exibe no calendário mas sem badge de "atrasada" ou "hoje"
      const isWithinCycle = !!latestCompletedDate && !isBefore(nextDate, now)
      if (isWithinCycle && !isToday(nextDate)) {
        items.push({
          protocoloId: proto.id,
          equipamentoId: eq.id,
          titulo: proto.titulo,
          equipamentoNome: eq.nome,
          equipamentoPatrimonio: eq.patrimonio,
          categoria: catName,
          periodicidade: effectivePeriodicidade,
          nextDate,
          isLate: false,
          isTodayItem: false,
          taskCount,
          completedTasks: 0,
        })
        continue
      }

      // Manutenção em aberto (pendente/em_andamento) mais recente,
      // mas somente se ainda não foi superada por uma conclusão posterior
      let latestOpen = related
        .filter(m => m.status === 'pendente' || m.status === 'em_andamento')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

      if (latestOpen && latestCompletedDate) {
        const openDate = startOfDay(new Date(latestOpen.created_at))
        if (latestCompletedDate >= openDate) {
          latestOpen = undefined
        }
      }

      const completedTasks = latestOpen
        ? Object.values(latestOpen.checklist_json ?? {}).filter(Boolean).length
        : 0

      const isLateItem = isBefore(nextDate, now) && !isToday(nextDate)
      const isTodayItem = isToday(nextDate)

      items.push({
        protocoloId: proto.id,
        equipamentoId: eq.id,
        titulo: proto.titulo,
        equipamentoNome: eq.nome,
        equipamentoPatrimonio: eq.patrimonio,
        categoria: catName,
        periodicidade: effectivePeriodicidade,
        nextDate,
        isLate: isLateItem,
        isTodayItem,
        taskCount,
        completedTasks,
      })
    }
  }

  return items.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
}
