import { useEffect, useState } from 'react'
import { LOST_REASONS } from '../followUp'

export default function useStageChange(onMoveStage, contextKey) {
  const [pending, setPending] = useState(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setPending(null); setReason(''); setError('') }, [contextKey])
  const requestMove = async (id, stage) => {
    if (stage === 'perdido') {
      setPending(id); setReason(''); setError('')
      return false
    }
    return onMoveStage(id, stage)
  }
  const confirm = async (event) => {
    event.preventDefault()
    if (!reason || saving) { if (!reason) setError('Selecione um motivo da perda.'); return }
    setSaving(true); setError('')
    try {
      const result = await onMoveStage(pending, 'perdido', reason)
      if (result === false) setError('Não foi possível salvar a perda. Tente novamente.')
      else setPending(null)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
  const lossDialog = pending && <div className="fixed inset-0 bg-black/55 z-[60] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); if (!saving) setPending(null) } }}>
    <form role="dialog" aria-modal="true" aria-label="Motivo da perda" onSubmit={confirm} className="bg-surface border border-line rounded-card shadow-pop p-5 w-96 max-w-full space-y-4">
      <h2 className="text-micro uppercase font-semibold">Motivo da perda</h2>
      <select autoFocus aria-label="Motivo da perda" value={reason} onChange={(e) => setReason(e.target.value)} disabled={saving} className="bg-surface2 border border-line rounded-control p-2 w-full">
        <option value="">Selecione um motivo</option>{LOST_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {reason === 'outro' && <p className="text-[12px] text-ink2">Use as observações em Editar negócio para detalhar o motivo.</p>}
      {error && <p role="alert" className="text-critical text-[13px]">{error}</p>}
      <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setPending(null)}>Cancelar</button><button type="submit" disabled={!reason || saving} className="bg-brand text-brandInk rounded-control px-3 py-2 disabled:opacity-50">Confirmar perda</button></div>
    </form>
  </div>
  return { requestMove, lossDialog }
}
