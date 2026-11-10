// FINALIZAÇÃO V2 — "Valor negociado" oculto na experiência V2 (só apresentação),
// acabamento visual sem mudança funcional e tela antiga (?legacy=1) preservada.
// Dados FICTÍCIOS; API mockada (nenhuma chamada real).
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import OpportunityBusiness from '../src/components/OpportunityBusiness'
import OpportunityFinancing from '../src/components/OpportunityFinancing'
import NovaOportunidadeV2Modal from '../src/components/NovaOportunidadeV2Modal'
import { mostrarValorNegociado } from '../src/novaOportunidadeV2'
import * as api from '../src/api'

vi.mock('../src/api', () => ({
  updateOpportunity: vi.fn(), createLead: vi.fn(), salvarClienteFinanciamento: vi.fn(),
  getFinanciamentoMarcas: vi.fn(), getFinanciamentoModelos: vi.fn(), getFinanciamentoVersoes: vi.fn(), getFinanciamentoBancos: vi.fn(),
  criarSimulacaoFinanciamento: vi.fn(), getSimulacaoFinanciamento: vi.fn(), listarSimulacoesFinanciamento: vi.fn(), salvarVeiculoFinanciamento: vi.fn(),
}))

const vendedor = { id: 'v1', nome: 'Ana Teste', papel: 'vendedor' }
const gerente = { id: 'g', nome: 'Gerente Teste', papel: 'gerente' }
// Oportunidade criada pela V2: nunca tem negotiatedValue.
const nova = { id: 'opp-v2', name: 'Cliente Teste', phone: '43999999999', ownerId: 'v1', recordType: 'opportunity', stage: 'novo',
  vehicleInterest: 'Vectra 2.2', assetValue: 29900, downPayment: 0, financingAmount: 29900, negotiatedValue: null,
  installmentsCount: null, installmentValue: null, installmentOptions: [24, 36], hasTradeIn: false, paymentComposition: 'financiamento', notes: 'Obs teste' }
// Oportunidade ANTIGA com valor negociado gravado.
const antiga = { ...nova, id: 'opp-antiga', negotiatedValue: 27500, downPayment: 5000, financingAmount: 22500, installmentOptions: undefined }

const setLegacy = (on) => window.history.replaceState(null, '', on ? '/?legacy=1' : '/')
afterEach(() => setLegacy(false))

describe('regra de apresentação do Valor negociado', () => {
  it('V2: oculto sem valor; histórico (só leitura) quando o registro antigo tem valor; tela antiga: como sempre', () => {
    expect(mostrarValorNegociado(nova, false)).toBe('oculto')
    expect(mostrarValorNegociado({ ...nova, negotiatedValue: 0 }, false)).toBe('oculto')
    expect(mostrarValorNegociado(antiga, false)).toBe('historico')
    expect(mostrarValorNegociado(nova, true)).toBe('editavel')
    expect(mostrarValorNegociado(antiga, true)).toBe('editavel')
  })
  it('a regra lê ?legacy=1 do endereço', () => {
    expect(mostrarValorNegociado(nova)).toBe('oculto')
    setLegacy(true)
    expect(mostrarValorNegociado(nova)).toBe('editavel')
  })
})

