import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import OpportunityFinancing from '../src/components/OpportunityFinancing'
import LeadModal from '../src/components/LeadModal'
import {
  cpfValido, formatCpf, maskCpf, montarSimulacao, formatTaxa, formularioInicial, STATUS_SIMULACAO, situacaoBanco, explicacaoBanco, resumoFinal,
  checklistCliente, dadosDoCrm, valorDaSimulacao, negociacao, montarComparativo, veiculoDesatualizado, patchCliente, rascunhoCliente,
  veiculoSalvo, veiculoPrecisaRevalidar, descreverVeiculo,
} from '../src/financing'
import * as api from '../src/api'

vi.mock('../src/api', () => ({
  getFinanciamentoMarcas: vi.fn(), getFinanciamentoModelos: vi.fn(), getFinanciamentoVersoes: vi.fn(), getFinanciamentoBancos: vi.fn(),
  criarSimulacaoFinanciamento: vi.fn(), getSimulacaoFinanciamento: vi.fn(), listarSimulacoesFinanciamento: vi.fn(),
  salvarClienteFinanciamento: vi.fn(), salvarVeiculoFinanciamento: vi.fn(),
  getLeadMessages: vi.fn(() => Promise.resolve([])), getLeadCoach: vi.fn(() => Promise.resolve(null)),
  regenerateLeadCoach: vi.fn(), assumirLead: vi.fn(), atribuirResponsavel: vi.fn(), removerResponsavel: vi.fn(),
  updateOpportunity: vi.fn(), updateLeadData: vi.fn(), updateFollowUp: vi.fn(), completeTask: vi.fn(),
}))

const vendedor = { id: 'v1', nome: 'Ana', papel: 'vendedor' }
const outro = { id: 'v2', nome: 'Bia', papel: 'vendedor' }
const gerente = { id: 'g', nome: 'Gerente', papel: 'gerente' }
const lead = { id: 'opp1', name: 'Joana Lima', email: 'joana@example.invalid', phone: '43999887766', ownerId: 'v1', recordType: 'opportunity',
  stage: 'negociacao', vehicleInterest: 'POP 100', assetValue: 129900, negotiatedValue: 125000, downPayment: 30000, installmentsCount: 48,
  channel: 'WhatsApp', createdAt: '2026-10-01T10:00:00Z' }
const HOJE = new Date('2026-10-14T12:00:00')
// Oportunidade NOVA COMPLETA, como o servidor devolve (CPF só mascarado; dados FICTÍCIOS).
const CADASTRO = { customerDocumentMasked: '•••.•••.•••-25', customerBirthDate: '1990-05-20', customerGender: 'female', customerState: 'PR',
  customerCity: 'Londrina', customerHasDriverLicense: true }
const VEICULO = { vehicleType: 'car', vehicleBrandCode: '59', vehicleBrandName: 'TOYOTA', vehicleModelCode: '5001', vehicleModelName: 'COROLLA',
  vehicleVersionCode: 'v-xei', vehicleVersionName: 'XEI 2.0 FLEX', vehicleManufactureYear: 2024, vehicleModelYear: 2025, vehicleZeroKm: false,
  vehicleCatalogInterest: 'POP 100', vehicleCatalogConfirmedAt: '2026-10-14T10:00:00Z', vehicleCatalogNeedsReview: false }
const leadCompleto = { ...lead, ...CADASTRO, ...VEICULO }

// Backend falso das rotas novas: aplica o que recebe e devolve a oportunidade como o servidor faria.
const MAPA = { document: 'customerDocument', birthDate: 'customerBirthDate', gender: 'customerGender', state: 'customerState', city: 'customerCity', hasDriverLicense: 'customerHasDriverLicense' }
function servidorFalso() {
  api.salvarClienteFinanciamento.mockImplementation(async (id, dados) => {
    const r = {}
    for (const [k, v] of Object.entries(dados)) {
      if (k === 'document') r.customerDocumentMasked = `•••.•••.•••-${v.slice(9)}`
      else r[MAPA[k]] = v
    }
    return r
  })
  api.salvarVeiculoFinanciamento.mockImplementation(async (id, v) => ({ vehicleType: v.type, vehicleBrandCode: v.brandCode, vehicleBrandName: 'TOYOTA',
    vehicleModelCode: v.modelCode, vehicleModelName: 'COROLLA', vehicleVersionCode: v.versionCode, vehicleVersionName: 'XEI 2.0 FLEX',
    vehicleManufactureYear: v.manufactureYear, vehicleModelYear: v.modelYear, vehicleZeroKm: v.zeroKm, vehicleCatalogNeedsReview: false }))
}
// Nomes vindos SOMENTE do mock da API: se aparecerem na tela, vieram da API.
const BANCOS_API = [
  { code: 'banco-x', name: 'Banco Xis Teste', status: 'enabled', habilitado: true },
  { code: 'banco-y', name: 'Financeira Ypsilon', status: 'disabled', habilitado: false },
]

const simBase = {
  id: 'sim-1', opportunityId: 'opp1', status: 'processing', terminal: false, createdAt: '2026-10-14T15:00:00Z', requestId: 'req-1',
  vehicle: { brand_name: 'TOYOTA', model_name: 'COROLLA', version_name: 'XEI 2.0', manufacture_year: 2024, model_year: 2025, zero_km: false },
  terms: { asset_value_cents: 12500000, down_payment_cents: 3000000, installments: [24, 36, 48, 60] },
  progress: { expected_banks: 8, finished_banks: 3, pending_banks: 5 }, results: [], nextPollInMs: 0, canRetry: false,
}
const cond = (o) => ({ monthly_rate: 1.49, monthly_rate_estimated: false, down_payment_cents: 3000000, financed_amount_cents: 9500000, ...o })

beforeEach(() => {
  api.listarSimulacoesFinanciamento.mockResolvedValue([])
  api.getFinanciamentoMarcas.mockResolvedValue([{ code: '59', name: 'TOYOTA' }])
  api.getFinanciamentoModelos.mockResolvedValue([{ code: '5001', name: 'COROLLA' }])
  api.getFinanciamentoVersoes.mockResolvedValue([{ code: 'v-xei', name: 'XEI 2.0 FLEX' }])
  api.getFinanciamentoBancos.mockResolvedValue(BANCOS_API)
  servidorFalso()
})

