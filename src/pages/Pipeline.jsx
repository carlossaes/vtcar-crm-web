import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GripVertical, Inbox } from 'lucide-react'
import { ChannelBadge, STAGE_META } from '../components/Badge'
import { displayName, formatPhone } from '../format'
import LeadModal from '../components/LeadModal'

// O funil inteiro, incluindo as duas saidas (fechado e perdido).
const COLUMNS = ['novo', 'qualificado', 'proposta', 'negociacao', 'fechado', 'perdido']

function relativeDay(iso) {
  if (!iso) return '—'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 30) return `há ${days} dias`
  const months = Math.floor(days / 30)
  return `há ${months} ${months === 1 ? 'mês' : 'meses'}`
}

function LeadCard({ lead, onOpen, onMoveRelative, dragging, onDragStart, onDragEnd }) {
  return (
    <motion.article
      layout
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(lead)}
      onKeyDown={(e) => {
        // Alternativa de teclado ao arrastar: setas movem o lead de coluna.
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          onMoveRelative(lead, 1)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          onMoveRelative(lead, -1)
        } else if (e.key === 'Enter') {
          onOpen(lead)
        }
      }}
      tabIndex={0}
      initial={false}
      animate={{ opacity: dragging ? 0.4 : 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.16 }}
      className="group bg-surface border border-line rounded-control p-3 cursor-grab active:cursor-grabbing hover:border-lineStrong transition-colors shadow-card"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold truncate">{displayName(lead)}</div>
          <div className="text-[12px] text-ink2 truncate mt-0.5">{lead.vehicleInterest || 'Interesse a confirmar'}</div>
        </div>
        <GripVertical
          size={14}
          className="text-ink3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
          aria-hidden="true"
        />
      </div>
      <div className="flex items-center justify-between gap-2 mt-2.5">
        <ChannelBadge channel={lead.channel} />
        <span className="text-[11.5px] text-ink3 tnum shrink-0">{relativeDay(lead.createdAt)}</span>
      </div>
    </motion.article>
  )
}

export default function Pipeline({ leads, search, onMoveStage }) {
  const [selected, setSelected] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [hoverColumn, setHoverColumn] = useState(null)

  const filtered = useMemo(() => {
    if (!search) return leads
    const q = search.toLowerCase()
    return leads.filter(
      (l) =>
        (l.name || '').toLowerCase().includes(q) ||
        (l.phone || '').includes(q) ||
        (formatPhone(l.phone) || '').includes(q) ||
        (l.channel || '').toLowerCase().includes(q) ||
        (l.vehicleInterest || '').toLowerCase().includes(q)
    )
  }, [leads, search])

  const byStage = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((c) => [c, []]))
    filtered.forEach((lead) => {
      const stage = map[lead.stage] ? lead.stage : 'novo'
      map[stage].push(lead)
    })
    return map
  }, [filtered])

  const handleDragStart = (e, lead) => {
    setDraggingId(lead.id)
    e.dataTransfer.effectAllowed = 'move'
    // Alguns navegadores so iniciam o drag se houver payload definido.
    e.dataTransfer.setData('text/plain', lead.id)
  }

  const handleDrop = (e, stage) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggingId
    setDraggingId(null)
    setHoverColumn(null)
    if (!id) return
    const lead = leads.find((l) => l.id === id)
    if (lead && lead.stage !== stage) onMoveStage(id, stage)
  }

  const moveRelative = (lead, delta) => {
    const index = COLUMNS.indexOf(lead.stage)
    const next = COLUMNS[index + delta]
    if (next) onMoveStage(lead.id, next)
  }

  return (
    <>
      {/* Colunas crescem pra ocupar a largura livre e so entram em rolagem
          horizontal quando a tela nao comporta a largura minima. */}
      <div className="flex gap-3 overflow-x-auto items-stretch pb-2 -mx-1 px-1 min-h-[calc(100vh-14rem)]">
        {COLUMNS.map((stage) => {
          const meta = STAGE_META[stage]
          const items = byStage[stage]
          const isTarget = hoverColumn === stage
          return (
            <section
              key={stage}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (hoverColumn !== stage) setHoverColumn(stage)
              }}
              onDragLeave={(e) => {
                // Ignora a saida quando o ponteiro so passou pra um filho.
                if (!e.currentTarget.contains(e.relatedTarget)) setHoverColumn(null)
              }}
              onDrop={(e) => handleDrop(e, stage)}
              className={`flex-1 min-w-[232px] shrink-0 flex flex-col rounded-card border transition-colors ${
                isTarget ? 'border-brand bg-brand/5' : 'border-line bg-surface2/40'
              }`}
            >
              <header className="flex items-center gap-2 px-3.5 py-3">
                <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${meta.dot}`} aria-hidden="true" />
                <h2 className="text-[13px] font-semibold">{meta.label}</h2>
                <span className="ml-auto text-[11.5px] text-ink3 tnum">{items.length}</span>
              </header>

              <div className="flex flex-col gap-2 px-2.5 pb-2.5 flex-1 min-h-[120px]">
                <AnimatePresence initial={false}>
                  {items.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      dragging={draggingId === lead.id}
                      onOpen={setSelected}
                      onMoveRelative={moveRelative}
                      onDragStart={handleDragStart}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setHoverColumn(null)
                      }}
                    />
                  ))}
                </AnimatePresence>

                {items.length === 0 && (
                  <div
                    className={`flex-1 min-h-[104px] rounded-control border border-dashed grid place-items-center text-[12px] px-3 text-center transition-colors ${
                      isTarget ? 'border-brand text-brand' : 'border-line text-ink3'
                    }`}
                  >
                    {isTarget ? (
                      'Soltar aqui'
                    ) : (
                      <span className="flex flex-col items-center gap-1.5">
                        <Inbox size={16} aria-hidden="true" />
                        Nenhum lead
                      </span>
                    )}
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <p className="text-[12px] text-ink3 mt-3">
        Arraste o card entre as colunas para mudar o estágio — ou selecione um card e use as setas ← → do teclado.
      </p>

      <LeadModal
        lead={selected}
        onClose={() => setSelected(null)}
        onMoveStage={async (id, stage) => {
          await onMoveStage(id, stage)
          setSelected(null)
        }}
      />
    </>
  )
}
