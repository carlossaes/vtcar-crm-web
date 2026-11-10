// FINALIZAÇÃO V2 — data de nascimento no padrão brasileiro (dd/mm/aaaa) na tela,
// ISO (aaaa-mm-dd) no payload, como o backend/Zinix já esperam. Dados FICTÍCIOS.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import DataBR, { isoParaBR, mascaraData, valorDigitado } from '../src/components/DataBR'
import NovaOportunidadeV2Modal from '../src/components/NovaOportunidadeV2Modal'
import OpportunityFinancing from '../src/components/OpportunityFinancing'
import * as api from '../src/api'

vi.mock('../src/api', () => ({
  createLead: vi.fn(), salvarClienteFinanciamento: vi.fn(),
  getFinanciamentoMarcas: vi.fn(), getFinanciamentoModelos: vi.fn(), getFinanciamentoVersoes: vi.fn(), getFinanciamentoBancos: vi.fn(),
  criarSimulacaoFinanciamento: vi.fn(), getSimulacaoFinanciamento: vi.fn(), listarSimulacoesFinanciamento: vi.fn(), salvarVeiculoFinanciamento: vi.fn(),
}))

describe('regras puras da data', () => {
  it('ISO → dd/mm/aaaa; máscara; digitado → ISO só quando completo', () => {
    expect(isoParaBR('2000-03-13')).toBe('13/03/2000')
    expect(isoParaBR('')).toBe('')
    expect(mascaraData('13032000')).toBe('13/03/2000')
    expect(mascaraData('1303')).toBe('13/03')
    expect(valorDigitado('13/03/2000')).toBe('2000-03-13')
    expect(valorDigitado('13032000')).toBe('2000-03-13')
    expect(valorDigitado('2000-03-13')).toBe('2000-03-13') // já em ISO
    expect(valorDigitado('13/03')).toBe('13/03') // incompleto: as validações atuais recusam
    expect(valorDigitado('')).toBe('')
  })
})

describe('componente DataBR', () => {
  function Caixa({ inicial = '' }) {
    const [v, setV] = React.useState(inicial)
    return <><DataBR aria-label="Nascimento" value={v} onChange={setV} /><output data-testid="iso">{v}</output>
      <button type="button" onClick={() => setV('')}>limpar</button><button type="button" onClick={() => setV('1985-02-01')}>servidor</button></>
  }
  it('vazio: texto, placeholder dd/mm/aaaa, nunca mm/dd/yyyy', () => {
    render(<Caixa />)
    const c = screen.getByLabelText('Nascimento')
    expect(c).toHaveAttribute('type', 'text'); expect(c).toHaveAttribute('placeholder', 'dd/mm/aaaa'); expect(c).toHaveValue('')
  })
  it('preenchimento: mostra 13/03/2000 e entrega 2000-03-13', () => {
    render(<Caixa />)
    fireEvent.change(screen.getByLabelText('Nascimento'), { target: { value: '13032000' } })
    expect(screen.getByLabelText('Nascimento')).toHaveValue('13/03/2000')
    expect(screen.getByTestId('iso')).toHaveTextContent('2000-03-13')
  })
  it('reabertura / dado vindo do servidor (ISO) aparece em dd/mm/aaaa; limpar esvazia', () => {
    render(<Caixa inicial="1990-05-20" />)
    expect(screen.getByLabelText('Nascimento')).toHaveValue('20/05/1990')
    fireEvent.click(screen.getByText('servidor'))
    expect(screen.getByLabelText('Nascimento')).toHaveValue('01/02/1985')
    fireEvent.click(screen.getByText('limpar'))
    expect(screen.getByLabelText('Nascimento')).toHaveValue('')
  })
  it('edição: apagar e redigitar atualiza o ISO', () => {
    render(<Caixa inicial="1990-05-20" />)
    const c = screen.getByLabelText('Nascimento')
    fireEvent.change(c, { target: { value: '20/05' } })
    expect(c).toHaveValue('20/05'); expect(screen.getByTestId('iso')).toHaveTextContent('20/05')
    fireEvent.change(c, { target: { value: '20/05/1991' } })
    expect(screen.getByTestId('iso')).toHaveTextContent('1991-05-20')
  })
})

