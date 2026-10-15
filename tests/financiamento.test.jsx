import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import OpportunityFinancing from '../src/components/OpportunityFinancing'
import LeadModal from '../src/components/LeadModal'
import {
  cpfValido, formatCpf, maskCpf, montarSimulacao, formatTaxa, formularioInicial, STATUS_SIMULACAO, situacaoBanco, explicacaoBanco, resumoFinal,
  checklistCliente, dadosDoCrm, valorDaSimulacao, negociacao, montarComparativo, veiculoDesatualizado,
} from '../src/financing'
import * as api from '../src/api'

vi.mock('../src/api', () => ({
  getFinanciamentoMarcas: vi.fn(), getFinanciamentoModelos: vi.fn(), getFinanciamentoVersoes: vi.fn(), getFinanciamentoBancos: vi.fn(),
  criarSimulacaoFinanciamento: vi.fn(), getSimulacaoFinanciamento: vi.fn(), listarSimulacoesFinanciamento: vi.fn(),
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
    expect(f).toMatchObject({ name: 'Joana Lima', email: 'joana@example.invalid', cpf: '', birthDate: '', gender: '', state: '', city: '', hasDriverLicense: '' })
    expect(f.phone).toMatch(/99988-7766/)
  })
  it('checklist marca como CRM só o que o CRM já tem', () => {
    const itens = checklistCliente(formularioInicial(lead), lead, HOJE)
    expect(itens.filter((i) => i.origem === 'crm').map((i) => i.campo)).toEqual(['name', 'phone', 'email'])
    expect(itens.filter((i) => !i.ok).map((i) => i.campo)).toEqual(['cpf', 'birthDate', 'gender', 'state', 'city', 'hasDriverLicense'])
    const semEmail = checklistCliente(formularioInicial({ ...lead, email: '' }), { ...lead, email: '' }, HOJE)
    expect(semEmail.find((i) => i.campo === 'email')).toMatchObject({ origem: 'simulacao', ok: false })
  })
  it('valor da simulação: negociado se > 0, senão valor do bem; financiar = valor − entrada', () => {
    expect(valorDaSimulacao(lead)).toEqual({ valor: 125000, origem: 'negociado' })
    expect(valorDaSimulacao({ ...lead, negotiatedValue: 0 })).toEqual({ valor: 129900, origem: 'bem' })
    expect(valorDaSimulacao({})).toEqual({ valor: null, origem: null })
    expect(negociacao(formularioInicial(lead)).financiar).toBe(95000)
  })
  it('monta o corpo com reais (não centavos), prazos ordenados e telefone só dígitos', () => {
    const form = { ...formularioInicial(lead), cpf: '52998224725', birthDate: '1990-05-20', gender: 'female', state: 'PR', city: 'Londrina',
      hasDriverLicense: 'sim', brandCode: '59', modelCode: '5001', manufactureYear: 2024, modelYear: '2025', versionCode: 'v-xei', installments: [60, 24] }
    const { erros, corpo } = montarSimulacao(form, 'opp1', HOJE)
    expect(erros).toBeNull()
    expect(corpo.terms).toEqual({ assetValue: 125000, downPayment: 30000, installments: [24, 60] })
    expect(corpo.applicant).toMatchObject({ document: '52998224725', phone: '43999887766', hasDriverLicense: true })
    expect(corpo.vehicle).toMatchObject({ manufactureYear: 2024, modelYear: 2025, versionCode: 'v-xei' })
    expect(Object.keys(corpo)).toEqual(['opportunityId', 'applicant', 'vehicle', 'terms']) // sem lista de bancos: o contrato não aceita
  })
  it('validações bloqueiam envio inválido', () => {
    const { erros } = montarSimulacao({ ...formularioInicial(lead), cpf: '123', birthDate: '2012-01-01', downPayment: 200000, installments: [] }, 'opp1', HOJE)
    expect(Object.keys(erros)).toEqual(expect.arrayContaining(['applicant.document', 'applicant.birthDate', 'terms.downPayment', 'terms.installments', 'vehicle.versionCode']))
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
async function abrir(usuario = vendedor, l = lead) {
  const r = render(<OpportunityFinancing lead={l} usuario={usuario} />)
  fireEvent.click(screen.getByRole('button', { name: /Financiamento/ }))
  await screen.findByRole('list', { name: 'Etapas do financiamento' })
  return r
}
function completarCliente() {
  fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } })
  fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '1990-05-20' } })
  fireEvent.click(within(screen.getByRole('group', { name: 'Sexo' })).getByRole('button', { name: 'Feminino' }))
  fireEvent.click(within(screen.getByRole('group', { name: 'Possui CNH' })).getByRole('button', { name: 'Sim' }))
  fireEvent.change(screen.getByLabelText('UF'), { target: { value: 'PR' } })
  fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Londrina' } })
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
const continuar = () => fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
async function irParaRevisao() {
  await abrir(); completarCliente(); continuar(); await identificarVeiculo(); continuar()
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
    render(<OpportunityFinancing lead={lead} usuario={vendedor} />)
    expect(api.listarSimulacoesFinanciamento).not.toHaveBeenCalled()
    expect(api.getFinanciamentoMarcas).not.toHaveBeenCalled()
    expect(api.getFinanciamentoBancos).not.toHaveBeenCalled()
  })
})

