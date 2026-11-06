import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import NovaOportunidadeV2Modal from '../src/components/NovaOportunidadeV2Modal'
import NovaOportunidadeModal from '../src/components/NovaOportunidadeModal'
import { formacao, alternarPrazo, dadosClienteV2, montarCriacaoV2, usarTelaLegacy, ESTADO_INICIAL_V2, MAX_PRAZOS } from '../src/novaOportunidadeV2'
import { formularioInicial } from '../src/financing'
import { createLead, salvarClienteFinanciamento } from '../src/api'

vi.mock('../src/api', () => ({ createLead: vi.fn(), salvarClienteFinanciamento: vi.fn() }))

const vendedor = { id: 'v1', nome: 'Ana', papel: 'vendedor', ativo: true }
const gerente = { id: 'g', nome: 'Kássia', papel: 'gerente', ativo: true }
const HOJE = new Date('2026-11-06T12:00:00')
const base = { ...ESTADO_INICIAL_V2, name: 'Carlos Teste', phone: '43999999999', origin: 'Loja', vehicleInterest: 'Vectra 2.2' }

beforeEach(() => {
  createLead.mockImplementation(async (d) => ({ id: 'novo-1', recordType: 'opportunity', ownerId: 'v1', ...d }))
  salvarClienteFinanciamento.mockImplementation(async (id, d) => ({ id, recordType: 'opportunity', ...(d.document ? { customerDocumentMasked: `•••.•••.•••-${d.document.slice(9)}` } : {}) }))
})

