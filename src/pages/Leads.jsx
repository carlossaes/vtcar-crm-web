import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChannelBadge, StageBadge } from '../components/Badge'
import LeadModal from '../components/LeadModal'

export default function Leads({ leads, search, onMoveStage }) {
  const [selected, setSelected] = useState(null)

  const filtered = useMemo(() => {
    if (!search) return leads
    const q = search.toLowerCase()
    return leads.filter(
      (l) => (l.name || '').toLowerCase().includes(q) || (l.phone || '').includes(q) || (l.channel || '').toLowerCase().includes(q)
    )
  }, [leads, search])

  return (
    <div className="bg-bg2 border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold">Todos os Leads ({filtered.length})</span>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-text2 border-b border-border">
            <th className="pb-2.5 px-3">Nome</th>
            <th className="pb-2.5 px-3">Canal</th>
            <th className="pb-2.5 px-3">Interesse</th>
            <th className="pb-2.5 px-3">Telefone</th>
            <th className="pb-2.5 px-3">Status</th>
            <th className="pb-2.5 px-3">Data</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((lead, i) => (
            <motion.tr
              key={lead.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelected(lead)}
              className="border-b border-border last:border-0 cursor-pointer hover:bg-bg3 transition-colors"
            >
              <td className="p-3 font-semibold text-sm">{lead.name || 'Sem nome'}</td>
              <td className="p-3">
                <ChannelBadge channel={lead.channel} />
              </td>
              <td className="p-3 text-sm">{lead.vehicleInterest || 'A confirmar'}</td>
              <td className="p-3 text-sm">{lead.phone || '—'}</td>
              <td className="p-3">
                <StageBadge stage={lead.stage} />
              </td>
              <td className="p-3 text-sm text-text2">{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</td>
            </motion.tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="p-6 text-center text-text2 text-sm">
                Nenhum lead ainda. Assim que alguém mandar mensagem pra Vitória, aparece aqui.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <LeadModal
        lead={selected}
        onClose={() => setSelected(null)}
        onMoveStage={async (id, stage) => {
          await onMoveStage(id, stage)
          setSelected(null)
        }}
      />
    </div>
  )
}
