import { useState } from 'react'
import { updateFollowUp } from '../api'
import { followUpPresentation, TIME_ZONE } from '../followUp'
import { effectiveTask, taskDraft, taskPayload, taskDateTime, TASK_TYPES, TASK_PRIORITIES, TASK_STATUSES } from '../tasks'
import TaskFields from './TaskFields'
import useNow from '../useNow'

export default function OpportunityFollowUp({ lead, usuario, onLeadChanged, initialEditing = false, onCancel, onSavingChange }) {
  const [editing, setEditing] = useState(initialEditing)
  const [draft, setDraft] = useState(() => taskDraft(lead))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const now = useNow()
  const visual = followUpPresentation(lead, now)
  const task = effectiveTask(lead)
  const canEdit = usuario?.papel === 'gerente' || (usuario?.papel === 'vendedor' && usuario.id === lead.ownerId)
  const save = async (event) => {
    event.preventDefault()
    if (saving || !canEdit) return
    setSaving(true); onSavingChange?.(true); setError('')
    try {
      const updated = await updateFollowUp(lead.id, taskPayload(draft))
      onLeadChanged(updated); setEditing(false)
    } catch (err) { setError(err.message) }
    finally { setSaving(false); onSavingChange?.(false) }
  }
  return <section aria-label="Próximo passo" className="rounded-card border border-line bg-surface2/50 p-4 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-micro uppercase font-semibold text-ink3">Próximo passo</h3>
      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${visual.textClass} ${visual.badgeClass}`}>{visual.label}</span>
    </div>
    {visual.detail && <p className={`text-[11px] ${visual.textClass}`}>{visual.detail}</p>}
    {editing && canEdit ? <form onSubmit={save} className="space-y-3">
      <fieldset disabled={saving}><TaskFields draft={draft} setDraft={setDraft} /></fieldset>
      <p className="text-[11px] text-ink3">Para retirar a tarefa da lista, limpe a ação e a data. Salvar um próximo passo o deixa pendente.</p>
      {error && <p role="alert" className="text-critical text-[13px]">{error}</p>}
      <div className="flex gap-3"><button type="submit" disabled={saving} className="bg-brand text-brandInk rounded-control px-3 py-2">{saving ? 'Salvando…' : 'Salvar'}</button>
        <button type="button" disabled={saving} onClick={() => { setEditing(false); setError(''); onCancel?.() }}>Cancelar</button></div>
    </form> : <>
      <p className="text-[13px] whitespace-pre-wrap">{lead.nextAction || 'Nenhuma ação definida'}</p>
      <dl className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-ink2">
        <div><dt className="text-ink3">Tipo</dt><dd>{TASK_TYPES[task.taskType]}</dd></div>
        <div><dt className="text-ink3">Prioridade</dt><dd>{TASK_PRIORITIES[task.taskPriority]}</dd></div>
        <div><dt className="text-ink3">Status</dt><dd className={visual.textClass}>{TASK_STATUSES[task.taskStatus]}</dd></div>
      </dl>
      <p className="text-[12px] text-ink2">{lead.nextFollowUpAt && Number.isFinite(Date.parse(lead.nextFollowUpAt)) ? new Date(lead.nextFollowUpAt).toLocaleString('pt-BR', { timeZone: TIME_ZONE }) : 'Sem data definida'}</p>
      {task.taskStatus === 'concluida' && taskDateTime(task.taskCompletedAt) && <p className={`text-[12px] ${visual.textClass}`}>Concluída em {taskDateTime(task.taskCompletedAt)}</p>}
      {canEdit && <button type="button" className="border border-line rounded-control px-3 py-2 text-[13px]" onClick={() => { setDraft(taskDraft(lead)); setEditing(true) }}>{visual.actionLabel}</button>}
    </>}
  </section>
}
