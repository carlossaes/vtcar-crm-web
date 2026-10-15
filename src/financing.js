// Regras de tela do Financiamento (ZINIX-MVP-002). Funções puras, testáveis.
//
// Princípio: "O CRM já sabe quase tudo. Complete o que falta, revise e simule."
// - Cliente: dados pessoais vêm do CRM (nome, telefone, e-mail). O que o CRM
//   ainda não guarda (CPF, nascimento, sexo, UF, cidade, CNH) é pedido só
//   para esta simulação e NÃO é persistido (nem no CRM, nem no arquivo de
//   simulações) — a persistência definitiva depende de modelagem aprovada.
// - Oportunidade: veículo de interesse e valores comerciais vêm dela.
// A validação aqui é conforto; a que vale é a do backend, que também confere
// os códigos do veículo no catálogo Zinix.
import { parseCurrencyInput, formatBRL } from './formInputs'
import { formatPhone } from './format'

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
export const PRAZOS_SUGERIDOS = [12, 18, 24, 30, 36, 42, 48, 54, 60, 72]
export const TERMINAIS = ['completed', 'partial', 'failed', 'expired']
export const ETAPAS = [['cliente', 'Cliente'], ['veiculo', 'Veículo'], ['revisao', 'Revisão'], ['resultados', 'Resultados']]

export const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '')
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

export function cpfValido(valor) {
  const d = onlyDigits(valor)
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false
  const dv = (len) => {
    let soma = 0
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}

export function formatCpf(valor) {
  const d = onlyDigits(valor).slice(0, 11)
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function maskCpf(valor) {
  const d = onlyDigits(valor)
  return d.length === 11 ? `•••.•••.•••-${d.slice(9)}` : formatCpf(d)
}

export function idade(dataIso, hoje = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso || '')) return null
  const [y, m, d] = dataIso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  let anos = hoje.getFullYear() - y
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) anos -= 1
  return anos
}

export function anosFabricacao(hoje = new Date()) {
  const fim = hoje.getFullYear() + 1
  return Array.from({ length: fim - 1990 + 1 }, (_, i) => fim - i)
}
export const anosModelo = (fab) => (fab ? [Number(fab), Number(fab) + 1] : [])

const telefoneValido = (v) => { const n = onlyDigits(v).length; return n >= 10 && n <= 13 }

// --- origem dos dados ------------------------------------------------------
// O que o CRM já tem e é utilizável. Identificador @lid do WhatsApp não é telefone.
export function dadosDoCrm(lead) {
  const telefone = lead?.phone && !String(lead.phone).includes('@') && telefoneValido(lead.phone) ? String(lead.phone) : ''
  const email = lead?.email && EMAIL.test(String(lead.email).trim()) ? String(lead.email).trim() : ''
  const nome = (lead?.name || '').trim().replace(/\s+/g, ' ')
  return { name: nome.length >= 3 ? nome : '', phone: telefone, email }
}

// Regra do CTO: valor negociado se > 0; senão valor do bem.
export function valorDaSimulacao(lead) {
  if (lead?.negotiatedValue > 0) return { valor: lead.negotiatedValue, origem: 'negociado' }
  if (lead?.assetValue > 0) return { valor: lead.assetValue, origem: 'bem' }
  return { valor: null, origem: null }
}

export function formularioInicial(lead) {
  const crm = dadosDoCrm(lead)
  const prazoDoNegocio = Number.isSafeInteger(lead?.installmentsCount) && lead.installmentsCount >= 1 && lead.installmentsCount <= 84 ? lead.installmentsCount : null
  const prazos = [24, 36, 48, 60]
  if (prazoDoNegocio && !prazos.includes(prazoDoNegocio)) prazos.push(prazoDoNegocio)
  return {
    // Cliente: CRM primeiro; o resto só existe nesta simulação.
    name: crm.name, phone: crm.phone ? formatPhone(crm.phone) || crm.phone : '', email: crm.email,
    cpf: '', birthDate: '', gender: '', state: '', city: '', hasDriverLicense: '',
    // Veículo: identificação no catálogo Zinix do MESMO veículo de interesse.
    type: 'car', brandCode: '', modelCode: '', manufactureYear: '', modelYear: '', versionCode: '', zeroKm: false,
    // Negociação: da oportunidade.
    valor: valorDaSimulacao(lead).valor, downPayment: lead?.downPayment ?? null, installments: prazos.sort((a, b) => a - b),
  }
}

