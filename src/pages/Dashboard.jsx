import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Users2, Handshake, Trophy, Percent, BarChart3, Inbox } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import KpiCard from '../components/KpiCard'
import EmptyState from '../components/EmptyState'
import { STAGE_META, STAGE_ORDER } from '../components/Badge'

const WEEKS = 8

function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay()) // domingo como inicio da semana
  return d
}

// Serie real de leads por semana, derivada do createdAt de cada lead.
function buildWeeklySeries(leads) {
  const buckets = []
  const cursor = startOfWeek(new Date())
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = new Date(cursor)
    start.setDate(start.getDate() - i * 7)
    buckets.push({
      key: start.getTime(),
      label: start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      leads: 0,
    })
  }
  leads.forEach((lead) => {
    if (!lead.createdAt) return
    const week = startOfWeek(lead.createdAt).getTime()
    const bucket = buckets.find((b) => b.key === week)
    if (bucket) bucket.leads += 1
  })
  return buckets
}

function ChartTooltip({ active, payload, label, unit = 'lead' }) {
  if (!active || !payload || !payload.length) return null
  const value = payload[0].value
  return (
    <div className="bg-surface border border-line rounded-control shadow-pop px-3 py-2">
      <div className="text-[11px] text-ink3">{label}</div>
      <div className="text-[13px] font-semibold tnum">
        {value} {unit}
        {value === 1 ? '' : 's'}
      </div>
    </div>
  )
}

function Card({ title, meta, children, className = '', delay = 0 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: 'easeOut' }}
      className={`bg-surface border border-line rounded-card shadow-card ${className}`}
    >
      <header className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        {meta && <span className="text-[11.5px] text-ink3">{meta}</span>}
      </header>
      <div className="px-5 pb-5">{children}</div>
    </motion.section>
  )
}

// Barra horizontal fina com rotulo direto — usada no funil e na origem.
function BarRow({ label, value, total, colorClass, delay }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12.5px] mb-1.5">
        <span className="text-ink2">{label}</span>
        <span className="font-semibold tnum">
          {value}
          <span className="text-ink3 font-normal ml-1.5">{total > 0 ? `${Math.round(pct)}%` : ''}</span>
        </span>
      </div>
      <div className="h-2 bg-surface2 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay, duration: 0.5, ease: 'easeOut' }}
          className={`h-full rounded-full ${colorClass}`}
        />
      </div>
    </div>
  )
}

export default function Dashboard({ leads, onGoToLeads }) {
  const weekly = useMemo(() => buildWeeklySeries(leads), [leads])

  const stageCounts = useMemo(
    () => STAGE_ORDER.map((stage) => leads.filter((l) => l.stage === stage).length),
    [leads]
  )

  // Canais: os 3 maiores viram serie propria; o resto vira "Outros".
  // Passar de 3 fatias coloridas quebraria a separacao de daltonismo.
  const channels = useMemo(() => {
    const map = new Map()
    leads.forEach((l) => {
      const key = l.channel || 'Desconhecido'
      map.set(key, (map.get(key) || 0) + 1)
    })
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 3).map(([name, value], i) => ({
      name,
      value,
      colorClass: ['bg-series1', 'bg-series2', 'bg-series3'][i],
    }))
    const rest = sorted.slice(3).reduce((sum, [, v]) => sum + v, 0)
    if (rest > 0) top.push({ name: 'Outros', value: rest, colorClass: 'bg-ink3' })
    return top
  }, [leads])

  const total = leads.length
  const negociando = stageCounts[2] + stageCounts[3]
  const fechados = stageCounts[4]
  const conversao = total > 0 ? Math.round((fechados / total) * 100) : 0
  const thisWeek = weekly[weekly.length - 1]?.leads || 0
  const lastWeek = weekly[weekly.length - 2]?.leads || 0
  const weekTrend = thisWeek > lastWeek ? 'up' : thisWeek < lastWeek ? 'down' : 'flat'
  const hasData = total > 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={Users2}
          label="Leads no total"
          value={total}
          hint={`${thisWeek} nesta semana`}
          trend={weekTrend}
          delay={0}
        />
        <KpiCard
          icon={Handshake}
          label="Em negociação"
          value={negociando}
          hint="proposta + negociação"
          delay={0.04}
        />
        <KpiCard icon={Trophy} label="Fechados" value={fechados} hint="negócios ganhos" delay={0.08} />
        <KpiCard
          icon={Percent}
          label="Taxa de conversão"
          value={`${conversao}%`}
          hint="fechados sobre o total"
          delay={0.12}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card
          title="Leads por semana"
          meta="últimas 8 semanas"
          className="xl:col-span-2"
          delay={0.16}
        >
          {hasData ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={weekly} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid stroke="rgb(var(--grid))" strokeWidth={1} vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="rgb(var(--axis))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dy={6}
                />
                <YAxis
                  stroke="rgb(var(--axis))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ fill: 'rgb(var(--surface-2))' }}
                  content={<ChartTooltip unit="lead" />}
                />
                <Bar dataKey="leads" fill="rgb(var(--series-1))" radius={[4, 4, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={BarChart3}
              compact
              title="Sem leads para plotar ainda"
              description="Assim que a Vitória captar o primeiro contato, o gráfico começa a se preencher sozinho."
            />
          )}
        </Card>

        <Card title="Funil de vendas" meta={`${total} no total`} delay={0.2}>
          <div className="flex flex-col gap-3.5">
            {STAGE_ORDER.map((stage, i) => (
              <BarRow
                key={stage}
                label={STAGE_META[stage].label}
                value={stageCounts[i]}
                total={total}
                colorClass={STAGE_META[stage].dot}
                delay={0.24 + i * 0.04}
              />
            ))}
          </div>
        </Card>
      </div>

      <Card title="Origem dos leads" meta="por canal de entrada" delay={0.24}>
        {channels.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
            {channels.map((c, i) => (
              <BarRow
                key={c.name}
                label={c.name}
                value={c.value}
                total={total}
                colorClass={c.colorClass}
                delay={0.28 + i * 0.04}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Inbox}
            compact
            title="Nenhum canal registrado"
            description="Os canais aparecem aqui conforme os leads chegam pelo WhatsApp, Instagram ou site."
            action={
              onGoToLeads && (
                <button
                  onClick={onGoToLeads}
                  className="text-[13px] font-semibold text-brand hover:text-brandHover transition-colors"
                >
                  Cadastrar um lead manualmente →
                </button>
              )
            }
          />
        )}
      </Card>
    </div>
  )
}
