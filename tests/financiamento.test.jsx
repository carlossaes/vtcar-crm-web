import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import OpportunityFinancing from '../src/components/OpportunityFinancing'
import LeadModal from '../src/components/LeadModal'
import {
  cpfValido, formatCpf, maskCpf, montarSimulacao, formatTaxa, formularioInicial, STATUS_BANCO, STATUS_SIMULACAO, mensagemSemCondicoes, resumoFinal,
} from '../src/financing'
import * as api from '../src/api'

vi.mock('../src/api', () => ({
  getFinanciamentoMarcas: vi.fn(), getFinanciamentoModelos: vi.fn(), getFinanciamentoVersoes: vi.fn(),
  criarSimulacaoFinanciamento: vi.fn(), getSimulacaoFinanciamento: vi.fn(), listarSimulacoesFinanciamento: vi.fn(),
  getLeadMessages: vi.fn(() => Promise.resolve([])), getLeadCoach: vi.fn(() => Promise.resolve(null)),
  regenerateLeadCoach: vi.fn(), assumirLead: vi.fn(), atribuirResponsavel: vi.fn(), removerResponsavel: vi.fn(),
  updateOpportunity: vi.fn(), updateLeadData: vi.fn(), updateFollowUp: vi.fn(), completeTask: vi.fn(),
}))

const vendedor = { id: 'v1', nome: 'Ana', papel: 'vendedor' }
const outro = { id: 'v2', nome: 'Bia', papel: 'vendedor' }
const gerente = { id: 'g', nome: 'Gerente', papel: 'gerente' }
const lead = { id: 'opp1', name: 'Joana Lima', email: 'joana@example.invalid', phone: '43999887766', ownerId: 'v1', recordType: 'opportunity',
  stage: 'negociacao', assetValue: 129900, downPayment: 30000, installmentsCount: 48, channel: 'WhatsApp', createdAt: '2026-10-01T10:00:00Z' }
const HOJE = new Date('2026-10-14T12:00:00')

const simBase = {
  id: 'sim-1', opportunityId: 'opp1', status: 'processing', terminal: false, createdAt: '2026-10-14T15:00:00Z', requestId: 'req-1',
  vehicle: { brand_name: 'TOYOTA', model_name: 'COROLLA', version_name: 'XEI 2.0', manufacture_year: 2024, model_year: 2025, zero_km: false },
  terms: { asset_value_cents: 12990000, down_payment_cents: 3000000, installments: [24, 36, 48, 60] },
  progress: { expected_banks: 8, finished_banks: 3, pending_banks: 5 }, results: [], nextPollInMs: 0, canRetry: false,
}

beforeEach(() => {
  api.listarSimulacoesFinanciamento.mockResolvedValue([])
  api.getFinanciamentoMarcas.mockResolvedValue([{ code: '59', name: 'TOYOTA' }])
  api.getFinanciamentoModelos.mockResolvedValue([{ code: '5001', name: 'COROLLA' }])
  api.getFinanciamentoVersoes.mockResolvedValue([{ code: 'v-xei', name: 'XEI 2.0 FLEX' }])
})

