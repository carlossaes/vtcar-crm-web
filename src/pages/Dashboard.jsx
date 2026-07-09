import { motion } from 'framer-motion'
import { DollarSign, Users2, Clock, Car } from 'lucide-react'
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import KpiCard from '../components/KpiCard'

const SALES_DATA = [
  { month: 'Jan', vendas: 6 },
  { month: 'Fev', vendas: 8 },
  { month: 'Mar', vendas: 5 },
  { month: 'Abr', vendas: 9 },
  { month: 'Mai', vendas: 7 },
  { month: 'Jun', vendas: 10 },
]

const STAGE_ORDER = ['novo', 'qualificado', 'proposta', 'negociacao', 'fechado']
const STAGE_LABELS = { novo: 'Leads', qualificado: 'Qualificados', proposta: 'Proposta', negociacao: 'Negociação', fechado: 'Fechados' }
const STAGE_COLORS = {
  novo: 'bg-blue-500',
  qualificado: 'bg-purple-500',
  proposta: 'bg-yellow-500',
  negociacao: 'bg-orange-500',
  fechado: 'bg-green-500',
}

export default function Dashboard({ leads }) {
  const total = leads.length
  const counts = STAGE_ORDER.map((stage) => leads.filter((l) => l.stage === stage).length)
  const maxCount = Math.max(total, 1)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} iconClass="bg-accent/15 text-accent" label="Receita (Junho)" value="R$ 487k" change="18% vs maio" changeUp delay={0} />
        <KpiCard
          icon={Users2}
          iconClass="bg-blue-500/15 text-blue-400"
          label="Novos Leads"
          value={total}
          change="captados via GPT Maker"
          changeUp
          delay={0.05}
        />
        <KpiCard
          icon={Clock}
          iconClass="bg-yellow-500/15 text-yellow-400"
          label="Negociações Abertas"
          value={counts[2] + counts[3]}
          change="proposta + negociação"
          changeUp={false}
          delay={0.1}
        />
        <KpiCard icon={Car} iconClass="bg-purple-500/15 text-purple-400" label="Veículos em Estoque" value={48} change="6 novas entradas" changeUp delay={0.15} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="col-span-2 bg-bg2 border border-border rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold">Vendas por Mês</span>
            <span className="text-xs text-accent">2026</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={SALES_DATA}>
              <CartesianGrid stroke="#2e3250" vertical={false} />
              <XAxis dataKey="month" stroke="#8b93b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2e3250', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="vendas" fill="#e63946" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="bg-bg2 border border-border rounded-xl p-5">
          <div className="text-sm font-bold mb-4">Funil de Vendas</div>
          <div className="flex flex-col gap-3">
            {STAGE_ORDER.map((stage, i) => (
              <div key={stage}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-text2">{STAGE_LABELS[stage]}</span>
                  <span className="font-semibold">{counts[i]}</span>
                </div>
                <div className="h-1.5 bg-bg3 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(counts[i] / maxCount) * 100}%` }}
                    transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                    className={`h-full rounded-full ${STAGE_COLORS[stage]}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
