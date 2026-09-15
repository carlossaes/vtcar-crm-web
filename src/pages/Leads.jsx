import { useMemo, useState } from 'react'
import { Users2, SearchX } from 'lucide-react'
import { ChannelBadge, StageBadge, STAGE_META, STAGE_ORDER } from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { displayName, formatPhone, hasName, initials } from '../format'
import LeadModal from '../components/LeadModal'

const FILTERS = [{ id: 'todos', label: 'Todos' }, ...STAGE_ORDER.map((s) => ({ id: s, label: STAGE_META[s].label }))]

export default function Leads({ leads, search, usuario, vendedores = [], onMoveStage, onLeadChanged }) {
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('todos')
  const [ownerFilter, setOwnerFilter] = useState('todos')
  const ehGerente = usuario?.papel === 'gerente'

  // Leads e a caixa de entrada / triagem -- so mostra o que ainda e lead.
  // Assim que alguem assume (ou uma oportunidade e criada direto), o
  // registro "sai" daqui e passa a aparecer no Pipeline. Ver
  // ENTREGA-003-HANDOFF-CTO.md, ajuste de 15/09/2026.
  const soLeads = useMemo(() => leads.filter((l) => l.recordType !== 'opportunity'), [leads])

  const byStage = useMemo(() => (filter === 'todos' ? soLeads : soLeads.filter((l) => l.stage === filter)), [soLeads, filter])

  const byOwner = useMemo(() => {
    if (!ehGerente || ownerFilter === 'todos') return byStage
    if (ownerFilter === 'sem-responsavel') return byStage.filter((l) => !l.ownerId)
    return byStage.filter((l) => l.ownerId === ownerFilter)
  }, [byStage, ownerFilter, ehGerente])

  const filtered = useMemo(() => {
    if (!search) return byOwner
    const q = search.toLowerCase()
    return byOwner.filter(
      (l) =>
        (l.name || '').toLowerCase().includes(q) ||
        (l.phone || '').includes(q) ||
        (formatPhone(l.phone) || '').includes(q) ||
        (l.channel || '').toLowerCase().includes(q) ||
        (l.vehicleInterest || '').toLowerCase().includes(q)
    )
  }, [byOwner, search])

  return (
    <section className="bg-surface border border-line rounded-card shadow-card overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-line">
        <h2 className="text-[13.5px] font-semibold mr-auto">
          Leads <span className="text-ink3 font-normal tnum">({filtered.length})</span>
        </h2>
        {ehGerente && (
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="bg-surface2 border border-line rounded-control px-2.5 h-8 text-[12.5px] outline-none focus:border-brand"
          >
            <option value="todos">Todos os responsáveis</option>
            <option value="sem-responsavel">Sem responsável</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        )}
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
                <th className="py-2.5 px-3 font-semibold">Responsável</th>
                <th className="py-2.5 px-3 font-semibold">Estágio</th>
                <th className="py-2.5 px-5 font-semibold text-right">Entrada</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelected(lead)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelected(lead)}
                  className="border-t border-line cursor-pointer hover:bg-surface2 transition-colors"
                >
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-surface2 border border-line grid place-items-center text-[11px] font-semibold text-ink2 shrink-0">
                        {initials(lead)}
                      </div>
                      <span
                        className={`text-[13.5px] ${hasName(lead) ? 'font-medium' : 'text-ink3 tnum'}`}
                        title={hasName(lead) ? undefined : 'Esse contato não tem nome no perfil do WhatsApp'}
                      >
                        {displayName(lead)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <ChannelBadge channel={lead.channel} />
                  </td>
                  <td className="py-3 px-3 text-[13px] text-ink2">{lead.vehicleInterest || 'A confirmar'}</td>
                  <td className="py-3 px-3 text-[13px] text-ink2 tnum">{formatPhone(lead.phone) || '—'}</td>
                  <td className="py-3 px-3 text-[13px]">
                    {lead.ownerName ? (
                      <span className="text-ink2">{lead.ownerName}</span>
                    ) : (
                      <span className="text-ink3">Sem responsável</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <StageBadge stage={lead.stage} />
                  </td>
                  <td className="py-3 px-5 text-[13px] text-ink3 tnum text-right">
                    {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : soLeads.length === 0 ? (
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
        usuario={usuario}
        vendedores={vendedores}
        onClose={() => setSelected(null)}
        onMoveStage={async (id, stage) => {
          await onMoveStage(id, stage)
          setSelected(null)
        }}
        onLeadChanged={(atualizado) => {
          onLeadChanged(atualizado)
          setSelected(atualizado)
        }}
      />
    </section>
  )
}
