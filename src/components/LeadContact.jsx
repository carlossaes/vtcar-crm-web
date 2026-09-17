import { useEffect, useRef, useState } from 'react'
import { updateLeadData } from '../api'
import { formatPhone } from '../format'
import { contactPayload, formatPhoneInput } from '../formInputs'

const fields = [['name', 'Nome'], ['phone', 'Telefone'], ['email', 'E-mail'],
  ['vehicleInterest', 'Interesse inicial'], ['contactNotes', 'Observações do contato']]
const control = 'w-full bg-surface2 border border-line rounded-control px-3 py-2 text-[13.5px] outline-none focus:border-brand'

export default function LeadContact({ lead, usuario, onLeadChanged }) {
  const [form, setForm] = useState(lead)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const isLead = (lead.recordType || (lead.ownerId ? 'opportunity' : 'lead')) === 'lead'
  const canEdit = isLead && (usuario?.papel === 'gerente' || (usuario?.papel === 'vendedor' && !lead.ownerId))
  useEffect(() => {
    if (!editing || !canEdit) { setForm(lead); setError('') }
    if (!canEdit) setEditing(false)
  }, [lead, editing, canEdit])
  const save = async (event) => {
    event.preventDefault()
    if (!canEdit || !editing || saving) return
    setSaving(true); setError('')
    try {
      const data = contactPayload(form, lead)
      const updated = await updateLeadData(lead.id, data)
      // A resposta de uma edição anterior não deve reabrir Lead após conversão.
      if (!active.current) return
      onLeadChanged(updated); setEditing(false)
    } catch (err) { if (active.current) setError(err.message) }
    finally { if (active.current) setSaving(false) }
  }
  return <section aria-label="Dados do contato" className="space-y-3">
    <h3 className="text-micro uppercase font-semibold text-ink3">Dados do contato</h3>
    <form noValidate onSubmit={save} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(([field, title]) => <div key={field} className={field === 'contactNotes' ? 'sm:col-span-2' : ''}>
          {editing && canEdit ? <label className="block text-[12px] text-ink2">{title}
            {field === 'contactNotes' ? <textarea aria-label={title} rows={3} className={control} disabled={saving}
              value={form[field] ?? ''} onChange={(e) => setForm((old) => ({ ...old, [field]: e.target.value }))} />
              : <input aria-label={title} className={control} type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                required={field === 'name' || field === 'phone'} disabled={saving} value={field === 'phone' ? formatPhoneInput(form[field]) : form[field] ?? ''}
                onChange={(e) => setForm((old) => ({ ...old, [field]: e.target.value }))} />}
          </label> : <><div className="text-[11.5px] text-ink3">{title}</div>
            <p className="text-[13.5px] whitespace-pre-wrap">{(field === 'phone' ? formatPhone(lead[field]) : lead[field]) || 'Não informado'}</p></>}
        </div>)}
      </div>
      {error && <p role="alert" className="text-critical text-[13px]">{error}</p>}
      {canEdit && <div className="flex gap-3">
        {editing ? <><button key="save-contact" type="submit" disabled={saving} className="bg-brand text-brandInk rounded-control px-3 py-2">{saving ? 'Salvando…' : 'Salvar'}</button>
          <button key="cancel-contact" type="button" disabled={saving} onClick={() => { setForm(lead); setEditing(false); setError('') }}>Cancelar</button></>
          : <button key="edit-contact" type="button" className="border border-line rounded-control px-3 py-2" onClick={(event) => { event.preventDefault(); setForm(lead); setEditing(true) }}>Editar lead</button>}
      </div>}
    </form>
  </section>
}
