import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAgenda, useManutencoes } from '../hooks/useManutencoes'
import { useUpdateProtocolo } from '../hooks/useProtocolos'
import ProgressBar from '../components/ProgressBar'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { CalendarClock, AlertTriangle, Clock, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { 
  addDays, addWeeks, addMonths, isSameMonth, isSameDay, format,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, isToday, parseISO
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { calculateSchedule, type ScheduleItem } from '../utils/maintenance'
import toast from 'react-hot-toast'


export default function Agenda() {
  const { data: agendaData, isLoading } = useAgenda()
  const { data: manutencoes } = useManutencoes()
  const updateProtocolo = useUpdateProtocolo()

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  
  // Reschedule State
  const [reschedulingTask, setReschedulingTask] = useState<ScheduleItem | null>(null)
  const [newDate, setNewDate] = useState('')

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const allScheduleItems = useMemo<ScheduleItem[]>(() => {
    return calculateSchedule(agendaData?.protocolos ?? [], agendaData?.equipamentos ?? [], manutencoes ?? [])
  }, [agendaData, manutencoes])

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
            {hasTasks && (
              <div className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[var(--color-accent)]'}`} />
            )}
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

  // Avoid duplicating overdue tasks if looking at today
  const displayedTasks = isToday(selectedDate) 
    ? [...new Set([...overdueTasks, ...dailyTasks])] 
    : dailyTasks

  const handleReschedule = async () => {
    if (!reschedulingTask || !newDate) return
    try {
      await updateProtocolo.mutateAsync({
        id: reschedulingTask.protocoloId,
        data_inicio: newDate
      })
      toast.success('Manutenção reagendada com sucesso!')
      setReschedulingTask(null)
      setNewDate('')
    } catch {
      toast.error('Erro ao reagendar manutenção.')
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--color-text-heading)' }}>Agenda</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Acompanhe as datas programadas para manutenção preventiva.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Calendário (Fica acima no mobile) */}
        <div className="xl:col-span-1">
          {renderCalendar()}
        </div>

        {/* Coluna Direita: Lista de Atividades do Dia Selecionado */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-heading)' }}>
              {isToday(selectedDate) ? 'Atividades de Hoje' : `Atividades do dia ${format(selectedDate, 'dd/MM/yyyy')}`}
            </h2>
            <span className="badge badge-neutral">{displayedTasks.length} {displayedTasks.length === 1 ? 'atividade' : 'atividades'}</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : displayedTasks.length === 0 ? (
            <EmptyState 
              icon={<CalendarClock size={48} strokeWidth={1} />} 
              title={isToday(selectedDate) ? "Seu dia está livre!" : "Sem atividades para este dia"} 
              description={isToday(selectedDate) ? "Nenhuma manutenção programada para hoje." : "Gere novas tarefas alterando os protocolos ou selecione outra data no calendário."} 
            />
          ) : (
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
                    <div className="flex flex-col sm:flex-row gap-2">
                       <button 
                         onClick={() => {
                           setReschedulingTask(item)
                           setNewDate(format(new Date(), 'yyyy-MM-dd'))
                         }}
                         className="btn-secondary whitespace-nowrap bg-opacity-50"
                       >
                         Reagendar
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
        </div>
      </div>

      <Modal
        open={!!reschedulingTask}
        onClose={() => setReschedulingTask(null)}
        title="Reagendar Manutenção"
      >
        <div className="p-4">
          <div className="mb-6 flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface-elevated)]">
            <div className="p-2 rounded bg-accent/10">
              <Calendar size={20} className="text-[var(--color-accent)]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Atividade</p>
              <p className="text-sm font-bold text-[var(--color-text-heading)]">{reschedulingTask?.titulo}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{reschedulingTask?.equipamentoNome}</p>
            </div>
          </div>

          <div className="mb-6">
            <label className="form-label mb-2 block">Nova Data Prevista</label>
            <input 
              type="date" 
              className="form-input w-full"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Ao reagendar, a próxima data de manutenção será calculada a partir deste novo dia.
            </p>
          </div>

          <div className="flex gap-3 mt-8">
            <button 
              onClick={() => setReschedulingTask(null)} 
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button 
              onClick={handleReschedule} 
              disabled={!newDate || updateProtocolo.isPending}
              className="btn-primary flex-1"
            >
              {updateProtocolo.isPending ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
