// HOTFIX-STRICTMODE-CATALOGO-ZINIX — o Financiamento roda dentro de React.StrictMode,
// como em src/main.jsx. No DEV o StrictMode faz montagem → desmontagem → montagem;
// a flag "montado" precisa voltar a true, senão o catálogo fica em "Carregando..." para sempre.
// Dados FICTÍCIOS; API mockada (nenhuma chamada real à Zinix).
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import OpportunityFinancing from '../src/components/OpportunityFinancing'
import * as api from '../src/api'

vi.mock('../src/api', () => ({
  getFinanciamentoMarcas: vi.fn(), getFinanciamentoModelos: vi.fn(), getFinanciamentoVersoes: vi.fn(), getFinanciamentoBancos: vi.fn(),
  criarSimulacaoFinanciamento: vi.fn(), getSimulacaoFinanciamento: vi.fn(), listarSimulacoesFinanciamento: vi.fn(),
  salvarClienteFinanciamento: vi.fn(), salvarVeiculoFinanciamento: vi.fn(),
}))

const vendedor = { id: 'v1', nome: 'Ana Teste', papel: 'vendedor' }
const gerente = { id: 'g', nome: 'Gerente Teste', papel: 'gerente' }
const CADASTRO = { customerDocumentMasked: '•••.•••.•••-25', customerBirthDate: '1990-05-20', customerGender: 'female', customerState: 'PR',
  customerCity: 'Londrina', customerHasDriverLicense: true }
const lead = { id: 'opp-sm', name: 'Cliente Teste', email: 'teste@example.invalid', phone: '43999999999', ownerId: 'v1', recordType: 'opportunity',
  stage: 'negociacao', vehicleInterest: 'COROLLA XEI', assetValue: 129900, downPayment: 30000, installmentOptions: [36, 48],
  createdAt: '2026-11-01T10:00:00Z', ...CADASTRO }

// Resposta no formato confirmado pelo CTO: lista direta [{ code, name }].
const MARCAS_CARRO = [{ code: '23', name: 'CHEVROLET' }, { code: '59', name: 'VOLKSWAGEN' }, { code: '21', name: 'FIAT' }, { code: '56', name: 'TOYOTA' }, { code: '25', name: 'HONDA' }]
const MARCAS_MOTO = [{ code: '80', name: 'HONDA MOTOS' }, { code: '81', name: 'YAMAHA' }]
const BANCOS = [{ code: 'bx', name: 'Banco Xis Teste', status: 'enabled', habilitado: true }]

let guardado = null
function Tela({ inicial, usuario }) {
  const [l, setL] = React.useState(inicial)
  return <OpportunityFinancing lead={l} usuario={usuario} onLeadChanged={(novo) => { guardado = novo; setL(novo) }} />
}
const renderStrict = (ui) => render(<React.StrictMode>{ui}</React.StrictMode>)

beforeEach(() => {
  guardado = null
  api.listarSimulacoesFinanciamento.mockResolvedValue([])
  api.getFinanciamentoMarcas.mockImplementation(async (tipo) => (tipo === 'motorcycle' ? MARCAS_MOTO : MARCAS_CARRO))
  api.getFinanciamentoModelos.mockResolvedValue([{ code: '5001', name: 'COROLLA' }])
  api.getFinanciamentoVersoes.mockResolvedValue([{ code: 'v-xei', name: 'XEI 2.0 FLEX' }])
  api.getFinanciamentoBancos.mockResolvedValue(BANCOS)
  api.salvarVeiculoFinanciamento.mockImplementation(async (id, v) => ({ ...(guardado || lead), vehicleType: v.type, vehicleBrandCode: v.brandCode,
    vehicleBrandName: 'TOYOTA', vehicleModelCode: v.modelCode, vehicleModelName: 'COROLLA', vehicleVersionCode: v.versionCode,
    vehicleVersionName: 'XEI 2.0 FLEX', vehicleManufactureYear: v.manufactureYear, vehicleModelYear: v.modelYear, vehicleZeroKm: v.zeroKm,
    vehicleCatalogInterest: lead.vehicleInterest, vehicleCatalogNeedsReview: false }))
})

const opcao = (campo, nome) => within(screen.getByLabelText(campo)).getByRole('option', { name: nome })
const continuar = () => fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
async function abrirNoVeiculo(usuario = vendedor) {
  const r = renderStrict(<Tela inicial={lead} usuario={usuario} />)
  fireEvent.click(screen.getByRole('button', { name: /Financiamento/ }))
  await screen.findByRole('list', { name: 'Etapas do financiamento' })
  continuar()
  return r
}
async function identificar() {
  await waitFor(() => expect(opcao('Marca', 'TOYOTA')).toBeInTheDocument())
  fireEvent.change(screen.getByLabelText('Marca'), { target: { value: '56' } })
  await waitFor(() => expect(opcao('Modelo', 'COROLLA')).toBeInTheDocument())
  fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: '5001' } })
  fireEvent.change(screen.getByLabelText('Ano de fabricação'), { target: { value: '2024' } })
  fireEvent.change(screen.getByLabelText('Ano do modelo'), { target: { value: '2025' } })
  await waitFor(() => expect(opcao('Versão', 'XEI 2.0 FLEX')).toBeInTheDocument())
  fireEvent.change(screen.getByLabelText('Versão'), { target: { value: 'v-xei' } })
}