// Checklist de completude da etapa Cliente. `origem: 'crm'` = já veio do CRM.
export function checklistCliente(form, lead, hoje = new Date()) {
  const crm = dadosDoCrm(lead)
  const anos = idade(form.birthDate, hoje)
  const itens = [
    ['name', 'Nome', (form.name || '').trim().replace(/\s+/g, ' ').length >= 3, 'Informe o nome completo do cliente.', !!crm.name],
    ['phone', 'Telefone', telefoneValido(form.phone), 'Informe um telefone com DDD.', !!crm.phone],
    ['email', 'E-mail', EMAIL.test((form.email || '').trim()), 'Informe um e-mail válido.', !!crm.email],
    ['cpf', 'CPF', cpfValido(form.cpf), 'Informe um CPF válido.', false],
    ['birthDate', 'Data de nascimento', anos !== null && anos >= 18 && anos <= 100, anos === null ? 'Informe a data de nascimento.' : 'O cliente precisa ter entre 18 e 100 anos.', false],
    ['gender', 'Sexo', ['male', 'female'].includes(form.gender), 'Selecione o sexo.', false],
    ['state', 'UF', UFS.includes(form.state), 'Selecione a UF.', false],
    ['city', 'Cidade', (form.city || '').trim().length >= 2, 'Informe a cidade.', false],
    ['hasDriverLicense', 'Possui CNH', ['sim', 'nao'].includes(form.hasDriverLicense), 'Informe se possui CNH.', false],
  ]
  return itens.map(([campo, label, ok, erro, doCrm]) => ({ campo, label, ok, erro, origem: doCrm ? 'crm' : 'simulacao' }))
}

export function veiculoCompleto(form) {
  return !!(form.brandCode && form.modelCode && form.manufactureYear && form.modelYear && form.versionCode)
}

export function negociacao(form) {
  let valor = null; let entrada = 0; let erroValor = null; let erroEntrada = null
  try { valor = parseCurrencyInput(form.valor) } catch { /* abaixo */ }
  if (!(valor > 0)) erroValor = 'Informe o valor do veículo para a simulação.'
  try { entrada = parseCurrencyInput(form.downPayment) ?? 0 } catch { entrada = NaN }
  if (!Number.isFinite(entrada) || entrada < 0) erroEntrada = 'Informe uma entrada válida.'
  else if (valor > 0 && entrada >= valor) erroEntrada = 'A entrada deve ser menor que o valor do veículo.'
  const prazos = [...new Set(form.installments || [])].sort((a, b) => a - b)
  const erroPrazos = !prazos.length || prazos.length > 12 || prazos.some((n) => !Number.isSafeInteger(n) || n < 1 || n > 84)
    ? 'Selecione de 1 a 12 prazos (1 a 84 parcelas).' : null
  return { valor, entrada, financiar: valor > 0 && Number.isFinite(entrada) ? Math.max(0, valor - entrada) : null, prazos, erroValor, erroEntrada, erroPrazos }
}

// Corpo de POST /api/financiamento/simulacoes. Valores em reais; centavos são com o backend.
export function montarSimulacao(form, opportunityId, hoje = new Date()) {
  const erros = {}
  const mapa = { name: 'applicant.name', phone: 'applicant.phone', email: 'applicant.email', cpf: 'applicant.document', birthDate: 'applicant.birthDate',
    gender: 'applicant.gender', state: 'applicant.state', city: 'applicant.city', hasDriverLicense: 'applicant.hasDriverLicense' }
  for (const item of checklistCliente(form, null, hoje)) if (!item.ok) erros[mapa[item.campo]] = item.erro
  if (!veiculoCompleto(form)) erros['vehicle.versionCode'] = 'Identifique o veículo no catálogo.'
  const n = negociacao(form)
  if (n.erroValor) erros['terms.assetValue'] = n.erroValor
  if (n.erroEntrada) erros['terms.downPayment'] = n.erroEntrada
  if (n.erroPrazos) erros['terms.installments'] = n.erroPrazos
  if (Object.keys(erros).length) return { erros }
  return {
    erros: null,
    corpo: {
      opportunityId,
      applicant: { document: onlyDigits(form.cpf), name: form.name.trim().replace(/\s+/g, ' '), birthDate: form.birthDate, gender: form.gender,
        email: form.email.trim(), phone: onlyDigits(form.phone), state: form.state, city: form.city.trim(), hasDriverLicense: form.hasDriverLicense === 'sim' },
      vehicle: { type: form.type, brandCode: form.brandCode, modelCode: form.modelCode, versionCode: form.versionCode,
        manufactureYear: Number(form.manufactureYear), modelYear: Number(form.modelYear), zeroKm: form.zeroKm === true },
      terms: { assetValue: n.valor, downPayment: n.entrada, installments: n.prazos },
    },
  }
}

export const centsBRL = (c) => (Number.isFinite(c) ? formatBRL(c / 100) : null)

// Escala de monthly_rate ainda não documentada pela Zinix (pendência ZINIX-001A #10):
// abaixo de 0,2 tratamos como fração (0,0149 = 1,49%); acima, como percentual.
const taxaPct = (rate) => (typeof rate === 'number' && Number.isFinite(rate) ? (rate < 0.2 ? rate * 100 : rate) : null)

