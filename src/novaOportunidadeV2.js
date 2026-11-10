// NOVA-OPORTUNIDADE-V2-001 — regras puras da tela "Nova oportunidade" V2.
// A tela antiga (NovaOportunidadeModal) continua intacta; ?legacy=1 a força.
import { parseCurrencyInput, normalizePhoneInput, normalizeEmailInput, requiredText } from './formInputs'
import { cpfValido, onlyDigits, idade, UFS, PRAZOS_SUGERIDOS } from './financing'

export { PRAZOS_SUGERIDOS }
export const MAX_PRAZOS = 12
// Prazos da referência visual aprovada. Todos dentro da regra da Zinix (1 a 84).
export const PRAZOS_V2 = [24, 36, 48, 60, 72, 84]

// A tela V2 é a padrão; ?legacy=1 no endereço força a tela antiga.
export function usarTelaLegacy(search = typeof window !== 'undefined' ? window.location.search : '') {
  try { return new URLSearchParams(search).get('legacy') === '1' } catch { return false }
}

export const ESTADO_INICIAL_V2 = {
  name: '', phone: '', email: '',
  cpf: '', birthDate: '', gender: '', hasDriverLicense: '', city: '', state: '',
  origin: '', vehicleInterest: '',
  assetValue: null, downPayment: null, cemPorCento: false, installmentOptions: [],
  hasTradeIn: false, tradeInVehicle: '', tradeInValue: null,
  paymentComposition: '', notes: '', ownerId: '',
}

const valor = (v) => { try { return parseCurrencyInput(v) } catch { return NaN } }

// Valor a financiar = valor do bem − entrada. Somente leitura, nunca digitado.
// "100% financiado" é só um atalho: entrada = 0.
export function formacao(form) {
  const bem = valor(form.assetValue)
  const entrada = form.cemPorCento ? 0 : valor(form.downPayment)
  const r = { bem, entrada, financiar: null, erro: null }
  if (Number.isNaN(bem)) { r.erro = 'Informe um valor do bem válido.'; return r }
  if (Number.isNaN(entrada)) { r.erro = 'Informe uma entrada válida.'; return r }
  if (bem == null) { if (entrada != null && entrada > 0) r.erro = 'Informe o valor do bem para calcular o valor a financiar.'; return r }
  const e = entrada ?? 0
  if (e >= bem) { r.erro = 'A entrada deve ser menor que o valor do bem.'; return r }
  r.financiar = Math.round((bem - e) * 100) / 100
  return r
}

export function alternarPrazo(lista, prazo) {
  if (lista.includes(prazo)) return lista.filter((p) => p !== prazo)
  if (lista.length >= MAX_PRAZOS) return lista
  return [...lista, prazo].sort((a, b) => a - b)
}

// Dados do cliente para financiamento: TODOS opcionais na criação. Só o que
// foi preenchido é validado e enviado. CPF incompleto ou inválido bloqueia
// (um CPF errado não pode ser salvo), mas CPF em branco não.
export function dadosClienteV2(form, hoje = new Date()) {
  const erros = {}; const patch = {}
  const cpf = onlyDigits(form.cpf)
  if (cpf) { if (!cpfValido(cpf)) erros.cpf = 'CPF inválido. Corrija ou deixe em branco.'; else patch.document = cpf }
  if (form.birthDate) {
    const a = idade(form.birthDate, hoje)
    if (a === null) erros.birthDate = 'Data de nascimento inválida.'
    else if (a < 18 || a > 100) erros.birthDate = 'O cliente precisa ter entre 18 e 100 anos.'
    else patch.birthDate = form.birthDate
  }
  if (form.gender) patch.gender = form.gender
  if (form.hasDriverLicense === 'sim' || form.hasDriverLicense === 'nao') patch.hasDriverLicense = form.hasDriverLicense === 'sim'
  if (form.state) { if (!UFS.includes(form.state)) erros.state = 'UF inválida.'; else patch.state = form.state }
  const cidade = (form.city || '').trim().replace(/\s+/g, ' ')
  if (cidade) { if (cidade.length < 2) erros.city = 'Cidade inválida.'; else patch.city = cidade }
  return { erros: Object.keys(erros).length ? erros : null, patch }
}

// Corpo do POST /api/leads da V2. NÃO envia negotiatedValue (removido da V2;
// registros antigos mantêm o campo). Valor a financiar sempre calculado.
export function montarCriacaoV2(form, { ehGerente }) {
  const f = formacao(form)
  if (f.erro) throw new Error(f.erro)
  if (f.bem == null) throw new Error('Informe o valor do bem.')
  if (!form.origin) throw new Error('Selecione a origem.')
  if (ehGerente && !form.ownerId) throw new Error('Selecione um responsável.')
  const hasTradeIn = form.hasTradeIn === true
  const dados = {
    name: requiredText(form.name, 'Informe o nome do cliente.'),
    phone: normalizePhoneInput(form.phone),
    email: normalizeEmailInput(form.email),
    origin: form.origin,
    vehicleInterest: requiredText(form.vehicleInterest, 'Informe o veículo de interesse.'),
    assetValue: f.bem ?? null,
    downPayment: f.bem == null && f.entrada == null ? null : (f.entrada ?? 0),
    financingAmount: f.financiar,
    hasTradeIn,
    tradeInVehicle: hasTradeIn ? (form.tradeInVehicle || '').trim() : '',
    tradeInValue: hasTradeIn ? parseCurrencyInput(form.tradeInValue) : null,
    paymentComposition: form.paymentComposition || '',
    notes: (form.notes || '').trim() || null,
  }
  if (form.installmentOptions.length) dados.installmentOptions = [...form.installmentOptions]
  if (ehGerente) dados.ownerId = form.ownerId
  return dados
}

// FINALIZAÇÃO V2 — "Valor negociado" deixa de ser apresentado na experiência V2.
// Só APRESENTAÇÃO: o campo continua no modelo, nos payloads e nos dados antigos.
// - tela antiga (?legacy=1): mostra como sempre;
// - V2: oculto quando não informado (toda oportunidade criada na V2);
//   registro ANTIGO que tem o valor continua exibindo-o, só leitura, como
//   histórico, para não esconder informação que ainda entra na simulação.
export function mostrarValorNegociado(registro, legacy = usarTelaLegacy()) {
  if (legacy) return 'editavel'
  return registro?.negotiatedValue > 0 ? 'historico' : 'oculto'
}