describe('StrictMode: catálogo Zinix na etapa Veículo', () => {
  it('o app real roda em React.StrictMode (o StrictMode NÃO foi removido)', () => {
    const main = fs.readFileSync(path.resolve(__dirname, '../src/main.jsx'), 'utf8')
    expect(main).toMatch(/<React\.StrictMode>/)
  })

  it('1. Carro: marcas carregam e "Carregando..." some', async () => {
    await abrirNoVeiculo()
    await waitFor(() => expect(opcao('Marca', 'CHEVROLET')).toBeInTheDocument())
    for (const m of ['VOLKSWAGEN', 'FIAT', 'TOYOTA', 'HONDA']) expect(opcao('Marca', m)).toBeInTheDocument()
    expect(api.getFinanciamentoMarcas).toHaveBeenCalledWith('car')
    expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument()
  })

  it('2. Moto: marcas de moto carregam', async () => {
    await abrirNoVeiculo()
    await waitFor(() => expect(opcao('Marca', 'TOYOTA')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Moto' }))
    await waitFor(() => expect(opcao('Marca', 'YAMAHA')).toBeInTheDocument())
    expect(api.getFinanciamentoMarcas).toHaveBeenLastCalledWith('motorcycle')
    expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument()
  })

  it('3–5. marca → modelos; modelo + anos → versões; salvar veículo', async () => {
    await abrirNoVeiculo()
    await identificar()
    expect(api.getFinanciamentoModelos).toHaveBeenCalledWith('car', '56')
    expect(api.getFinanciamentoVersoes).toHaveBeenLastCalledWith('car', '56', '5001', 2024, 2025)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar veículo' }))
    await screen.findByText('Veículo identificado para financiamento')
    expect(api.salvarVeiculoFinanciamento).toHaveBeenCalledWith('opp-sm', { type: 'car', brandCode: '56', modelCode: '5001', versionCode: 'v-xei', manufactureYear: 2024, modelYear: 2025, zeroKm: false })
    expect(guardado).toMatchObject({ vehicleVersionCode: 'v-xei' })
  })

  it('6–8. avança para Revisão, bancos carregam; voltar/avançar entre etapas funciona sem POST', async () => {
    await abrirNoVeiculo()
    await identificar()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar veículo' }))
    await screen.findByText('Veículo identificado para financiamento')
    continuar()
    await screen.findByRole('button', { name: 'SIMULAR FINANCIAMENTO' })
    const lista = await screen.findByRole('list', { name: 'Bancos' })
    expect(within(lista).getByText('Banco Xis Teste')).toBeInTheDocument()
    // Voltar à etapa Veículo e avançar de novo
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    await screen.findByText('Veículo identificado para financiamento')
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(await screen.findByLabelText('Completude')).toBeInTheDocument()
    continuar(); continuar()
    await screen.findByRole('button', { name: 'SIMULAR FINANCIAMENTO' })
    expect(await screen.findByRole('list', { name: 'Bancos' })).toHaveTextContent('Banco Xis Teste')
    expect(api.criarSimulacaoFinanciamento).not.toHaveBeenCalled()
  })

  it('9. fechar e abrir o Financiamento de novo: catálogo carrega outra vez', async () => {
    const { unmount } = await abrirNoVeiculo()
    await waitFor(() => expect(opcao('Marca', 'TOYOTA')).toBeInTheDocument())
    unmount()
    await abrirNoVeiculo()
    await waitFor(() => expect(opcao('Marca', 'CHEVROLET')).toBeInTheDocument())
    expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument()
  })

  it('gerente (ex.: Kássia) também carrega o catálogo em StrictMode', async () => {
    await abrirNoVeiculo(gerente)
    await waitFor(() => expect(opcao('Marca', 'FIAT')).toBeInTheDocument())
  })

  it('proteção mantida: resposta que chega DEPOIS de desmontar é ignorada, sem erro', async () => {
    let soltar
    api.getFinanciamentoMarcas.mockImplementation(() => new Promise((r) => { soltar = r }))
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = await abrirNoVeiculo()
    await waitFor(() => expect(soltar).toBeTypeOf('function'))
    unmount()
    soltar(MARCAS_CARRO)
    await new Promise((r) => setTimeout(r, 20))
    expect(erro).not.toHaveBeenCalled()
    erro.mockRestore()
  })
})
