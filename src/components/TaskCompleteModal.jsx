import { useState } from 'react'
import { completeTask, updateFollowUp } from '../api'
import { taskDraft, taskPayload } from '../tasks'
import TaskDialog from './TaskDialog'
import TaskFields from './TaskFields'

export default function TaskCompleteModal({ lead, onClose, onLeadChanged }) {
  const [next, setNext] = useState(false)
  const [draft, setDraft] = useState(() => taskDraft())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = async (event) => {
    event.preventDefault()
    if (saving) return
    setSaving(true); setError('')
    try {
      let updated
      if (next) {
        const payload = taskPayload(draft)
        if (!payload.nextAction || !payload.nextFollowUpAt) throw new Error('Informe a próxima ação e a data/hora.')
        // One write replaces the current follow-up. No fictitious task history.
        updated = await updateFollowUp(lead.id, payload)
      } else updated = await completeTask(lead.id)
      onLeadChanged(updated); onClose()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
  return <TaskDialog title="Tarefa concluída" onClose={onClose} busy={saving}>
    <p className="text-[13px] text-ink2 mb-4">{lead.nextAction}</p>
    <form onSubmit={save}>
      <fieldset disabled={saving} className="space-y-4">
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={next} onChange={(event) => setNext(event.target.checked)} />Definir próximo passo agora</label>
        {next && <><TaskFields draft={draft} setDraft={setDraft} required /><p className="text-[12px] text-ink3">O novo próximo passo substituirá o atual e ficará pendente.</p></>}
        {error && <p role="alert" className="text-critical text-[13px]">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" onClick={onClose}>Cancelar</button>
          <button type="submit" className="bg-brand text-brandInk rounded-control px-3 py-2 text-[13px] font-semibold">{saving ? 'Salvando…' : 'Concluir tarefa'}</button></div>
      </fieldset>
    </form>
  </TaskDialog>
}
