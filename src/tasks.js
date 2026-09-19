import { fromFollowUpInput, toFollowUpInput, TIME_ZONE } from './followUp'

export const TASK_TYPES = { ligacao: 'Ligação', whatsapp: 'WhatsApp', visita: 'Visita', proposta: 'Proposta', follow_up: 'Follow-up', outro: 'Outro' }
export const TASK_PRIORITIES = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' }
export const TASK_STATUSES = { pendente: 'Pendente', concluida: 'Concluída' }
export const TASK_PERIODS = { atrasadas: 'Atrasadas', hoje: 'Hoje', semana: 'Próximos 7 dias', todas: 'Todas' }

export function effectiveTask(lead) {
  return { ...lead, taskType: lead.taskType || 'follow_up', taskPriority: lead.taskPriority || 'media',
    taskStatus: lead.taskStatus || 'pendente', taskCompletedAt: lead.taskCompletedAt ?? null }
}

export function hasTask(lead) {
  if (typeof lead.nextAction !== 'string' || !lead.nextAction.trim() || typeof lead.nextFollowUpAt !== 'string') return false
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(lead.nextFollowUpAt)
  if (!match || !Number.isFinite(Date.parse(lead.nextFollowUpAt))) return false
  if (match[2] !== 'Z' && match[2].slice(1, 3) === '14' && match[2].slice(4) !== '00') return false
  return new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) === match[1]
}

export function visibleOpportunities(leads, usuario) {
  if (!usuario || !['gerente', 'vendedor'].includes(usuario.papel)) return []
  return leads.filter((lead) => (lead.recordType || (lead.ownerId ? 'opportunity' : 'lead')) === 'opportunity' &&
    (usuario.papel === 'gerente' || lead.ownerId === usuario.id))
}

// Calendar-day arithmetic in São Paulo, independent of the browser timezone.
const dayNumber = (date) => Date.parse(`${toFollowUpInput(date).slice(0, 10)}T00:00:00Z`) / 86400000
export function inTaskPeriod(lead, period, now) {
  if (period === 'todas') return true
  if (lead.taskStatus === 'concluida') return false
  if (period === 'atrasadas') return Date.parse(lead.nextFollowUpAt) < Number(now)
  const days = dayNumber(lead.nextFollowUpAt) - dayNumber(new Date(now).toISOString())
  if (period === 'hoje') return days === 0 // Includes overdue tasks from today, highlighted in the table.
  return period === 'semana' && days >= 0 && days <= 7
}

export function filterTasks(opportunities, filters, now = Date.now()) {
  const query = (filters.search || '').trim().toLocaleLowerCase('pt-BR')
  return opportunities.filter(hasTask).map(effectiveTask).filter((lead) =>
    inTaskPeriod(lead, filters.period || 'todas', now) &&
    (!filters.status || lead.taskStatus === filters.status) &&
    (!filters.priority || lead.taskPriority === filters.priority) &&
    (!filters.type || lead.taskType === filters.type) &&
    (!filters.owner || lead.ownerId === filters.owner) &&
    (!query || [lead.nextAction, lead.name, lead.phone, lead.vehicleInterest].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(query)))
  ).sort((a, b) => Date.parse(a.nextFollowUpAt) - Date.parse(b.nextFollowUpAt) || a.id.localeCompare(b.id))
}

export function taskDraft(lead = {}) {
  const task = effectiveTask(lead)
  return { nextAction: lead.nextAction || '', date: toFollowUpInput(lead.nextFollowUpAt), taskType: task.taskType, taskPriority: task.taskPriority }
}
export function taskPayload(draft) {
  return { nextAction: draft.nextAction.trim(), nextFollowUpAt: fromFollowUpInput(draft.date), taskType: draft.taskType, taskPriority: draft.taskPriority }
}
export function taskDate(value) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }) : ''
}
export function taskDateTime(value) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('pt-BR', {
    timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).replace(',', '') : ''
}
