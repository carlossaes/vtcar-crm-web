export const TIME_ZONE = 'America/Sao_Paulo'
export const LOST_REASONS = [
  ['preco', 'Preço'], ['financiamento_nao_aprovado', 'Financiamento não aprovado'],
  ['sem_entrada', 'Sem entrada'], ['desistiu', 'Desistiu'], ['comprou_concorrente', 'Comprou no concorrente'],
  ['veiculo_indisponivel', 'Veículo indisponível'], ['troca_nao_aprovada', 'Troca não aprovada'],
  ['sem_retorno', 'Sem retorno'], ['contato_invalido', 'Contato inválido'], ['outro', 'Outro'],
]
export const STATUS_LABEL = { SEM_PRÓXIMO_PASSO: 'Sem próximo passo', HOJE: 'Hoje', ATRASADO: 'Atrasado', FUTURO: 'Próximo' }
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
  switch (followUpStatus(lead, now)) {
    case 'ATRASADO': return 'Follow-up atrasado'
    case 'HOJE': return `Follow-up hoje às ${followUpTime(lead.nextFollowUpAt)}`
    case 'FUTURO': return `Próximo: ${followUpDate(lead.nextFollowUpAt)} às ${followUpTime(lead.nextFollowUpAt)}`
    default: return 'Sem próximo passo'
  }
}

export function followUpIndicators(leads, now = Date.now()) {
  const result = { HOJE: 0, ATRASADO: 0, SEM_PRÓXIMO_PASSO: 0, FUTURO: 0, average: '' }
  const durations = []
  for (const lead of leads) {
    result[followUpStatus(lead, now)]++
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
