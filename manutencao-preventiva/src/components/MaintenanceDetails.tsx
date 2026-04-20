import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckSquare, Square, Image as ImageIcon } from 'lucide-react'
import type { ManutencaoWithRelations } from '../hooks/useManutencoes'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  concluida: { label: 'Concluída', cls: 'badge-ok' },
  em_andamento: { label: 'Em Andamento', cls: 'badge-accent' },
  pendente: { label: 'Pendente', cls: 'badge-warn' },
  cancelada: { label: 'Cancelada', cls: 'badge-danger' },
}

interface MaintenanceDetailsProps {
  detailItem: ManutencaoWithRelations
  allManutencoes: ManutencaoWithRelations[]
}

export default function MaintenanceDetails({ detailItem, allManutencoes }: MaintenanceDetailsProps) {
  const st = STATUS_MAP[detailItem.status] ?? { label: detailItem.status, cls: 'badge-neutral' }
  const checklist = detailItem.checklist_json ?? {}

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Equipamento</span>
          <p className="font-medium mt-0.5" style={{ color: 'var(--color-text-heading)' }}>{detailItem.equipamentos?.nome ?? '—'}</p>
          <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>Patrimônio: {detailItem.equipamentos?.patrimonio ?? '—'}</p>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Status</span>
          <div className="mt-1"><span className={`badge ${st.cls}`}>{st.label}</span></div>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Técnico</span>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-body)' }}>{detailItem.profiles?.nome || detailItem.profiles?.email || '—'}</p>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Data</span>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-body)' }}>{format(new Date(detailItem.created_at), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}</p>
        </div>
      </div>
      <div style={{ height: '1px', background: 'var(--color-border-default)' }} />
      {Object.keys(checklist).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-heading)' }}>Checklist</h4>
          <div className="flex flex-col gap-1.5">
            {Object.entries(checklist).map(([taskId, status]) => {
              const isObj = typeof status === 'object' && status !== null
              const done = isObj ? (status as any).concluida : !!status
              
              let taskName = ''
              if (isObj) {
                taskName = (status as any).descricao
              }
              
              if (!taskName) {
                const isCustom = !isObj && taskId.startsWith('custom:')
                if (isCustom) {
                  taskName = taskId.replace('custom:', '')
                } else {
                  const currentProtoTasks = detailItem.protocolos?.tarefas_protocolo || []
                  const categoryProtocols = detailItem.equipamentos?.categorias?.protocolos || []
                  
                  let match = currentProtoTasks.find((t: any) => t.id === taskId)

                  if (!match) {
                    const allCategoryTasks = categoryProtocols.flatMap((p: any) => p.tarefas_protocolo || [])
                    match = allCategoryTasks.find((t: any) => t.id === taskId)
                  }

                  if (!match) {
                    const similarMaintenance = allManutencoes.find(prev => 
                      prev.titulo === detailItem.titulo && 
                      prev.equipamento_id === detailItem.equipamento_id &&
                      prev.checklist_json &&
                      typeof prev.checklist_json[taskId] === 'object' &&
                      (prev.checklist_json[taskId] as any)?.descricao
                    )
                    if (similarMaintenance && similarMaintenance.checklist_json) {
                      taskName = (similarMaintenance.checklist_json[taskId] as any).descricao
                    }
                  }

                  if (!match && !taskName && !detailItem.protocolo_id) {
                    const matchingByTitle = categoryProtocols.find((p: any) => p.titulo === detailItem.titulo)
                    if (matchingByTitle) {
                      match = (matchingByTitle.tarefas_protocolo || []).find((t: any) => t.id === taskId)
                    }
                  }

                  if (!match && !taskName) {
                    const refProto = detailItem.protocolos || 
                                   categoryProtocols.find((p: any) => p.titulo === detailItem.titulo) ||
                                   categoryProtocols[0]
                    
                    const refTasks = refProto?.tarefas_protocolo || []
                    const checklistKeys = Object.keys(checklist)
                    const currentIdx = checklistKeys.indexOf(taskId)
                    if (currentIdx !== -1 && refTasks[currentIdx]) {
                      match = refTasks[currentIdx]
                    }
                  }
                  
                  if (!taskName) {
                    taskName = match?.descricao || `Tarefa ${taskId.slice(0, 8)}`
                  }
                }
              }
              
              return (
                <div key={taskId} className="flex items-center gap-2 text-sm" style={{ color: done ? 'var(--color-status-ok)' : 'var(--color-text-muted)' }}>
                  {done ? <CheckSquare size={16} strokeWidth={2.5} /> : <Square size={16} />}
                  <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{taskName}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {detailItem.observacoes && (
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-heading)' }}>Observações</h4>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{detailItem.observacoes}</p>
        </div>
      )}
      {detailItem.evidencias.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-heading)' }}><ImageIcon size={14} /> Registros Fotográficos ({detailItem.evidencias.length})</h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {detailItem.evidencias.map(ev => (
              <a key={ev.id} href={ev.foto_url} target="_blank" rel="noopener noreferrer" className="block h-24 overflow-hidden transition-opacity hover:opacity-80" style={{ borderRadius: '2px', border: '1px solid var(--color-border-default)' }}>
                <img src={ev.foto_url} alt="" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
