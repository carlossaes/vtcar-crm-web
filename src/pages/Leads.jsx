import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Users2, SearchX } from 'lucide-react'
import { ChannelBadge, StageBadge, STAGE_META, STAGE_ORDER } from '../components/Badge'
import EmptyState from '../components/EmptyState'
import LeadModal from '../components/LeadModal'

const FILTERS = [{ id: 'todos', label: 'Todos' }, ...STAGE_ORDER.map((s) => ({ id: s, label: STAGE_META[s].label }))]

function initials(name) {
  if (!name) return '—'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

export default function Leads({ leads, search, onMoveStage }) {
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('todos')

  const byStage = useMemo(() => (filter === 'todos' ? leads : leads.filter((l) => l.stage === filter)), [leads, filter])

  const filtered = useMemo(() => {
    if (!search) return byStage
    const q = search.toLowerCase()
    return byStage.filter(
      (l) =>
        (l.name || '').toLowerCase().includes(q) ||
        (l.phone || '').includes(q) ||
        (l.channel || '').toLowerCase().includes(q) ||
        (l.vehicleInterest || '').toLowerCase().includes(q)
    )
  }, [byStage, search])

  return (
    <section className="bg-surface border border-line rounded-card shadow-card overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-line">
        <h2 className="text-[13.5px] font-semibold mr-auto">
          Leads <span className="text-ink3 font-normal tnum">({filtered.length})</span>
        </h2>
        <div className="flex items-center gap-1 bg-surface2 border border-line rounded-control p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded-[7px] text-[12px] font-medium transition-colors ${
                filter === f.id ? 'bg-surface text-ink shadow-card' : 'text-ink2 hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-micro uppercase font-semibold text-ink3 bg-surface2/60">
                <th className="py-2.5 px-5 font-semibold">Lead</th>
                <th className="py-2.5 px-3 font-semibold">Canal</th>
                <th className="py-2.5 px-3 font-semibold">Interesse</th>
                <th className="py-2.5 px-3 font-semibold">Telefone</th>
                <th className="py-2.5 px-3 font-semibold">Estágio</th>
                <th className="py-2.5 px-5 font-semibold text-right">Entrada</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, i) => (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  onClick={() => setSelected(lead)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelected(lead)}
                  className="border-t border-line cursor-pointer hover:bg-surface2 transition-colors"
                >
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-surface2 border border-line grid place-items-center text-[11px] font-semibold text-ink2 shrink-0">
                        {initials(lead.name)}
                      </div>
                      <span className="font-medium text-[13.5px]">{lead.name || 'Sem nome'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <ChannelBadge channel={lead.channel} />
                  </td>
                  <td className="py-3 px-3 text-[13px] text-ink2">{lead.vehicleInterest || 'A confirmar'}</td>
                  <td className="py-3 px-3 text-[13px] text-ink2 tnum">{lead.phone || '—'}</td>
                  <td className="py-3 px-3">
                    <StageBadge stage={lead.stage} />
                  </td>
                  <td className="py-3 px-5 text-[13px] text-ink3 tnum text-right">
                    {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="Nenhum lead por aqui ainda"
          description="Assim que alguém mandar a primeira mensagem pra Vitória, o lead entra nessa lista automaticamente."
        />
      ) : (
        <EmptyState
          icon={SearchX}
          title="Nada bateu com esse filtro"
          description="Tente outro estágio ou limpe a busca lá em cima."
        />
      )}

      <LeadModal
        lead={selected}
        onClose={() => setSelected(null)}
        onMoveStage={async (id, stage) => {
          await onMoveStage(id, stage)
          setSelected(null)
        }}
      />
    </section>
  )
}