// ------------------------------------------------------------------ regras puras
describe('regras puras', () => {
  it('CPF: dígito verificador, máscara de digitação e máscara de exibição', () => {
    expect(cpfValido('529.982.247-25')).toBe(true)
    expect(cpfValido('529.982.247-24')).toBe(false)
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
    expect(maskCpf('52998224725')).toBe('•••.•••.•••-25')
  })
  it('reaproveita nome/telefone/e-mail do CRM; identificador @lid não é telefone', () => {
    expect(dadosDoCrm(lead)).toEqual({ name: 'Joana Lima', phone: '43999887766', email: 'joana@example.invalid' })
    expect(dadosDoCrm({ ...lead, phone: '5543999@lid', email: 'invalido' })).toMatchObject({ phone: '', email: '' })
    const f = formularioInicial(lead)
    expect(f).toMatchObject({ name: 'Joana Lima', email: 'joana@example.invalid', brandCode: '', versionCode: '', type: 'car', zeroKm: false })
    expect(f.cpf).toBeUndefined() // o CPF não vive no formulário da simulação
    expect(formularioInicial(leadCompleto)).toMatchObject({ type: 'car', brandCode: '59', modelCode: '5001', versionCode: 'v-xei', manufactureYear: 2024, modelYear: 2025 })
    expect(f.phone).toMatch(/99988-7766/)
  })
  it('checklist: contato do CRM + cadastro do cliente salvo na oportunidade', () => {
    const itens = checklistCliente(formularioInicial(lead), lead, HOJE)
    expect(itens.filter((i) => i.origem === 'crm').map((i) => i.campo)).toEqual(['name', 'phone', 'email'])
    expect(itens.filter((i) => i.origem === 'cadastro').map((i) => i.campo)).toEqual(['cpf', 'birthDate', 'gender', 'state', 'city', 'hasDriverLicense'])
    expect(itens.filter((i) => !i.ok).map((i) => i.campo)).toEqual(['cpf', 'birthDate', 'gender', 'state', 'city', 'hasDriverLicense'])
    const completo = checklistCliente(formularioInicial(leadCompleto), leadCompleto, HOJE)
    expect(completo.every((i) => i.ok)).toBe(true)
    expect(completo.find((i) => i.campo === 'cpf').valor).toBe('•••.•••.•••-25')
    expect(completo.find((i) => i.campo === 'birthDate').valor).toBe('20/05/1990')
    const semEmail = checklistCliente(formularioInicial({ ...lead, email: '' }), { ...lead, email: '' }, HOJE)
    expect(semEmail.find((i) => i.campo === 'email')).toMatchObject({ origem: 'simulacao', ok: false })
  })
  it('valor da simulação: negociado se > 0, senão valor do bem; financiar = valor − entrada', () => {
    expect(valorDaSimulacao(lead)).toEqual({ valor: 125000, origem: 'negociado' })
    expect(valorDaSimulacao({ ...lead, negotiatedValue: 0 })).toEqual({ valor: 129900, origem: 'bem' })
    expect(valorDaSimulacao({})).toEqual({ valor: null, origem: null })
    expect(negociacao(formularioInicial(lead)).financiar).toBe(95000)
  })
  it('monta o corpo só com contato e termos: CPF, cadastro e veículo vêm do CRM no servidor', () => {
    const form = { ...formularioInicial(leadCompleto), installments: [60, 24] }
    const { erros, corpo } = montarSimulacao(form, leadCompleto, HOJE)
    expect(erros).toBeNull()
    expect(corpo).toEqual({ opportunityId: 'opp1', applicant: { name: 'Joana Lima', email: 'joana@example.invalid', phone: '43999887766' },
      terms: { assetValue: 125000, downPayment: 30000, installments: [24, 60] } })
    expect(JSON.stringify(corpo)).not.toMatch(/document|birth|vehicle|52998/)
  })
  it('validações bloqueiam envio: cadastro incompleto, veículo não salvo ou pendente, termos inválidos', () => {
    const { erros } = montarSimulacao({ ...formularioInicial(lead), downPayment: 200000, installments: [] }, lead, HOJE)
    expect(Object.keys(erros)).toEqual(expect.arrayContaining(['cliente.cpf', 'cliente.birthDate', 'veiculo', 'terms.downPayment', 'terms.installments']))
    const pendente = { ...leadCompleto, vehicleInterest: 'CG 160', vehicleCatalogNeedsReview: true }
    expect(montarSimulacao(formularioInicial(pendente), pendente, HOJE).erros).toHaveProperty('veiculo')
  })
  it('patchCliente: valida e envia só o que mudou; CPF só se digitado', () => {
    const vazio = patchCliente(rascunhoCliente(lead), lead, ['cpf', 'birthDate', 'gender', 'state', 'city', 'hasDriverLicense'], HOJE)
    expect(Object.keys(vazio.erros)).toEqual(['cpf', 'birthDate', 'gender', 'state', 'city', 'hasDriverLicense'])
    const r = { cpf: '52998224725', birthDate: '1990-05-20', gender: 'male', state: 'PR', city: ' Cambé ', hasDriverLicense: 'nao' }
    expect(patchCliente(r, lead, Object.keys(r), HOJE)).toEqual({ erros: null, patch: { document: '52998224725', birthDate: '1990-05-20', gender: 'male', state: 'PR', city: 'Cambé', hasDriverLicense: false } })
    expect(patchCliente({ ...r, cpf: '52998224724' }, lead, ['cpf'], HOJE).erros).toEqual({ cpf: 'Informe um CPF válido.' })
    expect(patchCliente({ ...r, birthDate: '2012-01-01' }, lead, ['birthDate'], HOJE).erros.birthDate).toMatch(/18 e 100/)
    // Cadastro existente: CPF em branco mantém o atual; só a cidade mudou.
    const atual = rascunhoCliente(leadCompleto)
    expect(atual.cpf).toBe('')
    expect(patchCliente({ ...atual, city: 'Cambé' }, leadCompleto, ['cpf', 'birthDate', 'gender', 'state', 'city', 'hasDriverLicense'], HOJE)).toEqual({ erros: null, patch: { city: 'Cambé' } })
  })
  it('veículo salvo × pendente de revalidação × ausente', () => {
    expect(veiculoSalvo(leadCompleto)).toBe(true)
    expect(veiculoSalvo(lead)).toBe(false)
    const pendente = { ...leadCompleto, vehicleCatalogNeedsReview: true }
    expect(veiculoSalvo(pendente)).toBe(false); expect(veiculoPrecisaRevalidar(pendente)).toBe(true)
    expect(veiculoPrecisaRevalidar(lead)).toBe(false)
    expect(descreverVeiculo(leadCompleto)).toBe('TOYOTA COROLLA · XEI 2.0 FLEX')
  })
  it('taxa em fração ou percentual exibida igual', () => {
    expect(formatTaxa(0.0149)).toBe('1,49% a.m.')
    expect(formatTaxa(1.49)).toBe('1,49% a.m.')
    expect(formatTaxa(null)).toBeNull()
  })
  it('linguagem dos status: nunca "aprovado"; falha técnica não é recusa', () => {
    const st = ['queued', 'pending', 'processing', 'completed', 'rejected', 'unavailable', 'failed', 'timed_out', 'x']
    const textos = [...Object.values(STATUS_SIMULACAO), ...st.map((s) => situacaoBanco({ status: s, conditions: [] }).label),
      situacaoBanco({ status: 'completed', conditions: [{}] }).label, ...st.map((s) => explicacaoBanco({ status: s, conditions: [] }) || ''),
      ...['completed', 'partial', 'failed', 'expired'].map((s) => resumoFinal({ status: s }))]
    for (const t of textos) expect(t.toLowerCase()).not.toMatch(/aprovad/)
    expect(situacaoBanco({ status: 'completed', conditions: [{}] }).label).toBe('Condições disponíveis')
    expect(situacaoBanco({ status: 'processing' }).label).toBe('Em processamento')
    expect(situacaoBanco({ status: 'rejected' }).label).toBe('Sem condição disponível')
    expect(situacaoBanco({ status: 'unavailable' }).label).toBe('Indisponível')
    expect(situacaoBanco({ status: 'timed_out' }).label).toBe('Falha técnica')
    expect(explicacaoBanco({ status: 'timed_out' })).toMatch(/não uma recusa/)
  })
  it('"menor taxa" só com mesmo prazo, mesma entrada e nenhuma taxa estimada no grupo', () => {
    const base = [{ bank: 'a', bankName: 'A', status: 'completed', conditions: [
      cond({ installments: 48, installment_value_cents: 300000, monthly_rate: 0.0149, condition_id: 'x1' }),
      cond({ installments: 48, installment_value_cents: 310000, monthly_rate: 1.39, condition_id: 'x2' })] }]
    expect(montarComparativo(base).filter((l) => l.menorTaxa).map((l) => l.condition_id)).toEqual(['x2']) // fração e % na mesma escala
    const comEstimada = structuredClone(base); comEstimada[0].conditions[1].monthly_rate_estimated = true
    expect(montarComparativo(comEstimada).some((l) => l.menorTaxa)).toBe(false)
    const outraEntrada = structuredClone(base); outraEntrada[0].conditions[1].down_payment_cents = 5000000
    expect(montarComparativo(outraEntrada).some((l) => l.menorTaxa)).toBe(false)
  })
  it('veículo de interesse alterado depois da simulação é detectado', () => {
    expect(veiculoDesatualizado({ vehicleInterest: 'POP 100' }, { vehicleInterest: 'POP 100' })).toBe(false)
    expect(veiculoDesatualizado({ vehicleInterest: 'POP 100' }, { vehicleInterest: 'CG 160' })).toBe(true)
    expect(veiculoDesatualizado({ vehicleInterest: null }, { vehicleInterest: 'CG 160' })).toBe(false) // registros antigos sem referência
  })
  it('comparativo: uma linha por condição; "menor parcela" só com mesmo prazo E mesma entrada', () => {
    const linhas = montarComparativo([
      { bank: 'a', bankName: 'A', status: 'completed', conditions: [
        cond({ installments: 48, installment_value_cents: 300000, condition_id: 'a48' }),
        cond({ installments: 48, installment_value_cents: 250000, down_payment_cents: 4500000, condition_id: 'a48-ent' }),
        cond({ installments: 36, installment_value_cents: 380000, condition_id: 'a36' })] },
      { bank: 'b', bankName: 'B', status: 'completed', conditions: [
        cond({ installments: 48, installment_value_cents: 290000, condition_id: 'b48' }),
        cond({ installments: 48, installment_value_cents: 295000, condition_id: 'b48-2' })] },
    ])
    expect(linhas).toHaveLength(5) // não agrupa pelo prazo
    expect(linhas.filter((l) => l.installments === 48)).toHaveLength(4)
    expect(linhas.filter((l) => l.menorParcela).map((l) => l.condition_id)).toEqual(['b48'])
    // a parcela de 2.500 é menor, mas a entrada é outra: não entra na comparação
    expect(linhas.find((l) => l.condition_id === 'a48-ent').menorParcela).toBe(false)
    expect(linhas.find((l) => l.condition_id === 'a36').menorParcela).toBe(false) // sozinha no grupo
  })
})

