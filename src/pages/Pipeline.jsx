import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GripVertical, Inbox } from 'lucide-react'
import { ChannelBadge, STAGE_META } from '../components/Badge'
import { displayName, formatPhone, quandoEntrou } from '../format'
import LeadModal from '../components/LeadModal'
import { effectiveValue, formatBRL, pipelineIndicators } from '../opportunity'
import { followUpCardText, followUpIndicators } from '../followUp'
import useNow from '../useNow'
import useStageChange from '../components/useStageChange'

// O funil inteiro, incluindo as duas saidas (fechado e perdido).
const COLUMNS = ['novo', 'qualificado', 'proposta', 'negociacao', 'fechado', 'perdido']
// Percentual comercial fixo por estágio, não uma previsão estatística.
const COLUMN_META = {
  novo: { chance: 10, badge: 'bg-sky-50 text-sky-800' },
  qualificado: { chance: 25, badge: 'bg-blue-100 text-blue-800' },
  proposta: { chance: 50, badge: 'bg-orange-50 text-orange-800' },
  negociacao: { chance: 75, badge: 'bg-amber-50 text-amber-800' },
  fechado: { chance: 100, badge: 'bg-green-50 text-green-800' },
  perdido: { chance: 0, badge: 'bg-rose-50 text-rose-800' },
}

export function LeadCard({ lead, onOpen, onMoveRelative, dragging, onDragStart, onDragEnd, now }) {
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
      <div className="text-[14px] font-semibold mt-2">{formatBRL(lead.negotiatedValue ?? lead.assetValue ?? 0)}</div>
      {lead.assetValue != null && lead.negotiatedValue != null && lead.assetValue !== lead.negotiatedValue && (
        <div className="text-[11px] text-ink3"><div>Bem: {formatBRL(lead.assetValue)}</div><div>Negociado: {formatBRL(lead.negotiatedValue)}</div></div>
      )}
      {lead.hasTradeIn && <div className="text-[11.5px] text-brand mt-1">Com troca</div>}
      <div className="text-[11.5px] text-ink2 mt-1 truncate">{followUpCardText(lead, now)}</div>
      <div className="flex items-center justify-between gap-2 mt-2.5">
        <ChannelBadge channel={lead.origin || lead.channel} />
        <span className="text-[11.5px] text-ink3 tnum shrink-0">{quandoEntrou(lead.createdAt)}</span>
      </div>
      <div className="text-[11.5px] mt-1.5 truncate">
        {lead.ownerName ? (
          <span className="text-ink2">{lead.ownerName}</span>
        ) : (
          <span className="text-ink3">Sem responsável</span>
        )}
      </div>
    </motion.article>
  )
}

