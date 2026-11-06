// NOVA-OPORTUNIDADE-V2-001 — tela "Nova oportunidade" V2.
// A tela antiga (NovaOportunidadeModal.jsx) não foi alterada e continua
// disponível com ?legacy=1. Esta tela cria a oportunidade mesmo sem os dados
// de financiamento: só a SIMULAÇÃO exige tudo (etapa Financiamento).
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Loader2, ShieldCheck, Info } from 'lucide-react'
import { StageBadge } from './Badge'
import CurrencyInput from './CurrencyInput'
import { createLead, salvarClienteFinanciamento } from '../api'
import { ORIGENS } from './NovaOportunidadeModal'
import { payments, formatBRL } from '../opportunity'
import { formatPhoneInput } from '../formInputs'
import { formatCpf, maskCpf, onlyDigits, UFS } from '../financing'
import { ESTADO_INICIAL_V2, PRAZOS_SUGERIDOS, MAX_PRAZOS, formacao, alternarPrazo, dadosClienteV2, montarCriacaoV2 } from '../novaOportunidadeV2'

const campo = 'w-full bg-surface2 border border-line rounded-control px-3 h-10 text-[13.5px] outline-none focus:border-brand transition-colors'
const label = 'text-[12px] font-medium text-ink2 mb-1.5 block'
const titulo = 'text-micro uppercase font-semibold text-ink3'
const erroCampo = 'block text-[11.5px] text-critical mt-1'

