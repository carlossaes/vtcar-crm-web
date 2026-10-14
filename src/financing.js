// Regras de tela do Financiamento (ZINIX-MVP-001). Funções puras, testáveis.
// A validação aqui é conforto para o vendedor; a validação que vale é a do
// backend, que também confere os códigos do veículo no catálogo Zinix.
import { parseCurrencyInput, formatBRL } from './formInputs'
import { formatPhone } from './format'

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
export const PRAZOS_SUGERIDOS = [12, 18, 24, 30, 36, 42, 48, 54, 60, 72]
export const TERMINAIS = ['completed', 'partial', 'failed', 'expired']

export const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '')

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

// 52998224725 -> 529.982.247-25 (enquanto digita)
export function formatCpf(valor) {
  const d = onlyDigits(valor).slice(0, 11)
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2')
}

// Exibição depois de preenchido: só os 2 últimos dígitos ficam visíveis.
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

export const anosModelo = (fab) => (fab ? [fab, fab + 1] : [])

export function formularioInicial(lead) {
  const valor = lead?.negotiatedValue > 0 ? lead.negotiatedValue : lead?.assetValue > 0 ? lead.assetValue : null
  const prazoDoNegocio = Number.isSafeInteger(lead?.installmentsCount) && lead.installmentsCount >= 1 && lead.installmentsCount <= 84 ? lead.installmentsCount : null
  const prazos = [24, 36, 48, 60]
  if (prazoDoNegocio && !prazos.includes(prazoDoNegocio)) prazos.push(prazoDoNegocio)
  return {
    // Identificador @lid do WhatsApp não é telefone: fica em branco para o vendedor preencher.
    cpf: '', name: (lead?.name || '').trim(), birthDate: '', gender: '', email: lead?.email || '',
    phone: lead?.phone && !String(lead.phone).includes('@') ? formatPhone(lead.phone) || '' : '',
    state: '', city: '', hasDriverLicense: '',
    type: 'car', brandCode: '', modelCode: '', manufactureYear: '', modelYear: '', versionCode: '', zeroKm: false,
    assetValue: valor, downPayment: lead?.downPayment ?? null, installments: prazos.sort((a, b) => a - b),
  }
}

// Valida e monta o corpo de POST /api/financiamento/simulacoes.
// Valores seguem em reais (número); a conversão para centavos é do backend.
export function montarSimulacao(form, opportunityId, hoje = new Date()) {
  const erros = {}
  if (!cpfValido(form.cpf)) erros['applicant.document'] = 'Informe um CPF válido.'
  const nome = (form.name || '').trim().replace(/\s+/g, ' ')
  if (nome.length < 3) erros['applicant.name'] = 'Informe o nome completo do cliente.'
  const anos = idade(form.birthDate, hoje)
  if (anos === null) erros['applicant.birthDate'] = 'Informe a data de nascimento.'
  else if (anos < 18 || anos > 100) erros['applicant.birthDate'] = 'O cliente precisa ter entre 18 e 100 anos.'
  if (!['male', 'female'].includes(form.gender)) erros['applicant.gender'] = 'Selecione o sexo.'
  if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test((form.email || '').trim())) erros['applicant.email'] = 'Informe um e-mail válido.'
  const fone = onlyDigits(form.phone)
  if (fone.length < 10 || fone.length > 13) erros['applicant.phone'] = 'Informe um telefone com DDD.'
  if (!UFS.includes(form.state)) erros['applicant.state'] = 'Selecione a UF.'
  if ((form.city || '').trim().length < 2) erros['applicant.city'] = 'Informe a cidade.'
  if (!['sim', 'nao'].includes(form.hasDriverLicense)) erros['applicant.hasDriverLicense'] = 'Informe se possui CNH.'
  if (!form.brandCode) erros['vehicle.brandCode'] = 'Selecione a marca.'
  if (!form.modelCode) erros['vehicle.modelCode'] = 'Selecione o modelo.'
  if (!form.manufactureYear) erros['vehicle.manufactureYear'] = 'Selecione o ano de fabricação.'
  if (!form.modelYear) erros['vehicle.modelYear'] = 'Selecione o ano do modelo.'
  if (!form.versionCode) erros['vehicle.versionCode'] = 'Selecione a versão.'
  let valor = null; let entrada = null
  try { valor = parseCurrencyInput(form.assetValue) } catch { /* tratado abaixo */ }
  try { entrada = parseCurrencyInput(form.downPayment) } catch { entrada = NaN }
  if (!(valor > 0)) erros['terms.assetValue'] = 'Informe o valor do veículo.'
  if (entrada === null) entrada = 0
  if (!Number.isFinite(entrada) || entrada < 0) erros['terms.downPayment'] = 'Informe uma entrada válida.'
  else if (valor > 0 && entrada >= valor) erros['terms.downPayment'] = 'A entrada deve ser menor que o valor do veículo.'
  const prazos = [...new Set(form.installments || [])].sort((a, b) => a - b)
  if (!prazos.length || prazos.length > 12 || prazos.some((n) => !Number.isSafeInteger(n) || n < 1 || n > 84)) {
    erros['terms.installments'] = 'Selecione de 1 a 12 prazos (1 a 84 parcelas).'
  }
  if (Object.keys(erros).length) return { erros }
  return {
    erros: null,
    corpo: {
      opportunityId,
      applicant: { document: onlyDigits(form.cpf), name: nome, birthDate: form.birthDate, gender: form.gender, email: form.email.trim(),
        phone: fone, state: form.state, city: form.city.trim(), hasDriverLicense: form.hasDriverLicense === 'sim' },
      vehicle: { type: form.type, brandCode: form.brandCode, modelCode: form.modelCode, versionCode: form.versionCode,
        manufactureYear: Number(form.manufactureYear), modelYear: Number(form.modelYear), zeroKm: form.zeroKm === true },
      terms: { assetValue: valor, downPayment: entrada, installments: prazos },
    },
  }
}