describe('oportunidade criada (detalhes "Negócio") na V2', () => {
  it('mostra Valor do bem, Entrada, Valor a financiar e veículo; NÃO mostra "Valor negociado — Não informado"', () => {
    render(<OpportunityBusiness lead={nova} usuario={vendedor} onLeadChanged={() => {}} />)
    for (const r of ['Valor do bem', 'Entrada', 'Valor a financiar', 'Veículo de interesse']) expect(screen.getAllByText(r).length).toBeGreaterThan(0)
    expect(screen.getByText('Vectra 2.2')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 29.900,00').length).toBe(2) // valor do bem e a financiar
    expect(screen.queryByText(/Valor negociado/)).not.toBeInTheDocument()
  })
  it('editar → salvar: Valor negociado não aparece para edição e o valor gravado segue intacto no payload', async () => {
    api.updateOpportunity.mockImplementation(async (id, d) => ({ ...nova, ...d }))
    let salvo = null
    render(<OpportunityBusiness lead={nova} usuario={vendedor} onLeadChanged={(l) => { salvo = l }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar negócio' }))
    expect(screen.queryByLabelText('Valor negociado')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Obs editada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar negócio' }))
    await waitFor(() => expect(api.updateOpportunity).toHaveBeenCalledTimes(1))
    const enviado = api.updateOpportunity.mock.calls[0][1]
    expect(enviado).toMatchObject({ notes: 'Obs editada', assetValue: 29900, downPayment: 0, financingAmount: 29900, negotiatedValue: null })
    expect(salvo.notes).toBe('Obs editada')
  })
  it('registro ANTIGO: valor negociado aparece só leitura como histórico e é preservado ao salvar (nenhuma perda)', async () => {
    api.updateOpportunity.mockImplementation(async (id, d) => ({ ...antiga, ...d }))
    render(<OpportunityBusiness lead={antiga} usuario={gerente} onLeadChanged={() => {}} />)
    expect(screen.getByText('Valor negociado (histórico)')).toBeInTheDocument()
    expect(screen.getByText('R$ 27.500,00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Editar negócio' }))
    expect(screen.queryByLabelText('Valor negociado')).not.toBeInTheDocument()
    expect(screen.getByText('Valor negociado (histórico)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar negócio' }))
    await waitFor(() => expect(api.updateOpportunity).toHaveBeenCalledTimes(1))
    expect(api.updateOpportunity.mock.calls[0][1].negotiatedValue).toBe(27500)
  })
  it('tela antiga (?legacy=1): Valor negociado continua editável como antes', () => {
    setLegacy(true)
    render(<OpportunityBusiness lead={nova} usuario={vendedor} onLeadChanged={() => {}} />)
    expect(screen.getByText('Valor negociado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Editar negócio' }))
    expect(screen.getByLabelText('Valor negociado')).toBeInTheDocument()
  })
  it('permissões inalteradas: vendedor de outra oportunidade não edita', () => {
    render(<OpportunityBusiness lead={{ ...nova, ownerId: 'outro' }} usuario={vendedor} onLeadChanged={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Editar negócio' })).not.toBeInTheDocument()
  })
})

describe('Financiamento → Revisão na V2', () => {
  const CAD = { customerDocumentMasked: '•••.•••.•••-25', customerBirthDate: '1990-05-20', customerGender: 'female', customerState: 'PR', customerCity: 'Londrina',
    customerHasDriverLicense: true, email: 'teste@example.invalid', vehicleType: 'car', vehicleBrandCode: '56', vehicleBrandName: 'TOYOTA', vehicleModelCode: '5001',
    vehicleModelName: 'COROLLA', vehicleVersionCode: 'v-xei', vehicleVersionName: 'XEI 2.0 FLEX', vehicleManufactureYear: 2024, vehicleModelYear: 2025,
    vehicleZeroKm: false, vehicleCatalogInterest: 'Vectra 2.2', vehicleCatalogNeedsReview: false }
  beforeEach(() => {
    api.listarSimulacoesFinanciamento.mockResolvedValue([])
    api.getFinanciamentoBancos.mockResolvedValue([{ code: 'bx', name: 'Banco Xis Teste', status: 'enabled', habilitado: true }])
  })
  async function revisao(l) {
    render(<OpportunityFinancing lead={{ ...l, ...CAD }} usuario={vendedor} />)
    fireEvent.click(screen.getByRole('button', { name: /Financiamento/ }))
    await screen.findByRole('list', { name: 'Etapas do financiamento' })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByRole('button', { name: 'SIMULAR FINANCIAMENTO' })
    return screen.getByText('Negociação', { selector: 'h4' }).closest('section')
  }
  it('oportunidade da V2: sem linha "Valor negociado"; simulação usa o valor do bem (regra intacta)', async () => {
    const neg = await revisao(nova)
    expect(within(neg).queryByText(/Valor negociado/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Valor da simulação')).toHaveValue('R$ 29.900,00')
  })
  it('registro antigo: valor negociado exibido como histórico e ainda usado na simulação (regra intacta)', async () => {
    const neg = await revisao(antiga)
    expect(within(neg).getByText('Valor negociado (histórico)')).toBeInTheDocument()
    expect(screen.getByLabelText('Valor da simulação')).toHaveValue('R$ 27.500,00')
    expect(api.criarSimulacaoFinanciamento).not.toHaveBeenCalled()
  })
})

describe('acabamento visual da V2 (estrutura preservada)', () => {
  it('tema escopado, cabeçalho VT Car CRM, 7 seções com ícone, selects com seta, radios nativos e caixa Zinix', () => {
    render(<NovaOportunidadeV2Modal open usuario={vendedor} vendedores={[]} onClose={() => {}} onCreated={() => {}} onAbrirExistente={() => {}} />)
    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveClass('v2-tema')
    expect(within(dialogo).getByText(/VT Car/)).toBeInTheDocument()
    const titulos = ['Cliente', 'Negócio', 'Formação do negócio', 'Troca', 'Pagamento', 'Observações', 'Responsável comercial']
    for (const t of titulos) expect(screen.getByRole('heading', { name: t }).querySelector('svg')).not.toBeNull()
    for (const id of [/^Sexo/, /^UF/, /^Origem/, /^Composição do pagamento/]) {
      const sel = screen.getByLabelText(id, { selector: 'select' })
      expect(sel.parentElement.querySelectorAll('svg').length).toBeGreaterThan(0) // seta (e ícone, quando houver)
    }
    expect(screen.getAllByRole('radio')).toHaveLength(4) // CNH Sim/Não + Troca Não/Sim
    const zinix = screen.getByRole('complementary', { name: 'Requisitos da Zinix' })
    expect(zinix).toHaveTextContent('Usados para liberar a simulação')
    expect(zinix).toHaveTextContent('não impedem criar a oportunidade')
    expect(screen.queryByText(/Valor negociado/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Criar oportunidade/ })).toHaveAttribute('form', 'v2-form')
  })
  it('tokens da V2 ficam escopados em .v2-tema (nenhum token global alterado)', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../src/index.css'), 'utf8')
    expect(css).toMatch(/\.v2-tema \{/)
    expect(css).toMatch(/:root\[data-theme='light'\] \.v2-tema \{/)
    const global = css.split('FINALIZAÇÃO V2')[0]
    expect(global).not.toMatch(/--v2-/)
  })
  it('hotfix StrictMode preservado em OpportunityFinancing', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../src/components/OpportunityFinancing.jsx'), 'utf8')
    expect(src).toMatch(/const montado = useRef\(false\)/)
    expect(src).toMatch(/montado\.current = true\n\s+return \(\) => \{ montado\.current = false \}/)
  })
})