describe('regras da V2', () => {
  it('valor a financiar = bem − entrada; entrada zero = 100%; entrada ≥ bem é erro', () => {
    expect(formacao({ assetValue: 15000, downPayment: 5000 }).financiar).toBe(10000)
    expect(formacao({ assetValue: 15000, downPayment: 0 }).financiar).toBe(15000)
    expect(formacao({ assetValue: 15000, downPayment: null }).financiar).toBe(15000)
    expect(formacao({ assetValue: 15000, downPayment: 9000, cemPorCento: true }).financiar).toBe(15000)
    expect(formacao({ assetValue: 15000, downPayment: 15000 }).erro).toMatch(/menor que o valor do bem/)
    expect(formacao({ assetValue: 15000, downPayment: 20000 }).erro).toMatch(/menor que o valor do bem/)
    expect(formacao({ assetValue: null, downPayment: null })).toMatchObject({ financiar: null, erro: null })
  })
  it('prazos: vários, ordenados, no máximo 12', () => {
    expect(alternarPrazo([48], 24)).toEqual([24, 48])
    expect(alternarPrazo([24, 48], 24)).toEqual([48])
    const cheio = Array.from({ length: MAX_PRAZOS }, (_, i) => i + 1)
    expect(alternarPrazo(cheio, 60)).toEqual(cheio)
  })
  it('dados do cliente são opcionais; só o preenchido é validado e enviado', () => {
    expect(dadosClienteV2(base, HOJE)).toEqual({ erros: null, patch: {} })
    expect(dadosClienteV2({ ...base, cpf: '52998224725', city: ' Cambé ', state: 'PR', hasDriverLicense: 'nao' }, HOJE))
      .toEqual({ erros: null, patch: { document: '52998224725', city: 'Cambé', state: 'PR', hasDriverLicense: false } })
    expect(dadosClienteV2({ ...base, cpf: '52998224724' }, HOJE).erros.cpf).toMatch(/CPF inválido/)
    expect(dadosClienteV2({ ...base, birthDate: '2012-01-01' }, HOJE).erros.birthDate).toMatch(/18 e 100/)
  })
  it('corpo da criação: sem valor negociado, valor a financiar calculado, prazos e dono do gerente', () => {
    const d = montarCriacaoV2({ ...base, assetValue: 15000, downPayment: 5000, installmentOptions: [24, 36] }, { ehGerente: false })
    expect(d).toMatchObject({ assetValue: 15000, downPayment: 5000, financingAmount: 10000, installmentOptions: [24, 36] })
    expect('negotiatedValue' in d).toBe(false)
    expect('installmentsCount' in d).toBe(false)
    expect(JSON.stringify(d)).not.toMatch(/document|birth|gender|customer/)
    expect(() => montarCriacaoV2({ ...base, assetValue: 15000, downPayment: 15000 }, { ehGerente: false })).toThrow(/menor que o valor do bem/)
    expect(() => montarCriacaoV2({ ...base, ownerId: '' }, { ehGerente: true })).toThrow(/responsável/)
    expect(montarCriacaoV2({ ...base, ownerId: 'v1' }, { ehGerente: true }).ownerId).toBe('v1')
    expect('installmentOptions' in montarCriacaoV2(base, { ehGerente: false })).toBe(false)
  })
  it('?legacy=1 força a tela antiga; sem o parâmetro a V2 é a padrão', () => {
    expect(usarTelaLegacy('?legacy=1')).toBe(true)
    expect(usarTelaLegacy('')).toBe(false)
    expect(usarTelaLegacy('?legacy=0')).toBe(false)
    const app = fs.readFileSync(path.resolve(__dirname, '../src/App.jsx'), 'utf8')
    expect(app).toMatch(/usarTelaLegacy\(\) \?\s*\(\s*<NovaOportunidadeModal/)
    expect(app).toMatch(/<NovaOportunidadeV2Modal/)
  })
  it('financiamento usa os prazos escolhidos na V2; oportunidade antiga mantém o comportamento', () => {
    expect(formularioInicial({ id: 'x', installmentOptions: [24, 36, 48] }).installments).toEqual([24, 36, 48])
    expect(formularioInicial({ id: 'x', installmentsCount: 72 }).installments).toEqual([24, 36, 48, 60, 72])
    expect(formularioInicial({ id: 'x', negotiatedValue: 28000, assetValue: 30000 }).valor).toBe(28000) // negotiatedValue antigo continua valendo
  })
})

const props = { open: true, usuario: vendedor, vendedores: [], onClose: vi.fn(), onCreated: vi.fn(), onAbrirExistente: vi.fn() }
function preencherObrigatorios() {
  fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Carlos Teste' } })
  fireEvent.change(screen.getByLabelText('Telefone *'), { target: { value: '43999999999' } })
  fireEvent.change(screen.getByLabelText('Origem *'), { target: { value: 'Loja' } })
  fireEvent.change(screen.getByLabelText('Veículo de interesse *'), { target: { value: 'Vectra 2.2' } })
}
const criar = () => fireEvent.click(screen.getByRole('button', { name: 'Criar oportunidade' }))

describe('tela V2', () => {
  beforeEach(() => { props.onCreated.mockReset() })
  it('mostra os campos do cliente, CNH como escolha explícita e NÃO mostra valor negociado', () => {
    render(<NovaOportunidadeV2Modal {...props} />)
    for (const l of ['Nome *', 'Telefone *', 'E-mail', 'CPF', 'Nascimento', 'Cidade', 'UF', 'Origem *', 'Veículo de interesse *', 'Valor do bem', 'Entrada']) expect(screen.getByLabelText(l)).toBeInTheDocument()
    const cnh = screen.getByRole('radiogroup', { name: 'Possui CNH?' })
    expect(within(cnh).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Sim', 'Não'])
    expect(within(cnh).getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true)
    expect(screen.getByRole('radiogroup', { name: 'Sexo' })).toBeInTheDocument()
    expect(screen.queryByText(/Valor negociado/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Valor negociado/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Quantidade de parcelas')).not.toBeInTheDocument()
  })
  it('valor a financiar é calculado e somente leitura; 100% financiado zera a entrada', () => {
    render(<NovaOportunidadeV2Modal {...props} />)
    const saida = screen.getByTestId('valor-a-financiar')
    expect(saida.tagName).toBe('OUTPUT')
    expect(screen.queryByLabelText('Valor a financiar')).toBe(saida) // não é campo digitável
    fireEvent.change(screen.getByLabelText('Valor do bem'), { target: { value: '15000' } })
    fireEvent.change(screen.getByLabelText('Entrada'), { target: { value: '5000' } })
    expect(saida).toHaveTextContent('R$ 10.000,00')
    fireEvent.click(screen.getByLabelText(/100% financiado/))
    expect(saida).toHaveTextContent('R$ 15.000,00')
    expect(screen.getByLabelText('Entrada')).toHaveValue('R$ 0,00')
  })
  it('entrada maior ou igual ao bem mostra validação e não cria', async () => {
    render(<NovaOportunidadeV2Modal {...props} />); preencherObrigatorios()
    fireEvent.change(screen.getByLabelText('Valor do bem'), { target: { value: '15000' } })
    fireEvent.change(screen.getByLabelText('Entrada'), { target: { value: '15000' } })
    expect(screen.getByText('A entrada deve ser menor que o valor do bem.', { selector: 'p' })).toBeInTheDocument()
    criar()
    expect(await screen.findByRole('alert')).toHaveTextContent('menor que o valor do bem')
    expect(createLead).not.toHaveBeenCalled()
  })
  it('cria oportunidade SEM CPF, nascimento e demais dados de financiamento', async () => {
    render(<NovaOportunidadeV2Modal {...props} />); preencherObrigatorios()
    fireEvent.change(screen.getByLabelText('Valor do bem'), { target: { value: '15000' } })
    fireEvent.change(screen.getByLabelText('Entrada'), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: '24x' })); fireEvent.click(screen.getByRole('button', { name: '48x' }))
    criar()
    await waitFor(() => expect(props.onCreated).toHaveBeenCalledTimes(1))
    const enviado = createLead.mock.calls[0][0]
    expect(enviado).toMatchObject({ name: 'Carlos Teste', phone: '43999999999', origin: 'Loja', vehicleInterest: 'Vectra 2.2', assetValue: 15000, downPayment: 5000, financingAmount: 10000, installmentOptions: [24, 48] })
    expect('negotiatedValue' in enviado).toBe(false)
    expect(salvarClienteFinanciamento).not.toHaveBeenCalled()
  })
  it('dados parciais do cliente vão para a rota de financiamento (CPF só sai do formulário uma vez)', async () => {
    render(<NovaOportunidadeV2Modal {...props} />); preencherObrigatorios()
    const cpf = screen.getByLabelText('CPF')
    fireEvent.focus(cpf); fireEvent.change(cpf, { target: { value: '529.982.247-25' } }); fireEvent.blur(cpf)
    expect(cpf).toHaveValue('•••.•••.•••-25')
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Possui CNH?' })).getByRole('radio', { name: 'Não' }))
    fireEvent.change(screen.getByLabelText('UF'), { target: { value: 'PR' } })
    criar()
    await waitFor(() => expect(props.onCreated).toHaveBeenCalledTimes(1))
    expect(JSON.stringify(createLead.mock.calls[0][0])).not.toMatch(/52998224725/)
    expect(salvarClienteFinanciamento).toHaveBeenCalledWith('novo-1', { document: '52998224725', hasDriverLicense: false, state: 'PR' })
    expect(props.onCreated.mock.calls[0][0]).toMatchObject({ id: 'novo-1', customerDocumentMasked: '•••.•••.•••-25' })
  })
  it('CPF inválido bloqueia a criação até corrigir ou apagar', async () => {
    render(<NovaOportunidadeV2Modal {...props} />); preencherObrigatorios()
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '52998224724' } })
    criar()
    expect(await screen.findByText('CPF inválido. Corrija ou deixe em branco.')).toBeInTheDocument()
    expect(createLead).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '' } })
    criar()
    await waitFor(() => expect(createLead).toHaveBeenCalledTimes(1))
  })
  it('se os dados do cliente falharem, a oportunidade criada não se perde', async () => {
    salvarClienteFinanciamento.mockRejectedValueOnce(Object.assign(new Error('Confira os campos destacados.'), { status: 400 }))
    render(<NovaOportunidadeV2Modal {...props} />); preencherObrigatorios()
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Cambé' } })
    criar()
    expect(await screen.findByRole('alert')).toHaveTextContent('A oportunidade foi criada, mas os dados de financiamento do cliente não foram salvos')
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(props.onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'novo-1' }))
  })
  it('telefone duplicado mantém o fluxo atual', async () => {
    createLead.mockRejectedValueOnce(Object.assign(new Error('dup'), { status: 409, body: { existente: { id: 'x', name: 'Já Existe', ownerName: 'Bia', stage: 'novo' } } }))
    render(<NovaOportunidadeV2Modal {...props} />); preencherObrigatorios(); criar()
    expect(await screen.findByText('Já existe um registro com este telefone.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir registro existente' }))
    expect(props.onAbrirExistente).toHaveBeenCalledWith(expect.objectContaining({ id: 'x' }))
  })
  it('gerente (ex.: Kássia) escolhe o responsável como hoje', async () => {
    render(<NovaOportunidadeV2Modal {...props} usuario={gerente} vendedores={[vendedor]} />); preencherObrigatorios()
    fireEvent.change(screen.getByLabelText('Responsável comercial'), { target: { value: 'v1' } })
    criar()
    await waitFor(() => expect(createLead).toHaveBeenCalledTimes(1))
    expect(createLead.mock.calls[0][0].ownerId).toBe('v1')
  })
  it('troca e pagamento mantidos', async () => {
    render(<NovaOportunidadeV2Modal {...props} />); preencherObrigatorios()
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Tem veículo na troca?' })).getByRole('radio', { name: 'Sim' }))
    fireEvent.change(screen.getByLabelText('Veículo na troca'), { target: { value: 'Gol 2010' } })
    fireEvent.change(screen.getByLabelText('Valor da troca'), { target: { value: '20000' } })
    fireEvent.change(screen.getByLabelText('Composição do pagamento'), { target: { value: 'troca_financiamento' } })
    criar()
    await waitFor(() => expect(createLead).toHaveBeenCalledTimes(1))
    expect(createLead.mock.calls[0][0]).toMatchObject({ hasTradeIn: true, tradeInVehicle: 'Gol 2010', tradeInValue: 20000, paymentComposition: 'troca_financiamento' })
  })
  it('responsivo: grades empilham no celular', () => {
    render(<NovaOportunidadeV2Modal {...props} />)
    expect(screen.getByLabelText('CPF').closest('.grid').className).toMatch(/grid-cols-1 sm:grid-cols-2/)
  })
})

describe('tela antiga (fallback legacy) intacta', () => {
  it('continua com valor negociado e cria sem depender da V2', async () => {
    render(<NovaOportunidadeModal {...props} />)
    expect(screen.getByLabelText('Valor negociado')).toBeInTheDocument()
    expect(screen.queryByLabelText('CPF')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Legacy' } })
    fireEvent.change(screen.getByLabelText('Telefone *'), { target: { value: '43999990000' } })
    fireEvent.change(screen.getByLabelText('Origem *'), { target: { value: 'OLX' } })
    fireEvent.change(screen.getByLabelText('Veículo de interesse *'), { target: { value: 'Onix' } })
    fireEvent.change(screen.getByLabelText('Valor negociado'), { target: { value: '48000' } })
    criar()
    await waitFor(() => expect(createLead).toHaveBeenCalledTimes(1))
    expect(createLead.mock.calls[0][0].negotiatedValue).toBe(48000)
    const legacy = fs.readFileSync(path.resolve(__dirname, '../src/components/NovaOportunidadeModal.jsx'), 'utf8')
    expect(legacy).not.toMatch(/novaOportunidadeV2|NovaOportunidadeV2/)
  })
})
