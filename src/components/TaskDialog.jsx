import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function TaskDialog({ title, children, onClose, busy = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    ref.current?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); if (!busy) onClose() }
    if (event.key !== 'Tab') return
    const nodes = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
    if (!nodes.length) { event.preventDefault(); return }
    const first = nodes[0], last = nodes[nodes.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus() }
  }
  return <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={() => { if (!busy) onClose() }}>
    <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKeyDown} onClick={(event) => event.stopPropagation()}
      className="bg-surface border border-line rounded-card shadow-pop p-5 w-[500px] max-w-full max-h-[88vh] overflow-y-auto outline-none">
      <header className="flex items-center justify-between gap-3 mb-4"><h2 className="text-[15px] font-semibold">{title}</h2>
        <button type="button" disabled={busy} onClick={onClose} aria-label="Fechar" className="p-1 text-ink3 hover:text-ink"><X size={18} /></button>
      </header>
      {children}
    </section>
  </div>
}
