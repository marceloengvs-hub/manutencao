import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAgenda, useManutencoes } from '../hooks/useManutencoes'
import { useUpdateProtocolo, useCreateProtocolo } from '../hooks/useProtocolos'
import ProgressBar from '../components/ProgressBar'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { CalendarClock, AlertTriangle, Clock, ChevronLeft, ChevronRight, Info, RefreshCw, CheckCircle, ExternalLink } from 'lucide-react'
import {
  addDays, addMonths, isSameMonth, isSameDay, format,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, isToday
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { calculateSchedule, nextWorkingDay, type ScheduleItem } from '../utils/maintenance'
import MaintenanceDetails from '../components/MaintenanceDetails'



export default function Agenda() {
  const { data: agendaData, isLoading } = useAgenda()
  const { data: manutencoes } = useManutencoes()
  const updateProtocolo = useUpdateProtocolo()
  const createProtocolo = useCreateProtocolo()

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())


  // Reprogram State
  const [reprogrammingTask, setReprogrammingTask] = useState<ScheduleItem | null>(null)
  const [reprogramDate, setReprogramDate] = useState('')

  // Auto-reschedule (fins de semana / feriados)
  const [showAutoReschedule, setShowAutoReschedule] = useState(false)
  const [autoRescheduling, setAutoRescheduling] = useState(false)

  // Details Modal State
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null)
  const detailItem = manutencoes?.find(m => m.id === selectedDetailId)


  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const allScheduleItems = useMemo<ScheduleItem[]>(() => {
    return calculateSchedule(agendaData?.protocolos ?? [], agendaData?.equipamentos ?? [], manutencoes ?? [])
  }, [agendaData, manutencoes])

  /** Verifica se uma data cai em fim de semana (sáb/dom) */
  const isWeekend = (d: Date) => { const dow = d.getDay(); return dow === 0 || dow === 6 }

  /** Items cujas nextDate caem em fim de semana ou feriado */
  const badDateItems = useMemo(() =>
    allScheduleItems.filter(item => {
      const correctDate = nextWorkingDay(item.nextDate)
      return correctDate.getTime() !== item.nextDate.getTime()
    }),
    [allScheduleItems]
  )

  /** Reagenda em massa todos os items em fins de semana/feriados */
  const handleAutoReschedule = async () => {
    if (!user || badDateItems.length === 0) return
    setAutoRescheduling(true)
    try {
      for (const item of badDateItems) {
        const correctedDate = format(nextWorkingDay(item.nextDate), 'yyyy-MM-dd')
        if (item.isEquipmentSpecific) {
          await updateProtocolo.mutateAsync({ id: item.protocoloId, data_inicio: correctedDate })
        } else {
          const proto = agendaData?.protocolos.find(p => p.id === item.protocoloId)
          if (!proto) continue
          await createProtocolo.mutateAsync({
            titulo: proto.titulo,
            categoria_id: proto.categoria_id,
            equipamento_id: item.equipamentoId,
            periodicidade: proto.periodicidade as 'diaria' | 'semanal' | 'mensal',
            data_inicio: correctedDate,
            status: 'ativo',
            user_id: user.id,
            tarefas: (proto.tarefas_protocolo ?? []).map((t: any) => t.descricao),
          })
        }
      }
    } finally {
      setAutoRescheduling(false)
      setShowAutoReschedule(false)
    }
  }

  const periLabel = (p: string) =>
    p === 'diaria' ? 'Diária' : p === 'semanal' ? 'Semanal' : 'Mensal'

  // Calendar render logic
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const dateFormat = "d"
    const rows = []
    let days = []
    let day = startDate
    let formattedDate = ""

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat)
        const cloneDay = day

        const hasTasks = allScheduleItems.some(item => isSameDay(item.nextDate, cloneDay) || (isToday(cloneDay) && item.isLate))
        const hasCompletions = manutencoes?.some(m => m.status === 'concluida' && m.completed_at && isSameDay(new Date(m.completed_at), cloneDay))
        const isSelected = isSameDay(day, selectedDate)
        const isCurrentMonth = isSameMonth(day, monthStart)
        const isDayToday = isToday(day)

        days.push(
          <button
            key={day.toString()}
            onClick={() => {
              setSelectedDate(cloneDay)
              if (!isSameMonth(cloneDay, currentMonth)) {
                setCurrentMonth(cloneDay)
              }
            }}
            className={`
              relative h-10 w-full flex flex-col items-center justify-center rounded-md transition-all
              ${!isCurrentMonth ? 'opacity-30' : 'opacity-100'}
              ${isSelected ? 'bg-[var(--color-accent)] text-white font-bold' : 'hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-body)]'}
              ${isDayToday && !isSelected ? 'border border-[var(--color-accent)] text-[var(--color-accent)] font-semibold' : ''}
            `}
          >
            <span className="text-sm">{formattedDate}</span>
            <div className="absolute bottom-1 flex gap-0.5 justify-center w-full px-1">
              {hasTasks && (
                <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[var(--color-accent)]'}`} title="Manutenção Agendada" />
              )}
              {hasCompletions && (
                <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[var(--color-status-ok)]'}`} title="Manutenção Concluída" />
              )}
            </div>
          </button>
        )
        day = addDays(day, 1)
      }
      rows.push(
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1" key={day.toString()}>
          {days}
        </div>
      )
      days = []
    }

    return (
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-1 hover:bg-[var(--color-surface-elevated)] rounded transition-colors"><ChevronLeft size={20} style={{ color: 'var(--color-text-muted)' }} /></button>
          <h2 className="text-base font-semibold capitalize" style={{ color: 'var(--color-text-heading)' }}>
            {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          <button onClick={nextMonth} className="p-1 hover:bg-[var(--color-surface-elevated)] rounded transition-colors"><ChevronRight size={20} style={{ color: 'var(--color-text-muted)' }} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {weekDays.map(wd => (
            <div key={wd} className="text-center text-xs font-semibold py-1" style={{ color: 'var(--color-text-muted)' }}>
              {wd}
            </div>
          ))}
        </div>
        {rows}

        <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--color-border-default)' }}>
             <button
               onClick={() => { setSelectedDate(new Date()); setCurrentMonth(new Date()); }}
               className="text-xs font-medium text-center py-1.5 transition-colors"
               style={{ color: 'var(--color-accent)' }}
             >
               Voltar para Hoje
             </button>
        </div>
      </div>
    )
  }

  const dailyTasks = allScheduleItems.filter(item => isSameDay(item.nextDate, selectedDate))
  const overdueTasks = allScheduleItems.filter(item => item.isLate)

  const finishedDailyTasks = useMemo(() => {
    return manutencoes?.filter(m => 
      m.status === 'concluida' && 
      m.completed_at && 
      isSameDay(new Date(m.completed_at), selectedDate)
    ) ?? []
  }, [manutencoes, selectedDate])

  // Avoid duplicating overdue tasks if looking at today
  const displayedTasks = isToday(selectedDate)
    ? [...new Set([...overdueTasks, ...dailyTasks])]
    : dailyTasks


  /** Ao reprogramar a atividade, atualizamos a data de início do protocolo. */
  const handleReprogramming = async () => {
    if (!reprogrammingTask || !user || !reprogramDate) return
    try {
      if (reprogrammingTask.isEquipmentSpecific) {
        await updateProtocolo.mutateAsync({
          id: reprogrammingTask.protocoloId,
          data_inicio: reprogramDate
        })
      } else {
        const proto = agendaData?.protocolos.find(p => p.id === reprogrammingTask.protocoloId)
        if (!proto) return
        await createProtocolo.mutateAsync({
          titulo: proto.titulo,
          categoria_id: proto.categoria_id,
          equipamento_id: reprogrammingTask.equipamentoId,
          periodicidade: proto.periodicidade as 'diaria' | 'semanal' | 'mensal',
          data_inicio: reprogramDate,
          status: 'ativo',
          user_id: user.id,
          tarefas: (proto.tarefas_protocolo ?? []).map((t: any) => t.descricao),
        })
      }
      setReprogrammingTask(null)
      setReprogramDate('')
    } catch {
      // handled by hook onError
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--color-text-heading)' }}>Agenda</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Acompanhe as datas programadas para manutenção preventiva.</p>
        </div>
        {badDateItems.length > 0 && (
          <button
            onClick={() => setShowAutoReschedule(true)}
            className="btn-primary flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
          >
            <RefreshCw size={15} />
            Reagendar {badDateItems.length} {badDateItems.length === 1 ? 'atividade' : 'atividades'} (fds/feriado)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Calendário */}
        <div className="xl:col-span-1">
          {renderCalendar()}
        </div>

        {/* Coluna Direita: Lista de Atividades do Dia Selecionado */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-heading)' }}>
              {isToday(selectedDate) ? 'Resumo de Hoje' : `Atividades de ${format(selectedDate, 'dd/MM/yyyy')}`}
            </h2>
            <div className="flex gap-2">
              {displayedTasks.length > 0 && <span className="badge badge-accent">{displayedTasks.length} agendada{displayedTasks.length !== 1 && 's'}</span>}
              {finishedDailyTasks.length > 0 && <span className="badge badge-success">{finishedDailyTasks.length} concluída{finishedDailyTasks.length !== 1 && 's'}</span>}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : (displayedTasks.length === 0 && finishedDailyTasks.length === 0) ? (
            <EmptyState
              icon={<CalendarClock size={48} strokeWidth={1} />}
              title={isToday(selectedDate) ? "Seu dia está livre!" : "Sem atividades para este dia"}
              description={isToday(selectedDate) ? "Nenhuma manutenção programada para hoje." : "Gere novas tarefas alterando os protocolos ou selecione outra data no calendário."}
            />
          ) : (
            <div className="flex flex-col gap-8">
              {/* Seção Agendadas */}
              {displayedTasks.length > 0 && (
                <div className="flex flex-col gap-3">
                  {displayedTasks.map((item, i) => (
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
                            {item.categoria} • {periLabel(item.periodicidade)}
                          </p>
                          {item.taskCount > 0 && (
                            <div className="mt-3 max-w-xs">
                              <ProgressBar value={item.completedTasks} max={item.taskCount} />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                          {/* Botão Reprogramar */}
                          <button
                            onClick={() => {
                              setReprogrammingTask(item)
                              const intervalDays = item.periodicidade === 'diaria' ? 1 : item.periodicidade === 'semanal' ? 7 : 30
                              const suggestedDate = nextWorkingDay(addDays(item.nextDate, intervalDays))
                              setReprogramDate(format(suggestedDate, 'yyyy-MM-dd'))
                            }}
                            className="btn-secondary flex-none p-2"
                            title="Reprogramar esta ocorrência"
                          >
                            <CalendarClock size={15} />
                          </button>

                          <Link to={`/executar?equipamentoId=${item.equipamentoId}&titulo=${encodeURIComponent(item.titulo)}&protocoloId=${item.protocoloId}`} className="btn-primary whitespace-nowrap">
                            {item.completedTasks > 0 ? 'Continuar' : 'Iniciar'}
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Seção Realizadas (Histórico) */}
              {finishedDailyTasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-px flex-1 bg-[var(--color-border-default)]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5 px-2">
                       <CheckCircle size={14} className="text-[var(--color-status-ok)]" /> Realizadas neste dia
                    </span>
                    <div className="h-px flex-1 bg-[var(--color-border-default)]" />
                  </div>
                  <div className="flex flex-col gap-3">
                    {finishedDailyTasks.map((m, i) => (
                      <div
                        key={m.id}
                        className="card bg-[var(--color-surface-elevated)]/50 border-l-3 animate-fade-in"
                        style={{
                          animationDelay: `${(displayedTasks.length + i) * 30}ms`,
                          borderLeftColor: 'var(--color-status-ok)',
                        }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-heading)' }}>{m.titulo}</h3>
                              <span className="badge badge-success flex items-center gap-1">
                                <CheckCircle size={10} /> Concluída às {m.completed_at ? format(new Date(m.completed_at), 'HH:mm') : '--:--'}
                              </span>
                            </div>
                            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-heading)' }}>
                              {m.equipamentos?.nome} <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>#{m.equipamentos?.patrimonio}</span>
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {m.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'} • Realizada por {m.profiles?.nome}
                            </p>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                            <button 
                              onClick={() => setSelectedDetailId(m.id)} 
                              className="btn-secondary flex items-center justify-center gap-2 text-xs py-1.5 px-3"
                            >
                              <ExternalLink size={14} /> Detalhes
                            </button>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      {/* Modal Reprogramar */}
      <Modal
        open={!!reprogrammingTask}
        onClose={() => setReprogrammingTask(null)}
        title="Reprogramar Atividade"
      >
        <div className="p-4 flex flex-col gap-4">
          {/* Info da atividade */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface-elevated)]">
            <div className="p-2 rounded bg-accent/10">
              <CalendarClock size={18} className="text-[var(--color-accent)]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--color-text-heading)]">{reprogrammingTask?.titulo}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {reprogrammingTask?.equipamentoNome} • Data atual: {reprogrammingTask && format(reprogrammingTask.nextDate, "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Histórico e Sugestão */}
          {reprogrammingTask && (
            <div className="grid grid-cols-2 gap-3 text-sm mb-1">
              <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--color-border-default)', background: 'var(--color-surface-elevated)' }}>
                <p className="text-xs mb-1 font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Última Manutenção</p>
                <p className="font-medium text-[var(--color-text-heading)]">
                  {reprogrammingTask.latestCompletedDate 
                    ? format(reprogrammingTask.latestCompletedDate, "dd/MM/yyyy", { locale: ptBR }) 
                    : <span className="italic text-[var(--color-text-muted)]">Sem histórico</span>}
                </p>
              </div>
              <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--color-border-default)', background: 'var(--color-surface-elevated)' }}>
                <p className="text-xs mb-1 font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Intervalo (Ciclo)</p>
                <p className="font-medium text-[var(--color-text-heading)] capitalize">
                  {reprogrammingTask.periodicidade}
                </p>
              </div>
            </div>
          )}

          <div className="mt-1">
            <label className="form-label mb-2 block">Nova Data Prevista</label>
            <input
              type="date"
              className="form-input w-full"
              value={reprogramDate}
              onChange={(e) => setReprogramDate(e.target.value)}
              min={reprogrammingTask ? format(new Date(Math.max(new Date().getTime(), reprogrammingTask.nextDate.getTime())), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          {/* Aviso sobre comportamento */}
          <div
            className="flex items-start gap-2 p-3 rounded-lg text-xs"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Esta manutenção será <strong>reprogramada</strong> para a nova data selecionada. O ciclo de manutenções futuras será ajustado a partir deste novo dia.
            </p>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={() => setReprogrammingTask(null)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={handleReprogramming}
              disabled={updateProtocolo.isPending || createProtocolo.isPending || !reprogramDate}
              className="btn-primary flex-1"
            >
              {(updateProtocolo.isPending || createProtocolo.isPending) ? 'Salvando...' : 'Confirmar Reprogramação'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Auto-Reagendar fins de semana/feriados */}
      <Modal
        open={showAutoReschedule}
        onClose={() => setShowAutoReschedule(false)}
        title="Reagendar Atividades em Fins de Semana / Feriados"
      >
        <div className="p-4 flex flex-col gap-4">
          <div
            className="flex items-start gap-2 p-3 rounded-lg text-xs"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            <Info size={14} className="mt-0.5 shrink-0" style={{ color: '#60a5fa' }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>
              As atividades abaixo estão programadas para finais de semana ou feriados. Elas serão reagendadas automaticamente para o <strong>próximo dia útil</strong> com base no histórico e periodicidade de cada protocolo.
            </p>
          </div>

          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {badDateItems.map((item, i) => (
              <div
                key={`${item.protocoloId}-${item.equipamentoId}-${i}`}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: 'var(--color-surface-elevated)' }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-heading)' }}>{item.titulo}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.equipamentoNome} • {item.periodicidade}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-xs line-through" style={{ color: 'var(--color-status-danger)' }}>
                    {format(item.nextDate, 'dd/MM/yyyy', { locale: ptBR })}
                    {isWeekend(item.nextDate) ? ' (fds)' : ' (feriado)'}
                  </p>
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
                    → {format(nextWorkingDay(item.nextDate), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-2">
            <button onClick={() => setShowAutoReschedule(false)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={handleAutoReschedule}
              disabled={autoRescheduling}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {autoRescheduling ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Reagendando...</>
              ) : (
                <><RefreshCw size={14} /> Confirmar Reagendamento</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Detalhes da Manutenção */}
      <Modal 
        open={!!selectedDetailId} 
        onClose={() => setSelectedDetailId(null)} 
        title="Detalhes da Manutenção" 
        maxWidth="700px"
      >
        {detailItem && <MaintenanceDetails detailItem={detailItem} allManutencoes={manutencoes ?? []} />}
      </Modal>
    </div>

  )
}
