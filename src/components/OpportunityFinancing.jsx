import { useCallback, useEffect, useRef, useState } from 'react'
import { Landmark, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, CheckCircle2, Clock, Info, ShieldCheck, Plus, XCircle, Circle, Check, Pencil } from 'lucide-react'
import CurrencyInput from './CurrencyInput'
import {
  ETAPAS, UFS, PRAZOS_SUGERIDOS, TERMINAIS, formatCpf, maskCpf, onlyDigits, anosFabricacao, anosModelo, formularioInicial, checklistCliente,
  CAMPOS_CADASTRO, rascunhoCliente, patchCliente, veiculoSalvo, veiculoPrecisaRevalidar, descreverVeiculo,
  veiculoCompleto, negociacao, montarSimulacao, centsBRL, formatTaxa, STATUS_SIMULACAO, situacaoBanco, explicacaoBanco, resumoFinal,
  ordenarBancos, montarComparativo, valorDaSimulacao, formatData, veiculoDesatualizado,
} from '../financing'
import { formatBRL } from '../formInputs'
import {
  getFinanciamentoMarcas, getFinanciamentoModelos, getFinanciamentoVersoes, getFinanciamentoBancos, criarSimulacaoFinanciamento,
  getSimulacaoFinanciamento, listarSimulacoesFinanciamento, salvarClienteFinanciamento, salvarVeiculoFinanciamento,
} from '../api'

const control = 'w-full bg-surface2 border border-line rounded-control px-3 py-2 text-[13.5px] outline-none focus:border-brand disabled:opacity-60'
const btnPrimario = 'bg-brand hover:bg-brandHover text-brandInk rounded-control h-10 px-4 text-[13px] font-semibold transition-colors disabled:opacity-50'
const btnSecundario = 'border border-line rounded-control h-10 px-3.5 text-[12.5px] font-medium text-ink2 hover:text-ink hover:border-lineStrong'
const AUTO_POLL_MS = 4 * 60 * 1000
const LGPD = 'Os dados informados serão utilizados para realizar a simulação de financiamento junto às instituições financeiras habilitadas.'