// ------------------------------------------------------------------ fluxo na tela
// Tela com "pai" que guarda a oportunidade (como o App): onLeadChanged atualiza o registro.
let guardado = null
function Tela({ inicial, usuario }) {
  const [l, setL] = React.useState(inicial)
  return <OpportunityFinancing lead={l} usuario={usuario} onLeadChanged={(novo) => { guardado = novo; setL(novo) }} />
}
beforeEach(() => {
  guardado = null
  // O servidor falso devolve só as chaves alteradas; aqui juntamos com a oportunidade atual, como o backend real.
  const cli = api.salvarClienteFinanciamento.getMockImplementation()
  const vei = api.salvarVeiculoFinanciamento.getMockImplementation()
  api.salvarClienteFinanciamento.mockImplementation(async (id, d) => ({ ...(guardado || base), ...(await cli(id, d)) }))
  api.salvarVeiculoFinanciamento.mockImplementation(async (id, d) => ({ ...(guardado || base), ...(await vei(id, d)), vehicleCatalogInterest: (guardado || base).vehicleInterest }))
})
let base = lead
async function abrir(usuario = vendedor, l = lead) {
  base = l
  const r = render(<Tela inicial={l} usuario={usuario} />)
  fireEvent.click(screen.getByRole('button', { name: /Financiamento/ }))
  await screen.findByRole('list', { name: 'Etapas do financiamento' })
  return r
}
async function completarCliente() {
  fireEvent.click(screen.getByRole('button', { name: 'COMPLETAR DADOS' }))
  fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } })
  fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '1990-05-20' } })
  fireEvent.click(within(screen.getByRole('group', { name: 'Sexo' })).getByRole('button', { name: 'Feminino' }))
  fireEvent.click(within(screen.getByRole('group', { name: 'Possui CNH' })).getByRole('button', { name: 'Sim' }))
  fireEvent.change(screen.getByLabelText('UF'), { target: { value: 'PR' } })
  fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Londrina' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar dados do cliente' }))
  await waitFor(() => expect(screen.getByLabelText('Completude')).toHaveTextContent('9 de 9 ok'))
}
async function identificarVeiculo() {
  await waitFor(() => expect(within(screen.getByLabelText('Marca')).getByRole('option', { name: 'TOYOTA' })).toBeInTheDocument())
  fireEvent.change(screen.getByLabelText('Marca'), { target: { value: '59' } })
  await waitFor(() => expect(within(screen.getByLabelText('Modelo')).getByRole('option', { name: 'COROLLA' })).toBeInTheDocument())
  fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: '5001' } })
  fireEvent.change(screen.getByLabelText('Ano de fabricação'), { target: { value: '2024' } })
  fireEvent.change(screen.getByLabelText('Ano do modelo'), { target: { value: '2025' } })
  await waitFor(() => expect(within(screen.getByLabelText('Versão')).getByRole('option', { name: 'XEI 2.0 FLEX' })).toBeInTheDocument())
  fireEvent.change(screen.getByLabelText('Versão'), { target: { value: 'v-xei' } })
}
async function salvarVeiculo(nome = 'Salvar veículo') {
  fireEvent.click(screen.getByRole('button', { name: nome }))
  await screen.findByText('Veículo identificado para financiamento')
}
const continuar = () => fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
// Oportunidade com cadastro e veículo já salvos: Cliente → Veículo → Revisão sem redigitar nada.
async function irParaRevisao(l = leadCompleto) {
  await abrir(vendedor, l); continuar(); continuar()
  await screen.findByRole('button', { name: 'SIMULAR FINANCIAMENTO' })
}

describe('acesso e abertura', () => {
  it('vendedor de outra oportunidade não vê a área; gerente vê', () => {
    const { container, unmount } = render(<OpportunityFinancing lead={lead} usuario={outro} />)
    expect(container).toBeEmptyDOMElement(); unmount()
    render(<OpportunityFinancing lead={lead} usuario={gerente} />)
    expect(screen.getByRole('button', { name: /Financiamento/ })).toBeInTheDocument()
  })
  it('recolhida por padrão: abrir a oportunidade não faz nenhuma chamada de financiamento', () => {
    render(<OpportunityFinancing lead={leadCompleto} usuario={vendedor} />)
    for (const f of ['listarSimulacoesFinanciamento', 'getFinanciamentoMarcas', 'getFinanciamentoBancos', 'salvarClienteFinanciamento', 'salvarVeiculoFinanciamento']) expect(api[f]).not.toHaveBeenCalled()
  })
})

