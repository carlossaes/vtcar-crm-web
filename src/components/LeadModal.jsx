import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Copy, Check, RefreshCw, MessagesSquare } from 'lucide-react'
import { ChannelBadge, StageBadge, STAGE_META } from './Badge'
import EmptyState from './EmptyState'
import { displayName, formatPhone } from '../format'
import { getLeadMessages, getLeadCoach, regenerateLeadCoach } from '../api'

const MOVABLE = ['novo', 'qualificado', 'proposta', 'negociacao', 'fechado', 'perdido']

const INTENT_STYLE = {
  frio: { dot: 'bg-stage2', label: 'Interesse frio' },
  morno: { dot: 'bg-stage3', label: 'Interesse morno' },
  quente: { dot: 'bg-brand', label: 'Interesse quente' },
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11.5px] text-ink3 mb-0.5">{label}</div>
      <div className="text-[13.5px] font-medium">{value || '—'}</div>
    </div>
  )
}

function MessageBubble({ message }) {
  const fromClient = message.direction === 'cliente'
  return (
    <div className={`flex ${fromClient ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[78%] rounded-card px-3 py-2 text-[13px] leading-relaxed ${
          fromClient ? 'bg-surface2 border border-line' : 'bg-brand/10 border border-brand/25'
        }`}
      >
        {message.text}
        <div className="text-[10.5px] text-ink3 mt-1 tnum">
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
      setCoach(await regenerateLeadCoach(leadId))
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

  const intent = INTENT_STYLE[coach?.intentLevel] || INTENT_STYLE.morno

  return (
    <div className="rounded-card border border-line bg-surface2/50 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Sparkles size={14} className="text-brand" />
          Coach de vendas
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="flex items-center gap-1.5 text-[12px] font-medium text-ink2 hover:text-ink transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Analisando…' : coach ? 'Recalcular' : 'Analisar conversa'}
        </button>
      </div>

      {error && (
        <div className="text-[12px] text-critical bg-critical/10 border border-critical/25 rounded-control px-2.5 py-1.5 mb-2.5">
          {error}
        </div>
      )}

      {!coach && !loading && !error && (
        <p className="text-[12.5px] text-ink2 leading-relaxed">
          Ainda sem análise. Clique em “Analisar conversa” pra gerar resumo, nível de interesse e uma sugestão de
          resposta.
        </p>
      )}

      {coach && (
        <div className="space-y-3.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-[3px] text-[11.5px] font-medium">
              <span className={`w-[7px] h-[7px] rounded-full ${intent.dot}`} aria-hidden="true" />
              {intent.label}
              <span className="text-ink3 tnum">· {coach.intentScore}%</span>
            </span>
          </div>

          <p className="text-[13px] text-ink2 leading-relaxed">{coach.summary}</p>

          {coach.objections?.length > 0 && (
            <div>
              <div className="text-micro uppercase font-semibold text-ink3 mb-1.5">Objeções detectadas</div>
              <div className="flex flex-wrap gap-1.5">
                {coach.objections.map((o, i) => (
                  <span
                    key={i}
                    className="text-[11.5px] bg-surface border border-line rounded-full px-2.5 py-[3px] text-ink2"
                  >
                    {o}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="text-micro uppercase font-semibold text-ink3">Sugestão · {coach.technique}</div>
              <button
                onClick={copyMessage}
                className="flex items-center gap-1 text-[11.5px] font-medium text-brand hover:text-brandHover transition-colors"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="bg-surface border border-line rounded-control p-3 text-[13px] leading-relaxed">
              {coach.suggestedMessage}
            </div>
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

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <AnimatePresence>
      {lead && (
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
            className="bg-surface border border-line rounded-card shadow-pop w-[580px] max-w-full max-h-[88vh] overflow-y-auto"
          >
            <header className="sticky top-0 bg-surface/95 backdrop-blur border-b border-line px-6 py-4 flex items-start justify-between gap-4 z-10">
              <div className="min-w-0">
                <h2 className="text-[17px] font-bold tracking-tight truncate">{displayName(lead)}</h2>
                <div className="flex gap-1.5 mt-2">
                  <ChannelBadge channel={lead.channel} />
                  <StageBadge stage={lead.stage} />
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="grid place-items-center w-8 h-8 rounded-control text-ink3 hover:text-ink hover:bg-surface2 transition-colors shrink-0"
              >
                <X size={17} />
              </button>
            </header>

            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Telefone" value={formatPhone(lead.phone)} />
                <Field label="E-mail" value={lead.email} />
                <Field label="Veículo de interesse" value={lead.vehicleInterest || 'A confirmar'} />
                <Field
                  label="Entrou em"
                  value={lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('pt-BR') : null}
                />
              </div>

              <div>
                <div className="text-micro uppercase font-semibold text-ink3 mb-2">Mover para</div>
                <div className="flex flex-wrap gap-1.5">
                  {MOVABLE.filter((s) => s !== lead.stage).map((s) => (
                    <button
                      key={s}
                      onClick={() => onMoveStage(lead.id, s)}
                      className="flex items-center gap-1.5 border border-line bg-surface2 rounded-control px-3 py-1.5 text-[12.5px] font-medium text-ink2 hover:text-ink hover:border-lineStrong transition-colors"
                    >
                      <span className={`w-[7px] h-[7px] rounded-full ${STAGE_META[s].dot}`} aria-hidden="true" />
                      {STAGE_META[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <CoachPanel leadId={lead.id} />

              <div>
                <div className="text-micro uppercase font-semibold text-ink3 mb-2">Conversa sincronizada</div>
                {messages.length > 0 ? (
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto bg-plane border border-line rounded-card p-3">
                    {messages.map((m, i) => (
                      <MessageBubble key={i} message={m} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-plane border border-line rounded-card">
                    <EmptyState
                      icon={MessagesSquare}
                      compact
                      title="Nenhuma mensagem sincronizada"
                      description="As mensagens aparecem aqui conforme o webhook onNewMessage do GPT Maker for disparando."
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
