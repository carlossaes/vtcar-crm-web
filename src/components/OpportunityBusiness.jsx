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
  useEffect(() => { setForm(lead); setEditing(false); setError('') }, [lead])
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    try { onLeadChanged(await updateOpportunity(lead.id, commercialPayload(form))); setEditing(false) }
    catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
  return <form onSubmit={save} className="space-y-4">
    <CommercialFields form={form} setForm={setForm} readOnly={!editing || !canEdit} />
    {error && <p role="alert" className="text-critical text-[13px]">{error}</p>}
    {canEdit && <div className="flex gap-3">
      {editing ? <><button disabled={saving} className="bg-brand text-brandInk rounded-control px-3 py-2" type="submit">{saving ? 'Salvando…' : 'Salvar negócio'}</button>
        <button disabled={saving} type="button" onClick={() => { setForm(lead); setEditing(false); setError('') }}>Cancelar</button></>
        : <button className="border border-line rounded-control px-3 py-2" type="button" onClick={() => setEditing(true)}>Editar negócio</button>}
    </div>}
  </form>
}
