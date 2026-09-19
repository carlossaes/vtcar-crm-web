import { useState } from 'react'
import { updateFollowUp } from '../api'
import { followUpStatus, STATUS_LABEL, toFollowUpInput, fromFollowUpInput, TIME_ZONE } from '../followUp'
import useNow from '../useNow'

export default function OpportunityFollowUp({ lead, usuario, onLeadChanged }) {
  const [editing, setEditing] = useState(false)
  const [action, setAction] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const now = useNow()
  const status = followUpStatus(lead, now)
  const canEdit = usuario?.papel === 'gerente' || (usuario?.papel === 'vendedor' && usuario.id === lead.ownerId)
  const save = async (event) => {
    event.preventDefault()
    if (saving || !canEdit) return
    setSaving(true); setError('')
    try {
      const updated = await updateFollowUp(lead.id, { nextAction: action.trim(), nextFollowUpAt: fromFollowUpInput(date) })
      onLeadChanged(updated); setEditing(false)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
  return <section aria-label="Próximo passo" className="rounded-card border border-line bg-surface2/50 p-4 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-micro uppercase font-semibold text-ink3">Próximo passo</h3>
      <span className={`rounded-full border border-line px-2 py-0.5 text-[11px] ${status === 'ATRASADO' ? 'text-critical' : 'text-ink2'}`}>{STATUS_LABEL[status]}</span>
    </div>
    {editing && canEdit ? <form onSubmit={save} className="space-y-3">
      <label className="block text-[13px]">Próxima ação<input className="block w-full bg-surface border border-line rounded-control p-2" value={action} onChange={(e) => setAction(e.target.value)} /></label>
      <label className="block text-[13px]">Data/hora do follow-up<input type="datetime-local" className="block w-full bg-surface border border-line rounded-control p-2" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <p className="text-[11px] text-ink3">Horário de São Paulo</p>
      {error && <p role="alert" className="text-critical text-[13px]">{error}</p>}
      <div className="flex gap-3"><button type="submit" disabled={saving} className="bg-brand text-brandInk rounded-control px-3 py-2">{saving ? 'Salvando…' : 'Salvar'}</button>
        <button type="button" disabled={saving} onClick={() => { setEditing(false); setError('') }}>Cancelar</button></div>
    </form> : <>
      <p className="text-[13px] whitespace-pre-wrap">{lead.nextAction || 'Nenhuma ação definida'}</p>
      <p className="text-[12px] text-ink2">{lead.nextFollowUpAt && Number.isFinite(Date.parse(lead.nextFollowUpAt)) ? new Date(lead.nextFollowUpAt).toLocaleString('pt-BR', { timeZone: TIME_ZONE }) : 'Sem data definida'}</p>
      {canEdit && <button type="button" className="border border-line rounded-control px-3 py-2 text-[13px]" onClick={() => { setAction(lead.nextAction || ''); setDate(toFollowUpInput(lead.nextFollowUpAt)); setEditing(true) }}>Editar follow-up</button>}
    </>}
  </section>
}