describe('etapa Cliente', () => {
  it('oportunidade ANTIGA: contato do CRM preenchido, cadastro do cliente aparece como faltando', async () => {
    await abrir()
    const lista = screen.getByRole('list', { name: 'Dados do cliente' })
    expect(within(lista).getByText('Joana Lima')).toBeInTheDocument()
    expect(within(lista).getByText('joana@example.invalid')).toBeInTheDocument()
    expect(within(lista).getByText(/99988-7766/)).toBeInTheDocument()
    expect(within(lista).getAllByText('Falta')).toHaveLength(6)
    expect(screen.getByLabelText('Completude')).toHaveTextContent('3 de 9 ok')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    expect(screen.queryByLabelText('CPF')).not.toBeInTheDocument() // formulário só ao clicar COMPLETAR DADOS
  })
  it('oportunidade NOVA COMPLETA: tudo preenchido do CRM, CPF mascarado, nada a digitar', async () => {
    await abrir(vendedor, leadCompleto)
    const lista = screen.getByRole('list', { name: 'Dados do cliente' })
    expect(screen.getByLabelText('Completude')).toHaveTextContent('9 de 9 ok')
    expect(within(lista).getByText('•••.•••.•••-25')).toBeInTheDocument()
    for (const t of ['20/05/1990', 'Feminino', 'PR', 'Londrina', 'Possui']) expect(within(lista).getByText(t)).toBeInTheDocument()
    expect(within(lista).queryByText('Falta')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'COMPLETAR DADOS' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar dados do cliente' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument() // nenhuma duplicação: só leitura
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  })
  it('dados incompletos: COMPLETAR DADOS mostra só os campos que faltam', async () => {
    await abrir(vendedor, { ...lead, customerDocumentMasked: '•••.•••.•••-25', customerGender: 'male', customerState: 'PR' })
    expect(screen.getByLabelText('Completude')).toHaveTextContent('6 de 9 ok')
    fireEvent.click(screen.getByRole('button', { name: 'COMPLETAR DADOS' }))
    const form = screen.getByRole('region', { name: 'Completar dados do cliente' })
    expect(within(form).getByLabelText('Data de nascimento')).toBeInTheDocument()
    expect(within(form).getByLabelText('Cidade')).toBeInTheDocument()
    expect(within(form).getByRole('group', { name: 'Possui CNH' })).toBeInTheDocument()
    expect(within(form).queryByLabelText('CPF')).not.toBeInTheDocument()
    expect(within(form).queryByRole('group', { name: 'Sexo' })).not.toBeInTheDocument()
  })
  it('completar e salvar grava no cadastro (PATCH só com os campos do cliente) e libera o Continuar', async () => {
    await abrir()
    await completarCliente()
    expect(api.salvarClienteFinanciamento).toHaveBeenCalledTimes(1)
    expect(api.salvarClienteFinanciamento.mock.calls[0]).toEqual(['opp1', { document: '52998224725', birthDate: '1990-05-20', gender: 'female', state: 'PR', city: 'Londrina', hasDriverLicense: true }])
    expect(guardado).toMatchObject({ customerDocumentMasked: '•••.•••.•••-25', customerCity: 'Londrina' })
    expect(within(screen.getByRole('list', { name: 'Dados do cliente' })).getByText('•••.•••.•••-25')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Completar dados do cliente' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
    expect(api.criarSimulacaoFinanciamento).not.toHaveBeenCalled()
    expect(api.getFinanciamentoMarcas).not.toHaveBeenCalled()
  })
  it('validação local: CPF ou nascimento inválidos não chegam ao servidor', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'COMPLETAR DADOS' }))
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-24' } })
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '2012-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar dados do cliente' }))
    expect(await screen.findByText('Informe um CPF válido.')).toBeInTheDocument()
    expect(screen.getByText('O cliente precisa ter entre 18 e 100 anos.')).toBeInTheDocument()
    expect(api.salvarClienteFinanciamento).not.toHaveBeenCalled()
  })
  it('erro do servidor aparece no campo e nada é dado como salvo', async () => {
    api.salvarClienteFinanciamento.mockRejectedValueOnce(Object.assign(new Error('Confira os campos destacados.'), { status: 400, body: { code: 'dados_invalidos', fields: { city: 'Informe a cidade.' } } }))
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'COMPLETAR DADOS' }))
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '52998224725' } })
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '1990-05-20' } })
    fireEvent.click(within(screen.getByRole('group', { name: 'Sexo' })).getByRole('button', { name: 'Masculino' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Possui CNH' })).getByRole('button', { name: 'Não' }))
    fireEvent.change(screen.getByLabelText('UF'), { target: { value: 'PR' } })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Cambé' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar dados do cliente' }))
    expect(await screen.findByText('Informe a cidade.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Completar dados do cliente' })).toBeInTheDocument()
    expect(guardado).toBeNull()
  })
  it('CPF mascarado: na digitação fora do foco e no cadastro; editar não traz o CPF inteiro', async () => {
    await abrir(vendedor, leadCompleto)
    fireEvent.click(screen.getByRole('button', { name: 'Editar dados do cliente' }))
    const cpf = screen.getByLabelText('CPF')
    expect(cpf).toHaveValue('')
    expect(cpf).toHaveAttribute('placeholder', expect.stringContaining('•••.•••.•••-25'))
    fireEvent.focus(cpf); fireEvent.change(cpf, { target: { value: '11144477735' } })
    expect(cpf).toHaveValue('111.444.777-35')
    fireEvent.blur(cpf)
    expect(cpf).toHaveValue('•••.•••.•••-35')
    expect(document.body.textContent).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/)
  })
  it('editar só a cidade envia só a cidade', async () => {
    await abrir(vendedor, leadCompleto)
    fireEvent.click(screen.getByRole('button', { name: 'Editar dados do cliente' }))
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Cambé' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar dados do cliente' }))
    await waitFor(() => expect(api.salvarClienteFinanciamento).toHaveBeenCalledWith('opp1', { city: 'Cambé' }))
    expect(await within(screen.getByRole('list', { name: 'Dados do cliente' })).findByText('Cambé')).toBeInTheDocument()
  })
  it('sem e-mail no CRM: e-mail informado vale só para a simulação (oportunidade não tem edição cadastral)', async () => {
    await abrir(vendedor, { ...leadCompleto, email: '' })
    expect(screen.getByLabelText('Completude')).toHaveTextContent('8 de 9 ok')
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'joana.lima@example.invalid' } })
    expect(screen.getByLabelText('Completude')).toHaveTextContent('9 de 9 ok')
    expect(screen.getByText(/Vale só para esta simulação/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir Nome' }))
    expect(screen.getByLabelText('Nome')).toHaveValue('Joana Lima')
    expect(api.updateOpportunity).not.toHaveBeenCalled(); expect(api.updateLeadData).not.toHaveBeenCalled(); expect(api.salvarClienteFinanciamento).not.toHaveBeenCalled()
  })
  it('Sexo e CNH são botões; LGPD visível; nenhum POST, catálogo ou banco nesta etapa', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'COMPLETAR DADOS' }))
    expect(within(screen.getByRole('group', { name: 'Sexo' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Masculino', 'Feminino'])
    expect(screen.getByText(/serão utilizados para realizar a simulação de financiamento junto às instituições financeiras habilitadas/)).toBeInTheDocument()
    expect(api.criarSimulacaoFinanciamento).not.toHaveBeenCalled()
    expect(api.getFinanciamentoMarcas).not.toHaveBeenCalled()
    expect(api.getFinanciamentoBancos).not.toHaveBeenCalled()
  })
  it('indicador de etapas: atual em destaque e concluídas com check', async () => {
    await abrir(vendedor, leadCompleto); continuar()
    const etapas = screen.getByRole('list', { name: 'Etapas do financiamento' })
    expect(within(etapas).getByRole('button', { name: /Veículo/ })).toHaveAttribute('aria-current', 'step')
    expect(within(etapas).getByRole('button', { name: /Cliente/ })).toHaveAttribute('data-concluida', 'sim')
    expect(within(etapas).getByRole('button', { name: /Resultados/ })).toBeDisabled()
  })
})

