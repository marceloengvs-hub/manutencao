import { useState, useMemo } from 'react'
import { useManutencoes, useDeleteManutencao, type ManutencaoWithRelations } from '../hooks/useManutencoes'
import { useCategorias } from '../hooks/useProtocolos'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { Search, History, Eye, CheckSquare, Square, Image as ImageIcon, Trash2, Download, SlidersHorizontal, X } from 'lucide-react'
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { toast } from 'react-hot-toast'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  concluida: { label: 'Concluída', cls: 'badge-ok' },
  em_andamento: { label: 'Em Andamento', cls: 'badge-accent' },
  pendente: { label: 'Pendente', cls: 'badge-warn' },
  cancelada: { label: 'Cancelada', cls: 'badge-danger' },
}

export default function Historico() {
  const { data: manutencoes, isLoading } = useManutencoes()
  const { data: categorias } = useCategorias()
  const deleteManutencao = useDeleteManutencao()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterDateStart, setFilterDateStart] = useState('')
  const [filterDateEnd, setFilterDateEnd] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const hasActiveFilters = !!(filterStatus || filterTipo || filterCategoria || filterDateStart || filterDateEnd)

  const filtered = useMemo(() => {
    if (!manutencoes) return []
    return manutencoes.filter(m => {
      const eqName = m.equipamentos?.nome ?? ''
      const eqPatrimonio = m.equipamentos?.patrimonio ?? ''
      const tecnicoNome = m.profiles?.nome ?? ''

      const matchSearch = !search ||
        eqName.toLowerCase().includes(search.toLowerCase()) ||
        eqPatrimonio.toLowerCase().includes(search.toLowerCase()) ||
        m.titulo.toLowerCase().includes(search.toLowerCase()) ||
        tecnicoNome.toLowerCase().includes(search.toLowerCase())

      const matchStatus = !filterStatus || m.status === filterStatus
      const matchTipo = !filterTipo || m.tipo === filterTipo
      const matchCategoria = !filterCategoria || (m.equipamentos?.categoria_id === filterCategoria)

      let matchDate = true
      if (filterDateStart || filterDateEnd) {
        const createdDate = new Date(m.created_at)
        if (filterDateStart) {
          const start = startOfDay(new Date(filterDateStart + 'T00:00:00'))
          if (isBefore(createdDate, start)) matchDate = false
        }
        if (filterDateEnd) {
          const end = endOfDay(new Date(filterDateEnd + 'T00:00:00'))
          if (isAfter(createdDate, end)) matchDate = false
        }
      }

      return matchSearch && matchStatus && matchTipo && matchCategoria && matchDate
    })
  }, [manutencoes, search, filterStatus, filterTipo, filterCategoria, filterDateStart, filterDateEnd])

  const detailItem = manutencoes?.find(m => m.id === detailId) as ManutencaoWithRelations | undefined

  const handleDelete = (id: string, titulo: string) => {
    if (window.confirm(`Tem certeza que deseja deletar a manutenção "${titulo}"?`)) {
      deleteManutencao.mutate(id)
    }
  }

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF()

      doc.setFontSize(16)
      doc.text('Histórico de Manutenções', 14, 22)

      doc.setFontSize(10)
      let filterText = `Total de registros: ${filtered.length}`
      if (search) filterText += ` | Busca: "${search}"`
      if (filterStatus) filterText += ` | Status: ${STATUS_MAP[filterStatus]?.label || filterStatus}`
      if (filterTipo) filterText += ` | Tipo: ${filterTipo === 'preventiva' ? 'Preventiva' : 'Corretiva'}`
      if (filterDateStart || filterDateEnd) {
        filterText += ` | Período: ${filterDateStart ? format(new Date(filterDateStart + 'T00:00:00'), 'dd/MM/yyyy') : '...'} até ${filterDateEnd ? format(new Date(filterDateEnd + 'T00:00:00'), 'dd/MM/yyyy') : 'agora'}`
      }
      doc.text(filterText, 14, 30)

      const tableColumn = ["Equipamento", "Patrimônio", "Título", "Tipo", "Data", "Status", "Observações"]
      const tableRows = filtered.map(m => [
        m.equipamentos?.nome || '—',
        m.equipamentos?.patrimonio || '—',
        m.titulo,
        m.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva',
        format(new Date(m.created_at), 'dd/MM/yyyy'),
        STATUS_MAP[m.status]?.label || m.status,
        m.observacoes || '—'
      ])

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [249, 115, 22] }, // var(--color-accent) approximation
      })

      // Generate Data URI and trigger download manually
      // For small files (~25KB), Data URI is extremely reliable for forcing correct naming in Chrome
      const dataUri = doc.output('dataurlstring')
      const link = document.createElement('a')
      const fileName = `historico-manutencoes-${format(new Date(), 'yyyy-MM-dd')}.pdf`
      
      link.href = dataUri
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('PDF exportado com sucesso!')
    } catch (error) {
      console.error('Erro ao exportar PDF:', error)
      toast.error('Ocorreu um erro ao gerar o PDF. Tente novamente.')
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--color-text-heading)' }}>Histórico</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Consulte todas as manutenções realizadas.</p>
        </div>
        <button onClick={handleExportPDF} className="btn-secondary" disabled={filtered.length === 0}>
          <Download size={16} /> Exportar PDF
        </button>
      </div>

      <div className="card mb-6 p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input className="form-input pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por equipamento, patrimônio, técnico..." />
          </div>
          <button 
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="btn-secondary px-3 sm:px-4"
            style={{ 
              borderColor: hasActiveFilters ? 'var(--color-accent)' : 'var(--color-border-default)',
              background: hasActiveFilters ? 'var(--color-accent-muted)' : 'transparent',
              color: hasActiveFilters ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            }}
          >
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline ml-2">Filtros</span>
            {hasActiveFilters && (
              <span className="ml-2 w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)' }} />
            )}
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="mt-4 pt-4 border-t border-dashed" style={{ borderColor: 'var(--color-border-default)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: 'var(--color-text-muted)' }}>Data Início</label>
                <input type="date" className="form-input text-xs h-9" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: 'var(--color-text-muted)' }}>Data Fim</label>
                <input type="date" className="form-input text-xs h-9" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: 'var(--color-text-muted)' }}>Status</label>
                <select className="form-select text-xs h-9" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="concluida">Concluída</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="pendente">Pendente</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: 'var(--color-text-muted)' }}>Tipo</label>
                <select className="form-select text-xs h-9" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="preventiva">Preventiva</option>
                  <option value="corretiva">Corretiva</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: 'var(--color-text-muted)' }}>Categoria</label>
                <select className="form-select text-xs h-9" value={filterCategoria} onChange={e => setFilterCategoria(e.target.value)}>
                  <option value="">Todas</option>
                  {categorias?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
            
            {hasActiveFilters && (
              <div className="flex justify-end mt-3">
                <button 
                  onClick={() => {
                    setFilterStatus('')
                    setFilterTipo('')
                    setFilterCategoria('')
                    setFilterDateStart('')
                    setFilterDateEnd('')
                  }}
                  className="text-[11px] font-medium flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--color-status-danger)' }}
                >
                  <X size={12} /> Limpar Filtros
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<History size={48} strokeWidth={1} />} title="Nenhum registro encontrado" description={search || hasActiveFilters ? 'Tente outros critérios.' : 'O histórico será preenchido conforme manutenções forem executadas.'} />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th className="hidden sm:table-cell">Data</th>
                  <th className="hidden md:table-cell">Técnico</th>
                  <th>Status</th>
                  <th className="text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => {
                  const st = STATUS_MAP[m.status] ?? { label: m.status, cls: 'badge-neutral' }
                  return (
                    <tr key={m.id} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                      <td>
                        <span className="font-medium" style={{ color: 'var(--color-text-heading)' }}>{m.equipamentos?.nome ?? '—'}</span>
                        <br />
                        <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>Patrimônio: {m.equipamentos?.patrimonio ?? '—'}</span>
                      </td>
                      <td>{m.titulo}</td>
                      <td><span className={`badge ${m.tipo === 'preventiva' ? 'badge-accent' : 'badge-warn'}`}>{m.tipo === 'preventiva' ? 'Prev.' : 'Corr.'}</span></td>
                      <td className="hidden sm:table-cell">{format(new Date(m.created_at), 'dd/MM/yyyy', { locale: ptBR })}</td>
                      <td className="hidden md:table-cell">{m.profiles?.nome || m.profiles?.email || '—'}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td className="text-right flex items-center justify-end gap-2">
                        <button onClick={() => setDetailId(m.id)} className="btn-ghost text-xs py-1 px-2"><Eye size={14} /> Detalhes</button>
                        <button onClick={() => handleDelete(m.id, m.titulo)} className="btn-ghost text-xs py-1 px-2" style={{ color: 'var(--color-status-danger)' }} title="Deletar"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!detailId} onClose={() => setDetailId(null)} title="Detalhes da Manutenção" maxWidth="700px">
        {detailItem && (() => {
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
                      // Suporte ao novo formato (objeto) ou legado (booleano)
                      const isObj = typeof status === 'object' && status !== null;
                      const done = isObj ? (status as any).concluida : !!status;
                      
                      let taskName = '';
                      if (isObj) {
                        taskName = (status as any).descricao;
                      }
                      
                      if (!taskName) {
                        const isCustom = !isObj && taskId.startsWith('custom:');
                        if (isCustom) {
                          taskName = taskId.replace('custom:', '');
                        } else {
                          // Conjunto expandido de tarefas para "curar" registros órfãos
                          const currentProtoTasks = detailItem.protocolos?.tarefas_protocolo || [];
                          const categoryProtocols = (detailItem as any).equipamentos?.categorias?.protocolos || [];
                          
                          // 1. Busca Direta no Protocolo Vinculado
                          let match = currentProtoTasks.find(t => t.id === taskId);

                          // 2. Busca Global em todos os protocolos da Categoria
                          if (!match) {
                            const allCategoryTasks = categoryProtocols.flatMap((p: any) => p.tarefas_protocolo || []);
                            match = allCategoryTasks.find(t => t.id === taskId);
                          }

                          // 3. Fallback por Título do Protocolo
                          // (Muitas manutenções antigas têm o mesmo título que o protocolo mas sem o link de protocolo_id)
                          if (!match && !detailItem.protocolo_id) {
                            const matchingByTitle = categoryProtocols.find((p: any) => p.titulo === detailItem.titulo);
                            if (matchingByTitle) {
                              match = (matchingByTitle.tarefas_protocolo || []).find((t: any) => t.id === taskId);
                            }
                          }

                          // 4. Fallback por Posição: Se não achamos pelo ID, usamos a ordem
                          if (!match) {
                            // Escolhe a melhor referência (Protocolo vinculado > Protocolo por título > Primeiro da categoria)
                            const refProto = detailItem.protocolos || 
                                           categoryProtocols.find((p: any) => p.titulo === detailItem.titulo) ||
                                           categoryProtocols[0];
                            
                            const refTasks = refProto?.tarefas_protocolo || [];
                            const checklistKeys = Object.keys(checklist);
                            const currentIdx = checklistKeys.indexOf(taskId);
                            if (currentIdx !== -1 && refTasks[currentIdx]) {
                              match = refTasks[currentIdx];
                            }
                          }
                          
                          taskName = match?.descricao || `Tarefa ${taskId.slice(0, 8)}`;
                        }
                      }
                      
                      return (
                        <div key={taskId} className="flex items-center gap-2 text-sm" style={{ color: done ? 'var(--color-status-ok)' : 'var(--color-text-muted)' }}>
                          {done ? <CheckSquare size={16} strokeWidth={2.5} /> : <Square size={16} />}
                          <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{taskName}</span>
                        </div>
                      );
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
        })()}
      </Modal>
    </div>
  )
}