export default function Pipeline({ leads, search, usuario, vendedores = [], onMoveStage, onLeadChanged }) {
  const [selected, setSelected] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [hoverColumn, setHoverColumn] = useState(null)
  const [ownerFilter, setOwnerFilter] = useState('todos')
  const ehGerente = usuario?.papel === 'gerente'
  const now = useNow()
  const { requestMove, lossDialog } = useStageChange(onMoveStage)

  const filtered = useMemo(() => {
    // Pipeline e a carteira comercial: so oportunidade entra aqui. Lead
    // livre (sem responsavel, recordType "lead") fica na caixa de entrada
    // (tela Leads) ate alguem assumir -- ai sim ele vira oportunidade e
    // aparece aqui. Ver ENTREGA-003-HANDOFF-CTO.md, ajuste de 15/09/2026.
    let base = leads.filter((l) => l.recordType === 'opportunity')
    // O backend ja so manda pro vendedor o que e dele (podeVerLead), mas a
    // regra pedida e explicita: "recordType opportunity AND ownerId =
    // usuario logado". Reforça aqui tambem, sem depender so do que a API
    // devolveu.
    base = ehGerente
      ? ownerFilter !== 'todos'
        ? base.filter((l) => l.ownerId === ownerFilter)
        : base
      : base.filter((l) => l.ownerId === usuario?.id)
    if (!search) return base
    const q = search.toLowerCase()
    return base.filter(
      (l) =>
        (l.name || '').toLowerCase().includes(q) ||
        (l.phone || '').includes(q) ||
        (formatPhone(l.phone) || '').includes(q) ||
        (l.channel || '').toLowerCase().includes(q) ||
        (l.vehicleInterest || '').toLowerCase().includes(q)
    )
  }, [leads, search, ownerFilter, ehGerente, usuario])

  const byStage = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((c) => [c, []]))
    filtered.forEach((lead) => {
      const stage = map[lead.stage] ? lead.stage : 'novo'
      map[stage].push(lead)
    })
    return map
  }, [filtered])
  const indicators = useMemo(() => pipelineIndicators(filtered), [filtered])
  const followUps = followUpIndicators(filtered, now)

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
    if (lead && lead.stage !== stage) requestMove(id, stage)
  }

  const moveRelative = (lead, delta) => {
    const index = COLUMNS.indexOf(lead.stage)
    const next = COLUMNS[index + delta]
    if (next) requestMove(lead.id, next)
  }

  return (
    <>
      {lossDialog}
      <div aria-label="Indicadores de follow-up" className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {[
          ['Follow-ups hoje', followUps.HOJE], ['Atrasados', followUps.ATRASADO],
          ['Sem próximo passo', followUps.SEM_PRÓXIMO_PASSO], ['Tempo médio até assumir', followUps.average],
        ].map(([title, value]) => <section key={title} aria-label={title} className="bg-surface border border-line rounded-card p-3">
          <h2 className="text-micro uppercase text-ink3 font-semibold">{title}</h2><div className="text-[19px] font-bold tnum">{value}</div>
        </section>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-4" aria-label="Indicadores financeiros">
        {[
          ['Pipeline aberto', formatBRL(indicators.openValue), `${indicators.openCount} oportunidades abertas`],
          ['Vendas fechadas', formatBRL(indicators.closedValue), `${indicators.closedCount} veículos vendidos`],
          ['Ticket médio', formatBRL(indicators.average), 'Por veículo vendido'],
          ['Perdidas', formatBRL(indicators.lostValue), `${indicators.lostCount} oportunidades perdidas`],
          ['Conversão', `${indicators.conversion.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, 'Fechadas / (fechadas + perdidas)'],
        ].map(([title, value, subtitle]) => <section key={title} aria-label={title} className="bg-surface border border-line rounded-card p-4">
          <h2 className="text-micro uppercase text-ink3 font-semibold">{title}</h2><div className="text-[19px] font-bold tnum my-1">{value}</div><p className="text-[11.5px] text-ink2">{subtitle}</p>
        </section>)}
      </div>
      {ehGerente && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[12px] text-ink3">Responsável:</span>
          <select
            aria-label="Filtrar por vendedor"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="bg-surface2 border border-line rounded-control px-2.5 h-8 text-[12.5px] outline-none focus:border-brand"
          >
            <option value="todos">Todos</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Colunas crescem pra ocupar a largura livre e so entram em rolagem
      horizontal quando a tela nao comporta a largura minima. */}
      <div className="flex gap-3 overflow-x-auto items-stretch pb-2 -mx-1 px-1 min-h-[calc(100vh-14rem)]">
        {COLUMNS.map((stage) => {
          const meta = STAGE_META[stage]
          const items = byStage[stage]
          const stageTotal = items.reduce((total, item) => total + effectiveValue(item), 0)
          const columnMeta = COLUMN_META[stage]
          const isTarget = hoverColumn === stage
          return (
            <section
              key={stage}
              aria-label={`Etapa ${meta.label}`}
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
              <header className="px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${columnMeta.badge}`}>{meta.label}</h2>
                  <span aria-label="Quantidade de oportunidades" className="text-[11.5px] text-ink2 tnum">{items.length}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 text-[11.5px] tnum">
                  <span aria-label="Valor da etapa" className="font-semibold">{formatBRL(stageTotal)}</span>
                  <span className="text-ink2 whitespace-nowrap" title="Percentual comercial fixo por estágio">
                    {columnMeta.chance}%{stage !== 'fechado' && stage !== 'perdido' ? ' de chance' : ''}
                  </span>
                </div>
              </header>

              <div className="flex flex-col gap-2 px-2.5 pb-2.5 flex-1 min-h-[120px]">
                <AnimatePresence initial={false}>
                  {items.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      now={now}
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
        usuario={usuario}
        vendedores={vendedores}
        onClose={() => setSelected(null)}
        onMoveStage={async (id, stage, reason) => {
          const result = await onMoveStage(id, stage, reason)
          if (result !== false) setSelected(null)
          return result
        }}
        onLeadChanged={(atualizado) => {
          onLeadChanged(atualizado)
          setSelected(atualizado)
        }}
      />
    </>
  )
}
