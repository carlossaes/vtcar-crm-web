import { TASK_TYPES, TASK_PRIORITIES } from '../tasks'

const control = 'block w-full bg-surface border border-line rounded-control p-2 mt-1 text-[13px] focus:border-brand outline-none'
export default function TaskFields({ draft, setDraft, required = false }) {
  const change = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }))
  return <div className="space-y-3">
    <label className="block text-[13px]">Próxima ação<input required={required} className={control} value={draft.nextAction} onChange={change('nextAction')} /></label>
    <label className="block text-[13px]">Data/hora do follow-up<input required={required} type="datetime-local" className={control} value={draft.date} onChange={change('date')} /></label>
    <p className="text-[11px] text-ink3">Horário de São Paulo</p>
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-[13px]">Tipo<select className={control} value={draft.taskType} onChange={change('taskType')}>
        {Object.entries(TASK_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="block text-[13px]">Prioridade<select className={control} value={draft.taskPriority} onChange={change('taskPriority')}>
        {Object.entries(TASK_PRIORITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
  </div>
}
