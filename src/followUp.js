export const TIME_ZONE = 'America/Sao_Paulo'
export const LOST_REASONS = [
  ['preco', 'Preço'], ['financiamento_nao_aprovado', 'Financiamento não aprovado'],
  ['sem_entrada', 'Sem entrada'], ['desistiu', 'Desistiu'], ['comprou_concorrente', 'Comprou no concorrente'],
  ['veiculo_indisponivel', 'Veículo indisponível'], ['troca_nao_aprovada', 'Troca não aprovada'],
  ['sem_retorno', 'Sem retorno'], ['contato_invalido', 'Contato inválido'], ['outro', 'Outro'],
]
export const STATUS_LABEL = { SEM_PRÓXIMO_PASSO: 'Sem próxima ação', HOJE: 'Hoje', ATRASADO: 'Atrasada', FUTURO: 'Próxima', CONCLUIDA: 'Concluída' }
const ATTENTION_STYLE = { textClass: 'text-amber-700 dark:text-amber-400', badgeClass: 'border-amber-500/30 bg-amber-500/5' }
const FOLLOW_UP_STYLE = {
  ATRASADO: { textClass: 'text-critical', badgeClass: 'border-critical/30 bg-critical/5' },
  HOJE: ATTENTION_STYLE,
  FUTURO: { textClass: 'text-slate-600 dark:text-slate-300', badgeClass: 'border-slate-400/30 bg-slate-500/5' },
  CONCLUIDA: { textClass: 'text-green-700 dark:text-green-400', badgeClass: 'border-green-500/30 bg-green-500/5' },
  SEM_PRÓXIMO_PASSO: ATTENTION_STYLE,
}
const dateValue = (value) => value ? new Date(value).getTime() : NaN
const dayKey = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))

export function followUpStatus(lead, now = Date.now()) {
  const due = dateValue(lead.nextFollowUpAt)
  if (!lead.nextAction?.trim() || !Number.isFinite(due)) return 'SEM_PRÓXIMO_PASSO'
  if (due < Number(now)) return 'ATRASADO'
  return dayKey(due) === dayKey(now) ? 'HOJE' : 'FUTURO'
}

export function followUpTime(value) {
  return new Date(value).toLocaleTimeString('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })
}
export function followUpDate(value) {
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit' })
}
export function followUpCardText(lead, now = Date.now()) {
  return followUpPresentation(lead, now).label
}

// Presentation only: the temporal classifier and indicator calculations stay unchanged.
export function followUpPresentation(lead, now = Date.now()) {
  const status = lead.taskStatus === 'concluida' ? 'CONCLUIDA' : followUpStatus(lead, now)
  let label = STATUS_LABEL[status]
  let detail = ''
  if (status === 'ATRASADO') {
    label = 'Follow-up atrasado'
    const hours = Math.floor((Number(now) - dateValue(lead.nextFollowUpAt)) / 3600000)
    const days = Math.floor(hours / 24)
    detail = days > 0 ? `há ${days} ${days === 1 ? 'dia' : 'dias'}`
      : hours > 0 ? `há ${hours} ${hours === 1 ? 'hora' : 'horas'}` : 'há menos de 1 hora'
  } else if (status === 'HOJE') {
    label = `Follow-up hoje às ${followUpTime(lead.nextFollowUpAt)}`
  } else if (status === 'FUTURO') {
    label = `Próximo: ${followUpDate(lead.nextFollowUpAt)} às ${followUpTime(lead.nextFollowUpAt)}`
  } else if (status === 'CONCLUIDA') {
    label = 'Follow-up concluído'
  }
  return { status, label, detail, ...FOLLOW_UP_STYLE[status],
    dueLabel: status === 'ATRASADO' || status === 'HOJE' ? STATUS_LABEL[status] : '',
    actionLabel: status === 'SEM_PRÓXIMO_PASSO' ? 'Definir ação' : 'Editar follow-up' }
}

export function followUpIndicators(leads, now = Date.now()) {
  const result = { HOJE: 0, ATRASADO: 0, SEM_PRÓXIMO_PASSO: 0, FUTURO: 0, average: '' }
  const durations = []
  for (const lead of leads) {
    if (lead.taskStatus !== 'concluida') result[followUpStatus(lead, now)]++
    const duration = dateValue(lead.firstHumanActionAt) - dateValue(lead.createdAt)
    if (Number.isFinite(duration) && duration >= 0) durations.push(duration)
  }
  if (durations.length) {
    const minutes = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60000)
    result.average = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`
  }
  return result
}

export function toFollowUpInput(value) {
  if (!Number.isFinite(dateValue(value))) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

// Resolve wall time in the same IANA timezone used by cards and indicators.
export function fromFollowUpInput(value) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Informe uma data/hora válida.')
  const wall = Date.parse(`${value}:00Z`)
  let instant = wall
  for (let i = 0; i < 3; i++) {
    const displayed = Date.parse(`${toFollowUpInput(new Date(instant).toISOString())}:00Z`)
    instant += wall - displayed
  }
  const iso = new Date(instant).toISOString()
  if (toFollowUpInput(iso) !== value) throw new Error('Informe uma data/hora válida.')
  return iso
}