export const centsBRL = (c) => (Number.isFinite(c) ? formatBRL(c / 100) : null)

// A Zinix ainda não documentou a escala de monthly_rate (pendência ZINIX-001A
// #10). Taxas mensais reais ficam entre ~0,3% e ~6%: abaixo de 0,2 tratamos
// como fração (0,0149 = 1,49%); acima, como percentual (1,49 = 1,49%).
export function formatTaxa(rate) {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return null
  const pct = rate < 0.2 ? rate * 100 : rate
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m.`
}

export const STATUS_SIMULACAO = {
  enviando: 'Enviando aos bancos',
  envio_incerto: 'Envio não confirmado',
  erro_envio: 'Não enviada',
  queued: 'Na fila de processamento',
  processing: 'Bancos processando',
  completed: 'Processamento concluído',
  partial: 'Concluída parcialmente',
  failed: 'Simulação falhou',
  expired: 'Simulação expirada',
}

// "completed" do banco = o banco respondeu. NÃO significa crédito aprovado.
export const STATUS_BANCO = {
  queued: { label: 'Na fila', tom: 'neutro' },
  pending: { label: 'Aguardando', tom: 'neutro' },
  processing: { label: 'Processando', tom: 'neutro' },
  completed: { label: 'Respondeu', tom: 'bom' },
  rejected: { label: 'Recusado pelo banco', tom: 'alerta' },
  unavailable: { label: 'Banco indisponível', tom: 'tecnico' },
  failed: { label: 'Falha técnica', tom: 'tecnico' },
  timed_out: { label: 'Sem resposta no prazo', tom: 'tecnico' },
  unknown: { label: 'Status desconhecido', tom: 'neutro' },
}

export function mensagemSemCondicoes(status) {
  if (status === 'completed') return 'O banco respondeu sem condições para estes prazos e valores.'
  if (status === 'rejected') return 'O banco não ofereceu condições para esta simulação.'
  if (['failed', 'unavailable', 'timed_out'].includes(status)) return 'Não foi possível obter resposta deste banco. É uma falha técnica, não uma recusa de crédito.'
  return 'Aguardando resposta do banco…'
}

export function resumoFinal(sim) {
  if (sim.status === 'completed') return 'Processamento concluído. Confira abaixo as condições que cada banco retornou.'
  if (sim.status === 'partial') return 'Processamento concluído parcialmente: alguns bancos não responderam. As condições recebidas estão abaixo.'
  if (sim.status === 'failed') return sim.error?.message ? `A simulação falhou: ${sim.error.message}` : 'A simulação falhou.'
  if (sim.status === 'expired') return 'A simulação expirou. Faça uma nova simulação se precisar de condições atualizadas.'
  return null
}

// Bancos com condições primeiro; dentro de cada banco a ordem da Zinix é mantida.
export function ordenarBancos(results = []) {
  return [...results].sort((a, b) => (b.conditions?.length ? 1 : 0) - (a.conditions?.length ? 1 : 0))
}
