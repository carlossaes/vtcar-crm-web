import { useCallback, useEffect, useRef, useState } from 'react'
import { Landmark, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, CheckCircle2, Clock, Info, ShieldCheck, Plus, XCircle } from 'lucide-react'
import CurrencyInput from './CurrencyInput'
import {
  UFS, PRAZOS_SUGERIDOS, TERMINAIS, formatCpf, maskCpf, onlyDigits, anosFabricacao, anosModelo, formularioInicial, montarSimulacao,
  centsBRL, formatTaxa, STATUS_SIMULACAO, STATUS_BANCO, mensagemSemCondicoes, resumoFinal, ordenarBancos,
} from '../financing'
import { formatBRL } from '../formInputs'
import {
  getFinanciamentoMarcas, getFinanciamentoModelos, getFinanciamentoVersoes, criarSimulacaoFinanciamento,
  getSimulacaoFinanciamento, listarSimulacoesFinanciamento,
} from '../api'

const control = 'w-full bg-surface2 border border-line rounded-control px-3 py-2 text-[13.5px] outline-none focus:border-brand disabled:opacity-60'
const AUTO_POLL_MS = 4 * 60 * 1000 // depois disso o vendedor atualiza manualmente

function Secao({ titulo, children }) {
  return <section className="space-y-3"><h4 className="text-micro uppercase font-semibold text-ink3">{titulo}</h4>{children}</section>
}