describe('etapa Cliente', () => {
  it('reaproveita nome, telefone e e-mail do CRM e pede só o que falta', async () => {
    await abrir()
    const crm = screen.getByRole('list', { name: 'Dados do CRM' })
    expect(within(crm).getByText('Joana Lima')).toBeInTheDocument()
    expect(within(crm).getByText('joana@example.invalid')).toBeInTheDocument()
    expect(within(crm).getByText(/99988-7766/)).toBeInTheDocument()
    // nada disso aparece como campo a preencher
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Telefone')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument()
    const faltam = screen.getByRole('list', { name: 'Dados a completar' })
    for (const l of ['CPF', 'Data de nascimento', 'Sexo', 'UF', 'Cidade', 'Possui CNH']) expect(within(faltam).getByLabelText(l)).toBeInTheDocument()
    expect(screen.getByLabelText('Completude')).toHaveTextContent('3 de 9 ok')
  })
  it('se o CRM não tem e-mail, o e-mail entra como campo a preencher', async () => {
    await abrir(vendedor, { ...lead, email: '' })
    expect(within(screen.getByRole('list', { name: 'Dados a completar' })).getByLabelText('E-mail')).toHaveValue('')
    expect(screen.getByLabelText('Completude')).toHaveTextContent('2 de 9 ok')
  })
  it('"Corrigir" permite editar um dado do CRM só para a simulação', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir E-mail' }))
    const email = screen.getByLabelText('E-mail')
    expect(email).toHaveValue('joana@example.invalid')
    fireEvent.change(email, { target: { value: 'joana.lima@example.invalid' } })
    expect(api.updateOpportunity).not.toHaveBeenCalled()
    expect(api.updateLeadData).not.toHaveBeenCalled()
  })
  it('CPF fica mascarado fora do foco', async () => {
    await abrir()
    const cpf = screen.getByLabelText('CPF')
    fireEvent.focus(cpf); fireEvent.change(cpf, { target: { value: '52998224725' } })
    expect(cpf).toHaveValue('529.982.247-25')
    fireEvent.blur(cpf)
    expect(cpf).toHaveValue('•••.•••.•••-25')
  })
  it('Continuar só habilita com todos os obrigatórios válidos; aviso LGPD presente', async () => {
    await abrir()
    expect(screen.getByText(/serão utilizados para realizar a simulação de financiamento junto às instituições financeiras habilitadas/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    completarCliente()
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-24' } })
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } })
    expect(screen.getByLabelText('Completude')).toHaveTextContent('9 de 9 ok')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
    expect(api.getFinanciamentoMarcas).not.toHaveBeenCalled() // catálogo só na etapa Veículo
  })
})

