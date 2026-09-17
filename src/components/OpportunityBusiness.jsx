import { useEffect, useState } from 'react'
import CommercialFields from './CommercialFields'
import { commercialPayload } from '../opportunity'
import { updateOpportunity } from '../api'

export default function OpportunityBusiness({ lead, usuario, onLeadChanged }) {
  const [form, setForm] = useState(lead)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canEdit = usuario?.papel === 'gerente' || (usuario?.papel === 'vendedor' && usuario.id === lead.ownerId)
  // Refreshes may replace the lead object without changing the opportunity.
  // Keep the active draft; LeadModal's key={lead.id} resets only on a new record.
  useEffect(() => {
    if (!editing) { setForm(lead); setError('') }
  }, [lead, editing])
  const save = async (event) => {
    event.preventDefault()
    if (!editing || !canEdit || saving) return
    setSaving(true); setError('')
    try {
      const data = commercialPayload(form)
      delete data.vehicleInterest
      onLeadChanged(await updateOpportunity(lead.id, data)); setEditing(false)
    }
    catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
  return <form onSubmit={save} className="space-y-4">
    <CommercialFields form={form} setForm={setForm} readOnly={!editing || !canEdit} />
    {error && <p role="alert" className="text-critical text-[13px]">{error}</p>}
    {canEdit && <div className="flex gap-3">
      {editing ? <><button key="save" disabled={saving} className="bg-brand text-brandInk rounded-control px-3 py-2" type="submit">{saving ? 'Salvando…' : 'Salvar negócio'}</button>
        <button key="cancel" disabled={saving} type="button" onClick={() => { setForm(lead); setEditing(false); setError('') }}>Cancelar</button></>
        : <button key="edit" className="border border-line rounded-control px-3 py-2" type="button" onClick={(event) => { event.preventDefault(); setForm(lead); setEditing(true) }}>Editar negócio</button>}
    </div>}
  </form>
}
