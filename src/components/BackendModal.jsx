import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export default function BackendModal({ open, currentUrl, onClose, onSave }) {
  const [value, setValue] = useState(currentUrl || '')

  useEffect(() => {
    if (open) setValue(currentUrl || '')
  }, [open, currentUrl])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-bg2 border border-border rounded-2xl p-7 w-[440px] max-w-[95vw]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-extrabold">Conectar backend</div>
              <button onClick={onClose} className="text-text2 hover:text-text">
                <X size={18} />
              </button>
            </div>
            <label className="text-xs text-text2 mb-1.5 block">URL do backend (Railway)</label>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://seu-servico.up.railway.app"
              className="w-full bg-bg3 border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2.5 mt-6">
              <button onClick={onClose} className="border border-border text-text2 rounded-lg px-4 py-2 text-sm">
                Cancelar
              </button>
              <button onClick={() => onSave(value)} className="bg-accent hover:bg-accent2 text-white rounded-lg px-4 py-2 text-sm font-bold">
                Salvar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