describe('etapa Cliente (cont.)', () => {
  it('Sexo e CNH são botões; nenhuma chamada de simulação, catálogo ou banco nesta etapa', async () => {
    await abrir()
    const sexo = screen.getByRole('group', { name: 'Sexo' })
    expect(within(sexo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Masculino', 'Feminino'])
    completarCliente()
    expect(within(sexo).getByRole('button', { name: 'Feminino' })).toHaveAttribute('aria-pressed', 'true')
    expect(api.criarSimulacaoFinanciamento).not.toHaveBeenCalled()
    expect(api.getFinanciamentoMarcas).not.toHaveBeenCalled()
    expect(api.getFinanciamentoBancos).not.toHaveBeenCalled()
  })
  it('indicador de etapas: atual em destaque e concluída com check', async () => {
    await abrir(); completarCliente(); continuar()
    const etapas = screen.getByRole('list', { name: 'Etapas do financiamento' })
    expect(within(etapas).getByRole('button', { name: /Veículo/ })).toHaveAttribute('aria-current', 'step')
    expect(within(etapas).getByRole('button', { name: /Cliente/ })).toHaveAttribute('data-concluida', 'sim')
    expect(within(etapas).getByLabelText('concluída')).toBeInTheDocument()
    expect(within(etapas).getByRole('button', { name: /Resultados/ })).toBeDisabled()
  })
})

describe('etapa Veículo', () => {
  it('mostra o veículo de interesse da oportunidade e identifica o mesmo veículo no catálogo em cascata', async () => {
    await abrir(); completarCliente(); continuar()
    const bloco = screen.getByText('Veículo de interesse da oportunidade').closest('section')
    expect(within(bloco).getByText('POP 100')).toBeInTheDocument()
    expect(screen.getByLabelText('Modelo')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await identificarVeiculo()
    expect(api.getFinanciamentoMarcas).toHaveBeenCalledWith('car')
    expect(api.getFinanciamentoModelos).toHaveBeenCalledWith('car', '59')
    expect(api.getFinanciamentoVersoes).toHaveBeenLastCalledWith('car', '59', '5001', 2024, 2025)
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  })
  it('zero km em botões Sim/Não (padrão Não) e enviado com o código real escolhido', async () => {
    api.criarSimulacaoFinanciamento.mockResolvedValue({ ...simBase, nextPollInMs: null })
    await abrir(); completarCliente(); continuar(); await identificarVeiculo()
    const zero = screen.getByRole('group', { name: 'Zero km' })
    expect(within(zero).getByRole('button', { name: 'Não' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(zero).getByRole('button', { name: 'Sim' }))
    continuar()
    const veic = (await screen.findByText('Veículo', { selector: 'h4' })).closest('section')
    expect(within(veic).getByText('Zero km').parentElement).toHaveTextContent('Sim')
    fireEvent.click(screen.getByRole('button', { name: 'SIMULAR FINANCIAMENTO' }))
    await waitFor(() => expect(api.criarSimulacaoFinanciamento).toHaveBeenCalledTimes(1))
    expect(api.criarSimulacaoFinanciamento.mock.calls[0][0].vehicle).toEqual({ type: 'car', brandCode: '59', modelCode: '5001', versionCode: 'v-xei', manufactureYear: 2024, modelYear: 2025, zeroKm: true })
  })
  it('trocar para moto recarrega marcas e limpa a seleção', async () => {
    await abrir(); completarCliente(); continuar(); await identificarVeiculo()
    fireEvent.click(screen.getByRole('button', { name: 'Moto' }))
    await waitFor(() => expect(api.getFinanciamentoMarcas).toHaveBeenLastCalledWith('motorcycle'))
    expect(screen.getByLabelText('Marca')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  })
  it('sem veículo de interesse, orienta registrar em "Editar negócio"', async () => {
    await abrir(vendedor, { ...lead, vehicleInterest: '' }); completarCliente(); continuar()
    expect(screen.getByText(/Não informado/)).toBeInTheDocument()
  })
  it('servidor sem configuração: aviso claro e catálogo desabilitado', async () => {
    api.getFinanciamentoMarcas.mockRejectedValue(Object.assign(new Error('O financiamento ainda não está configurado no servidor.'), { status: 503, body: { code: 'nao_configurado' } }))
    await abrir(); completarCliente(); continuar()
    expect(await screen.findByText(/ainda não está configurado no servidor/)).toBeInTheDocument()
    expect(screen.getByLabelText('Marca')).toBeDisabled()
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
    await abrir(vendedor, { ...lead, negotiatedValue: null }); completarCliente(); continuar(); await identificarVeiculo(); continuar()
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
  it('POST só acontece ao clicar SIMULAR FINANCIAMENTO, com o corpo completo', async () => {
    api.criarSimulacaoFinanciamento.mockResolvedValue({ ...simBase, nextPollInMs: null })
    await irParaRevisao()
    await screen.findByRole('list', { name: 'Bancos' })
    expect(api.criarSimulacaoFinanciamento).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'SIMULAR FINANCIAMENTO' }))
    await waitFor(() => expect(api.criarSimulacaoFinanciamento).toHaveBeenCalledTimes(1))
    const corpo = api.criarSimulacaoFinanciamento.mock.calls[0][0]
    expect(corpo).toMatchObject({ opportunityId: 'opp1', terms: { assetValue: 125000, downPayment: 30000, installments: [24, 36, 48, 60] },
      applicant: { name: 'Joana Lima', email: 'joana@example.invalid', phone: '43999887766', document: '52998224725' },
      vehicle: { type: 'car', brandCode: '59', modelCode: '5001', versionCode: 'v-xei', manufactureYear: 2024, modelYear: 2025 } })
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
    render(<OpportunityFinancing lead={lead} usuario={vendedor} />)
    fireEvent.click(screen.getByRole('button', { name: /Financiamento/ }))
    expect(await screen.findByText('Processamento concluído')).toBeInTheDocument()
    expect(api.getSimulacaoFinanciamento).not.toHaveBeenCalled()
    expect(api.criarSimulacaoFinanciamento).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Nova simulação' }))
    expect(await screen.findByLabelText('CPF')).toBeInTheDocument() // dados pessoais não ficam guardados: começa pelo Cliente
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
    expect(screen.getByRole('list', { name: 'Dados a completar' }).className).toMatch(/grid-cols-1 sm:grid-cols-2/)
    expect(screen.getByRole('list', { name: 'Etapas do financiamento' }).className).toMatch(/flex-wrap/)
    const comp = src('components/OpportunityFinancing.jsx')
    expect(comp).toMatch(/overflow-x-auto[^"]*" data-testid="comparativo"/)
  })
})

describe('integração com a oportunidade', () => {
  it('LeadModal de oportunidade mostra Financiamento; lead livre não', () => {
    const { unmount } = render(<LeadModal lead={lead} usuario={vendedor} onClose={() => {}} onMoveStage={() => {}} onLeadChanged={() => {}} />)
    expect(screen.getByRole('region', { name: 'Financiamento' })).toBeInTheDocument()
    expect(api.listarSimulacoesFinanciamento).not.toHaveBeenCalled()
    unmount()
    render(<LeadModal lead={{ ...lead, id: 'free', recordType: 'lead', ownerId: null }} usuario={vendedor} onClose={() => {}} onMoveStage={() => {}} onLeadChanged={() => {}} />)
    expect(screen.queryByRole('region', { name: 'Financiamento' })).not.toBeInTheDocument()
  })
})