describe('etapa Veículo', () => {
  it('veículo NÃO estruturado: mostra o veículo de interesse e identifica no catálogo em cascata; salva na oportunidade', async () => {
    await abrir(vendedor, { ...lead, ...CADASTRO }); continuar()
    const bloco = screen.getByText('Veículo de interesse da oportunidade').closest('section')
    expect(within(bloco).getByText('POP 100')).toBeInTheDocument()
    expect(screen.getByLabelText('Modelo')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await identificarVeiculo()
    expect(api.getFinanciamentoMarcas).toHaveBeenCalledWith('car')
    expect(api.getFinanciamentoModelos).toHaveBeenCalledWith('car', '59')
    expect(api.getFinanciamentoVersoes).toHaveBeenLastCalledWith('car', '59', '5001', 2024, 2025)
    await salvarVeiculo()
    expect(api.salvarVeiculoFinanciamento).toHaveBeenCalledWith('opp1', { type: 'car', brandCode: '59', modelCode: '5001', versionCode: 'v-xei', manufactureYear: 2024, modelYear: 2025, zeroKm: false })
    expect(screen.getByText('TOYOTA COROLLA · XEI 2.0 FLEX')).toBeInTheDocument()
    expect(guardado).toMatchObject({ vehicleVersionCode: 'v-xei', vehicleCatalogNeedsReview: false })
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
    expect(api.criarSimulacaoFinanciamento).not.toHaveBeenCalled()
  })
  it('veículo JÁ estruturado: aparece pronto, sem consultar o catálogo e sem pedir de novo', async () => {
    await abrir(vendedor, leadCompleto); continuar()
    expect(screen.getByText('Veículo identificado para financiamento')).toBeInTheDocument()
    expect(screen.getByText('TOYOTA COROLLA · XEI 2.0 FLEX')).toBeInTheDocument()
    expect(screen.queryByLabelText('Marca')).not.toBeInTheDocument()
    expect(api.getFinanciamentoMarcas).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  })
  it('corrigir veículo: "Alterar veículo" abre o catálogo já preenchido e salva o novo', async () => {
    await abrir(vendedor, leadCompleto); continuar()
    fireEvent.click(screen.getByRole('button', { name: 'Alterar veículo' }))
    await waitFor(() => expect(screen.getByLabelText('Marca')).toHaveValue('59'))
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    const zero = screen.getByRole('group', { name: 'Zero km' })
    fireEvent.click(within(zero).getByRole('button', { name: 'Sim' }))
    await waitFor(() => expect(screen.getByLabelText('Versão')).toHaveValue('v-xei'))
    await salvarVeiculo()
    expect(api.salvarVeiculoFinanciamento.mock.calls[0][1]).toMatchObject({ versionCode: 'v-xei', zeroKm: true })
  })
  it('vehicleInterest alterado: aviso de revalidação, códigos antigos não são usados até confirmar', async () => {
    const pendente = { ...leadCompleto, vehicleInterest: 'CG 160 Titan', vehicleCatalogNeedsReview: true }
    await abrir(vendedor, pendente)
    const etapas = screen.getByRole('list', { name: 'Etapas do financiamento' })
    expect(within(etapas).getByRole('button', { name: /Revisão/ })).toBeDisabled()
    continuar()
    expect(screen.getByRole('alert')).toHaveTextContent('O veículo de interesse foi alterado. Confirme novamente os dados do veículo antes de uma nova simulação.')
    expect(screen.getByText('Confirmar veículo para financiamento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await waitFor(() => expect(screen.getByLabelText('Versão')).toHaveValue('v-xei'))
    await salvarVeiculo('Confirmar veículo')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  })
  it('vehicleInterest alterado com a área aberta (pai atualiza a oportunidade) mostra o aviso', async () => {
    const { rerender } = render(<OpportunityFinancing lead={leadCompleto} usuario={vendedor} />)
    fireEvent.click(screen.getByRole('button', { name: /Financiamento/ }))
    await screen.findByRole('list', { name: 'Etapas do financiamento' }); continuar()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    rerender(<OpportunityFinancing lead={{ ...leadCompleto, vehicleInterest: 'CG 160', vehicleCatalogNeedsReview: true }} usuario={vendedor} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('O veículo de interesse foi alterado')
  })
  it('trocar para moto recarrega marcas e limpa a seleção', async () => {
    await abrir(vendedor, { ...lead, ...CADASTRO }); continuar(); await identificarVeiculo()
    fireEvent.click(screen.getByRole('button', { name: 'Moto' }))
    await waitFor(() => expect(api.getFinanciamentoMarcas).toHaveBeenLastCalledWith('motorcycle'))
    expect(screen.getByLabelText('Marca')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Salvar veículo' })).toBeDisabled()
  })
  it('sem veículo de interesse, orienta registrar em "Editar negócio"', async () => {
    await abrir(vendedor, { ...lead, ...CADASTRO, vehicleInterest: '' }); continuar()
    expect(screen.getByText(/Não informado/)).toBeInTheDocument()
  })
  it('servidor sem configuração: aviso claro, catálogo e salvar desabilitados', async () => {
    api.getFinanciamentoMarcas.mockRejectedValue(Object.assign(new Error('O financiamento ainda não está configurado no servidor.'), { status: 503, body: { code: 'nao_configurado' } }))
    await abrir(vendedor, { ...lead, ...CADASTRO }); continuar()
    expect(await screen.findByText(/ainda não está configurado no servidor/)).toBeInTheDocument()
    expect(screen.getByLabelText('Marca')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Salvar veículo' })).toBeDisabled()
  })
})

describe('jornada completa e persistência (fixture fictícia "Carlos Teste")', () => {
  const carlos = { ...lead, id: 'opp-carlos', name: 'Carlos Teste', phone: '43999999999', email: 'teste@example.invalid', vehicleInterest: 'POP 100', negotiatedValue: null, assetValue: 15990, downPayment: 3000 }
  it('completa, salva, fecha, reabre (F5) e Cliente e Veículo já vêm completos até a Revisão — sem POST', async () => {
    const { unmount } = await abrir(vendedor, carlos)
    await completarCliente()
    continuar()
    await identificarVeiculo(); await salvarVeiculo()
    unmount() // fecha o modal
    // "F5": a oportunidade volta do servidor como foi salva (fixture persistida).
    const recarregada = { ...guardado }
    expect(recarregada).toMatchObject({ customerDocumentMasked: '•••.•••.•••-25', customerBirthDate: '1990-05-20', vehicleVersionCode: 'v-xei' })
    expect(JSON.stringify(recarregada)).not.toMatch(/52998224725/)
    vi.clearAllMocks(); servidorFalso(); api.listarSimulacoesFinanciamento.mockResolvedValue([]); api.getFinanciamentoBancos.mockResolvedValue(BANCOS_API)
    await abrir(vendedor, recarregada)
    expect(screen.getByLabelText('Completude')).toHaveTextContent('9 de 9 ok')
    continuar()
    expect(screen.getByText('Veículo identificado para financiamento')).toBeInTheDocument()
    continuar()
    expect(await screen.findByRole('button', { name: 'SIMULAR FINANCIAMENTO' })).toBeInTheDocument()
    const cliente = screen.getByText('Cliente', { selector: 'h4' }).closest('section')
    expect(cliente).toHaveTextContent('Carlos Teste'); expect(cliente).toHaveTextContent('•••.•••.•••-25')
    for (const f of ['salvarClienteFinanciamento', 'salvarVeiculoFinanciamento', 'getFinanciamentoMarcas', 'criarSimulacaoFinanciamento']) expect(api[f]).not.toHaveBeenCalled()
  })
})

describe('etapa Revisão', () => {
  it('resume cliente (CPF mascarado), veículo e negociação com a regra de valor', async () => {
    await irParaRevisao()
    const cliente = screen.getByText('Cliente', { selector: 'h4' }).closest('section')
    expect(within(cliente).getByText('Joana Lima')).toBeInTheDocument()
    expect(within(cliente).getByText('•••.•••.•••-25')).toBeInTheDocument()
    expect(within(cliente).queryByText('529.982.247-25')).not.toBeInTheDocument()
    expect(within(cliente).getByText('20/05/1990')).toBeInTheDocument()
    expect(within(cliente).getByText('Londrina / PR')).toBeInTheDocument()
    const veiculo = screen.getByText('Veículo', { selector: 'h4' }).closest('section')
    expect(within(veiculo).getByText('POP 100')).toBeInTheDocument()
    expect(within(veiculo).getByText('TOYOTA COROLLA · XEI 2.0 FLEX')).toBeInTheDocument()
    expect(within(veiculo).getByText('Não', { selector: 'span' })).toBeInTheDocument()
    expect(within(veiculo).getByText('2024/2025')).toBeInTheDocument()
    const neg = screen.getByText('Negociação', { selector: 'h4' }).closest('section')
    expect(within(neg).getByText('R$ 129.900,00')).toBeInTheDocument() // valor do bem
    expect(within(neg).getByText('R$ 125.000,00')).toBeInTheDocument() // valor negociado
    expect(screen.getByLabelText('Valor da simulação')).toHaveValue('R$ 125.000,00') // negociado > 0
    expect(within(neg).getByText('R$ 95.000,00')).toBeInTheDocument() // a financiar
    for (const p of ['24x', '36x', '48x', '60x']) expect(screen.getByRole('button', { name: p })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '72x' }))
    expect(screen.getByRole('button', { name: '72x' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('sem valor negociado, usa o valor do bem', async () => {
    await irParaRevisao({ ...leadCompleto, negotiatedValue: null })
    expect(await screen.findByLabelText('Valor da simulação')).toHaveValue('R$ 129.900,00')
    expect(screen.getByText('R$ 99.900,00')).toBeInTheDocument()
  })
  it('bancos vêm da API (habilitado/não habilitado), lista apenas informativa, sem checkbox', async () => {
    await irParaRevisao()
    expect(api.getFinanciamentoBancos).toHaveBeenCalledTimes(1)
    const lista = await screen.findByRole('list', { name: 'Bancos' })
    const itens = within(lista).getAllByRole('listitem')
    expect(itens).toHaveLength(2)
    expect(itens[0]).toHaveTextContent('Banco Xis Teste'); expect(itens[0]).toHaveTextContent('Habilitado')
    expect(itens[1]).toHaveTextContent('Financeira Ypsilon'); expect(itens[1]).toHaveTextContent('Não habilitado')
    expect(within(lista).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText(/Lista informativa/)).toBeInTheDocument()
  })
  it('outra lista de bancos da API muda a tela (nada fixo no código)', async () => {
    api.getFinanciamentoBancos.mockResolvedValue([{ code: 'z', name: 'Banco Zeta Único', status: 'enabled', habilitado: true }])
    await irParaRevisao()
    const lista = await screen.findByRole('list', { name: 'Bancos' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(1)
    expect(lista).toHaveTextContent('Banco Zeta Único')
    expect(screen.queryByText('Banco Xis Teste')).not.toBeInTheDocument()
  })
  it('POST só acontece ao clicar SIMULAR FINANCIAMENTO; corpo sem CPF nem veículo (o servidor usa o CRM)', async () => {
    api.criarSimulacaoFinanciamento.mockResolvedValue({ ...simBase, nextPollInMs: null })
    await irParaRevisao()
    await screen.findByRole('list', { name: 'Bancos' })
    expect(api.criarSimulacaoFinanciamento).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'SIMULAR FINANCIAMENTO' }))
    await waitFor(() => expect(api.criarSimulacaoFinanciamento).toHaveBeenCalledTimes(1))
    const corpo = api.criarSimulacaoFinanciamento.mock.calls[0][0]
    expect(corpo).toEqual({ opportunityId: 'opp1', terms: { assetValue: 125000, downPayment: 30000, installments: [24, 36, 48, 60] },
      applicant: { name: 'Joana Lima', email: 'joana@example.invalid', phone: '43999887766' } })
    expect(await screen.findByText('3 de 8')).toBeInTheDocument() // navegou para Resultados
  })
  it('duplo clique em SIMULAR FINANCIAMENTO gera um único POST', async () => {
    let resolver
    api.criarSimulacaoFinanciamento.mockImplementation(() => new Promise((r) => { resolver = r }))
    await irParaRevisao()
    const botao = screen.getByRole('button', { name: 'SIMULAR FINANCIAMENTO' })
    fireEvent.click(botao); fireEvent.click(botao); fireEvent.click(botao)
    expect(api.criarSimulacaoFinanciamento).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Enviando aos bancos…' })).toBeDisabled()
    resolver({ ...simBase, nextPollInMs: null })
    expect(await screen.findByText('3 de 8')).toBeInTheDocument()
    expect(api.criarSimulacaoFinanciamento).toHaveBeenCalledTimes(1)
  })
  it('servidor recusa veículo pendente (409): tela passa a pedir a revalidação', async () => {
    api.criarSimulacaoFinanciamento.mockRejectedValue(Object.assign(new Error('O veículo de interesse foi alterado. Confirme novamente os dados do veículo antes de uma nova simulação.'), { status: 409, body: { code: 'veiculo_revalidar' } }))
    await irParaRevisao()
    fireEvent.click(screen.getByRole('button', { name: 'SIMULAR FINANCIAMENTO' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'SIMULAR FINANCIAMENTO' })).toBeDisabled())
    fireEvent.click(screen.getAllByRole('button', { name: 'Alterar' })[1])
    expect(await screen.findByText('Confirmar veículo para financiamento')).toBeInTheDocument()
  })
  it('navegar entre etapas (Alterar, Voltar, Continuar) não envia nada', async () => {
    await irParaRevisao()
    fireEvent.click(screen.getAllByRole('button', { name: 'Alterar' })[1])
    continuar()
    fireEvent.click(screen.getAllByRole('button', { name: 'Alterar' })[0])
    continuar(); continuar()
    await screen.findByRole('button', { name: 'SIMULAR FINANCIAMENTO' })
    expect(api.criarSimulacaoFinanciamento).not.toHaveBeenCalled()
  })
  it('erro do backend mostra mensagem; envio incerto oferece "Tentar novamente" com os mesmos dados', async () => {
    const erro = Object.assign(new Error('A plataforma de financiamento não respondeu a tempo.'), { status: 504, body: { code: 'timeout', simulation: { ...simBase, status: 'envio_incerto', canRetry: true } } })
    api.criarSimulacaoFinanciamento.mockRejectedValueOnce(erro).mockResolvedValueOnce({ ...simBase, status: 'queued', nextPollInMs: 20000 })
    await irParaRevisao()
    fireEvent.click(screen.getByRole('button', { name: 'SIMULAR FINANCIAMENTO' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('não respondeu a tempo')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(api.criarSimulacaoFinanciamento).toHaveBeenCalledTimes(2))
    expect(api.criarSimulacaoFinanciamento.mock.calls[1][0]).toEqual(api.criarSimulacaoFinanciamento.mock.calls[0][0])
  })
  it('402 sem saldo aparece de forma compreensível e sem reenvio', async () => {
    api.criarSimulacaoFinanciamento.mockRejectedValue(Object.assign(new Error('Não há saldo disponível para uma nova consulta.'), { status: 402, body: { code: 'sem_saldo' } }))
    await irParaRevisao()
    fireEvent.click(screen.getByRole('button', { name: 'SIMULAR FINANCIAMENTO' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não há saldo disponível para uma nova consulta.')
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })
  it('entrada maior que o valor bloqueia o envio', async () => {
    await irParaRevisao()
    fireEvent.change(screen.getByLabelText('Entrada'), { target: { value: '200000' } })
    expect(await screen.findByText('A entrada deve ser menor que o valor do veículo.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SIMULAR FINANCIAMENTO' })).toBeDisabled()
  })
})

describe('etapa Resultados', () => {
  it('status geral, progresso, situação por banco e comparativo com várias condições no mesmo prazo', async () => {
    api.criarSimulacaoFinanciamento.mockResolvedValue({ ...simBase })
    api.getSimulacaoFinanciamento.mockResolvedValue({ ...simBase, status: 'partial', terminal: true, nextPollInMs: null,
      progress: { expected_banks: 3, finished_banks: 3, pending_banks: 0 },
      results: [
        { bank: 'banco-y', bankName: 'Financeira Ypsilon', status: 'timed_out', conditions: [], issues: [], error: { code: 'provider_timeout' } },
        { bank: 'banco-w', bankName: 'Banco Wê', status: 'rejected', conditions: [], issues: [], error: null },
        { bank: 'banco-x', bankName: 'Banco Xis Teste', status: 'completed', issues: [], error: null, conditions: [
          cond({ installments: 48, installment_value_cents: 284900, condition_id: 'cond-a' }),
          cond({ installments: 48, installment_value_cents: 251000, monthly_rate: 0.0139, monthly_rate_estimated: true, condition_id: 'cond-b' }),
          cond({ installments: 48, installment_value_cents: 240000, down_payment_cents: 4500000, condition_id: 'cond-c' })] },
      ] })
    await irParaRevisao()
    fireEvent.click(screen.getByRole('button', { name: 'SIMULAR FINANCIAMENTO' }))
    expect(await screen.findByText('3 de 8')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
    expect(screen.getByText('Em processamento')).toBeInTheDocument()
    await waitFor(() => expect(api.getSimulacaoFinanciamento).toHaveBeenCalledWith('sim-1'), { timeout: 4000 })
    expect(await screen.findByText(/Processamento concluído parcialmente/, { selector: 'p' })).toBeInTheDocument()

    const bancos = screen.getByRole('list', { name: 'Situação por banco' })
    expect(within(bancos).getAllByRole('listitem', { name: undefined }).filter((li) => li.parentElement === bancos)[0]).toHaveTextContent('Banco Xis Teste')
    expect(bancos).toHaveTextContent('Condições disponíveis')
    expect(bancos).toHaveTextContent('Falha técnica')
    expect(bancos).toHaveTextContent('Sem condição disponível')
    expect(bancos).toHaveTextContent(/não uma recusa/)

    const tabela = screen.getByTestId('comparativo')
    const linhas = within(tabela).getAllByRole('row').slice(1)
    expect(linhas).toHaveLength(3) // três condições no mesmo prazo, sem agrupar
    for (const h of ['Banco', 'Prazo', 'Parcela', 'Entrada', 'Financiado', 'Taxa', 'Condição']) expect(within(tabela).getByRole('columnheader', { name: h })).toBeInTheDocument()
    expect(within(tabela).getByText('cond-a')).toBeInTheDocument()
    expect(within(tabela).getByText('R$ 2.849,00')).toBeInTheDocument()
    expect(within(tabela).getByText('1,39% a.m.')).toBeInTheDocument()
    expect(within(tabela).getAllByText('Taxa estimada')).toHaveLength(1)
    // "Menor parcela": só cond-b (mesmo prazo e entrada que cond-a). cond-c tem parcela menor mas outra entrada.
    const menor = within(tabela).getAllByText('Menor parcela')
    expect(menor).toHaveLength(1)
    expect(menor[0].closest('tr')).toHaveTextContent('cond-b')
    expect(document.body.textContent.toLowerCase()).not.toMatch(/aprovad/)
  })
  it('resumo da oportunidade e comparativo em cards no celular (mesmas condições da tabela)', async () => {
    api.listarSimulacoesFinanciamento.mockResolvedValue([{ ...simBase, status: 'completed', terminal: true, nextPollInMs: null, vehicleInterest: 'POP 100',
      results: [{ bank: 'banco-x', bankName: 'Banco Xis Teste', status: 'completed', conditions: [
        cond({ installments: 48, installment_value_cents: 284900, condition_id: 'c1' }),
        cond({ installments: 48, installment_value_cents: 279900, monthly_rate: 1.29, condition_id: 'c2' })] }] }])
    await abrir()
    const resumo = (await screen.findByText('Resumo da oportunidade')).closest('section')
    expect(resumo).toHaveTextContent('Joana Lima')
    expect(resumo).toHaveTextContent('TOYOTA COROLLA · XEI 2.0 · 2024/2025')
    expect(resumo).toHaveTextContent('R$ 125.000,00'); expect(resumo).toHaveTextContent('R$ 30.000,00'); expect(resumo).toHaveTextContent('R$ 95.000,00')
    expect(within(resumo).queryByRole('status')).not.toBeInTheDocument() // veículo de interesse igual
    const cards = screen.getByTestId('comparativo-cards')
    expect(cards.className).toMatch(/sm:hidden/)
    expect(screen.getByTestId('comparativo').className).toMatch(/hidden sm:block/)
    expect(within(cards).getAllByRole('listitem')).toHaveLength(2)
    expect(within(cards).getByText('c2').closest('li')).toHaveTextContent('Menor parcela')
    expect(within(cards).getByText('c2').closest('li')).toHaveTextContent('Menor taxa')
    expect(within(screen.getByTestId('comparativo')).getByText('Menor taxa').closest('tr')).toHaveTextContent('c2')
  })
  it('avisa quando o veículo de interesse mudou depois da simulação', async () => {
    api.listarSimulacoesFinanciamento.mockResolvedValue([{ ...simBase, status: 'completed', terminal: true, nextPollInMs: null, vehicleInterest: 'Onix 2020' }])
    await abrir()
    expect(await screen.findByText(/mudou depois desta simulação \(era “Onix 2020”\)/)).toBeInTheDocument()
  })
  it.each([
    ['completed', 'Processamento concluído', /Compare abaixo/],
    ['failed', 'Falha na simulação', /A simulação falhou: Erro na plataforma/],
    ['expired', 'Simulação expirada', /expirou/],
  ])('status final %s é exibido sem nova consulta e sem "aprovado"', async (status, titulo, texto) => {
    api.listarSimulacoesFinanciamento.mockResolvedValue([{ ...simBase, status, terminal: true, nextPollInMs: null, error: status === 'failed' ? { message: 'Erro na plataforma' } : null }])
    await abrir()
    expect(await screen.findByText(titulo)).toBeInTheDocument()
    expect(screen.getByText(texto)).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 50))
    expect(api.getSimulacaoFinanciamento).not.toHaveBeenCalled()
    expect(document.body.textContent.toLowerCase()).not.toMatch(/aprovad/)
  })
  it('reabrir mostra a última simulação guardada sem nova consulta; "Nova simulação" volta à revisão', async () => {
    api.listarSimulacoesFinanciamento.mockResolvedValue([{ ...simBase, status: 'completed', terminal: true, nextPollInMs: null, results: [] }])
    render(<Tela inicial={lead} usuario={vendedor} />)
    fireEvent.click(screen.getByRole('button', { name: /Financiamento/ }))
    expect(await screen.findByText('Processamento concluído')).toBeInTheDocument()
    expect(api.getSimulacaoFinanciamento).not.toHaveBeenCalled()
    expect(api.criarSimulacaoFinanciamento).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Nova simulação' }))
    expect(await screen.findByText('COMPLETAR DADOS')).toBeInTheDocument() // oportunidade antiga sem cadastro: começa pelo Cliente
  })
  it('"Nova simulação" com cadastro e veículo salvos vai direto para a Revisão', async () => {
    api.listarSimulacoesFinanciamento.mockResolvedValue([{ ...simBase, status: 'completed', terminal: true, nextPollInMs: null, results: [] }])
    await abrir(vendedor, leadCompleto)
    fireEvent.click(await screen.findByRole('button', { name: 'Nova simulação' }))
    expect(await screen.findByRole('button', { name: 'SIMULAR FINANCIAMENTO' })).toBeInTheDocument()
  })
})

describe('segurança, LGPD e layout', () => {
  const src = (f) => fs.readFileSync(path.resolve(__dirname, '../src', f), 'utf8')
  it('nenhum banco fixo no código do financiamento', () => {
    const codigo = src('components/OpportunityFinancing.jsx') + src('financing.js')
    expect(codigo).not.toMatch(/santander|bradesco|ita[uú]|banco do brasil|caixa|\bbv\b|safra|\bpan\b|omni|sicredi|sicoob|porto seguro|daycoval|\bc6 bank/i)
  })
  it('nenhuma chave nem URL da Zinix no frontend', () => {
    const codigo = src('components/OpportunityFinancing.jsx') + src('financing.js') + src('api.js')
    expect(codigo).not.toMatch(/ZINIX_API_KEY|saas\.zinix|zx_live|Authorization: ?Bearer/i)
  })
  it('aviso LGPD aparece também na revisão, antes do envio', async () => {
    await irParaRevisao()
    expect(screen.getByText('Os dados informados serão utilizados para realizar a simulação de financiamento junto às instituições financeiras habilitadas.')).toBeInTheDocument()
  })
  it('responsivo: grades empilham no celular e o comparativo rola na horizontal', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'COMPLETAR DADOS' }))
    expect(within(screen.getByRole('region', { name: 'Completar dados do cliente' })).getByRole('list').className).toMatch(/grid-cols-1 sm:grid-cols-2/)
    expect(screen.getByRole('list', { name: 'Etapas do financiamento' }).className).toMatch(/flex-wrap/)
    const comp = src('components/OpportunityFinancing.jsx')
    expect(comp).toMatch(/overflow-x-auto[^"]*" data-testid="comparativo"/)
  })
})

describe('ZINIX-MVP-002B: frontend nunca depende do CPF completo', () => {
  const src = (f) => fs.readFileSync(path.resolve(__dirname, '../src', f), 'utf8')
  it('código do frontend só conhece customerDocumentMasked (nunca customerDocument)', () => {
    const codigo = ['components/OpportunityFinancing.jsx', 'financing.js', 'api.js', 'components/LeadModal.jsx'].map(src).join('\n')
    expect(codigo).not.toMatch(/customerDocument(?!Masked)/)
  })
  it('editar CPF: campo abre vazio, a máscara nunca vira valor e sem digitar o CPF não é enviado', async () => {
    await abrir(vendedor, leadCompleto)
    fireEvent.click(screen.getByRole('button', { name: 'Editar dados do cliente' }))
    expect(screen.getByLabelText('CPF')).toHaveValue('')
    expect(rascunhoCliente(leadCompleto).cpf).toBe('')
    fireEvent.click(within(screen.getByRole('group', { name: 'Possui CNH' })).getByRole('button', { name: 'Não' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar dados do cliente' }))
    await waitFor(() => expect(api.salvarClienteFinanciamento).toHaveBeenCalledWith('opp1', { hasDriverLicense: false }))
    // salvar outro campo não limpa o CPF: continua o mascarado do cadastro
    expect(await within(screen.getByRole('list', { name: 'Dados do cliente' })).findByText('•••.•••.•••-25')).toBeInTheDocument()
    expect(screen.getByLabelText('Completude')).toHaveTextContent('9 de 9 ok')
  })
  it('trocar o CPF exige digitar o número inteiro; só então ele é enviado', async () => {
    await abrir(vendedor, leadCompleto)
    fireEvent.click(screen.getByRole('button', { name: 'Editar dados do cliente' }))
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar dados do cliente' }))
    expect(await screen.findByText('Informe um CPF válido.')).toBeInTheDocument()
    expect(api.salvarClienteFinanciamento).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '111.444.777-35' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar dados do cliente' }))
    await waitFor(() => expect(api.salvarClienteFinanciamento).toHaveBeenCalledWith('opp1', { document: '11144477735' }))
    expect(await within(screen.getByRole('list', { name: 'Dados do cliente' })).findByText('•••.•••.•••-35')).toBeInTheDocument()
  })
  it('oportunidade sem responsável vista por vendedor (API omite os dados): nada pessoal na tela e sem Financiamento', () => {
    const restrita = { ...lead, ownerId: null, ownerName: null, ...VEICULO, customerDataRestricted: true }
    render(<LeadModal lead={restrita} usuario={vendedor} onClose={() => {}} onMoveStage={() => {}} onLeadChanged={() => {}} />)
    expect(screen.queryByRole('region', { name: 'Financiamento' })).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/•••|20\/05\/1990|Londrina/)
  })
  it('gerente e vendedor responsável veem o necessário (CPF só mascarado)', async () => {
    for (const quem of [gerente, vendedor]) {
      const { unmount } = await abrir(quem, leadCompleto)
      const dados = screen.getByRole('list', { name: 'Dados do cliente' })
      expect(dados).toHaveTextContent('•••.•••.•••-25'); expect(dados).toHaveTextContent('20/05/1990'); expect(dados).toHaveTextContent('Londrina')
      expect(document.body.textContent).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11}/)
      unmount()
    }
  })
  it('gerente abre oportunidade sem responsável com os dados (como a API entrega ao gerente)', async () => {
    await abrir(gerente, { ...leadCompleto, ownerId: null, ownerName: null })
    expect(screen.getByLabelText('Completude')).toHaveTextContent('9 de 9 ok')
  })
})

describe('integração com a oportunidade', () => {
  it('LeadModal repassa onLeadChanged: salvar o cadastro atualiza a oportunidade no App', async () => {
    const onLeadChanged = vi.fn()
    base = lead
    render(<LeadModal lead={lead} usuario={vendedor} onClose={() => {}} onMoveStage={() => {}} onLeadChanged={onLeadChanged} />)
    fireEvent.click(screen.getByRole('button', { name: /Simular \/ ver simulações/ }))
    await screen.findByRole('list', { name: 'Etapas do financiamento' })
    await completarCliente()
    expect(onLeadChanged).toHaveBeenCalledWith(expect.objectContaining({ id: 'opp1', customerDocumentMasked: '•••.•••.•••-25' }))
  })
  it('LeadModal de oportunidade mostra Financiamento; lead livre não', () => {
    const { unmount } = render(<LeadModal lead={lead} usuario={vendedor} onClose={() => {}} onMoveStage={() => {}} onLeadChanged={() => {}} />)
    expect(screen.getByRole('region', { name: 'Financiamento' })).toBeInTheDocument()
    expect(api.listarSimulacoesFinanciamento).not.toHaveBeenCalled()
    unmount()
    render(<LeadModal lead={{ ...lead, id: 'free', recordType: 'lead', ownerId: null }} usuario={vendedor} onClose={() => {}} onMoveStage={() => {}} onLeadChanged={() => {}} />)
    expect(screen.queryByRole('region', { name: 'Financiamento' })).not.toBeInTheDocument()
  })
})