describe('regras puras', () => {
  it('CPF: dígito verificador, máscara de digitação e máscara de exibição', () => {
    expect(cpfValido('529.982.247-25')).toBe(true)
    expect(cpfValido('529.982.247-24')).toBe(false)
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
    expect(maskCpf('52998224725')).toBe('•••.•••.•••-25')
  })
  it('monta o corpo com reais (não centavos), prazos ordenados e telefone só dígitos', () => {
    const form = { ...formularioInicial(lead), cpf: '52998224725', birthDate: '1990-05-20', gender: 'female', state: 'PR', city: 'Londrina',
      hasDriverLicense: 'sim', brandCode: '59', modelCode: '5001', manufactureYear: 2024, modelYear: '2025', versionCode: 'v-xei',
      phone: '(43) 99988-7766', installments: [60, 24] }
    const { erros, corpo } = montarSimulacao(form, 'opp1', HOJE)
    expect(erros).toBeNull()
    expect(corpo.terms).toEqual({ assetValue: 129900, downPayment: 30000, installments: [24, 60] })
    expect(corpo.applicant).toMatchObject({ document: '52998224725', phone: '43999887766', hasDriverLicense: true })
    expect(corpo.vehicle).toMatchObject({ manufactureYear: 2024, modelYear: 2025, versionCode: 'v-xei' })
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
  it('nenhum rótulo diz "aprovado"; falha técnica não vira recusa', () => {
    const textos = [...Object.values(STATUS_SIMULACAO), ...Object.values(STATUS_BANCO).map((s) => s.label),
      resumoFinal({ status: 'completed' }), resumoFinal({ status: 'partial' }), ...['completed', 'rejected', 'failed', 'unavailable', 'timed_out', 'pending'].map(mensagemSemCondicoes)]
    for (const t of textos) expect(t.toLowerCase()).not.toMatch(/aprovad/)
    expect(mensagemSemCondicoes('timed_out')).toMatch(/não uma recusa/)
    expect(STATUS_BANCO.completed.label).toBe('Respondeu')
  })
})

async function abrir(usuario = vendedor) {
  render(<OpportunityFinancing lead={lead} usuario={usuario} />)
  fireEvent.click(screen.getByRole('button', { name: /Financiamento/ }))
  await screen.findByRole('button', { name: 'Simular financiamento' })
}
async function preencher() {
  fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } })
  fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '1990-05-20' } })
  fireEvent.change(screen.getByLabelText('Sexo'), { target: { value: 'female' } })
  fireEvent.change(screen.getByLabelText('Possui CNH'), { target: { value: 'sim' } })
  fireEvent.change(screen.getByLabelText('UF'), { target: { value: 'PR' } })
  fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Londrina' } })
  await waitFor(() => expect(within(screen.getByLabelText('Marca')).getByRole('option', { name: 'TOYOTA' })).toBeInTheDocument())
  fireEvent.change(screen.getByLabelText('Marca'), { target: { value: '59' } })
  await waitFor(() => expect(within(screen.getByLabelText('Modelo')).getByRole('option', { name: 'COROLLA' })).toBeInTheDocument())
  fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: '5001' } })
  fireEvent.change(screen.getByLabelText('Ano de fabricação'), { target: { value: '2024' } })
  fireEvent.change(screen.getByLabelText('Ano do modelo'), { target: { value: '2025' } })
  await waitFor(() => expect(within(screen.getByLabelText('Versão')).getByRole('option', { name: 'XEI 2.0 FLEX' })).toBeInTheDocument())
  fireEvent.change(screen.getByLabelText('Versão'), { target: { value: 'v-xei' } })
}

