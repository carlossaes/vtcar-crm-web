import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { ChannelBadge, StageBadge } from './Badge'

const STAGES = [
  { id: 'qualificado', label: 'Qualificado' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'negociacao', label: 'Negociação' },
]

export default function LeadModal({ lead, onClose, onMoveStage }) {
  return (
    <AnimatePresence>
      {lead && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-bg2 border border-border rounded-2xl p-7 w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="text-lg font-extrabold">{lead.name || 'Sem nome'}</div>
              <button onClick={onClose} className="text-text2 hover:text-text">
                <X size={18} />
              </button>
            </div>
            <div className="flex gap-2 mb-5">
              <ChannelBadge channel={lead.channel} />
              <StageBadge stage={lead.stage} />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-text2 mb-1">Telefone</div>
                <div className="font-semibold">{lead.phone || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-text2 mb-1">E-mail</div>
                <div className="font-semibold">{lead.email || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-text2 mb-1">Veículo de interesse</div>
                <div className="font-semibold">{lead.vehicleInterest || 'A confirmar'}</div>
              </div>
              <div>
                <div className="text-xs text-text2 mb-1">Data de entrada</div>
                <div className="font-semibold">{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</div>
              </div>
            </div>
            <div className="mt-5 mb-3 text-xs text-text2 uppercase tracking-wide">Mover para</div>
            <div className="flex gap-2 flex-wrap">
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onMoveStage(lead.id, s.id)}
                  className="border border-border rounded-lg px-3.5 py-2 text-[13px] text-text2 hover:text-text hover:border-text2 transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
