import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Copy, RefreshCw } from 'lucide-react'
import { ChannelBadge, StageBadge } from './Badge'
import { getLeadMessages, getLeadCoach, regenerateLeadCoach } from '../api'

const STAGES = [
  { id: 'qualificado', label: 'Qualificado' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'negociacao', label: 'Negociação' },
]

const INTENT_STYLES = {
  frio: 'bg-blue-500/15 text-blue-400',
  morno: 'bg-yellow-500/15 text-yellow-400',
  quente: 'bg-red-500/15 text-red-400',
}

function MessageBubble({ message }) {
  const fromClient = message.direction === 'cliente'
  return (
    <div className={`flex ${fromClient ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-[13px] ${fromClient ? 'bg-bg3 text-text' : 'bg-accent/20 text-text'}`}>
        {message.text}
        <div className="text-[10px] text-text2 mt-1">
          {new Date(message.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

function CoachPanel({ leadId }) {
  const [coach, setCoach] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setCoach(null)
    setError(null)
    getLeadCoach(leadId)
      .then((data) => {
        if (!cancelled) setCoach(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [leadId])

  const analyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await regenerateLeadCoach(leadId)
      setCoach(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copyMessage = () => {
    if (!coach || !coach.suggestedMessage) return
    navigator.clipboard.writeText(coach.suggestedMessage).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="bg-bg3 border border-border rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <Sparkles size={15} className="text-accent" />
          Coach de Vendas
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-text2 hover:text-text transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {coach ? 'Recalcular' : 'Analisar conversa'}
        </button>
      </div>

      {error && <div className="text-xs text-accent mb-2">{error}</div>}

      {!coach && !loading && (
        <div className="text-xs text-text2">Ainda sem análise — clica em "Analisar conversa" pra gerar.</div>
      )}

      {coach && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                INTENT_STYLES[coach.intentLevel] || INTENT_STYLES.morno
              }`}
            >
              Interesse {coach.intentLevel} · {coach.intentScore}%
            </span>
          </div>
          <div className="text-[13px] text-text2">{coach.summary}</div>

          {coach.objections && coach.objections.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text2 mb-1">Objeções detectadas</div>
              <div className="flex flex-wrap gap-1.5">
                {coach.objections.map((o, i) => (
                  <span key={i} className="text-[11px] bg-bg2 border border-border rounded-full px-2 py-0.5 text-text2">
                    {o}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[11px] uppercase tracking-wide text-text2">Sugestão · {coach.technique}</div>
              <button onClick={copyMessage} className="flex items-center gap-1 text-[11px] text-accent hover:text-accent2">
                <Copy size={11} />
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <div className="bg-bg2 border border-border rounded-lg p-3 text-[13px]">{coach.suggestedMessage}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LeadModal({ lead, onClose, onMoveStage }) {
  const [messages, setMessages] = useState([])

  useEffect(() => {
    if (!lead) return
    setMessages([])
    getLeadMessages(lead.id).then(setMessages).catch(() => {})
  }, [lead && lead.id])

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
            className="bg-bg2 border border-border rounded-2xl p-7 w-[560px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
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

            <CoachPanel leadId={lead.id} />

            {messages.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-text2 uppercase tracking-wide mb-2">Conversa sincronizada</div>
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto bg-bg border border-border rounded-xl p-3">
                  {messages.map((m, i) => (
                    <MessageBubble key={i} message={m} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