function Campo({ label, erro, children, className = '', as: Tag = 'label' }) {
  return (
    <Tag className={`block text-[12px] text-ink2 ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
      {erro && <span className="block text-[11.5px] text-critical mt-1">{erro}</span>}
    </Tag>
  )
}

function Seletor({ label, value, onChange, opcoes, vazio, disabled, carregando }) {
  return (
    <Campo label={label}>
      <select aria-label={label} className={control} value={value} disabled={disabled || carregando} onChange={(e) => onChange(e.target.value)}>
        <option value="">{carregando ? 'Carregando…' : vazio}</option>
        {opcoes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Campo>
  )
}

function Bloco({ titulo, acao, children }) {
  return (
    <section className="rounded-card border border-line bg-surface p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-micro uppercase font-semibold text-ink3">{titulo}</h4>
        {acao}
      </div>
      {children}
    </section>
  )
}

function Linha({ rotulo, valor }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <span className="text-ink3 shrink-0">{rotulo}</span>
      <span className="text-right font-medium min-w-0 break-words">{valor ?? '—'}</span>
    </div>
  )
}

// Escolha curta em botões (Sexo, CNH, Zero km): mais rápido que um select.
function Opcoes({ label, value, onChange, opcoes }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label={label}>
      {opcoes.map(([v, l]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          className={`flex-1 sm:flex-none rounded-control h-9 px-3.5 text-[12.5px] font-medium border ${value === v ? 'border-brand bg-brand/10 text-ink' : 'border-line text-ink2 hover:text-ink'}`}>{l}</button>
      ))}
    </div>
  )
}

function Etapas({ atual, liberadas, concluidas, onIr }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Etapas do financiamento">
      {ETAPAS.map(([id, nome], i) => {
        const ativa = atual === id
        const pode = liberadas.includes(id) && !ativa
        const feita = !ativa && concluidas.includes(id)
        return (
          <li key={id}>
            <button type="button" disabled={!pode} onClick={() => onIr(id)} aria-current={ativa ? 'step' : undefined} data-concluida={feita ? 'sim' : undefined}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11.5px] font-medium ${ativa ? 'border-brand text-ink bg-brand/10' : pode ? 'border-line text-ink2 hover:text-ink' : 'border-line text-ink3 opacity-70'}`}>
              {feita ? <Check size={12} className="text-good" aria-label="concluída" /> : <span className="tnum">{i + 1}</span>}{nome}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function ChipSituacao({ banco }) {
  const s = situacaoBanco(banco)
  const Icone = s.tom === 'bom' ? CheckCircle2 : s.tom === 'neutro' ? Clock : s.tom === 'tecnico' ? AlertTriangle : XCircle
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-[2px] text-[11.5px] font-medium whitespace-nowrap">
      <Icone size={12} className={s.tom === 'bom' ? 'text-good' : 'text-ink3'} aria-hidden="true" />{s.label}
    </span>
  )
}

// ---------------------------------------------------------------- Cliente
const ROTULOS_CADASTRO = { cpf: 'CPF', birthDate: 'Data de nascimento', gender: 'Sexo', state: 'UF', city: 'Cidade', hasDriverLicense: 'Possui CNH' }

function FormCadastro({ lead, campos, salvando, erroServidor, onSalvar, onCancelar }) {
  const [r, setR] = useState(() => rascunhoCliente(lead))
  const [erros, setErros] = useState(null)
  const [cpfFoco, setCpfFoco] = useState(false)
  const set = (c, v) => setR((x) => ({ ...x, [c]: v }))
  const salvar = async () => {
    const { erros: e, patch } = patchCliente(r, lead, campos)
    setErros(e)
    if (e) return
    if (!Object.keys(patch).length) { onCancelar(); return }
    await onSalvar(patch)
  }
  const erroDe = (c) => erros?.[c] || erroServidor?.fields?.[c === 'cpf' ? 'document' : c]
  const campo = (c) => {
    switch (c) {
      case 'cpf': return <input aria-label="CPF" className={control} inputMode="numeric" autoComplete="off"
        placeholder={lead.customerDocumentMasked ? `Atual ${lead.customerDocumentMasked} · digite só para trocar` : '000.000.000-00'}
        value={cpfFoco ? formatCpf(r.cpf) : maskCpf(r.cpf)} onFocus={() => setCpfFoco(true)} onBlur={() => setCpfFoco(false)}
        onChange={(e) => set('cpf', onlyDigits(e.target.value).slice(0, 11))} />
      case 'birthDate': return <input aria-label="Data de nascimento" type="date" className={control} value={r.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
      case 'gender': return <Opcoes label="Sexo" value={r.gender} onChange={(v) => set('gender', v)} opcoes={[['male', 'Masculino'], ['female', 'Feminino']]} />
      case 'state': return <select aria-label="UF" className={control} value={r.state} onChange={(e) => set('state', e.target.value)}>
        <option value="">Selecione</option>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
      case 'city': return <input aria-label="Cidade" className={control} value={r.city} onChange={(e) => set('city', e.target.value)} autoComplete="off" />
      case 'hasDriverLicense': return <Opcoes label="Possui CNH" value={r.hasDriverLicense} onChange={(v) => set('hasDriverLicense', v)} opcoes={[['sim', 'Sim'], ['nao', 'Não']]} />
      default: return null
    }
  }
  return (
    <section aria-label="Completar dados do cliente" className="rounded-card border border-line bg-surface p-3.5 space-y-3">
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {campos.map((c) => (
          <li key={c}>
            <Campo as={['gender', 'hasDriverLicense'].includes(c) ? 'div' : 'label'} label={ROTULOS_CADASTRO[c]} erro={erroDe(c)}>{campo(c)}</Campo>
          </li>
        ))}
      </ul>
      <p className="text-[11.5px] text-ink3">Fica salvo no cadastro desta oportunidade e é reaproveitado nas próximas simulações. O CPF aparece sempre mascarado.</p>
      {erroServidor?.msg && !erroServidor.fields && <p role="alert" className="text-[12px] text-critical">{erroServidor.msg}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={btnSecundario} onClick={onCancelar} disabled={salvando}>Cancelar</button>
        <button type="button" className={btnPrimario} onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar dados do cliente'}</button>
      </div>
    </section>
  )
}

function EtapaCliente({ form, set, lead, salvando, erroServidor, onSalvarCliente, onContinuar }) {
  const [editar, setEditar] = useState(null) // null | lista de campos do cadastro
  const [corrigindo, setCorrigindo] = useState({})
  const itens = checklistCliente(form, lead)
  const ok = itens.filter((i) => i.ok).length
  const faltando = itens.filter((i) => i.origem === 'cadastro' && !i.ok).map((i) => i.campo)
  const inputSimulacao = (campo) => {
    const props = { className: control, autoComplete: 'off', value: form[campo], onChange: (e) => set(campo, e.target.value) }
    if (campo === 'name') return <input aria-label="Nome" {...props} />
    if (campo === 'phone') return <input aria-label="Telefone" inputMode="tel" {...props} />
    return <input aria-label="E-mail" type="email" {...props} />
  }
  const salvar = async (patch) => { if (await onSalvarCliente(patch)) setEditar(null) }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] text-ink2">Dados do cadastro do cliente usados na simulação.</p>
        <span className="text-[12px] font-semibold tnum whitespace-nowrap" aria-label="Completude">{ok} de {itens.length} ok</span>
      </div>
      <Bloco titulo="Dados do cliente">
        <ul className="space-y-1.5" aria-label="Dados do cliente">
          {itens.map((i) => {
            const simulacao = i.origem !== 'cadastro' && (i.origem === 'simulacao' || corrigindo[i.campo])
            return (
              <li key={i.campo} className="text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    {i.ok ? <Check size={13} className="text-good shrink-0" aria-label="ok" /> : <Circle size={10} className="text-ink3 shrink-0 mx-[1.5px]" aria-label="falta" />}
                    <span className="text-ink3 whitespace-nowrap">{i.label}</span>
                    {!simulacao && <span className={`truncate ${i.ok ? 'font-medium' : 'text-ink3'}`}>{i.ok ? i.valor : 'Falta'}</span>}
                  </span>
                  {i.origem === 'crm' && !corrigindo[i.campo] && (
                    <button type="button" onClick={() => setCorrigindo((c) => ({ ...c, [i.campo]: true }))} aria-label={`Corrigir ${i.label}`}
                      className="flex items-center gap-1 text-[11.5px] text-ink3 hover:text-ink shrink-0"><Pencil size={11} />Corrigir</button>
                  )}
                </div>
                {simulacao && <div className="mt-1 pl-5">{inputSimulacao(i.campo)}<span className="block text-[11px] text-ink3 mt-0.5">Vale só para esta simulação (dados de contato da oportunidade não são editados aqui).</span></div>}
              </li>
            )
          })}
        </ul>
        {!editar && (
          <div className="pt-1">
            {faltando.length > 0
              ? <button type="button" className={btnPrimario} onClick={() => setEditar(faltando)}>COMPLETAR DADOS</button>
              : <button type="button" className={btnSecundario} onClick={() => setEditar(CAMPOS_CADASTRO)}>Editar dados do cliente</button>}
          </div>
        )}
      </Bloco>
      {editar && <FormCadastro lead={lead} campos={editar} salvando={salvando} erroServidor={erroServidor} onSalvar={salvar} onCancelar={() => setEditar(null)} />}
      <p className="flex gap-2 text-[11.5px] text-ink3"><ShieldCheck size={13} className="shrink-0 mt-[1px]" aria-hidden="true" />{LGPD}</p>
      <div className="flex justify-end">
        <button type="button" className={btnPrimario} disabled={ok !== itens.length || !!editar} onClick={onContinuar}>Continuar</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Veículo
const AVISO_REVALIDAR = 'O veículo de interesse foi alterado. Confirme novamente os dados do veículo antes de uma nova simulação.'

function EtapaVeiculo({ form, set, lead, catalogo, naoConfigurado, editando, onEditar, salvando, erroVeiculo, onSalvar, onVoltar, onContinuar }) {
  const revalidar = veiculoPrecisaRevalidar(lead)
  const seletor = editando || !veiculoSalvo(lead)
  return (
    <div className="space-y-3">
      <Bloco titulo="Veículo de interesse da oportunidade">
        {lead.vehicleInterest
          ? <p className="text-[15px] font-semibold">{lead.vehicleInterest}</p>
          : <p className="text-[12.5px] text-ink2">Não informado. Você pode registrá-lo em “Editar negócio”.</p>}
      </Bloco>
      {revalidar && (
        <div role="alert" className="text-[12.5px] text-ink bg-surface border border-lineStrong rounded-control px-3 py-2 flex gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-[1px]" aria-hidden="true" />{AVISO_REVALIDAR}
        </div>
      )}
      {!seletor ? (
        <Bloco titulo="Veículo identificado para financiamento" acao={
          <button type="button" onClick={onEditar} className="text-[11.5px] text-ink2 hover:text-ink flex items-center gap-1"><Pencil size={11} />Alterar veículo</button>}>
          <p className="flex items-center gap-1.5 text-[13.5px] font-medium"><Check size={14} className="text-good shrink-0" aria-hidden="true" />{descreverVeiculo(lead)}</p>
          <Linha rotulo="Tipo" valor={lead.vehicleType === 'motorcycle' ? 'Moto' : 'Carro'} />
          <Linha rotulo="Ano" valor={`${lead.vehicleManufactureYear}/${lead.vehicleModelYear}`} />
          <Linha rotulo="Zero km" valor={lead.vehicleZeroKm ? 'Sim' : 'Não'} />
        </Bloco>
      ) : (
        <Bloco titulo={revalidar ? 'Confirmar veículo para financiamento' : 'Identificar veículo para financiamento'}>
          <p className="text-[12px] text-ink2">É o mesmo veículo da oportunidade, identificado no catálogo de financiamento. Fica salvo na oportunidade.</p>
          {naoConfigurado && (
            <div role="status" className="text-[12.5px] text-ink2 bg-surface border border-line rounded-control px-3 py-2 flex gap-2">
              <Info size={14} className="shrink-0 mt-[1px]" aria-hidden="true" />O financiamento ainda não está configurado no servidor. Fale com o administrador.
            </div>
          )}
          <div className="flex gap-1.5" role="group" aria-label="Tipo de veículo">
            {[['car', 'Carro'], ['motorcycle', 'Moto']].map(([v, l]) => (
              <button key={v} type="button" aria-pressed={form.type === v} onClick={() => set('type', v)}
                className={`rounded-control h-8 px-3 text-[12.5px] font-medium border ${form.type === v ? 'border-brand bg-brand/10 text-ink' : 'border-line text-ink2 hover:text-ink'}`}>{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Seletor label="Marca" value={form.brandCode} onChange={(v) => set('brandCode', v)} vazio="Selecione a marca" opcoes={catalogo.marcas}
              carregando={catalogo.carregando === 'marcas'} disabled={naoConfigurado} />
            <Seletor label="Modelo" value={form.modelCode} onChange={(v) => set('modelCode', v)} vazio={form.brandCode ? 'Selecione o modelo' : 'Escolha a marca primeiro'}
              opcoes={catalogo.modelos} carregando={catalogo.carregando === 'modelos'} disabled={!form.brandCode} />
            <Seletor label="Ano de fabricação" value={String(form.manufactureYear)} onChange={(v) => set('manufactureYear', v ? Number(v) : '')} vazio="Selecione"
              opcoes={anosFabricacao().map((a) => ({ value: String(a), label: String(a) }))} disabled={!form.modelCode} />
            <Seletor label="Ano do modelo" value={String(form.modelYear)} onChange={(v) => set('modelYear', v ? Number(v) : '')} vazio="Selecione"
              opcoes={anosModelo(form.manufactureYear).map((a) => ({ value: String(a), label: String(a) }))} disabled={!form.manufactureYear} />
            <Seletor label="Versão" value={form.versionCode} onChange={(v) => set('versionCode', v)} vazio={form.modelYear ? 'Selecione a versão' : 'Escolha modelo e anos primeiro'}
              opcoes={catalogo.versoes} carregando={catalogo.carregando === 'versoes'} disabled={!form.modelYear} />
            <div className="text-[12px] text-ink2">Zero km
              <div className="mt-1"><Opcoes label="Zero km" value={form.zeroKm} onChange={(v) => set('zeroKm', v)} opcoes={[[true, 'Sim'], [false, 'Não']]} /></div>
            </div>
          </div>
          {catalogo.erro && !naoConfigurado && <p className="text-[12px] text-critical">{catalogo.erro}</p>}
          {erroVeiculo && <p role="alert" className="text-[12px] text-critical">{erroVeiculo}</p>}
          <div className="flex justify-end">
            <button type="button" className={btnPrimario} disabled={!veiculoCompleto(form) || salvando || naoConfigurado} onClick={onSalvar}>
              {salvando ? 'Salvando…' : revalidar ? 'Confirmar veículo' : 'Salvar veículo'}
            </button>
          </div>
        </Bloco>
      )}
      <div className="flex justify-between gap-2">
        <button type="button" className={btnSecundario} onClick={onVoltar}>Voltar</button>
        <button type="button" className={btnPrimario} disabled={seletor} onClick={onContinuar}>Continuar</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Revisão
function EtapaRevisao({ form, set, lead, bancos, naoConfigurado, enviando, erroGeral, podeReenviar, onIr, onSimular }) {
  const [outroPrazo, setOutroPrazo] = useState('')
  const n = negociacao(form)
  const origem = valorDaSimulacao(lead).origem
  const togglePrazo = (p) => set('installments', form.installments.includes(p) ? form.installments.filter((x) => x !== p) : [...form.installments, p].sort((a, b) => a - b))
  const prazos = [...new Set([...PRAZOS_SUGERIDOS, ...form.installments])].sort((a, b) => a - b)
  const adicionar = () => { const p = Number(outroPrazo); if (Number.isSafeInteger(p) && p >= 1 && p <= 84 && !form.installments.includes(p)) togglePrazo(p); setOutroPrazo('') }
  const alterar = (etapa) => <button type="button" onClick={() => onIr(etapa)} className="text-[11.5px] text-ink2 hover:text-ink flex items-center gap-1"><Pencil size={11} />Alterar</button>
  return (
    <div className="space-y-3">
      <Bloco titulo="Cliente" acao={alterar('cliente')}>
        <Linha rotulo="Nome" valor={form.name} />
        <Linha rotulo="CPF" valor={lead.customerDocumentMasked} />
        <Linha rotulo="Telefone" valor={form.phone} />
        <Linha rotulo="E-mail" valor={form.email} />
        <Linha rotulo="Nascimento" valor={formatData(lead.customerBirthDate)} />
        <Linha rotulo="Cidade / UF" valor={`${lead.customerCity} / ${lead.customerState}`} />
        <Linha rotulo="CNH" valor={lead.customerHasDriverLicense ? 'Sim' : 'Não'} />
      </Bloco>
      <Bloco titulo="Veículo" acao={alterar('veiculo')}>
        <Linha rotulo="Veículo de interesse" valor={lead.vehicleInterest || 'Não informado'} />
        <Linha rotulo="Catálogo" valor={descreverVeiculo(lead)} />
        <Linha rotulo="Ano" valor={`${lead.vehicleManufactureYear}/${lead.vehicleModelYear}`} />
        <Linha rotulo="Zero km" valor={lead.vehicleZeroKm ? 'Sim' : 'Não'} />
      </Bloco>
      <Bloco titulo="Negociação">
        <Linha rotulo="Valor do bem" valor={lead.assetValue > 0 ? formatBRL(lead.assetValue) : 'Não informado'} />
        <Linha rotulo="Valor negociado" valor={lead.negotiatedValue > 0 ? formatBRL(lead.negotiatedValue) : 'Não informado'} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Campo label={`Valor da simulação${origem === 'negociado' ? ' (negociado)' : origem === 'bem' ? ' (valor do bem)' : ''}`} erro={n.erroValor && form.valor != null ? n.erroValor : null}>
            <CurrencyInput label="Valor da simulação" className={control} value={form.valor} onChange={(v) => set('valor', v)} />
          </Campo>
          <Campo label="Entrada" erro={n.erroEntrada}>
            <CurrencyInput label="Entrada" className={control} value={form.downPayment} onChange={(v) => set('downPayment', v)} />
          </Campo>
        </div>
        <Linha rotulo="Valor a financiar" valor={n.financiar != null ? formatBRL(n.financiar) : '—'} />
        <div>
          <div className="text-[12px] text-ink2 mb-1.5">Prazos <span className="text-ink3">(até 12 opções)</span></div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Prazos">
            {prazos.map((p) => (
              <button key={p} type="button" aria-pressed={form.installments.includes(p)} onClick={() => togglePrazo(p)}
                className={`rounded-control h-8 min-w-[44px] px-2.5 text-[12.5px] font-medium border tnum ${form.installments.includes(p) ? 'border-brand bg-brand/10 text-ink' : 'border-line text-ink2 hover:text-ink'}`}>{p}x</button>
            ))}
            <span className="flex items-center gap-1">
              <input aria-label="Outro prazo" inputMode="numeric" placeholder="Outro" value={outroPrazo}
                className="w-16 bg-surface2 border border-line rounded-control px-2 h-8 text-[12.5px] outline-none focus:border-brand"
                onChange={(e) => setOutroPrazo(onlyDigits(e.target.value).slice(0, 2))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar() } }} />
              <button type="button" aria-label="Adicionar prazo" onClick={adicionar} className="grid place-items-center h-8 w-8 rounded-control border border-line text-ink2 hover:text-ink"><Plus size={14} /></button>
            </span>
          </div>
          {n.erroPrazos && <span className="block text-[11.5px] text-critical mt-1">{n.erroPrazos}</span>}
        </div>
      </Bloco>

      <Bloco titulo="Bancos da conta de financiamento">
        {bancos.carregando && <p className="text-[12.5px] text-ink2">Carregando bancos…</p>}
        {bancos.erro && <p className="text-[12.5px] text-ink2">{bancos.erro}</p>}
        {!bancos.carregando && !bancos.erro && (
          <>
            {bancos.lista.length === 0 && <p className="text-[12.5px] text-ink2">Nenhum banco retornado pela plataforma.</p>}
            <ul className="flex flex-wrap gap-1.5" aria-label="Bancos">
              {bancos.lista.map((b) => (
                <li key={b.code} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface2 px-2.5 py-[3px] text-[12px]">
                  <span className="font-medium">{b.name}</span>
                  <span className={`flex items-center gap-0.5 ${b.habilitado ? 'text-ink2' : 'text-ink3'}`}>
                    {b.habilitado ? <Check size={11} className="text-good" aria-hidden="true" /> : <XCircle size={11} aria-hidden="true" />}
                    {b.habilitado ? 'Habilitado' : 'Não habilitado'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11.5px] text-ink3">Lista informativa: a simulação é enviada a todos os bancos habilitados da conta.</p>
          </>
        )}
      </Bloco>

      <p className="flex gap-2 text-[11.5px] text-ink3"><ShieldCheck size={13} className="shrink-0 mt-[1px]" aria-hidden="true" />{LGPD}</p>
      {erroGeral && <div role="alert" className="text-[12.5px] text-critical bg-critical/10 border border-critical/25 rounded-control px-3 py-2">{erroGeral}</div>}
      <div className="flex justify-between gap-2">
        <button type="button" className={btnSecundario} onClick={() => onIr('veiculo')} disabled={enviando}>Voltar</button>
        <button type="button" className={btnPrimario} onClick={onSimular}
          disabled={enviando || naoConfigurado || !veiculoSalvo(lead) || !!(n.erroValor || n.erroEntrada || n.erroPrazos)}>
          {enviando ? 'Enviando aos bancos…' : podeReenviar ? 'Tentar novamente' : 'SIMULAR FINANCIAMENTO'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Resultados
function Comparativo({ results }) {
  const linhas = montarComparativo(results)
  if (!linhas.length) return null
  return (
    <section className="space-y-1.5">
      <h4 className="text-micro uppercase font-semibold text-ink3">Comparativo de condições</h4>
      <ul className="sm:hidden space-y-2" data-testid="comparativo-cards" aria-label="Condições">
        {linhas.map((l, i) => (
          <li key={`${l.bankCode}-${l.condition_id || i}`} className="rounded-control border border-line bg-surface px-3 py-2.5 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[13px] font-semibold min-w-0 break-words">{l.banco}</span>
              <span className="text-[13px] font-semibold tnum whitespace-nowrap">{l.installments}x {centsBRL(l.installment_value_cents)}</span>
            </div>
            {(l.menorParcela || l.menorTaxa || l.monthly_rate_estimated) && (
              <div className="flex flex-wrap gap-1">
                {l.menorParcela && <span className="text-[10px] uppercase tracking-wide font-semibold border border-line rounded-full px-1.5 py-[1px] text-ink2">Menor parcela</span>}
                {l.menorTaxa && <span className="text-[10px] uppercase tracking-wide font-semibold border border-line rounded-full px-1.5 py-[1px] text-ink2">Menor taxa</span>}
                {l.monthly_rate_estimated && <span className="text-[10px] uppercase tracking-wide font-semibold border border-line rounded-full px-1.5 py-[1px] text-ink3">Taxa estimada</span>}
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px]">
              <dt className="text-ink3">Entrada</dt><dd className="text-right tnum">{centsBRL(l.down_payment_cents) || '—'}</dd>
              <dt className="text-ink3">Financiado</dt><dd className="text-right tnum">{centsBRL(l.financed_amount_cents) || '—'}</dd>
              <dt className="text-ink3">Taxa</dt><dd className="text-right tnum">{formatTaxa(l.monthly_rate) || '—'}</dd>
              <dt className="text-ink3">Condição</dt><dd className="text-right text-ink3 font-mono text-[11px] truncate" title={l.condition_id || ''}>{l.condition_id || '—'}</dd>
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden sm:block overflow-x-auto rounded-card border border-line" data-testid="comparativo">
        <table className="w-full min-w-[520px] text-[12.5px]">
          <thead className="bg-surface2 text-ink3 text-left">
            <tr>{['Banco', 'Prazo', 'Parcela', 'Entrada', 'Financiado', 'Taxa', 'Condição'].map((h) => <th key={h} scope="col" className="px-2.5 py-2 font-semibold whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={`${l.bankCode}-${l.condition_id || i}`} className="border-t border-line">
                <td className="px-2.5 py-2 font-medium whitespace-nowrap">{l.banco}</td>
                <td className="px-2.5 py-2 tnum">{l.installments}x</td>
                <td className="px-2.5 py-2 tnum whitespace-nowrap font-semibold">
                  {centsBRL(l.installment_value_cents)}
                  {l.menorParcela && <span className="block w-fit mt-0.5 text-[10px] uppercase tracking-wide font-semibold border border-line rounded-full px-1.5 py-[1px] text-ink2">Menor parcela</span>}
                </td>
                <td className="px-2.5 py-2 tnum whitespace-nowrap">{centsBRL(l.down_payment_cents) || '—'}</td>
                <td className="px-2.5 py-2 tnum whitespace-nowrap">{centsBRL(l.financed_amount_cents) || '—'}</td>
                <td className="px-2.5 py-2 tnum whitespace-nowrap">
                  {formatTaxa(l.monthly_rate) || '—'}
                  {l.menorTaxa && <span className="block w-fit mt-0.5 text-[10px] uppercase tracking-wide font-semibold border border-line rounded-full px-1.5 py-[1px] text-ink2">Menor taxa</span>}
                  {l.monthly_rate_estimated && <span className="block w-fit mt-0.5 text-[10px] uppercase tracking-wide font-semibold border border-line rounded-full px-1.5 py-[1px] text-ink3">Taxa estimada</span>}
                </td>
                <td className="px-2.5 py-2 text-ink3 text-[11px] font-mono max-w-[120px] truncate" title={l.condition_id || ''}>{l.condition_id || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-ink3">“Menor parcela” e “Menor taxa” comparam apenas condições com o mesmo prazo e a mesma entrada (taxa só quando nenhuma é estimada). Não é recomendação de banco.</p>
    </section>
  )
}

function EtapaResultados({ sim, lead, historico, onAbrir, onAtualizar, atualizando, autoAtivo, onNova }) {
  const terminal = TERMINAIS.includes(sim.status)
  const p = sim.progress
  const pct = p && p.expected_banks > 0 ? Math.min(100, Math.round((p.finished_banks / p.expected_banks) * 100)) : 0
  const resumo = resumoFinal(sim)
  const v = sim.vehicle || {}
  return (
    <div className="space-y-3">
      {historico.length > 1 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Simulações anteriores">
          {historico.slice(0, 5).map((s) => (
            <button key={s.id} type="button" onClick={() => onAbrir(s)}
              className={`text-[11.5px] border rounded-full px-2.5 py-[3px] ${sim.id === s.id ? 'border-brand text-ink' : 'border-line text-ink2 hover:text-ink'}`}>
              {new Date(s.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {STATUS_SIMULACAO[s.status] || s.status}
            </button>
          ))}
        </div>
      )}
      <Bloco titulo="Resumo da oportunidade">
        <Linha rotulo="Cliente" valor={lead.name} />
        <Linha rotulo="Veículo" valor={`${[v.brand_name, v.model_name].filter(Boolean).join(' ')}${v.version_name ? ` · ${v.version_name}` : ''} · ${v.manufacture_year}/${v.model_year}`} />
        {sim.terms && <>
          <Linha rotulo="Valor" valor={centsBRL(sim.terms.asset_value_cents)} />
          <Linha rotulo="Entrada" valor={centsBRL(sim.terms.down_payment_cents)} />
          <Linha rotulo="Valor financiado" valor={centsBRL(sim.terms.asset_value_cents - sim.terms.down_payment_cents)} />
        </>}
        {veiculoDesatualizado(sim, lead) && (
          <p role="status" className="flex gap-1.5 text-[12px] text-ink2 border-t border-line pt-2">
            <AlertTriangle size={13} className="shrink-0 mt-[1px]" aria-hidden="true" />
            O veículo de interesse da oportunidade mudou depois desta simulação (era “{sim.vehicleInterest}”). Revalide o veículo em uma nova simulação.
          </p>
        )}
      </Bloco>

      <div className="rounded-card border border-line bg-surface p-3" aria-live="polite">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold">
            {terminal ? <CheckCircle2 size={14} className="text-ink2" aria-hidden="true" /> : <RefreshCw size={14} className="text-ink2" aria-hidden="true" />}
            {STATUS_SIMULACAO[sim.status] || sim.status}
          </div>
          {!terminal && sim.status !== 'erro_envio' && sim.status !== 'envio_incerto' && (
            <button type="button" onClick={onAtualizar} disabled={atualizando} className="flex items-center gap-1.5 text-[12px] font-medium text-ink2 hover:text-ink disabled:opacity-50">
              <RefreshCw size={12} className={atualizando ? 'animate-spin' : ''} />{atualizando ? 'Atualizando…' : 'Atualizar agora'}
            </button>
          )}
        </div>
        {!terminal && (
          <div className="mt-2">
            {p && p.expected_banks > 0 ? (
              <>
                <div className="text-[13px] tnum"><strong>{p.finished_banks} de {p.expected_banks}</strong> bancos processados{p.pending_banks > 0 ? ` · ${p.pending_banks} pendentes` : ''}</div>
                <div className="h-1.5 rounded-full bg-surface3 mt-1.5 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={p.expected_banks} aria-valuenow={p.finished_banks}>
                  <div className="h-full bg-ink2" style={{ width: `${pct}%` }} />
                </div>
              </>
            ) : <div className="text-[12.5px] text-ink2">Aguardando os bancos começarem a responder.</div>}
            <div className="text-[11.5px] text-ink3 mt-1.5">{autoAtivo ? 'Atualização automática. Você pode continuar usando o CRM.' : 'A atualização automática terminou. Use “Atualizar agora”.'}</div>
          </div>
        )}
        {terminal && resumo && <p className="text-[12.5px] text-ink2 mt-1.5">{resumo}</p>}
        {sim.status === 'envio_incerto' && <p className="text-[12.5px] text-ink2 mt-1.5">O envio não foi confirmado. Em “Nova simulação”, envie os mesmos dados: o sistema reaproveita a mesma identificação e não duplica a consulta.</p>}
        {sim.status === 'erro_envio' && <p className="text-[12.5px] text-ink2 mt-1.5">Esta simulação não foi enviada aos bancos.</p>}
        {sim.aviso && <p className="text-[12px] text-ink2 mt-1.5 flex items-center gap-1"><Info size={12} aria-hidden="true" />{sim.aviso}</p>}
      </div>

      {sim.results?.length > 0 && (
        <section className="space-y-1.5">
          <h4 className="text-micro uppercase font-semibold text-ink3">Bancos</h4>
          <ul className="space-y-1.5" aria-label="Situação por banco">
            {ordenarBancos(sim.results).map((b, i) => (
              <li key={`${b.bank}-${i}`} className="rounded-control border border-line bg-surface2/50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold">{b.bankName || b.bank}</span><ChipSituacao banco={b} />
                </div>
                {explicacaoBanco(b) && <p className="text-[12px] text-ink2 mt-1">{explicacaoBanco(b)}</p>}
                {b.issues?.length > 0 && <ul className="mt-1">{b.issues.map((x, k) => <li key={k} className="text-[11.5px] text-ink3">{x.installments ? `${x.installments}x: ` : ''}{x.message || x.code}</li>)}</ul>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Comparativo results={sim.results || []} />
      {sim.requestId && <div className="text-[10.5px] text-ink3">Protocolo para suporte: {sim.requestId}</div>}
      <button type="button" className={btnSecundario} onClick={onNova}>Nova simulação</button>
    </div>
  )
}

// ---------------------------------------------------------------- Container
export default function OpportunityFinancing({ lead: leadProp, usuario, onLeadChanged }) {
  // Cópia local da oportunidade: atualizada pelo que o servidor devolve ao salvar
  // cliente/veículo e sincronizada quando a oportunidade muda fora daqui.
  const [lead, setLead] = useState(leadProp)
  useEffect(() => { setLead(leadProp) }, [leadProp])
  const podeSimular = usuario?.papel === 'gerente' || (usuario?.papel === 'vendedor' && usuario.id === lead.ownerId)
  const [salvandoCliente, setSalvandoCliente] = useState(false)
  const [erroCliente, setErroCliente] = useState(null)
  const [editandoVeiculo, setEditandoVeiculo] = useState(false)
  const [salvandoVeiculo, setSalvandoVeiculo] = useState(false)
  const [erroVeiculo, setErroVeiculo] = useState(null)
  const [aberto, setAberto] = useState(false)
  const [etapa, setEtapa] = useState(null) // null = carregando histórico
  const [form, setForm] = useState(() => formularioInicial(lead))
  const [historico, setHistorico] = useState([])
  const [atual, setAtual] = useState(null)
  const [catalogo, setCatalogo] = useState({ marcas: [], modelos: [], versoes: [], carregando: '', erro: '' })
  const [bancos, setBancos] = useState({ lista: [], carregando: false, erro: '', carregado: false })
  const [naoConfigurado, setNaoConfigurado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroGeral, setErroGeral] = useState(null)
  const [podeReenviar, setPodeReenviar] = useState(false)
  const [atualizando, setAtualizando] = useState(false)
  const [autoAte, setAutoAte] = useState(0)
  // false até o efeito rodar: no StrictMode (DEV) o React faz montagem → desmontagem → montagem,
  // então o efeito precisa religar a flag a cada montagem (senão o catálogo fica em "Carregando...").
  const montado = useRef(false)
  const enviandoRef = useRef(false) // trava síncrona contra duplo clique
  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])

  const set = useCallback((campo, valor) => setForm((f) => {
    const n = { ...f, [campo]: valor, [`_tocado_${campo}`]: true }
    if (campo === 'type') Object.assign(n, { brandCode: '', modelCode: '', versionCode: '', manufactureYear: '', modelYear: '' })
    if (campo === 'brandCode') Object.assign(n, { modelCode: '', versionCode: '' })
    if (campo === 'modelCode' || campo === 'modelYear') n.versionCode = ''
    if (campo === 'manufactureYear') Object.assign(n, { modelYear: valor ? Number(valor) : '', versionCode: '' })
    return n
  }), [])

  // Nada de rede ao abrir a oportunidade: só quando a área é expandida.
  useEffect(() => {
    if (!aberto || etapa !== null) return
    let cancelado = false
    listarSimulacoesFinanciamento(lead.id)
      .then((lista) => {
        if (cancelado) return
        setHistorico(lista || [])
        const ultima = lista?.[0]
        if (ultima && ultima.status !== 'erro_envio') {
          setAtual(ultima); setEtapa('resultados')
          if (!TERMINAIS.includes(ultima.status)) setAutoAte(Date.now() + AUTO_POLL_MS)
        } else setEtapa('cliente')
      })
      .catch(() => { if (!cancelado) setEtapa('cliente') })
    return () => { cancelado = true }
  }, [aberto, etapa, lead.id])

  const carregar = useCallback((chave, fn) => {
    setCatalogo((c) => ({ ...c, carregando: chave, erro: '' }))
    fn().then((itens) => { if (montado.current) setCatalogo((c) => ({ ...c, [chave]: (itens || []).map((i) => ({ value: i.code, label: i.name })), carregando: '' })) })
      .catch((err) => {
        if (!montado.current) return
        if (err.body?.code === 'nao_configurado') setNaoConfigurado(true)
        setCatalogo((c) => ({ ...c, carregando: '', erro: err.message }))
      })
  }, [])

  // Catálogo só é consultado na etapa Veículo, e só se for preciso identificar/alterar o veículo.
  const seletor = etapa === 'veiculo' && (editandoVeiculo || !veiculoSalvo(lead))
  useEffect(() => {
    if (!seletor) return
    setCatalogo((c) => ({ ...c, marcas: [] }))
    carregar('marcas', () => getFinanciamentoMarcas(form.type))
  }, [seletor, form.type, carregar]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!seletor) return
    setCatalogo((c) => ({ ...c, modelos: [], versoes: [] }))
    if (form.brandCode) carregar('modelos', () => getFinanciamentoModelos(form.type, form.brandCode))
  }, [seletor, form.type, form.brandCode, carregar]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!seletor) return
    setCatalogo((c) => ({ ...c, versoes: [] }))
    if (form.modelCode && form.manufactureYear && form.modelYear) {
      carregar('versoes', () => getFinanciamentoVersoes(form.type, form.brandCode, form.modelCode, form.manufactureYear, form.modelYear))
    }
  }, [seletor, form.type, form.brandCode, form.modelCode, form.manufactureYear, form.modelYear, carregar]) // eslint-disable-line react-hooks/exhaustive-deps

  const aplicarLead = (novo) => { if (!novo) return; setLead(novo); onLeadChanged?.(novo) }

  // Grava os dados do cliente no cadastro da oportunidade (PATCH com allowlist no servidor).
  const salvarCliente = async (patch) => {
    setSalvandoCliente(true); setErroCliente(null)
    try { const novo = await salvarClienteFinanciamento(lead.id, patch); if (montado.current) aplicarLead(novo); return true }
    catch (err) { if (montado.current) setErroCliente({ msg: err.message, fields: err.body?.fields || null }); return false }
    finally { if (montado.current) setSalvandoCliente(false) }
  }

  // Grava a estrutura técnica do veículo (o servidor confere no catálogo e guarda os nomes).
  const salvarVeiculo = async () => {
    setSalvandoVeiculo(true); setErroVeiculo(null)
    try {
      const novo = await salvarVeiculoFinanciamento(lead.id, { type: form.type, brandCode: form.brandCode, modelCode: form.modelCode, versionCode: form.versionCode,
        manufactureYear: Number(form.manufactureYear), modelYear: Number(form.modelYear), zeroKm: form.zeroKm === true })
      if (montado.current) { aplicarLead(novo); setEditandoVeiculo(false) }
    } catch (err) {
      if (!montado.current) return
      if (err.body?.code === 'nao_configurado') setNaoConfigurado(true)
      setErroVeiculo(err.message)
    } finally { if (montado.current) setSalvandoVeiculo(false) }
  }

  // Bancos: carregados da API ao chegar na Revisão. Nunca uma lista fixa.
  useEffect(() => {
    if (etapa !== 'revisao' || bancos.carregado) return
    setBancos((b) => ({ ...b, carregando: true, erro: '' }))
    getFinanciamentoBancos()
      .then((lista) => { if (montado.current) setBancos({ lista: lista || [], carregando: false, erro: '', carregado: true }) })
      .catch((err) => {
        if (!montado.current) return
        if (err.body?.code === 'nao_configurado') setNaoConfigurado(true)
        setBancos({ lista: [], carregando: false, erro: err.message, carregado: false })
      })
  }, [etapa, bancos.carregado])

  const aplicar = (sim) => { setAtual(sim); setHistorico((h) => [sim, ...h.filter((x) => x.id !== sim.id)]) }

  const atualizar = useCallback(async () => {
    if (!atual) return
    setAtualizando(true)
    try { const sim = await getSimulacaoFinanciamento(atual.id); if (montado.current) aplicar(sim) }
    catch (err) { if (montado.current) setAtual((a) => (a ? { ...a, aviso: err.message } : a)) }
    finally { if (montado.current) setAtualizando(false) }
  }, [atual])

  // Polling: o backend diz quando consultar de novo (>= 20 s, respeitando Retry-After).
  useEffect(() => {
    if (etapa !== 'resultados' || !atual || TERMINAIS.includes(atual.status) || atual.nextPollInMs == null || Date.now() > autoAte) return
    const t = setTimeout(atualizar, Math.max(1000, atual.nextPollInMs + 300))
    return () => clearTimeout(t)
  }, [etapa, atual, autoAte, atualizar])

  // ÚNICO ponto que envia a simulação: o clique em SIMULAR FINANCIAMENTO.
  const simular = async () => {
    if (enviandoRef.current) return
    const { erros, corpo } = montarSimulacao(form, lead)
    setErroGeral(null); setPodeReenviar(false)
    if (erros) { setErroGeral('Há dados incompletos. Use “Alterar” para revisar.'); return }
    enviandoRef.current = true
    setEnviando(true)
    try {
      const sim = await criarSimulacaoFinanciamento(corpo)
      if (!montado.current) return
      aplicar(sim); setEtapa('resultados'); setAutoAte(Date.now() + AUTO_POLL_MS)
    } catch (err) {
      if (!montado.current) return
      setErroGeral(err.message)
      setPodeReenviar(err.body?.simulation?.canRetry === true)
      if (err.body?.code === 'veiculo_revalidar') setLead((l) => ({ ...l, vehicleCatalogNeedsReview: true }))
      if (err.body?.code === 'nao_configurado') setNaoConfigurado(true)
    } finally { enviandoRef.current = false; if (montado.current) setEnviando(false) }
  }

  if (!podeSimular) return null
  const clienteOk = checklistCliente(form, lead).every((i) => i.ok)
  const veicOk = veiculoSalvo(lead)
  const liberadas = ['cliente', ...(clienteOk ? ['veiculo'] : []), ...(clienteOk && veicOk ? ['revisao'] : []), ...(atual ? ['resultados'] : [])]
  const concluidas = [...(clienteOk ? ['cliente'] : []), ...(veicOk ? ['veiculo'] : []), ...(atual ? ['revisao'] : [])]
  const ir = (e) => { setErroGeral(null); setEtapa(e) }

  return (
    <section className="rounded-card border border-line bg-surface2/50 p-4" aria-label="Financiamento">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="w-full flex items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold"><Landmark size={14} className="text-brand" />Financiamento</span>
        <span className="flex items-center gap-1 text-[12px] text-ink2">{aberto ? 'Fechar' : 'Simular / ver simulações'}{aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>
      {aberto && (
        <div className="mt-4 space-y-4">
          {etapa === null ? <p className="text-[12.5px] text-ink2">Carregando simulações…</p> : (
            <>
              <Etapas atual={etapa} liberadas={liberadas} concluidas={concluidas} onIr={ir} />
              {etapa === 'cliente' && <EtapaCliente form={form} set={set} lead={lead} salvando={salvandoCliente} erroServidor={erroCliente}
                onSalvarCliente={salvarCliente} onContinuar={() => ir('veiculo')} />}
              {etapa === 'veiculo' && <EtapaVeiculo form={form} set={set} lead={lead} catalogo={catalogo} naoConfigurado={naoConfigurado}
                editando={editandoVeiculo} onEditar={() => setEditandoVeiculo(true)} salvando={salvandoVeiculo} erroVeiculo={erroVeiculo} onSalvar={salvarVeiculo}
                onVoltar={() => ir('cliente')} onContinuar={() => ir('revisao')} />}
              {etapa === 'revisao' && <EtapaRevisao form={form} set={set} lead={lead} bancos={bancos} naoConfigurado={naoConfigurado}
                enviando={enviando} erroGeral={erroGeral} podeReenviar={podeReenviar} onIr={ir} onSimular={simular} />}
              {etapa === 'resultados' && atual && <EtapaResultados sim={atual} lead={lead} historico={historico} onAbrir={setAtual} onAtualizar={atualizar}
                atualizando={atualizando} autoAtivo={Date.now() <= autoAte} onNova={() => ir(clienteOk ? (veicOk ? 'revisao' : 'veiculo') : 'cliente')} />}
            </>
          )}
        </div>
      )}
    </section>
  )
}
