// NOVA-OPORTUNIDADE-V2-001 — tela "Nova oportunidade" V2, conforme a
// referência visual aprovada pelo CTO (06/11/2026), com os tokens do CRM.
// A tela antiga (NovaOportunidadeModal.jsx) não foi alterada e continua
// disponível com ?legacy=1. Os dados de financiamento do cliente NÃO impedem
// a criação: só a SIMULAÇÃO os exige (etapa Financiamento).
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, AlertTriangle, Loader2, Info, Check, Plus, User, Phone, Mail, Contact, Calendar, MapPin, Car,
  Handshake, Coins, ArrowLeftRight, CreditCard, MessageSquareText, BriefcaseBusiness, Users, Square,
} from 'lucide-react'
import { StageBadge } from './Badge'
import CurrencyInput from './CurrencyInput'
import { createLead, salvarClienteFinanciamento } from '../api'
import { ORIGENS } from './NovaOportunidadeModal'
import { payments, formatBRL } from '../opportunity'
import { formatPhoneInput } from '../formInputs'
import { formatCpf, maskCpf, onlyDigits, UFS } from '../financing'
import { ESTADO_INICIAL_V2, PRAZOS_V2, formacao, alternarPrazo, dadosClienteV2, montarCriacaoV2 } from '../novaOportunidadeV2'

const campo = 'w-full bg-surface border border-lineStrong rounded-control h-10 text-[13.5px] text-ink outline-none focus:border-brand transition-colors placeholder:text-ink3'
const comIcone = `${campo} pl-9 pr-3`
const semIcone = `${campo} px-3`
const rotulo = 'text-[12.5px] font-medium text-ink2 mb-1.5 block'
const obrig = <span className="text-critical" aria-hidden="true"> *</span>
const erroCampo = 'block text-[11.5px] text-critical mt-1'

function Icone({ icon: I, children }) {
  return (
    <div className="relative">
      <I size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none" aria-hidden="true" />
      {children}
    </div>
  )
}

function Cartao({ id, icon: I, titulo, children, className = '' }) {
  return (
    <section aria-labelledby={id} className={`border border-line rounded-card bg-surface px-5 py-4 space-y-3 min-w-0 ${className}`}>
      <h3 id={id} className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight text-ink">
        <I size={22} strokeWidth={1.75} className="text-ink2 shrink-0" aria-hidden="true" />{titulo}
      </h3>
      {children}
    </section>
  )
}

