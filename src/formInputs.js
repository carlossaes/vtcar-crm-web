import { formatPhone } from './format'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const formatBRL = (value) => currency.format(value ?? 0)
const empty = (value) => value == null || (typeof value === 'string' && !value.trim())

export function parseCurrencyInput(value) {
  if (empty(value)) return null
  if (typeof value === 'number') {
    if (Number.isFinite(value) && value >= 0) return value
    throw new Error('Informe um valor válido.')
  }
  if (typeof value !== 'string') throw new Error('Informe um valor válido.')
  const text = value.trim().replace(/^R\$\s*/, '')
  // Ponto só agrupa milhares. Decimal brasileiro usa vírgula, nunca ponto.
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) throw new Error('Informe um valor válido.')
  const number = Number(text.replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(number)) throw new Error('Informe um valor válido.')
  return number
}
export function formatCurrencyInput(value) {
  const number = parseCurrencyInput(value)
  return number === null ? '' : formatBRL(number).replace(/\u00a0/g, ' ')
}
export function parseInstallmentsInput(value) {
  if (empty(value)) return null
  const message = 'A quantidade de parcelas deve ser um número inteiro maior que zero.'
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value.trim()))) throw new Error(message)
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(message)
  return number
}
export function formatPhoneInput(value) {
  const text = value == null ? '' : String(value)
  return /^[+\d\s().-]*$/.test(text) ? formatPhone(text) || '' : text
}
export function normalizePhoneInput(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!/^[+\d\s().-]+$/.test(text) || !/\d/.test(text)) throw new Error('Informe um telefone válido.')
  const digits = text.replace(/\D/g, '')
  return (digits.length === 12 || digits.length === 13) && digits.startsWith('55') ? digits.slice(2) : digits
}
export function normalizeEmailInput(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new Error('Informe um e-mail válido.')
  const text = value.trim()
  if (!text) return null
  if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(text)) throw new Error('Informe um e-mail válido.')
  return text
}
export function requiredText(value, message) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(message)
  return value.trim()
}
export function contactPayload(form, original = null) {
  const result = {
    name: requiredText(form.name, 'Informe o nome do cliente.'),
    email: normalizeEmailInput(form.email),
    vehicleInterest: (form.vehicleInterest || '').trim(),
    contactNotes: (form.contactNotes || '').trim(),
  }
  // Não reinterpreta identificadores legados inalterados (ex.: @lid).
  if (!original || form.phone !== original.phone) result.phone = normalizePhoneInput(form.phone)
  return result
}