function Campo({ label, erro, children, className = '' }) {
  return (
    <label className={`block text-[12px] text-ink2 ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
      {erro && <span className="block text-[11.5px] text-critical mt-1">{erro}</span>}
    </label>
  )
}

function Seletor({ label, value, onChange, opcoes, vazio, erro, disabled, carregando }) {
  return (
    <Campo label={label} erro={erro}>
      <select aria-label={label} className={control} value={value} disabled={disabled || carregando} onChange={(e) => onChange(e.target.value)}>
        <option value="">{carregando ? 'Carregando…' : vazio}</option>
        {opcoes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Campo>
  )
}

function StatusBanco({ status }) {
  const meta = STATUS_BANCO[status] || STATUS_BANCO.unknown
  const Icone = meta.tom === 'bom' ? CheckCircle2 : meta.tom === 'neutro' ? Clock : meta.tom === 'tecnico' ? AlertTriangle : XCircle
  const cor = meta.tom === 'bom' ? 'text-good' : meta.tom === 'neutro' ? 'text-ink3' : meta.tom === 'tecnico' ? 'text-ink2' : 'text-ink2'
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-[2px] text-[11.5px] font-medium">
      <Icone size={12} className={cor} aria-hidden="true" />{meta.label}
    </span>
  )
}

function Condicao({ c }) {
  const taxa = formatTaxa(c.monthly_rate)
  return (
    <li className="rounded-control border border-line bg-surface px-3 py-2">
      <div className="text-[14px] font-semibold tnum">{c.installments}x de {centsBRL(c.installment_value_cents) || '—'}</div>
      <div className="text-[12px] text-ink2 mt-0.5">
        {c.down_payment_cents != null && <>Entrada {centsBRL(c.down_payment_cents)}</>}
        {c.down_payment_cents != null && c.financed_amount_cents != null && ' · '}
        {c.financed_amount_cents != null && <>Financiado {centsBRL(c.financed_amount_cents)}</>}
      </div>
      {taxa && (
        <div className="text-[12px] text-ink2 mt-0.5 flex items-center gap-1.5">
          Taxa {taxa}
          {c.monthly_rate_estimated && <span className="text-[10.5px] uppercase font-semibold tracking-wide border border-line rounded-full px-1.5 py-[1px] text-ink3">Taxa estimada</span>}
        </div>
      )}
    </li>
  )
}

function Banco({ b }) {
  return (
    <div className="rounded-card border border-line bg-surface2/50 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[13.5px] font-semibold uppercase tracking-wide">{b.bankName || b.bank}</div>
        <StatusBanco status={b.status} />
      </div>
      {b.conditions?.length > 0 ? (
        // Todas as condições aparecem: duas de 48x podem ter entrada/taxa diferentes.
        <ul className="space-y-1.5">{b.conditions.map((c, i) => <Condicao key={c.condition_id || i} c={c} />)}</ul>
      ) : (
        <p className="text-[12.5px] text-ink2">{mensagemSemCondicoes(b.status)}</p>
      )}
      {b.issues?.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {b.issues.map((i, k) => <li key={k} className="text-[11.5px] text-ink3">{i.installments ? `${i.installments}x: ` : ''}{i.message || i.code}</li>)}
        </ul>
      )}
      {b.error && !b.conditions?.length && <p className="text-[11.5px] text-ink3 mt-1">{b.error.message || b.error.code}</p>}
    </div>
  )
}

function Resultado({ sim, onAtualizar, atualizando, autoAtivo }) {
  const terminal = TERMINAIS.includes(sim.status)
  const p = sim.progress
  const pct = p && p.expected_banks > 0 ? Math.min(100, Math.round((p.finished_banks / p.expected_banks) * 100)) : 0
  const resumo = resumoFinal(sim)
  const v = sim.vehicle || {}
  return (
    <div className="space-y-3">
      <div className="text-[12.5px] text-ink2 leading-relaxed">
        <div className="text-[13.5px] font-medium text-ink">{[v.brand_name, v.model_name].filter(Boolean).join(' ')} {v.version_name ? `· ${v.version_name}` : ''}</div>
        <div>
          {v.manufacture_year}/{v.model_year}{v.zero_km ? ' · 0 km' : ''}
          {sim.terms && <> · Valor {centsBRL(sim.terms.asset_value_cents)} · Entrada {centsBRL(sim.terms.down_payment_cents)} · {sim.terms.installments?.map((n) => `${n}x`).join(', ')}</>}
        </div>
      </div>

      <div className="rounded-card border border-line bg-surface p-3" aria-live="polite">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold">
            {terminal ? <CheckCircle2 size={14} className="text-ink2" aria-hidden="true" /> : <RefreshCw size={14} className="text-brand" aria-hidden="true" />}
            {STATUS_SIMULACAO[sim.status] || sim.status}
          </div>
          {!terminal && sim.status !== 'erro_envio' && sim.status !== 'envio_incerto' && (
            <button type="button" onClick={onAtualizar} disabled={atualizando}
              className="flex items-center gap-1.5 text-[12px] font-medium text-ink2 hover:text-ink disabled:opacity-50">
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
            ) : (
              <div className="text-[12.5px] text-ink2">Aguardando os bancos começarem a responder.</div>
            )}
            <div className="text-[11.5px] text-ink3 mt-1.5">
              {autoAtivo ? 'Os resultados são atualizados automaticamente. Você pode continuar usando o CRM.' : 'A atualização automática terminou. Use “Atualizar agora” para consultar de novo.'}
            </div>
          </div>
        )}
        {terminal && resumo && <p className="text-[12.5px] text-ink2 mt-1.5">{resumo}</p>}
        {sim.status === 'envio_incerto' && (
          <p className="text-[12.5px] text-ink2 mt-1.5">O envio não foi confirmado pela plataforma. Use “Nova simulação” e envie os mesmos dados: o sistema reaproveita a mesma identificação e não duplica a consulta.</p>
        )}
        {sim.status === 'erro_envio' && <p className="text-[12.5px] text-ink2 mt-1.5">Esta simulação não foi enviada aos bancos.</p>}
        {sim.aviso && <p className="text-[12px] text-ink2 mt-1.5 flex items-center gap-1"><Info size={12} aria-hidden="true" />{sim.aviso}</p>}
      </div>

      {sim.results?.length > 0 && <div className="space-y-2">{ordenarBancos(sim.results).map((b, i) => <Banco key={`${b.bank}-${i}`} b={b} />)}</div>}
      {sim.requestId && <div className="text-[10.5px] text-ink3">Protocolo para suporte: {sim.requestId}</div>}
    </div>
  )
}

export default function OpportunityFinancing({ lead, usuario }) {
  const podeSimular = usuario?.papel === 'gerente' || (usuario?.papel === 'vendedor' && usuario.id === lead.ownerId)
  const [aberto, setAberto] = useState(false)
  const [modo, setModo] = useState(null) // null (carregando) | 'form' | 'resultado'
  const [historico, setHistorico] = useState([])
  const [atual, setAtual] = useState(null)
  const [form, setForm] = useState(() => formularioInicial(lead))
  const [errosCampo, setErrosCampo] = useState({})
  const [erroGeral, setErroGeral] = useState(null)
  const [podeReenviar, setPodeReenviar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [atualizando, setAtualizando] = useState(false)
  const [cpfFoco, setCpfFoco] = useState(false)
  const [outroPrazo, setOutroPrazo] = useState('')
  const [naoConfigurado, setNaoConfigurado] = useState(false)
  const [catalogo, setCatalogo] = useState({ marcas: [], modelos: [], versoes: [], carregando: '', erro: '' })
  const [autoAte, setAutoAte] = useState(0)
  const montado = useRef(true)
  useEffect(() => () => { montado.current = false }, [])

  const set = (campo, valor) => setForm((f) => {
    const n = { ...f, [campo]: valor }
    if (campo === 'type') Object.assign(n, { brandCode: '', modelCode: '', versionCode: '', manufactureYear: '', modelYear: '' })
    if (campo === 'brandCode') Object.assign(n, { modelCode: '', versionCode: '' })
    if (campo === 'modelCode' || campo === 'modelYear') n.versionCode = ''
    if (campo === 'manufactureYear') Object.assign(n, { modelYear: valor ? String(valor) : '', versionCode: '' })
    return n
  })

  // Histórico só é consultado quando o vendedor abre a área (nada de rede ao abrir a oportunidade).
  useEffect(() => {
    if (!aberto || modo !== null) return
    let cancelado = false
    listarSimulacoesFinanciamento(lead.id)
      .then((lista) => {
        if (cancelado) return
        setHistorico(lista || [])
        const ultima = lista?.[0]
        if (ultima && !TERMINAIS.includes(ultima.status) && ultima.status !== 'erro_envio') {
          setAtual(ultima); setModo('resultado'); setAutoAte(Date.now() + AUTO_POLL_MS)
        } else if (ultima && ultima.status !== 'erro_envio') { setAtual(ultima); setModo('resultado') }
        else setModo('form')
      })
      .catch(() => { if (!cancelado) setModo('form') })
    return () => { cancelado = true }
  }, [aberto, modo, lead.id])

  const carregar = useCallback((chave, fn) => {
    setCatalogo((c) => ({ ...c, carregando: chave, erro: '' }))
    fn()
      .then((itens) => { if (montado.current) setCatalogo((c) => ({ ...c, [chave]: (itens || []).map((i) => ({ value: i.code, label: i.name })), carregando: '' })) })
      .catch((err) => {
        if (!montado.current) return
        if (err.body?.code === 'nao_configurado') setNaoConfigurado(true)
        setCatalogo((c) => ({ ...c, carregando: '', erro: err.message }))
      })
  }, [])

  useEffect(() => {
    if (!aberto || modo !== 'form' || !podeSimular) return
    setCatalogo((c) => ({ ...c, marcas: [], modelos: [], versoes: [] }))
    carregar('marcas', () => getFinanciamentoMarcas(form.type))
  }, [aberto, modo, form.type, podeSimular, carregar])
  useEffect(() => {
    setCatalogo((c) => ({ ...c, modelos: [], versoes: [] }))
    if (modo === 'form' && form.brandCode) carregar('modelos', () => getFinanciamentoModelos(form.type, form.brandCode))
  }, [modo, form.type, form.brandCode, carregar])
  useEffect(() => {
    setCatalogo((c) => ({ ...c, versoes: [] }))
    if (modo === 'form' && form.modelCode && form.manufactureYear && form.modelYear) {
      carregar('versoes', () => getFinanciamentoVersoes(form.type, form.brandCode, form.modelCode, form.manufactureYear, form.modelYear))
    }
  }, [modo, form.type, form.brandCode, form.modelCode, form.manufactureYear, form.modelYear, carregar])

  const aplicar = (sim) => {
    setAtual(sim)
    setHistorico((h) => [sim, ...h.filter((x) => x.id !== sim.id)])
  }

  const atualizar = useCallback(async () => {
    if (!atual) return
    setAtualizando(true)
    try { const sim = await getSimulacaoFinanciamento(atual.id); if (montado.current) aplicar(sim) }
    catch (err) { if (montado.current) setAtual((a) => (a ? { ...a, aviso: err.message } : a)) }
    finally { if (montado.current) setAtualizando(false) }
  }, [atual])

  // Polling: o backend diz quando consultar de novo (>= 20s, respeitando Retry-After).
  useEffect(() => {
    if (!atual || TERMINAIS.includes(atual.status) || atual.nextPollInMs == null || Date.now() > autoAte) return
    const t = setTimeout(atualizar, Math.max(1000, atual.nextPollInMs + 300))
    return () => clearTimeout(t)
  }, [atual, autoAte, atualizar])

  const simular = async (e) => {
    e.preventDefault()
    if (enviando) return
    const { erros, corpo } = montarSimulacao(form, lead.id)
    setErroGeral(null); setPodeReenviar(false)
    if (erros) { setErrosCampo(erros); setErroGeral('Confira os campos destacados.'); return }
    setErrosCampo({})
    setEnviando(true)
    try {
      const sim = await criarSimulacaoFinanciamento(corpo)
      if (!montado.current) return
      aplicar(sim); setModo('resultado'); setAutoAte(Date.now() + AUTO_POLL_MS)
    } catch (err) {
      if (!montado.current) return
      setErrosCampo(err.body?.fields || {})
      setErroGeral(err.message)
      setPodeReenviar(err.body?.simulation?.canRetry === true)
      if (err.body?.code === 'nao_configurado') setNaoConfigurado(true)
    } finally { if (montado.current) setEnviando(false) }
  }

  if (!podeSimular) return null
  const err = (k) => errosCampo[k]
  const togglePrazo = (n) => set('installments', form.installments.includes(n) ? form.installments.filter((x) => x !== n) : [...form.installments, n].sort((a, b) => a - b))
  const prazos = [...new Set([...PRAZOS_SUGERIDOS, ...form.installments])].sort((a, b) => a - b)
  const adicionarPrazo = () => {
    const n = Number(outroPrazo)
    if (Number.isSafeInteger(n) && n >= 1 && n <= 84 && !form.installments.includes(n)) togglePrazo(n)
    setOutroPrazo('')
  }

  return (
    <section className="rounded-card border border-line bg-surface2/50 p-4" aria-label="Financiamento">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}
        className="w-full flex items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold"><Landmark size={14} className="text-brand" />Financiamento</span>
        <span className="flex items-center gap-1 text-[12px] text-ink2">{aberto ? 'Fechar' : 'Simular / ver simulações'}{aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>

      {aberto && (
        <div className="mt-4 space-y-4">
          {modo === null && <p className="text-[12.5px] text-ink2">Carregando simulações…</p>}

          {historico.length > 1 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Simulações anteriores">
              {historico.slice(0, 5).map((s) => (
                <button key={s.id} type="button" onClick={() => { setAtual(s); setModo('resultado') }}
                  className={`text-[11.5px] border rounded-full px-2.5 py-[3px] ${atual?.id === s.id && modo === 'resultado' ? 'border-brand text-ink' : 'border-line text-ink2 hover:text-ink'}`}>
                  {new Date(s.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {STATUS_SIMULACAO[s.status] || s.status}
                </button>
              ))}
            </div>
          )}

          {modo === 'resultado' && atual && (
            <>
              <Resultado sim={atual} onAtualizar={atualizar} atualizando={atualizando} autoAtivo={Date.now() <= autoAte} />
              <button type="button" onClick={() => { setModo('form'); setErroGeral(null) }}
                className="border border-line rounded-control h-9 px-3 text-[12.5px] font-medium text-ink2 hover:text-ink hover:border-lineStrong">
                Nova simulação
              </button>
            </>
          )}

          {modo === 'form' && (
            <form noValidate onSubmit={simular} className="space-y-5">
              {naoConfigurado && (
                <div role="status" className="text-[12.5px] text-ink2 bg-surface border border-line rounded-control px-3 py-2 flex gap-2">
                  <Info size={14} className="shrink-0 mt-[1px]" aria-hidden="true" />O financiamento ainda não está configurado no servidor. Fale com o administrador.
                </div>
              )}

              <Secao titulo="Cliente">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo label="Nome" erro={err('applicant.name')} className="sm:col-span-2">
                    <input aria-label="Nome" className={control} value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" />
                  </Campo>
                  <Campo label="CPF" erro={err('applicant.document')}>
                    <input aria-label="CPF" className={control} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
                      value={cpfFoco ? formatCpf(form.cpf) : maskCpf(form.cpf)}
                      onFocus={() => setCpfFoco(true)} onBlur={() => setCpfFoco(false)}
                      onChange={(e) => set('cpf', onlyDigits(e.target.value).slice(0, 11))} />
                  </Campo>
                  <Campo label="Data de nascimento" erro={err('applicant.birthDate')}>
                    <input aria-label="Data de nascimento" type="date" className={control} value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
                  </Campo>
                  <Seletor label="Sexo" value={form.gender} onChange={(v) => set('gender', v)} vazio="Selecione" erro={err('applicant.gender')}
                    opcoes={[{ value: 'female', label: 'Feminino' }, { value: 'male', label: 'Masculino' }]} />
                  <Seletor label="Possui CNH" value={form.hasDriverLicense} onChange={(v) => set('hasDriverLicense', v)} vazio="Selecione" erro={err('applicant.hasDriverLicense')}
                    opcoes={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]} />
                  <Campo label="E-mail" erro={err('applicant.email')}>
                    <input aria-label="E-mail" type="email" className={control} value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
                  </Campo>
                  <Campo label="Telefone" erro={err('applicant.phone')}>
                    <input aria-label="Telefone" inputMode="tel" className={control} value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="off" />
                  </Campo>
                  <Seletor label="UF" value={form.state} onChange={(v) => set('state', v)} vazio="Selecione" erro={err('applicant.state')}
                    opcoes={UFS.map((u) => ({ value: u, label: u }))} />
                  <Campo label="Cidade" erro={err('applicant.city')}>
                    <input aria-label="Cidade" className={control} value={form.city} onChange={(e) => set('city', e.target.value)} autoComplete="off" />
                  </Campo>
                </div>
              </Secao>

              <Secao titulo="Veículo">
                <div className="flex gap-1.5" role="group" aria-label="Tipo de veículo">
                  {[['car', 'Carro'], ['motorcycle', 'Moto']].map(([v, l]) => (
                    <button key={v} type="button" aria-pressed={form.type === v} onClick={() => set('type', v)}
                      className={`rounded-control h-8 px-3 text-[12.5px] font-medium border ${form.type === v ? 'border-brand bg-brand/10 text-ink' : 'border-line text-ink2 hover:text-ink'}`}>{l}</button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Seletor label="Marca" value={form.brandCode} onChange={(v) => set('brandCode', v)} vazio="Selecione a marca" erro={err('vehicle.brandCode')}
                    opcoes={catalogo.marcas} carregando={catalogo.carregando === 'marcas'} disabled={naoConfigurado} />
                  <Seletor label="Modelo" value={form.modelCode} onChange={(v) => set('modelCode', v)} vazio={form.brandCode ? 'Selecione o modelo' : 'Escolha a marca primeiro'} erro={err('vehicle.modelCode')}
                    opcoes={catalogo.modelos} carregando={catalogo.carregando === 'modelos'} disabled={!form.brandCode} />
                  <Seletor label="Ano de fabricação" value={String(form.manufactureYear)} onChange={(v) => set('manufactureYear', v ? Number(v) : '')} vazio="Selecione" erro={err('vehicle.manufactureYear')}
                    opcoes={anosFabricacao().map((a) => ({ value: String(a), label: String(a) }))} disabled={!form.modelCode} />
                  <Seletor label="Ano do modelo" value={String(form.modelYear)} onChange={(v) => set('modelYear', v ? Number(v) : '')} vazio="Selecione" erro={err('vehicle.modelYear')}
                    opcoes={anosModelo(form.manufactureYear).map((a) => ({ value: String(a), label: String(a) }))} disabled={!form.manufactureYear} />
                  <Seletor label="Versão" value={form.versionCode} onChange={(v) => set('versionCode', v)} vazio={form.modelYear ? 'Selecione a versão' : 'Escolha modelo e anos primeiro'} erro={err('vehicle.versionCode')}
                    opcoes={catalogo.versoes} carregando={catalogo.carregando === 'versoes'} disabled={!form.modelYear} />
                  <label className="flex items-center gap-2 text-[12.5px] text-ink2 sm:mt-6">
                    <input type="checkbox" checked={form.zeroKm} onChange={(e) => set('zeroKm', e.target.checked)} />Veículo zero km
                  </label>
                </div>
                {catalogo.erro && !naoConfigurado && <p className="text-[12px] text-critical">{catalogo.erro}</p>}
              </Secao>

              <Secao titulo="Negociação">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo label="Valor do veículo" erro={err('terms.assetValue')}>
                    <CurrencyInput label="Valor do veículo" className={control} value={form.assetValue} onChange={(v) => set('assetValue', v)} />
                  </Campo>
                  <Campo label="Entrada" erro={err('terms.downPayment')}>
                    <CurrencyInput label="Entrada" className={control} value={form.downPayment} onChange={(v) => set('downPayment', v)} />
                  </Campo>
                </div>
                <div>
                  <div className="text-[12px] text-ink2 mb-1.5">Parcelas desejadas <span className="text-ink3">(até 12 opções)</span></div>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Parcelas desejadas">
                    {prazos.map((n) => (
                      <button key={n} type="button" aria-pressed={form.installments.includes(n)} onClick={() => togglePrazo(n)}
                        className={`rounded-control h-8 min-w-[44px] px-2.5 text-[12.5px] font-medium border tnum ${form.installments.includes(n) ? 'border-brand bg-brand/10 text-ink' : 'border-line text-ink2 hover:text-ink'}`}>{n}x</button>
                    ))}
                    <span className="flex items-center gap-1">
                      <input aria-label="Outro prazo" inputMode="numeric" placeholder="Outro" className="w-16 bg-surface2 border border-line rounded-control px-2 h-8 text-[12.5px] outline-none focus:border-brand"
                        value={outroPrazo} onChange={(e) => setOutroPrazo(onlyDigits(e.target.value).slice(0, 2))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarPrazo() } }} />
                      <button type="button" aria-label="Adicionar prazo" onClick={adicionarPrazo} className="grid place-items-center h-8 w-8 rounded-control border border-line text-ink2 hover:text-ink"><Plus size={14} /></button>
                    </span>
                  </div>
                  {err('terms.installments') && <span className="block text-[11.5px] text-critical mt-1">{err('terms.installments')}</span>}
                  {form.assetValue > 0 && (
                    <p className="text-[11.5px] text-ink3 mt-1.5">Valor a financiar estimado: {formatBRL(Math.max(0, Number(form.assetValue) - (Number(form.downPayment) || 0)))} (sem tarifas; cada banco informa o seu).</p>
                  )}
                </div>
              </Secao>

              <p className="flex gap-2 text-[11.5px] text-ink3 leading-relaxed">
                <ShieldCheck size={13} className="shrink-0 mt-[1px]" aria-hidden="true" />
                Os dados informados serão utilizados para realizar a simulação de financiamento junto às instituições financeiras habilitadas.
              </p>

              {erroGeral && (
                <div role="alert" className="text-[12.5px] text-critical bg-critical/10 border border-critical/25 rounded-control px-3 py-2">
                  {erroGeral}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={enviando || naoConfigurado}
                  className="bg-brand hover:bg-brandHover text-brandInk rounded-control h-10 px-4 text-[13px] font-semibold transition-colors disabled:opacity-60">
                  {enviando ? 'Enviando aos bancos…' : podeReenviar ? 'Tentar novamente' : 'Simular financiamento'}
                </button>
                {historico.length > 0 && atual && (
                  <button type="button" onClick={() => setModo('resultado')} className="border border-line rounded-control h-10 px-3 text-[12.5px] font-medium text-ink2 hover:text-ink">
                    Ver última simulação
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  )
}
