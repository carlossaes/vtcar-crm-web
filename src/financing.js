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
  const temVeiculo = lead?.vehicleVersionCode != null
  return {
    // Nome/telefone/e-mail: do CRM (correção pontual vale só para a simulação).
    name: crm.name, phone: crm.phone ? formatPhone(crm.phone) || crm.phone : '', email: crm.email,
    // Veículo: a estrutura técnica salva na oportunidade (ou vazio para identificar).
    type: temVeiculo && ['car', 'motorcycle'].includes(lead.vehicleType) ? lead.vehicleType : 'car',
    brandCode: temVeiculo ? String(lead.vehicleBrandCode || '') : '', modelCode: temVeiculo ? String(lead.vehicleModelCode || '') : '',
    manufactureYear: temVeiculo ? lead.vehicleManufactureYear || '' : '', modelYear: temVeiculo ? lead.vehicleModelYear || '' : '',
    versionCode: temVeiculo ? String(lead.vehicleVersionCode || '') : '', zeroKm: temVeiculo ? lead.vehicleZeroKm === true : false,
    // Negociação: da oportunidade.
    valor: valorDaSimulacao(lead).valor, downPayment: lead?.downPayment ?? null, installments: prazos.sort((a, b) => a - b),
  }
}

// --- ZINIX-MVP-002A: dados do cliente gravados no CRM -------------------------
// O CPF nunca volta inteiro do servidor: o CRM só mostra o mascarado.
const NOMES_SEXO = { male: 'Masculino', female: 'Feminino' }
export const CAMPOS_CADASTRO = ['cpf', 'birthDate', 'gender', 'state', 'city', 'hasDriverLicense']

// Checklist da etapa Cliente. origem: 'crm' (nome/telefone/e-mail do CRM),
// 'simulacao' (nome/telefone/e-mail informados só para esta simulação) ou
// 'cadastro' (dados do cliente salvos no registro da oportunidade).
export function checklistCliente(form, lead, hoje = new Date()) {
  const crm = dadosDoCrm(lead)
  const anos = idade(lead?.customerBirthDate, hoje)
  const cnh = lead?.customerHasDriverLicense
  const itens = [
    ['name', 'Nome', (form.name || '').trim().replace(/\s+/g, ' ').length >= 3, 'Informe o nome completo do cliente.', crm.name ? 'crm' : 'simulacao', form.name],
    ['phone', 'Telefone', telefoneValido(form.phone), 'Informe um telefone com DDD.', crm.phone ? 'crm' : 'simulacao', form.phone],
    ['email', 'E-mail', EMAIL.test((form.email || '').trim()), 'Informe um e-mail válido.', crm.email ? 'crm' : 'simulacao', form.email],
    ['cpf', 'CPF', !!lead?.customerDocumentMasked, 'Informe o CPF.', 'cadastro', lead?.customerDocumentMasked],
    ['birthDate', 'Nascimento', anos !== null && anos >= 18 && anos <= 100, 'Informe a data de nascimento.', 'cadastro', formatData(lead?.customerBirthDate)],
    ['gender', 'Sexo', !!NOMES_SEXO[lead?.customerGender], 'Selecione o sexo.', 'cadastro', NOMES_SEXO[lead?.customerGender]],
    ['state', 'UF', UFS.includes(lead?.customerState), 'Selecione a UF.', 'cadastro', lead?.customerState],
    ['city', 'Cidade', (lead?.customerCity || '').trim().length >= 2, 'Informe a cidade.', 'cadastro', lead?.customerCity],
    ['hasDriverLicense', 'CNH', typeof cnh === 'boolean', 'Informe se possui CNH.', 'cadastro', typeof cnh === 'boolean' ? (cnh ? 'Possui' : 'Não possui') : ''],
  ]
  return itens.map(([campo, label, ok, erro, origem, valor]) => ({ campo, label, ok, erro, origem, valor: ok ? valor : '' }))
}

