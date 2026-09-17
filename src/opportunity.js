import { parseCurrencyInput, parseInstallmentsInput } from './formInputs'
export { formatBRL } from './formInputs'

export const moneyFields = [
  ['assetValue', 'Valor do bem'], ['negotiatedValue', 'Valor negociado'],
  ['downPayment', 'Entrada'], ['financingAmount', 'Valor a financiar'],
  ['installmentsCount', 'Quantidade de parcelas'], ['installmentValue', 'Valor da parcela'],
]
export const payments = {
  avista: 'À vista', financiamento: 'Financiamento', entrada_financiamento: 'Entrada + financiamento',
  troca_financiamento: 'Troca + financiamento', troca_dinheiro: 'Troca + dinheiro',
  troca_dinheiro_financiamento: 'Troca + dinheiro + financiamento',
}
export const effectiveValue = (opportunity) => opportunity.negotiatedValue > 0
  ? opportunity.negotiatedValue : opportunity.assetValue > 0 ? opportunity.assetValue : 0
export function commercialPayload(form) {
  const result = {
    vehicleInterest: (form.vehicleInterest || '').trim(), notes: (form.notes || '').trim(),
    hasTradeIn: form.hasTradeIn === true, paymentComposition: form.paymentComposition || '',
    tradeInVehicle: form.hasTradeIn ? (form.tradeInVehicle || '').trim() : '',
  }
  for (const [field] of [...moneyFields, ['tradeInValue']]) {
    if (field === 'tradeInValue' && !result.hasTradeIn) { result[field] = null; continue }
    result[field] = field === 'installmentsCount' ? parseInstallmentsInput(form[field]) : parseCurrencyInput(form[field])
  }
  if (!result.hasTradeIn) result.tradeInValue = null
  return result
}
export function pipelineIndicators(opportunities) {
  const sum = (items) => items.reduce((total, item) => total + effectiveValue(item), 0)
  const open = opportunities.filter((o) => ['novo', 'qualificado', 'proposta', 'negociacao'].includes(o.stage))
  const closed = opportunities.filter((o) => o.stage === 'fechado')
  const lost = opportunities.filter((o) => o.stage === 'perdido')
  return { openValue: sum(open), openCount: open.length, closedValue: sum(closed), closedCount: closed.length,
    average: closed.length ? sum(closed) / closed.length : 0, lostValue: sum(lost), lostCount: lost.length,
    conversion: closed.length + lost.length ? closed.length / (closed.length + lost.length) * 100 : 0 }
}