describe('Nova oportunidade V2: nascimento pt-BR, ISO no envio', () => {
  const vendedor = { id: 'v1', nome: 'Ana Teste', papel: 'vendedor' }
  const props = { open: true, usuario: vendedor, vendedores: [], onClose: vi.fn(), onCreated: vi.fn(), onAbrirExistente: vi.fn() }
  beforeEach(() => {
    api.createLead.mockImplementation(async (d) => ({ id: 'opp-n', ...d }))
    api.salvarClienteFinanciamento.mockImplementation(async (id, d) => ({ id, customerBirthDate: d.birthDate }))
  })
  function obrigatorios() {
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Cliente Teste' } })
    fireEvent.change(screen.getByLabelText('Telefone *'), { target: { value: '43999999999' } })
    fireEvent.change(screen.getByLabelText('Origem *'), { target: { value: 'Loja' } })
    fireEvent.change(screen.getByLabelText('Veículo de interesse *'), { target: { value: 'Vectra 2.2' } })
    fireEvent.change(screen.getByLabelText('Valor do bem'), { target: { value: '29900' } })
  }
  const criar = () => fireEvent.click(screen.getByRole('button', { name: /Criar oportunidade/ }))
  it('campo vazio: cria sem data (continua opcional)', async () => {
    render(<NovaOportunidadeV2Modal {...props} />); obrigatorios()
    expect(screen.getByLabelText('Nascimento')).toHaveAttribute('placeholder', 'dd/mm/aaaa')
    criar()
    await waitFor(() => expect(props.onCreated).toHaveBeenCalled())
    expect(api.salvarClienteFinanciamento).not.toHaveBeenCalled()
  })
  it('digitado 13/03/2000 → payload birthDate "2000-03-13"', async () => {
    render(<NovaOportunidadeV2Modal {...props} />); obrigatorios()
    fireEvent.change(screen.getByLabelText('Nascimento'), { target: { value: '13032000' } })
    expect(screen.getByLabelText('Nascimento')).toHaveValue('13/03/2000')
    criar()
    await waitFor(() => expect(api.salvarClienteFinanciamento).toHaveBeenCalledWith('opp-n', { birthDate: '2000-03-13' }))
  })
  it('data incompleta bloqueia como data inválida (regra atual)', async () => {
    render(<NovaOportunidadeV2Modal {...props} />); obrigatorios()
    fireEvent.change(screen.getByLabelText('Nascimento'), { target: { value: '1303' } })
    criar()
    expect(await screen.findByText('Data de nascimento inválida.')).toBeInTheDocument()
    expect(api.createLead).not.toHaveBeenCalled()
  })
})

describe('Financiamento: nascimento pt-BR na edição, reabertura e simulação', () => {
  const vendedor = { id: 'v1', nome: 'Ana Teste', papel: 'vendedor' }
  const lead = { id: 'opp-f', name: 'Cliente Teste', email: 'teste@example.invalid', phone: '43999999999', ownerId: 'v1', recordType: 'opportunity', stage: 'novo',
    vehicleInterest: 'Corolla', assetValue: 30000, downPayment: 5000, customerDocumentMasked: '•••.•••.•••-25', customerBirthDate: '1990-05-20', customerGender: 'female',
    customerState: 'PR', customerCity: 'Londrina', customerHasDriverLicense: true, vehicleType: 'car', vehicleBrandCode: '56', vehicleBrandName: 'TOYOTA', vehicleModelCode: '5001',
    vehicleModelName: 'COROLLA', vehicleVersionCode: 'v-xei', vehicleVersionName: 'XEI 2.0 FLEX', vehicleManufactureYear: 2024, vehicleModelYear: 2025, vehicleZeroKm: false,
    vehicleCatalogInterest: 'Corolla', vehicleCatalogNeedsReview: false }
  let atual
  function Tela() { const [l, setL] = React.useState(lead); atual = l; return <OpportunityFinancing lead={l} usuario={vendedor} onLeadChanged={setL} /> }
  beforeEach(() => {
    api.listarSimulacoesFinanciamento.mockResolvedValue([])
    api.getFinanciamentoBancos.mockResolvedValue([{ code: 'bx', name: 'Banco Xis Teste', status: 'enabled', habilitado: true }])
    api.salvarClienteFinanciamento.mockImplementation(async (id, d) => ({ ...atual, customerBirthDate: d.birthDate ?? atual.customerBirthDate }))
    api.criarSimulacaoFinanciamento.mockResolvedValue({ id: 'sim-1', status: 'processing', terminal: false, results: [], progress: {}, nextPollInMs: 0 })
  })
  it('edição mostra 20/05/1990, salva ISO, cadastro reaberto mostra dd/mm/aaaa e a simulação não reenvia a data', async () => {
    render(<Tela />)
    fireEvent.click(screen.getByRole('button', { name: /Financiamento/ }))
    await screen.findByRole('list', { name: 'Etapas do financiamento' })
    expect(within(screen.getByRole('list', { name: 'Dados do cliente' })).getByText('20/05/1990')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Editar dados do cliente' }))
    const c = screen.getByLabelText('Data de nascimento')
    expect(c).toHaveValue('20/05/1990'); expect(c).toHaveAttribute('placeholder', 'dd/mm/aaaa')
    fireEvent.change(c, { target: { value: '01021985' } })
    expect(c).toHaveValue('01/02/1985')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar dados do cliente' }))
    await waitFor(() => expect(api.salvarClienteFinanciamento).toHaveBeenCalledWith('opp-f', { birthDate: '1985-02-01' }))
    expect(await within(screen.getByRole('list', { name: 'Dados do cliente' })).findByText('01/02/1985')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/02\/01\/1985|1985-02-01/)
    // Revisão e simulação: o servidor usa o dado salvo (ISO) do CRM; o corpo do POST não leva a data.
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' })); fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByRole('button', { name: 'SIMULAR FINANCIAMENTO' })
    expect(screen.getByText('Cliente', { selector: 'h4' }).closest('section')).toHaveTextContent('01/02/1985')
    fireEvent.click(screen.getByRole('button', { name: '24x' }))
    fireEvent.click(screen.getByRole('button', { name: 'SIMULAR FINANCIAMENTO' }))
    await waitFor(() => expect(api.criarSimulacaoFinanciamento).toHaveBeenCalledTimes(1))
    expect(JSON.stringify(api.criarSimulacaoFinanciamento.mock.calls[0])).not.toMatch(/01\/02\/1985/)
    expect(atual.customerBirthDate).toBe('1985-02-01')
  })
})