describe('tela Financiamento', () => {
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
  })

  it('pré-preenche com dados do CRM e carrega o catálogo em cascata com os anos', async () => {
    await abrir(); await preencher()
    expect(screen.getByLabelText('Nome')).toHaveValue('Joana Lima')
    expect(screen.getByLabelText('E-mail')).toHaveValue('joana@example.invalid')
    expect(screen.getByLabelText('Valor do veículo')).toHaveValue('R$ 129.900,00')
    expect(api.getFinanciamentoModelos).toHaveBeenCalledWith('car', '59')
    expect(api.getFinanciamentoVersoes).toHaveBeenLastCalledWith('car', '59', '5001', 2024, 2025)
    expect(screen.getByRole('button', { name: '48x' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('CPF fica mascarado fora do foco', async () => {
    await abrir()
    const cpf = screen.getByLabelText('CPF')
    fireEvent.focus(cpf); fireEvent.change(cpf, { target: { value: '52998224725' } })
    expect(cpf).toHaveValue('529.982.247-25')
    fireEvent.blur(cpf)
    expect(cpf).toHaveValue('•••.•••.•••-25')
  })

  it('dados inválidos não chegam ao backend', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Simular financiamento' }))
    expect(await screen.findByText('Informe um CPF válido.')).toBeInTheDocument()
    expect(api.criarSimulacaoFinanciamento).not.toHaveBeenCalled()
  })

  it('simula, mostra progresso, consulta de novo e exibe todas as condições por banco', async () => {
    api.criarSimulacaoFinanciamento.mockResolvedValue({ ...simBase })
    api.getSimulacaoFinanciamento.mockResolvedValue({ ...simBase, status: 'partial', terminal: true, nextPollInMs: null,
      progress: { expected_banks: 3, finished_banks: 3, pending_banks: 0 },
      results: [
        { bank: 'santander', bankName: 'Santander', status: 'timed_out', conditions: [], issues: [], error: { code: 'provider_timeout', message: 'Sem resposta' } },
        { bank: 'bv', bankName: 'BV', status: 'completed', issues: [], error: null, conditions: [
          { installments: 48, installment_value_cents: 284900, monthly_rate: 1.49, monthly_rate_estimated: false, down_payment_cents: 3000000, financed_amount_cents: 9990000, condition_id: 'a' },
          { installments: 48, installment_value_cents: 251000, monthly_rate: 0.0139, monthly_rate_estimated: true, down_payment_cents: 4500000, financed_amount_cents: 8490000, condition_id: 'b' } ] },
      ] })
    await abrir(); await preencher()
    fireEvent.click(screen.getByRole('button', { name: 'Simular financiamento' }))
    await waitFor(() => expect(api.criarSimulacaoFinanciamento).toHaveBeenCalledTimes(1))
    const corpo = api.criarSimulacaoFinanciamento.mock.calls[0][0]
    expect(corpo).toMatchObject({ opportunityId: 'opp1', terms: { assetValue: 129900, downPayment: 30000, installments: [24, 36, 48, 60] } })
    expect(corpo.applicant.document).toBe('52998224725')
    expect(await screen.findByText('3 de 8')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
    await waitFor(() => expect(api.getSimulacaoFinanciamento).toHaveBeenCalledWith('sim-1'), { timeout: 4000 })
    expect(await screen.findByText(/Processamento concluído parcialmente/)).toBeInTheDocument()
    expect(screen.getAllByText(/^48x de/)).toHaveLength(2)
    expect(screen.getByText('48x de R$ 2.849,00')).toBeInTheDocument()
    expect(screen.getByText('48x de R$ 2.510,00')).toBeInTheDocument()
    expect(screen.getByText('Taxa estimada')).toBeInTheDocument()
    expect(screen.getByText(/falha técnica, não uma recusa/)).toBeInTheDocument()
    expect(document.body.textContent.toLowerCase()).not.toMatch(/aprovad/)
    const bancos = screen.getAllByText(/^(BV|Santander)$/).map((n) => n.textContent)
    expect(bancos).toEqual(['BV', 'Santander']) // bancos com condição primeiro
  })

  it('erro do backend mostra mensagem; envio incerto oferece "Tentar novamente" com os mesmos dados', async () => {
    const erro = Object.assign(new Error('A plataforma de financiamento não respondeu a tempo.'), { status: 504, body: { code: 'timeout', simulation: { ...simBase, status: 'envio_incerto', canRetry: true } } })
    api.criarSimulacaoFinanciamento.mockRejectedValueOnce(erro).mockResolvedValueOnce({ ...simBase, status: 'queued', nextPollInMs: 20000 })
    await abrir(); await preencher()
    fireEvent.click(screen.getByRole('button', { name: 'Simular financiamento' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('não respondeu a tempo')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(api.criarSimulacaoFinanciamento).toHaveBeenCalledTimes(2))
    expect(api.criarSimulacaoFinanciamento.mock.calls[1][0]).toEqual(api.criarSimulacaoFinanciamento.mock.calls[0][0])
  })

  it('402 sem saldo aparece de forma compreensível', async () => {
    api.criarSimulacaoFinanciamento.mockRejectedValue(Object.assign(new Error('Não há saldo disponível para uma nova consulta.'), { status: 402, body: { code: 'sem_saldo' } }))
    await abrir(); await preencher()
    fireEvent.click(screen.getByRole('button', { name: 'Simular financiamento' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não há saldo disponível para uma nova consulta.')
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })

  it('servidor sem configuração: aviso claro e envio desabilitado', async () => {
    api.getFinanciamentoMarcas.mockRejectedValue(Object.assign(new Error('O financiamento ainda não está configurado no servidor.'), { status: 503, body: { code: 'nao_configurado' } }))
    await abrir()
    expect(await screen.findByText(/ainda não está configurado no servidor/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular financiamento' })).toBeDisabled()
  })

  it('reabrir mostra a última simulação guardada sem nova consulta à Zinix', async () => {
    api.listarSimulacoesFinanciamento.mockResolvedValue([{ ...simBase, status: 'completed', terminal: true, nextPollInMs: null, results: [] }])
    render(<OpportunityFinancing lead={lead} usuario={vendedor} />)
    fireEvent.click(screen.getByRole('button', { name: /Financiamento/ }))
    expect(await screen.findByText('Processamento concluído')).toBeInTheDocument()
    expect(api.getSimulacaoFinanciamento).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Nova simulação' }))
    expect(await screen.findByRole('button', { name: 'Simular financiamento' })).toBeInTheDocument()
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
