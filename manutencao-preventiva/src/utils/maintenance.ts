import {
  addDays, isBefore, isToday, startOfDay, format
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
  /** true quando o protocolo é exclusivo deste equipamento (equipamento_id preenchido) */
  isEquipmentSpecific: boolean
  latestCompletedDate?: Date
  startDate: Date
}

// ─── Feriados Nacionais Brasileiros ──────────────────────────────────────────

/** Calcula o Domingo de Páscoa pelo algoritmo de Gauss */
function getEasterDate(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/** Retorna o Set de feriados nacionais para o ano dado (formato 'yyyy-MM-dd') */
function getBrazilianHolidays(year: number): Set<string> {
  const h = new Set<string>()
  const y = year

  // Feriados fixos nacionais
  ;[
    `${y}-01-01`, // Confraternização Universal (Ano Novo)
    `${y}-04-21`, // Tiradentes
    `${y}-05-01`, // Dia do Trabalhador
    `${y}-09-07`, // Independência do Brasil
    `${y}-10-12`, // Nossa Senhora Aparecida
    `${y}-11-02`, // Finados
    `${y}-11-15`, // Proclamação da República
    `${y}-12-25`, // Natal
  ].forEach(d => h.add(d))

  // Feriados móveis derivados da Páscoa
  const easter = getEasterDate(y)
  const shift = (days: number) => format(addDays(easter, days), 'yyyy-MM-dd')

  h.add(shift(-48)) // Segunda-feira de Carnaval
  h.add(shift(-47)) // Terça-feira de Carnaval
  h.add(shift(-2))  // Sexta-feira Santa (Paixão de Cristo)
  h.add(shift(0))   // Domingo de Páscoa
  h.add(shift(60))  // Corpus Christi

  return h
}

// Cache para evitar recalcular feriados no mesmo ano
const holidayCache = new Map<number, Set<string>>()
function getHolidaysForYear(year: number): Set<string> {
  if (!holidayCache.has(year)) {
    holidayCache.set(year, getBrazilianHolidays(year))
  }
  return holidayCache.get(year)!
}

/**
 * Avança para o próximo dia útil (segunda a sexta, exceto feriados nacionais).
 * Se a data já for um dia útil, retorna ela mesma.
 */
export function nextWorkingDay(date: Date): Date {
  let d = startOfDay(new Date(date))
  while (true) {
    const dow = d.getDay() // 0 = domingo, 6 = sábado
    const dateStr = format(d, 'yyyy-MM-dd')
    const holidays = getHolidaysForYear(d.getFullYear())
    if (dow !== 0 && dow !== 6 && !holidays.has(dateStr)) break
    d = addDays(d, 1)
  }
  return d
}

// ─── Cálculo de Próxima Data ─────────────────────────────────────────────────

/**
 * Calcula a próxima data de manutenção com base na periodicidade e última execução.
 * A data automática é sempre ajustada para o próximo dia útil.
 * - semanal: +7 dias → próximo dia útil
 * - mensal:  +30 dias → próximo dia útil
 * - diaria:  +1 dia  → próximo dia útil
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

    // Se o usuário reagendou (data_inicio > última manutenção), respeita a data manual
    if (manualDate > base) {
      return manualDate
    }

    // Data automática: avança para o próximo dia útil após o intervalo
    return nextWorkingDay(addDays(base, intervalDays))
  }

  // Sem histórico: usa data_inicio como referência (sem ajuste automático de feriado)
  return manualDate
}

// ─── Cálculo da Agenda ───────────────────────────────────────────────────────

export function calculateSchedule(
  protocolos: any[],
  equipamentos: any[],
  manutencoes: any[]
): ScheduleItem[] {
  const now = startOfDay(new Date())
  const items: ScheduleItem[] = []

  if (!protocolos || !equipamentos) return []

  // Identifica equipamentos que já têm protocolo ESPECÍFICO (equipamento_id) com o mesmo título.
  // Esses equipamentos ignoram o protocolo de categoria correspondente.
  const coveredBySpecific = new Set<string>()
  for (const proto of protocolos) {
    if (proto.equipamento_id && proto.status === 'ativo') {
      coveredBySpecific.add(`${proto.equipamento_id}:${proto.titulo.toLowerCase().trim()}`)
    }
  }

  for (const proto of protocolos) {
    const startDate = new Date(proto.data_inicio + 'T00:00:00')
    const catName = proto.categorias?.nome ?? '—'
    const tasks = proto.tarefas_protocolo ?? []
    const taskCount = tasks.length
    const isEquipmentSpecific = !!proto.equipamento_id

    const matchingEqs = equipamentos.filter(eq => {
      if (proto.equipamento_id) return eq.id === proto.equipamento_id
      if (proto.categoria_id) {
        // Pula equipamentos que têm protocolo específico com o mesmo título
        if (coveredBySpecific.has(`${eq.id}:${proto.titulo.toLowerCase().trim()}`)) return false
        return eq.categoria_id === proto.categoria_id
      }
      
      // Protocolo sem categoria e sem equipamento → aplica a todos (fallback global)
      // Mas também deve pular se o equipamento já tem um específico para este título!
      if (coveredBySpecific.has(`${eq.id}:${proto.titulo.toLowerCase().trim()}`)) return false
      
      return true
    })

    for (const eq of matchingEqs) {
      // Manutenções relacionadas a este protocolo+equipamento (inclui canceladas com data)
      const related = (manutencoes ?? []).filter(
        m =>
          m.equipamento_id === eq.id &&
          (m.protocolo_id === proto.id ||
            m.titulo.toLowerCase().trim() === proto.titulo.toLowerCase().trim())
      )

      // Última execução relevante do EQUIPAMENTO (independente do título do protocolo, conforme regra do usuário)
      const equipmentCompletedOnes = (manutencoes ?? [])
        .filter(m =>
          m.equipamento_id === eq.id &&
          (m.status === 'concluida' || (m.status === 'cancelada' && m.completed_at))
        )
        .sort((a, b) => {
          const dateA = new Date(a.completed_at ?? a.created_at).getTime()
          const dateB = new Date(b.completed_at ?? b.created_at).getTime()
          return dateB - dateA
        })

      const latestCompleted = equipmentCompletedOnes[0]

      const latestCompletedDate = latestCompleted
        ? startOfDay(new Date(latestCompleted.completed_at ?? latestCompleted.created_at))
        : undefined

      // Periodicidade efetiva: sempre usa a do protocolo atual sendo avaliado
      const effectivePeriodicidade = proto.periodicidade

      const nextDate = getNextDate(startDate, effectivePeriodicidade, latestCompletedDate)

      // Dentro do ciclo (data futura ainda não devida): exibe no calendário sem urgência
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
          isEquipmentSpecific,
          latestCompletedDate,
          startDate
        })
        continue
      }

      // Manutenção em aberto mais recente, desconsiderada se já superada por conclusão posterior
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
        isEquipmentSpecific,
        latestCompletedDate,
        startDate
      })
    }
  }

  return items.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
}
