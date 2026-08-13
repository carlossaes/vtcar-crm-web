import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { DEFAULT_API_BASE } from '../api'

export default function BackendModal({ open, currentUrl, onClose, onSave }) {
  const [value, setValue] = useState(currentUrl || '')

  useEffect(() => {
    if (open) setValue(currentUrl || '')
  }, [open, currentUrl])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/55 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border border-line rounded-card shadow-pop p-6 w-[460px] max-w-full"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-[16px] font-bold tracking-tight">Conectar backend</h2>
                <p className="text-[12.5px] text-ink3 mt-0.5">De onde o CRM lê os leads.</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="grid place-items-center w-8 h-8 rounded-control text-ink3 hover:text-ink hover:bg-surface2 transition-colors shrink-0"
              >
                <X size={17} />
              </button>
            </div>

            <label htmlFor="backend-url" className="text-[12px] font-medium text-ink2 mb-1.5 block">
              URL do backend
            </label>
            <input
              id="backend-url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSave(value)}
              placeholder={DEFAULT_API_BASE}
              autoFocus
              spellCheck={false}
              className="w-full bg-surface2 border border-line rounded-control px-3 h-10 text-[13.5px] outline-none focus:border-brand transition-colors"
            />
            <button
              type="button"
              onClick={() => setValue(DEFAULT_API_BASE)}
              className="text-[12px] text-ink3 hover:text-ink2 transition-colors mt-2"
            >
              Usar o padrão do Railway
            </button>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={onClose}
                className="border border-line rounded-control px-4 h-9 text-[13px] font-medium text-ink2 hover:text-ink hover:border-lineStrong transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => onSave(value)}
                className="bg-brand hover:bg-brandHover text-brandInk rounded-control px-4 h-9 text-[13px] font-semibold transition-colors"
              >
                Salvar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