export function formatTaxa(rate) {
  const pct = taxaPct(rate)
  if (pct == null) return null
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m.`
}

export const STATUS_SIMULACAO = {
  enviando: 'Enviando aos bancos',
  envio_incerto: 'Envio não confirmado',
  erro_envio: 'Não enviada',
  queued: 'Em processamento',
  processing: 'Em processamento',
  completed: 'Processamento concluído',
  partial: 'Concluída parcialmente',
  failed: 'Falha na simulação',
  expired: 'Simulação expirada',
}

// Situação de cada banco na linguagem pedida pelo CTO. Nunca "aprovado":
// o contrato Zinix não informa aprovação de crédito.
export function situacaoBanco(b) {
  const s = b?.status
  if (['queued', 'pending', 'processing'].includes(s)) return { label: 'Em processamento', tom: 'neutro' }
  if (s === 'completed' && b.conditions?.length) return { label: 'Condições disponíveis', tom: 'bom' }
  if (s === 'completed' || s === 'rejected') return { label: 'Sem condição disponível', tom: 'alerta' }
  if (s === 'unavailable') return { label: 'Indisponível', tom: 'tecnico' }
  if (s === 'failed' || s === 'timed_out') return { label: 'Falha técnica', tom: 'tecnico' }
  return { label: 'Status desconhecido', tom: 'neutro' }
}

export function explicacaoBanco(b) {
  const s = b?.status
  if (s === 'completed' && !b.conditions?.length) return 'O banco respondeu sem condições para estes prazos e valores.'
  if (s === 'rejected') return 'O banco não ofereceu condições para esta simulação.'
  if (s === 'timed_out') return 'O banco não respondeu dentro do prazo. É uma falha técnica, não uma recusa de crédito.'
  if (s === 'failed' || s === 'unavailable') return 'Não foi possível obter resposta deste banco. Não é uma recusa de crédito.'
  return null
}

export function resumoFinal(sim) {
  if (sim.status === 'completed') return 'Processamento concluído. Compare abaixo as condições que os bancos retornaram.'
  if (sim.status === 'partial') return 'Processamento concluído parcialmente: alguns bancos não responderam. As condições recebidas estão abaixo.'
  if (sim.status === 'failed') return sim.error?.message ? `A simulação falhou: ${sim.error.message}` : 'A simulação falhou.'
  if (sim.status === 'expired') return 'A simulação expirou. Faça uma nova simulação se precisar de condições atualizadas.'
  return null
}

// Comparativo: uma linha por condição (nunca agrupa só pelo prazo). Ordem
// neutra: prazo, entrada, valor da parcela. "Menor parcela" só entre condições
// com o MESMO prazo e a MESMA entrada, e só quando há mais de uma para comparar.
// "Menor taxa": mesmo grupo e só se todas as taxas do grupo forem informadas e
// não estimadas (comparação equivalente). Não há "melhor financiamento".
export function montarComparativo(results = []) {
  const linhas = []
  for (const b of results) {
    for (const c of b.conditions || []) {
      if (!Number.isSafeInteger(c.installments) || !Number.isSafeInteger(c.installment_value_cents)) continue
      linhas.push({ banco: b.bankName || b.bank, bankCode: b.bank, ...c, menorParcela: false, menorTaxa: false })
    }
  }
  const grupos = new Map()
  for (const l of linhas) {
    if (l.down_payment_cents == null) continue // sem entrada informada não há base de comparação
    const k = `${l.installments}|${l.down_payment_cents}`
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k).push(l)
  }
  for (const g of grupos.values()) {
    if (g.length < 2) continue
    const min = Math.min(...g.map((l) => l.installment_value_cents))
    for (const l of g) if (l.installment_value_cents === min) l.menorParcela = true
    if (g.every((l) => taxaPct(l.monthly_rate) != null && l.monthly_rate_estimated !== true)) {
      const taxas = g.map((l) => Math.round(taxaPct(l.monthly_rate) * 10000))
      const minT = Math.min(...taxas)
      if (taxas.some((t) => t !== minT)) g.forEach((l, i) => { if (taxas[i] === minT) l.menorTaxa = true })
    }
  }
  return linhas.sort((a, b) => a.installments - b.installments
    || (a.down_payment_cents ?? Infinity) - (b.down_payment_cents ?? Infinity)
    || a.installment_value_cents - b.installment_value_cents)
}

// Data ISO (aaaa-mm-dd) para exibição dd/mm/aaaa.
export const formatData = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '')

// O veículo de interesse da oportunidade mudou depois da simulação? (só quando o registro guardou a referência)
export function veiculoDesatualizado(sim, lead) {
  if (!sim || sim.vehicleInterest == null) return false
  return String(sim.vehicleInterest).trim() !== String(lead?.vehicleInterest || '').trim()
}

export function ordenarBancos(results = []) {
  return [...results].sort((a, b) => (b.conditions?.length ? 1 : 0) - (a.conditions?.length ? 1 : 0))
}
