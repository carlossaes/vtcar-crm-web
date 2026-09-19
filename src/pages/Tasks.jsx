import { useMemo, useState } from 'react'
import { Check, Pencil, ArrowUpRight, ClipboardList } from 'lucide-react'
import { displayName } from '../format'
import { followUpPresentation, followUpTime } from '../followUp'
import { filterTasks, visibleOpportunities, TASK_PERIODS, TASK_TYPES, TASK_PRIORITIES, TASK_STATUSES, taskDate, taskDateTime } from '../tasks'
import useNow from '../useNow'
import LeadModal from '../components/LeadModal'
import OpportunityFollowUp from '../components/OpportunityFollowUp'
import TaskCompleteModal from '../components/TaskCompleteModal'
import TaskDialog from '../components/TaskDialog'

const initialFilters = { period: 'todas', status: '', priority: '', type: '', owner: '' }
const control = 'block w-full bg-surface border border-line rounded-control px-2.5 h-9 mt-1 text-[12.5px] outline-none focus:border-brand'
const action = 'inline-flex items-center gap-1 text-[12px] px-2 py-1.5 rounded-control border border-line text-ink2 hover:text-ink hover:border-lineStrong whitespace-nowrap'

export default function Tasks({ leads, usuario, vendedores = [], search = '', onClearSearch, onLeadChanged, onMoveStage }) {
  const [filters, setFilters] = useState(initialFilters)
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [completingId, setCompletingId] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const now = useNow()
  const manager = usuario?.papel === 'gerente'
  const opportunities = useMemo(() => visibleOpportunities(leads, usuario), [leads, usuario])
  const tasks = filterTasks(opportunities, { ...filters, owner: manager ? filters.owner : usuario?.id, search }, now)
  const selected = opportunities.find((lead) => lead.id === selectedId)
  const editing = opportunities.find((lead) => lead.id === editingId)
  const completing = opportunities.find((lead) => lead.id === completingId)
  const owners = useMemo(() => {
    const map = new Map()
    if (usuario?.id) map.set(usuario.id, usuario.nome)
    if (manager) {
      vendedores.filter((user) => user.ativo !== false).forEach((user) => map.set(user.id, user.nome))
      opportunities.forEach((lead) => { if (lead.ownerId && !map.has(lead.ownerId)) map.set(lead.ownerId, lead.ownerName || lead.ownerId) })
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [usuario, manager, vendedores, opportunities])
  const change = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }))
  const clear = () => { setFilters(initialFilters); onClearSearch?.() }

  return <>
    <section aria-label="Central de tarefas" className="space-y-4">
      <div role="tablist" aria-label="Período das tarefas" className="flex flex-wrap gap-1 border-b border-line">
        {Object.entries(TASK_PERIODS).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filters.period === value}
          onClick={() => setFilters((current) => ({ ...current, period: value }))}
          className={`px-4 py-3 text-[13px] font-semibold border-b-2 transition-colors ${filters.period === value ? 'border-brand text-brand' : 'border-transparent text-ink2 hover:text-ink'}`}>{label}</button>)}
      </div>
      <div className="bg-surface border border-line rounded-card p-4 grid grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.3fr_auto] gap-3 items-end">
        <label className="text-[12px] text-ink2">Status<select className={control} value={filters.status} onChange={change('status')}>
          <option value="">Todos</option>{Object.entries(TASK_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="text-[12px] text-ink2">Prioridade<select className={control} value={filters.priority} onChange={change('priority')}>
          <option value="">Todas</option>{Object.entries(TASK_PRIORITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="text-[12px] text-ink2">Tipo<select className={control} value={filters.type} onChange={change('type')}>
          <option value="">Todos</option>{Object.entries(TASK_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="text-[12px] text-ink2">Responsável<select className={control} value={manager ? filters.owner : usuario?.id || ''} disabled={!manager} onChange={change('owner')}>
          {manager && <option value="">Todos</option>}{owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label>
        <button type="button" onClick={clear} className="h-9 px-3 text-[12.5px] font-medium text-ink2 hover:text-ink border border-line rounded-control">Limpar</button>
      </div>
      <div className="flex items-center justify-between gap-3 text-[12px]">
        <p role="status" aria-live="polite" className="font-medium text-ink2">{tasks.length} tarefa(s)</p>
        <span className="text-ink3">Horário de São Paulo</span>
      </div>
      <div className="bg-surface border border-line rounded-card overflow-x-auto shadow-card">
        <table className="w-full min-w-[1000px] text-left" aria-label="Tarefas comerciais">
          <thead className="bg-surface2/60 text-micro uppercase text-ink3"><tr>
            {['Tarefa', 'Cliente / Oportunidade', 'Tipo', 'Prioridade', 'Vence', 'Status', 'Responsável', 'Ações'].map((title) => <th key={title} scope="col" className="px-4 py-3 font-semibold">{title}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-line">
            {tasks.map((task) => {
              const visual = followUpPresentation(task, now)
              const completed = task.taskStatus === 'concluida'
              return <tr key={task.id} className="hover:bg-surface2/30 align-top">
                <td className="px-4 py-4 min-w-[190px] max-w-[280px]">
                  <button type="button" onClick={() => setSelectedId(task.id)} className="text-[13px] font-semibold text-left hover:text-brand break-words">{task.nextAction}</button>
                  <div className="text-[11.5px] text-ink3 mt-1">Cliente: {displayName(task)}</div>
                </td>
                <td className="px-4 py-4 min-w-[150px] text-[12.5px]"><div>{displayName(task)}</div><div className="text-ink3 mt-1">{task.vehicleInterest || 'Veículo a confirmar'}</div></td>
                <td className="px-4 py-4 text-[12px] whitespace-nowrap">{TASK_TYPES[task.taskType]}</td>
                <td className="px-4 py-4"><span className={`rounded-full border px-2 py-0.5 text-[11.5px] whitespace-nowrap ${task.taskPriority === 'urgente' ? 'border-critical/30 bg-critical/10 text-critical font-semibold' : task.taskPriority === 'alta' ? 'border-brand/25 text-brand' : 'border-line text-ink2'}`}>{TASK_PRIORITIES[task.taskPriority]}</span></td>
                <td className={`px-4 py-4 text-[12px] whitespace-nowrap tnum ${visual.textClass}`}><div>{taskDate(task.nextFollowUpAt)}</div><div>{followUpTime(task.nextFollowUpAt)}</div>
                  {visual.dueLabel && <div className="text-[11px] font-medium mt-1">{visual.dueLabel}</div>}
                </td>
                <td className="px-4 py-4 text-[12px]"><span className={`rounded-full border px-2 py-0.5 whitespace-nowrap ${visual.textClass} ${visual.badgeClass}`}>{TASK_STATUSES[task.taskStatus]}</span>
                  {completed && taskDateTime(task.taskCompletedAt) && <div className={`text-[11px] mt-2 ${visual.textClass}`}>Concluída em {taskDateTime(task.taskCompletedAt)}</div>}
                </td>
                <td className="px-4 py-4 text-[12px]">{task.ownerName || owners.find(([id]) => id === task.ownerId)?.[1] || 'Não informado'}</td>
                <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5">
                  {!completed && <button type="button" onClick={() => setCompletingId(task.id)} className={action}><Check size={13} />Concluir</button>}
                  <button type="button" onClick={() => setEditingId(task.id)} className={action}><Pencil size={13} />Editar</button>
                  <button type="button" onClick={() => setSelectedId(task.id)} className={action}><ArrowUpRight size={13} />Abrir oportunidade</button>
                </div></td>
              </tr>
            })}
            {!tasks.length && <tr><td colSpan={8} className="text-center py-12 text-ink3"><ClipboardList size={24} className="mx-auto mb-3" /><p className="text-[14px] font-medium text-ink2">Nenhuma tarefa neste filtro</p><p className="text-[12px] mt-1">Ajuste os filtros ou defina um próximo passo na oportunidade.</p></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
    {editing && <TaskDialog title="Editar tarefa" busy={editSaving} onClose={() => setEditingId(null)}>
      <OpportunityFollowUp key={editing.id} lead={editing} usuario={usuario} initialEditing onSavingChange={setEditSaving} onCancel={() => setEditingId(null)}
        onLeadChanged={(updated) => { onLeadChanged(updated); setEditingId(null) }} />
    </TaskDialog>}
    {completing && <TaskCompleteModal key={completing.id} lead={completing} onClose={() => setCompletingId(null)} onLeadChanged={onLeadChanged} />}
    <LeadModal lead={selected || null} usuario={usuario} vendedores={vendedores} onClose={() => setSelectedId(null)} onLeadChanged={onLeadChanged}
      onMoveStage={async (id, stage, reason) => { const result = await onMoveStage(id, stage, reason); if (result !== false) setSelectedId(null); return result }} />
  </>
}