function Escolha({ id, rotulo, value, onChange, opcoes }) {
  return (
    <div>
      <span className={label} id={`${id}-rotulo`}>{rotulo}</span>
      <div role="radiogroup" aria-labelledby={`${id}-rotulo`} className="flex gap-1.5">
        {opcoes.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(value === v ? '' : v)}
            className={`flex-1 rounded-control h-10 px-3 text-[13px] font-medium border transition-colors ${value === v ? 'border-brand bg-brand/10 text-ink' : 'border-line text-ink2 hover:text-ink'}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function NovaOportunidadeV2Modal({ open, usuario, vendedores = [], onClose, onCreated, onAbrirExistente }) {
  const [form, setForm] = useState(ESTADO_INICIAL_V2)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [errosCliente, setErrosCliente] = useState(null)
  const [duplicado, setDuplicado] = useState(null)
  const [criadaSemDados, setCriadaSemDados] = useState(null) // { lead, motivo }
  const [cpfFoco, setCpfFoco] = useState(false)
  const ehGerente = usuario?.papel === 'gerente'
  const responsaveis = [
    ...(ehGerente && usuario.id && usuario.ativo !== false ? [usuario] : []),
    ...vendedores.filter((v) => v.ativo !== false && v.papel === 'vendedor' && v.id !== usuario?.id),
  ]

  useEffect(() => {
    if (open) {
      setForm({ ...ESTADO_INICIAL_V2, ownerId: usuario?.id || '' })
      setErro(null); setErrosCliente(null); setDuplicado(null); setCriadaSemDados(null)
    }
  }, [open, usuario?.id])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v,
    ...(k === 'hasTradeIn' && !v ? { tradeInVehicle: '', tradeInValue: null } : {}),
    ...(k === 'cemPorCento' && v ? { downPayment: 0 } : {}),
    ...(k === 'downPayment' ? { cemPorCento: false } : {}) }))
  const mudar = (k) => (e) => set(k, e.target.value)
  const f = formacao(form)

  const salvar = async (e) => {
    e.preventDefault()
    setErro(null); setDuplicado(null)
    const cliente = dadosClienteV2(form)
    setErrosCliente(cliente.erros)
    let dados
    try {
      if (cliente.erros) throw new Error('Corrija os dados do cliente destacados ou deixe-os em branco.')
      dados = montarCriacaoV2(form, { ehGerente })
    } catch (err) { setErro(err.message); return }
    setSalvando(true)
    try {
      const lead = await createLead(dados)
      if (!Object.keys(cliente.patch).length) { onCreated(lead); return }
      try {
        const completo = await salvarClienteFinanciamento(lead.id, cliente.patch)
        onCreated(completo)
      } catch (err2) {
        // A oportunidade já existe: não some com ela por causa dos dados opcionais.
        setCriadaSemDados({ lead, motivo: err2.message })
      }
    } catch (err) {
      if (err.status === 409 && err.body?.existente) setDuplicado(err.body.existente)
      else setErro(err.message)
    } finally { setSalvando(false) }
  }

  const botaoSec = 'border border-line rounded-control h-10 px-3.5 text-[13px] font-medium text-ink2 hover:text-ink hover:border-lineStrong transition-colors'
  const botaoPri = 'flex items-center gap-1.5 bg-brand hover:bg-brandHover text-brandInk rounded-control h-10 px-4 text-[13px] font-semibold transition-colors disabled:opacity-60'

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/55 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label="Nova oportunidade" data-versao="v2"
            initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }} onClick={(e) => e.stopPropagation()}
            className="bg-surface border border-line rounded-card shadow-pop w-[600px] max-w-full max-h-[90vh] overflow-y-auto">
            <header className="sticky top-0 bg-surface/95 backdrop-blur border-b border-line px-6 py-4 flex items-center justify-between gap-4 z-10">
              <h2 className="text-[17px] font-bold tracking-tight">Nova oportunidade</h2>
              <button onClick={onClose} aria-label="Fechar" className="grid place-items-center w-8 h-8 rounded-control text-ink3 hover:text-ink hover:bg-surface2 transition-colors shrink-0"><X size={17} /></button>
            </header>

            <div className="px-6 py-5">
              {criadaSemDados ? (
                <div className="space-y-4">
                  <div role="alert" className="flex items-start gap-2 text-[12.5px] text-ink bg-surface2 border border-lineStrong rounded-control px-3 py-2.5">
                    <AlertTriangle size={14} className="shrink-0 mt-px" />
                    <span>A oportunidade foi criada, mas os dados de financiamento do cliente não foram salvos ({criadaSemDados.motivo}). Complete-os depois em Financiamento.</span>
                  </div>
                  <div className="flex justify-end"><button type="button" className={botaoPri} onClick={() => onCreated(criadaSemDados.lead)}>Continuar</button></div>
                </div>
              ) : duplicado ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 text-[12.5px] text-critical bg-critical/10 border border-critical/25 rounded-control px-3 py-2.5">
                    <AlertTriangle size={14} className="shrink-0 mt-px" /><span>Já existe um registro com este telefone.</span>
                  </div>
                  <div className="border border-line rounded-control p-3.5 space-y-2">
                    <div className="text-[13.5px] font-medium">{duplicado.name || 'Sem nome'}</div>
                    <div className="text-[12.5px] text-ink2">Responsável: {duplicado.ownerName || 'Sem responsável'}</div>
                    <div className="flex items-center gap-2"><span className="text-[12px] text-ink3">Estágio:</span><StageBadge stage={duplicado.stage} /></div>
                  </div>
                  <div className="flex items-center justify-end gap-2.5">
                    <button type="button" onClick={() => setDuplicado(null)} className={botaoSec}>Voltar</button>
                    <button type="button" onClick={() => onAbrirExistente(duplicado)} className={botaoPri}>Abrir registro existente</button>
                  </div>
                </div>
              ) : (
                <form noValidate onSubmit={salvar} className="space-y-5">
                  {erro && (
                    <div role="alert" className="flex items-start gap-2 text-[12.5px] text-critical bg-critical/10 border border-critical/25 rounded-control px-3 py-2.5">
                      <AlertTriangle size={14} className="shrink-0 mt-px" /><span>{erro}</span>
                    </div>
                  )}

                  {/* CLIENTE */}
                  <section className="space-y-3" aria-labelledby="v2-cliente">
                    <h3 id="v2-cliente" className={titulo}>Cliente</h3>
                    <div><label className={label} htmlFor="v2-nome">Nome *</label>
                      <input id="v2-nome" value={form.name} onChange={mudar('name')} className={campo} placeholder="Nome do cliente" /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><label className={label} htmlFor="v2-telefone">Telefone *</label>
                        <input id="v2-telefone" type="tel" value={formatPhoneInput(form.phone)} onChange={mudar('phone')} className={campo} placeholder="(43) 99999-9999" /></div>
                      <div><label className={label} htmlFor="v2-email">E-mail</label>
                        <input id="v2-email" type="email" value={form.email} onChange={mudar('email')} className={campo} placeholder="opcional" /></div>
                    </div>
                    <p className="flex gap-1.5 text-[11.5px] text-ink3"><Info size={13} className="shrink-0 mt-px" aria-hidden="true" />
                      Dados para financiamento: opcionais agora, exigidos só na simulação.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><label className={label} htmlFor="v2-cpf">CPF</label>
                        <input id="v2-cpf" inputMode="numeric" autoComplete="off" className={campo} placeholder="000.000.000-00"
                          value={cpfFoco ? formatCpf(form.cpf) : maskCpf(form.cpf)} onFocus={() => setCpfFoco(true)} onBlur={() => setCpfFoco(false)}
                          onChange={(e) => set('cpf', onlyDigits(e.target.value).slice(0, 11))} />
                        {errosCliente?.cpf && <span className={erroCampo}>{errosCliente.cpf}</span>}</div>
                      <div><label className={label} htmlFor="v2-nascimento">Nascimento</label>
                        <input id="v2-nascimento" type="date" className={campo} value={form.birthDate} onChange={mudar('birthDate')} />
                        {errosCliente?.birthDate && <span className={erroCampo}>{errosCliente.birthDate}</span>}</div>
                      <Escolha id="v2-sexo" rotulo="Sexo" value={form.gender} onChange={(v) => set('gender', v)} opcoes={[['male', 'Masculino'], ['female', 'Feminino']]} />
                      <Escolha id="v2-cnh" rotulo="Possui CNH?" value={form.hasDriverLicense} onChange={(v) => set('hasDriverLicense', v)} opcoes={[['sim', 'Sim'], ['nao', 'Não']]} />
                      <div><label className={label} htmlFor="v2-cidade">Cidade</label>
                        <input id="v2-cidade" className={campo} value={form.city} onChange={mudar('city')} autoComplete="off" />
                        {errosCliente?.city && <span className={erroCampo}>{errosCliente.city}</span>}</div>
                      <div><label className={label} htmlFor="v2-uf">UF</label>
                        <select id="v2-uf" className={`${campo} pr-8`} value={form.state} onChange={mudar('state')}>
                          <option value="">Selecione…</option>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select></div>
                    </div>
                  </section>

                  {/* NEGÓCIO */}
                  <section className="space-y-3" aria-labelledby="v2-negocio">
                    <h3 id="v2-negocio" className={titulo}>Negócio</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><label className={label} htmlFor="v2-origem">Origem *</label>
                        <select id="v2-origem" value={form.origin} onChange={mudar('origin')} className={`${campo} pr-8`}>
                          <option value="" disabled>Selecione…</option>{ORIGENS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select></div>
                      <div><label className={label} htmlFor="v2-veiculo">Veículo de interesse *</label>
                        <input id="v2-veiculo" value={form.vehicleInterest} onChange={mudar('vehicleInterest')} className={campo} placeholder="Ex.: Vectra 2.2" /></div>
                    </div>
                  </section>

                  {/* FORMAÇÃO DO NEGÓCIO */}
                  <section className="space-y-3" aria-labelledby="v2-formacao">
                    <h3 id="v2-formacao" className={titulo}>Formação do negócio</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div><span className={label}>Valor do bem</span>
                        <CurrencyInput label="Valor do bem" className={campo} value={form.assetValue} onChange={(v) => set('assetValue', v)} /></div>
                      <div><span className={label}>Entrada</span>
                        <CurrencyInput label="Entrada" className={campo} value={form.cemPorCento ? 0 : form.downPayment} onChange={(v) => set('downPayment', v)} /></div>
                      <div><span className={label} id="v2-financiar-rotulo">Valor a financiar</span>
                        <output aria-labelledby="v2-financiar-rotulo" data-testid="valor-a-financiar"
                          className="flex items-center w-full bg-surface border border-dashed border-line rounded-control px-3 h-10 text-[13.5px] font-semibold tnum">
                          {f.financiar != null ? formatBRL(f.financiar) : '—'}
                        </output></div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-[12.5px] text-ink2 cursor-pointer">
                      <input type="checkbox" checked={form.cemPorCento} onChange={(e) => set('cemPorCento', e.target.checked)} />100% financiado (entrada zero)
                    </label>
                    {f.erro && <p role="status" className="text-[12px] text-critical">{f.erro}</p>}
                    <div>
                      <span className={label} id="v2-prazos-rotulo">Prazos ({form.installmentOptions.length} de até {MAX_PRAZOS})</span>
                      <div role="group" aria-labelledby="v2-prazos-rotulo" className="flex flex-wrap gap-1.5">
                        {PRAZOS_SUGERIDOS.map((p) => {
                          const on = form.installmentOptions.includes(p)
                          return <button key={p} type="button" aria-pressed={on} onClick={() => set('installmentOptions', alternarPrazo(form.installmentOptions, p))}
                            className={`rounded-full border px-3 h-8 text-[12.5px] font-medium tnum ${on ? 'border-brand bg-brand/10 text-ink' : 'border-line text-ink2 hover:text-ink'}`}>{p}x</button>
                        })}
                      </div>
                    </div>
                  </section>

                  {/* TROCA */}
                  <section className="space-y-3" aria-labelledby="v2-troca">
                    <h3 id="v2-troca" className={titulo}>Troca</h3>
                    <Escolha id="v2-tem-troca" rotulo="Tem veículo na troca?" value={form.hasTradeIn ? 'sim' : 'nao'} onChange={(v) => set('hasTradeIn', v === 'sim')} opcoes={[['sim', 'Sim'], ['nao', 'Não']]} />
                    {form.hasTradeIn && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className={label} htmlFor="v2-troca-veiculo">Veículo na troca</label>
                          <input id="v2-troca-veiculo" className={campo} value={form.tradeInVehicle} onChange={mudar('tradeInVehicle')} /></div>
                        <div><span className={label}>Valor da troca</span>
                          <CurrencyInput label="Valor da troca" className={campo} value={form.tradeInValue} onChange={(v) => set('tradeInValue', v)} /></div>
                      </div>
                    )}
                  </section>

                  {/* PAGAMENTO */}
                  <section className="space-y-3" aria-labelledby="v2-pagamento">
                    <h3 id="v2-pagamento" className={titulo}>Pagamento</h3>
                    <div><label className={label} htmlFor="v2-composicao">Composição do pagamento</label>
                      <select id="v2-composicao" className={`${campo} pr-8`} value={form.paymentComposition} onChange={mudar('paymentComposition')}>
                        <option value="">Não informado</option>{Object.entries(payments).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                      </select></div>
                  </section>

                  {/* OBSERVAÇÕES */}
                  <section className="space-y-3" aria-labelledby="v2-obs">
                    <h3 id="v2-obs" className={titulo}>Observações</h3>
                    <textarea aria-labelledby="v2-obs" rows={3} className="w-full bg-surface2 border border-line rounded-control px-3 py-2 text-[13.5px] outline-none focus:border-brand"
                      value={form.notes} onChange={mudar('notes')} />
                  </section>

                  {/* RESPONSÁVEL */}
                  <div>
                    <label className={label} htmlFor="v2-responsavel">Responsável comercial</label>
                    {ehGerente ? (
                      <select id="v2-responsavel" value={form.ownerId} onChange={mudar('ownerId')} className={`${campo} pr-8`}>
                        <option value="" disabled>Selecione um responsável…</option>{responsaveis.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                      </select>
                    ) : <input id="v2-responsavel" value={usuario?.nome || ''} disabled className={`${campo} opacity-70`} />}
                  </div>

                  <p className="flex gap-2 text-[11.5px] text-ink3"><ShieldCheck size={13} className="shrink-0 mt-px" aria-hidden="true" />
                    O CPF fica protegido: depois de salvo, aparece sempre mascarado.</p>

                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button type="button" onClick={onClose} className={botaoSec}>Cancelar</button>
                    <button type="submit" disabled={salvando} className={botaoPri}>{salvando && <Loader2 size={14} className="animate-spin" />}Criar oportunidade</button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