function Radios({ id, titulo, name, value, onChange, opcoes, className = '' }) {
  return (
    <div className={className}>
      <span className={rotulo} id={`${id}-rotulo`}>{titulo}</span>
      <div role="radiogroup" aria-labelledby={`${id}-rotulo`} className="flex items-center gap-5 h-10">
        {opcoes.map(([v, l]) => (
          <label key={v} className="inline-flex items-center gap-2 text-[14px] text-ink cursor-pointer">
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="w-[18px] h-[18px] accent-brand" />{l}
          </label>
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
        onCreated(await salvarClienteFinanciamento(lead.id, cliente.patch))
      } catch (err2) {
        // A oportunidade já existe: não some com ela por causa dos dados opcionais.
        setCriadaSemDados({ lead, motivo: err2.message })
      }
    } catch (err) {
      if (err.status === 409 && err.body?.existente) setDuplicado(err.body.existente)
      else setErro(err.message)
    } finally { setSalvando(false) }
  }

  const botaoSec = 'border border-lineStrong rounded-control h-11 px-4 sm:px-6 text-[14px] font-semibold text-ink hover:bg-surface2 transition-colors whitespace-nowrap'
  const botaoPri = 'flex items-center gap-2 bg-brand hover:bg-brandHover text-brandInk rounded-control h-11 px-4 sm:px-6 text-[14px] font-semibold transition-colors disabled:opacity-60 whitespace-nowrap'

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/55 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="v2-titulo" data-versao="v2"
            initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }} onClick={(e) => e.stopPropagation()}
            className="bg-plane border border-line rounded-card shadow-pop w-[1180px] max-w-full max-h-[92vh] flex flex-col overflow-hidden">
            <header className="bg-ink text-surface px-5 sm:px-7 py-3.5 flex items-center gap-4 sm:gap-6 shrink-0">
              <div className="hidden sm:flex items-center gap-2.5 pr-6 border-r border-surface/40 self-stretch">
                <span className="grid place-items-center w-9 h-9 rounded-control bg-brand text-brandInk text-[13px] font-extrabold">VT</span>
                <span className="text-[19px] font-extrabold italic tracking-tight whitespace-nowrap">VT Car CRM</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="v2-titulo" className="text-[20px] sm:text-[24px] font-bold tracking-tight leading-tight">Nova oportunidade</h2>
                <p className="text-[13px] sm:text-[15px] text-surface/85 leading-snug">Cadastre os dados do cliente, do veículo e do financiamento.</p>
              </div>
              <button onClick={onClose} aria-label="Fechar" className="grid place-items-center w-9 h-9 rounded-control text-surface/90 hover:bg-surface/10 transition-colors shrink-0"><X size={24} /></button>
            </header>

            <div className="overflow-y-auto px-3 sm:px-5 py-4 flex-1 min-h-0">
              {criadaSemDados ? (
                <div className="space-y-4 p-2">
                  <div role="alert" className="flex items-start gap-2 text-[13px] text-ink bg-surface border border-lineStrong rounded-control px-3 py-2.5">
                    <AlertTriangle size={15} className="shrink-0 mt-px" />
                    <span>A oportunidade foi criada, mas os dados de financiamento do cliente não foram salvos ({criadaSemDados.motivo}). Complete-os depois em Financiamento.</span>
                  </div>
                  <div className="flex justify-end"><button type="button" className={botaoPri} onClick={() => onCreated(criadaSemDados.lead)}>Continuar</button></div>
                </div>
              ) : duplicado ? (
                <div className="space-y-4 p-2 max-w-[560px]">
                  <div className="flex items-start gap-2 text-[13px] text-critical bg-critical/10 border border-critical/25 rounded-control px-3 py-2.5">
                    <AlertTriangle size={15} className="shrink-0 mt-px" /><span>Já existe um registro com este telefone.</span>
                  </div>
                  <div className="border border-line bg-surface rounded-control p-3.5 space-y-2">
                    <div className="text-[14px] font-medium">{duplicado.name || 'Sem nome'}</div>
                    <div className="text-[13px] text-ink2">Responsável: {duplicado.ownerName || 'Sem responsável'}</div>
                    <div className="flex items-center gap-2"><span className="text-[12.5px] text-ink3">Estágio:</span><StageBadge stage={duplicado.stage} /></div>
                  </div>
                  <div className="flex items-center justify-end gap-2.5">
                    <button type="button" onClick={() => setDuplicado(null)} className={botaoSec}>Voltar</button>
                    <button type="button" onClick={() => onAbrirExistente(duplicado)} className={botaoPri}>Abrir registro existente</button>
                  </div>
                </div>
              ) : (
                <form id="v2-form" noValidate onSubmit={salvar} className="space-y-3">
                  {erro && (
                    <div role="alert" className="flex items-start gap-2 text-[13px] text-critical bg-critical/10 border border-critical/25 rounded-control px-3 py-2.5">
                      <AlertTriangle size={15} className="shrink-0 mt-px" /><span>{erro}</span>
                    </div>
                  )}

                  {/* CLIENTE */}
                  <Cartao id="v2-cliente" icon={User} titulo="Cliente">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.45fr_1fr_1.15fr] gap-x-5 gap-y-3">
                      <div><label className={rotulo} htmlFor="v2-nome">Nome{obrig}</label>
                        <Icone icon={User}><input id="v2-nome" value={form.name} onChange={mudar('name')} className={comIcone} placeholder="Nome do cliente" /></Icone></div>
                      <div><label className={rotulo} htmlFor="v2-telefone">Telefone{obrig}</label>
                        <Icone icon={Phone}><input id="v2-telefone" type="tel" value={formatPhoneInput(form.phone)} onChange={mudar('phone')} className={comIcone} placeholder="(43) 99999-9999" /></Icone></div>
                      <div className="sm:col-span-2 lg:col-span-1"><label className={rotulo} htmlFor="v2-email">E-mail</label>
                        <Icone icon={Mail}><input id="v2-email" type="email" value={form.email} onChange={mudar('email')} className={comIcone} placeholder="email@exemplo.com" /></Icone></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.05fr_0.85fr_0.95fr_0.95fr_1.05fr_0.55fr] gap-x-5 gap-y-3">
                      <div><label className={rotulo} htmlFor="v2-cpf">CPF</label>
                        <Icone icon={Contact}><input id="v2-cpf" inputMode="numeric" autoComplete="off" className={comIcone} placeholder="000.000.000-00"
                          value={cpfFoco ? formatCpf(form.cpf) : maskCpf(form.cpf)} onFocus={() => setCpfFoco(true)} onBlur={() => setCpfFoco(false)}
                          onChange={(e) => set('cpf', onlyDigits(e.target.value).slice(0, 11))} /></Icone>
                        {errosCliente?.cpf && <span className={erroCampo}>{errosCliente.cpf}</span>}</div>
                      <div><label className={rotulo} htmlFor="v2-nascimento">Nascimento</label>
                        <Icone icon={Calendar}><input id="v2-nascimento" type="date" className={comIcone} value={form.birthDate} onChange={mudar('birthDate')} /></Icone>
                        {errosCliente?.birthDate && <span className={erroCampo}>{errosCliente.birthDate}</span>}</div>
                      <div><label className={rotulo} htmlFor="v2-sexo">Sexo</label>
                        <Icone icon={Users}><select id="v2-sexo" className={`${comIcone} pr-8`} value={form.gender} onChange={mudar('gender')}>
                          <option value="">Selecione</option><option value="male">Masculino</option><option value="female">Feminino</option>
                        </select></Icone></div>
                      <Radios id="v2-cnh" titulo="Possui CNH?" name="v2-cnh" value={form.hasDriverLicense} onChange={(v) => set('hasDriverLicense', v)} opcoes={[['sim', 'Sim'], ['nao', 'Não']]} />
                      <div><label className={rotulo} htmlFor="v2-cidade">Cidade</label>
                        <Icone icon={MapPin}><input id="v2-cidade" className={comIcone} value={form.city} onChange={mudar('city')} autoComplete="off" /></Icone>
                        {errosCliente?.city && <span className={erroCampo}>{errosCliente.city}</span>}</div>
                      <div><label className={rotulo} htmlFor="v2-uf">UF</label>
                        <select id="v2-uf" className={`${semIcone} pr-7`} value={form.state} onChange={mudar('state')}>
                          <option value="">UF</option>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select></div>
                    </div>
                  </Cartao>

                  {/* NEGÓCIO */}
                  <Cartao id="v2-negocio" icon={Handshake} titulo="Negócio">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_0.95fr] gap-x-5 gap-y-3 items-end">
                      <div><label className={rotulo} htmlFor="v2-origem">Origem{obrig}</label>
                        <Icone icon={Users}><select id="v2-origem" value={form.origin} onChange={mudar('origin')} className={`${comIcone} pr-8`}>
                          <option value="" disabled>Selecione…</option>{ORIGENS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select></Icone></div>
                      <div><label className={rotulo} htmlFor="v2-veiculo">Veículo de interesse{obrig}</label>
                        <Icone icon={Car}><input id="v2-veiculo" value={form.vehicleInterest} onChange={mudar('vehicleInterest')} className={comIcone} placeholder="Ex.: Vectra 2.2" /></Icone></div>
                      <p className="flex gap-2.5 items-start text-[13px] leading-snug text-ink2 bg-stage1/15 border border-stage1/30 rounded-control px-3 py-2.5">
                        <Info size={20} className="shrink-0 text-stage1 fill-stage1/25" aria-hidden="true" />
                        O veículo exato (marca, modelo, versão e anos) será confirmado na etapa da simulação.
                      </p>
                    </div>
                  </Cartao>

                  {/* FORMAÇÃO DO NEGÓCIO */}
                  <Cartao id="v2-formacao" icon={Coins} titulo="Formação do negócio">
                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-[1fr_0.9fr_0.9fr_0.95fr] gap-x-5 gap-y-3 items-end">
                      <div><span className={rotulo}>Valor do bem{obrig}</span>
                        <CurrencyInput label="Valor do bem" className={semIcone} value={form.assetValue} onChange={(v) => set('assetValue', v)} /></div>
                      <div><span className={rotulo}>Entrada</span>
                        <CurrencyInput label="Entrada" className={semIcone} value={form.cemPorCento ? 0 : form.downPayment} onChange={(v) => set('downPayment', v)} /></div>
                      <div><span className={rotulo} id="v2-financiar-rotulo">Valor a financiar</span>
                        <output aria-labelledby="v2-financiar-rotulo" data-testid="valor-a-financiar"
                          className="flex items-center w-full bg-surface3 border border-line rounded-control px-3 h-10 text-[13.5px] text-ink2 tnum">
                          {f.financiar != null ? formatBRL(f.financiar) : 'R$ 0,00'}
                        </output></div>
                      <button type="button" aria-pressed={form.cemPorCento} onClick={() => set('cemPorCento', !form.cemPorCento)}
                        className={`flex items-center gap-3 rounded-control border px-4 h-[52px] text-left transition-colors ${form.cemPorCento ? 'border-brand bg-brand/10' : 'border-lineStrong bg-surface hover:bg-surface2'}`}>
                        <span className={`grid place-items-center w-6 h-6 rounded-full shrink-0 ${form.cemPorCento ? 'bg-brand text-brandInk' : 'border-2 border-lineStrong'}`} aria-hidden="true">
                          {form.cemPorCento && <Check size={15} strokeWidth={3} />}
                        </span>
                        <span className="leading-tight"><span className={`block text-[14px] font-semibold ${form.cemPorCento ? 'text-brand' : 'text-ink'}`}>100% financiado</span>
                          <span className="block text-[13px] text-ink2">(entrada R$ 0,00)</span></span>
                      </button>
                    </div>
                    {f.erro && <p className="text-[12.5px] text-critical">{f.erro}</p>}
                    <div>
                      <span className={`${rotulo} text-ink`} id="v2-prazos-rotulo"><span className="font-semibold">Prazos para simulação</span> <span className="text-ink2">(selecione um ou mais)</span></span>
                      <div role="group" aria-labelledby="v2-prazos-rotulo" className="flex flex-wrap gap-2.5">
                        {PRAZOS_V2.map((p) => {
                          const on = form.installmentOptions.includes(p)
                          return (
                            <button key={p} type="button" aria-pressed={on} aria-label={`${p}x`} onClick={() => set('installmentOptions', alternarPrazo(form.installmentOptions, p))}
                              className={`flex items-center justify-center gap-2.5 min-w-[104px] h-10 px-4 rounded-control border text-[16px] font-bold tnum transition-colors ${on ? 'border-brand bg-brand/10 text-brand' : 'border-lineStrong bg-surface text-ink2 hover:text-ink'}`}>
                              {on ? <Check size={18} strokeWidth={3} aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}{p}x
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </Cartao>

                  {/* TROCA + PAGAMENTO */}
                  <div className="grid grid-cols-1 lg:grid-cols-[0.73fr_1fr] gap-3">
                    <Cartao id="v2-troca" icon={ArrowLeftRight} titulo="Troca">
                      <Radios id="v2-tem-troca" titulo="Tem veículo na troca?" name="v2-troca" value={form.hasTradeIn ? 'sim' : 'nao'} onChange={(v) => set('hasTradeIn', v === 'sim')} opcoes={[['nao', 'Não'], ['sim', 'Sim']]} />
                      {form.hasTradeIn && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div><label className={rotulo} htmlFor="v2-troca-veiculo">Veículo na troca</label>
                            <input id="v2-troca-veiculo" className={semIcone} value={form.tradeInVehicle} onChange={mudar('tradeInVehicle')} /></div>
                          <div><span className={rotulo}>Valor da troca</span>
                            <CurrencyInput label="Valor da troca" className={semIcone} value={form.tradeInValue} onChange={(v) => set('tradeInValue', v)} /></div>
                        </div>
                      )}
                    </Cartao>
                    <Cartao id="v2-pagamento" icon={CreditCard} titulo="Pagamento">
                      <div className="max-w-[372px]"><label className={rotulo} htmlFor="v2-composicao">Composição do pagamento</label>
                        <select id="v2-composicao" className={`${semIcone} pr-8`} value={form.paymentComposition} onChange={mudar('paymentComposition')}>
                          <option value="">Não informado</option>{Object.entries(payments).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                        </select></div>
                    </Cartao>
                  </div>

                  {/* OBSERVAÇÕES */}
                  <Cartao id="v2-obs" icon={MessageSquareText} titulo="Observações">
                    <textarea aria-labelledby="v2-obs" rows={2} className="w-full bg-surface border border-lineStrong rounded-control px-3 py-2.5 text-[14px] outline-none focus:border-brand resize-y"
                      value={form.notes} onChange={mudar('notes')} />
                  </Cartao>

                  {/* RESPONSÁVEL */}
                  <Cartao id="v2-responsavel-titulo" icon={BriefcaseBusiness} titulo="Responsável comercial">
                    <div className="max-w-[640px]">
                      <Icone icon={User}>
                        {ehGerente ? (
                          <select aria-labelledby="v2-responsavel-titulo" value={form.ownerId} onChange={mudar('ownerId')} className={`${comIcone} pr-8`}>
                            <option value="" disabled>Selecione um responsável…</option>{responsaveis.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                          </select>
                        ) : <input aria-labelledby="v2-responsavel-titulo" value={usuario?.nome || ''} disabled className={`${comIcone} opacity-80`} />}
                      </Icone>
                    </div>
                  </Cartao>

                  {/* REQUISITOS DA SIMULAÇÃO (informativo) */}
                  <aside aria-label="Requisitos da Zinix" className="flex items-start gap-3 rounded-card border border-stage1/35 bg-stage1/15 px-5 py-3.5">
                    <Info size={24} className="shrink-0 text-stage1 fill-stage1/25 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-ink">Importante – Requisitos da Zinix</p>
                      <p className="text-[13px] text-ink2 leading-snug">
                        Para liberar a simulação, o CRM utiliza: Nome, CPF, Nascimento, Sexo, E-mail, Telefone, Cidade/UF, CNH, dados do veículo (identificado na simulação),
                        Valor do bem, Entrada e Prazos. Esses dados podem ser completados depois: não impedem criar a oportunidade.
                      </p>
                    </div>
                  </aside>
                </form>
              )}
            </div>

            {!criadaSemDados && !duplicado && (
              <footer className="shrink-0 border-t border-line bg-surface px-5 sm:px-7 py-3.5 flex items-center justify-end gap-3">
                <button type="button" onClick={onClose} className={botaoSec}>Cancelar</button>
                <button type="submit" form="v2-form" disabled={salvando} className={botaoPri}>
                  {salvando ? <Loader2 size={17} className="animate-spin" /> : <Plus size={18} strokeWidth={2.5} />}Criar oportunidade
                </button>
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