// Rascunho do formulário "Completar dados" a partir do cadastro (CPF sempre em branco:
// só é enviado se o vendedor digitar um novo).
export function rascunhoCliente(lead) {
  return {
    cpf: '', birthDate: lead?.customerBirthDate || '', gender: lead?.customerGender || '', state: lead?.customerState || '',
    city: lead?.customerCity || '', hasDriverLicense: typeof lead?.customerHasDriverLicense === 'boolean' ? (lead.customerHasDriverLicense ? 'sim' : 'nao') : '',
  }
}

// Valida o rascunho e monta o PATCH só com o que mudou. `campos` = campos exibidos.
export function patchCliente(rascunho, lead, campos, hoje = new Date()) {
  const erros = {}; const patch = {}
  const atual = rascunhoCliente(lead)
  for (const c of campos) {
    const v = rascunho[c]
    if (c === 'cpf') {
      if (!onlyDigits(v)) { if (!lead?.customerDocumentMasked) erros.cpf = 'Informe o CPF.'; continue }
      if (!cpfValido(v)) erros.cpf = 'Informe um CPF válido.'; else patch.document = onlyDigits(v)
      continue
    }
    if (v === atual[c] && v) continue
    if (c === 'birthDate') { const a = idade(v, hoje); if (a === null) erros.birthDate = 'Informe a data de nascimento.'; else if (a < 18 || a > 100) erros.birthDate = 'O cliente precisa ter entre 18 e 100 anos.'; else patch.birthDate = v }
    if (c === 'gender') { if (!NOMES_SEXO[v]) erros.gender = 'Selecione o sexo.'; else patch.gender = v }
    if (c === 'state') { if (!UFS.includes(v)) erros.state = 'Selecione a UF.'; else patch.state = v }
    if (c === 'city') { const t = (v || '').trim(); if (t.length < 2) erros.city = 'Informe a cidade.'; else patch.city = t }
    if (c === 'hasDriverLicense') { if (!['sim', 'nao'].includes(v)) erros.hasDriverLicense = 'Informe se possui CNH.'; else patch.hasDriverLicense = v === 'sim' }
  }
  return { erros: Object.keys(erros).length ? erros : null, patch }
}

// Veículo estruturado salvo e válido para simular (não pendente de revalidação).
export const veiculoSalvo = (lead) => lead?.vehicleVersionCode != null && lead.vehicleCatalogNeedsReview !== true
export const veiculoPrecisaRevalidar = (lead) => lead?.vehicleVersionCode != null && lead.vehicleCatalogNeedsReview === true
export function descreverVeiculo(lead) {
  if (lead?.vehicleVersionCode == null) return ''
  return `${[lead.vehicleBrandName, lead.vehicleModelName].filter(Boolean).join(' ')} · ${lead.vehicleVersionName || ''}`.trim()
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
// ZINIX-MVP-002A: CPF, nascimento, sexo, UF, cidade, CNH e o veículo estruturado NÃO
// vão no corpo: o servidor usa o que está salvo no CRM no momento do envio.
export function montarSimulacao(form, lead, hoje = new Date()) {
  const erros = {}
  for (const item of checklistCliente(form, lead, hoje)) if (!item.ok) erros[`cliente.${item.campo}`] = item.erro
  if (!veiculoSalvo(lead)) erros.veiculo = 'Identifique e salve o veículo.'
  const n = negociacao(form)
  if (n.erroValor) erros['terms.assetValue'] = n.erroValor
  if (n.erroEntrada) erros['terms.downPayment'] = n.erroEntrada
  if (n.erroPrazos) erros['terms.installments'] = n.erroPrazos
  if (Object.keys(erros).length) return { erros }
  return {
    erros: null,
    corpo: {
      opportunityId: lead.id,
      applicant: { name: form.name.trim().replace(/\s+/g, ' '), email: form.email.trim(), phone: onlyDigits(form.phone) },
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
