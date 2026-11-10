// NOVA-OPORTUNIDADE-V2-001 — tela "Nova oportunidade" V2, conforme a
// referência visual aprovada pelo CTO (06/11/2026), com os tokens do CRM.
// A tela antiga (NovaOportunidadeModal.jsx) não foi alterada e continua
// disponível com ?legacy=1. Os dados de financiamento do cliente NÃO impedem
// a criação: só a SIMULAÇÃO os exige (etapa Financiamento).
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, AlertTriangle, Loader2, Check, Plus, User, Phone, Mail, Contact, Calendar, MapPin, Car,
  Handshake, Coins, ArrowLeftRight, CreditCard, MessageSquareText, BriefcaseBusiness, Users, Square, ChevronDown, ShieldCheck, Megaphone,
} from 'lucide-react'
import { StageBadge } from './Badge'
import CurrencyInput from './CurrencyInput'
import DataBR from './DataBR'
import { createLead, salvarClienteFinanciamento } from '../api'
import { ORIGENS } from './NovaOportunidadeModal'
import { payments, formatBRL } from '../opportunity'
import { formatPhoneInput } from '../formInputs'
import { formatCpf, maskCpf, onlyDigits, UFS } from '../financing'
import { ESTADO_INICIAL_V2, PRAZOS_V2, formacao, alternarPrazo, dadosClienteV2, montarCriacaoV2 } from '../novaOportunidadeV2'

// FINALIZAÇÃO V2 — acabamento visual (só classes; campos, regras e payloads intactos).
// Cores da tela vêm dos tokens .v2-tema (index.css): azul institucional + vermelho VT Car.
const campo = 'w-full bg-surface border border-[rgb(var(--v2-campo))] rounded-[9px] h-11 text-[14px] text-ink outline-none shadow-[0_1px_1px_rgb(15_23_42/0.04)] hover:border-[rgb(var(--v2-icone)/0.6)] focus:border-brand focus:ring-2 focus:ring-brand/15 transition placeholder:text-ink3'
const comIcone = `${campo} pl-10 pr-3`
const semIcone = `${campo} px-3.5`
const lista = 'appearance-none cursor-pointer pr-9'
const rotulo = 'text-[13px] font-semibold text-[rgb(var(--v2-rotulo))] mb-1.5 block'
const obrig = <span className="text-brand" aria-hidden="true"> *</span>
const erroCampo = 'block text-[11.5px] text-critical mt-1'

function Icone({ icon: I, seta = false, children }) {
  return (
    <div className="relative">
      {I && <I size={17} strokeWidth={1.8} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--v2-icone))] pointer-events-none" aria-hidden="true" />}
      {children}
      {seta && <ChevronDown size={17} strokeWidth={2} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--v2-icone))] pointer-events-none" aria-hidden="true" />}
    </div>
  )
}

function Cartao({ id, icon: I, titulo, children, className = '' }) {
  return (
    <section aria-labelledby={id}
      className={`rounded-[12px] border border-[rgb(var(--v2-borda))] bg-gradient-to-b from-surface to-[rgb(var(--v2-card))] shadow-[0_1px_2px_rgb(15_23_42/0.05),0_4px_12px_-8px_rgb(15_23_42/0.10)] px-4 sm:px-6 pt-4 pb-5 space-y-3.5 min-w-0 ${className}`}>
      <h3 id={id} className="flex items-center gap-3 text-[18px] font-bold tracking-tight text-[rgb(var(--v2-navy))]">
        <I size={26} strokeWidth={1.7} className="shrink-0" aria-hidden="true" />{titulo}
      </h3>
      {children}
    </section>
  )
}

const radio = 'appearance-none shrink-0 w-5 h-5 rounded-full border-2 border-[rgb(var(--v2-campo))] bg-surface cursor-pointer transition '
  + 'checked:border-brand checked:bg-brand checked:shadow-[inset_0_0_0_3px_rgb(var(--surface))] focus-visible:ring-2 focus-visible:ring-brand/30 outline-none'

function Radios({ id, titulo, name, value, onChange, opcoes, className = '' }) {
  return (
    <div className={className}>
      <span className={rotulo} id={`${id}-rotulo`}>{titulo}</span>
      <div role="radiogroup" aria-labelledby={`${id}-rotulo`} className="flex items-center gap-6 h-11">
        {opcoes.map(([v, l]) => (
          <label key={v} className={`inline-flex items-center gap-2.5 text-[14.5px] cursor-pointer ${value === v ? 'text-ink font-semibold' : 'text-ink2'}`}>
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className={radio} />{l}
          </label>
        ))}
      </div>
    </div>
  )
}

function Aviso({ children, className = '' }) {
  return (
    <p className={`flex gap-3 items-start text-[13px] leading-snug text-[rgb(var(--v2-rotulo))] bg-gradient-to-r from-[rgb(var(--v2-info))] to-[rgb(var(--v2-info)/0.55)] border border-[rgb(var(--v2-info-borda))] rounded-[10px] px-3.5 py-3 ${className}`}>
      <span className="grid place-items-center w-6 h-6 rounded-full bg-[rgb(var(--v2-azul))] text-white text-[13px] font-bold font-serif shrink-0" aria-hidden="true">i</span>
      <span>{children}</span>
    </p>
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

  const botaoSec = 'border border-[rgb(var(--v2-campo))] bg-surface rounded-[10px] h-12 px-5 sm:px-8 text-[15px] font-semibold text-[rgb(var(--v2-navy))] hover:bg-surface2 transition-colors whitespace-nowrap'
  const botaoPri = 'flex items-center gap-2 bg-brand hover:bg-brandHover text-brandInk rounded-[10px] h-12 px-5 sm:px-8 text-[15px] font-semibold shadow-[0_8px_18px_-10px_rgb(var(--brand)/0.9)] transition-colors disabled:opacity-60 whitespace-nowrap'

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/55 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="v2-titulo" data-versao="v2"
            initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }} onClick={(e) => e.stopPropagation()}
            className="v2-tema bg-[rgb(var(--v2-fundo))] border border-[rgb(var(--v2-borda))] rounded-[16px] shadow-pop w-[1180px] max-w-full max-h-[94vh] flex flex-col overflow-hidden">
            <header className="relative bg-gradient-to-r from-[#071c40] via-[#0b2856] to-[#12387a] text-white px-5 sm:px-7 py-4 flex items-center gap-4 sm:gap-6 shrink-0">
              <div className="hidden sm:flex items-center gap-3 pr-6 border-r border-white/25 self-stretch">
                <span className="grid place-items-center w-10 h-10 rounded-[10px] bg-gradient-to-b from-[#e3283a] to-[#b51624] text-white text-[14px] font-extrabold shadow-[0_4px_10px_-4px_rgb(0_0_0/0.5)]">VT</span>
                <span className="text-[21px] font-extrabold italic tracking-tight whitespace-nowrap">VT Car <span className="text-white/85">CRM</span></span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="v2-titulo" className="text-[20px] sm:text-[25px] font-bold tracking-tight leading-tight">Nova oportunidade</h2>
                <p className="text-[13px] sm:text-[15px] text-white/80 leading-snug">Cadastre os dados do cliente, do veículo e do financiamento.</p>
              </div>
              <button onClick={onClose} aria-label="Fechar" className="grid place-items-center w-10 h-10 rounded-[10px] text-white/90 hover:bg-white/10 transition-colors shrink-0"><X size={24} /></button>
              <span className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-brand via-brand/70 to-transparent" aria-hidden="true" />
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
                <form id="v2-form" noValidate onSubmit={salvar} className="space-y-3.5">
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
                        <Icone icon={Calendar}><DataBR id="v2-nascimento" className={comIcone} value={form.birthDate} onChange={(v) => set('birthDate', v)} /></Icone>
                        {errosCliente?.birthDate && <span className={erroCampo}>{errosCliente.birthDate}</span>}</div>
                      <div><label className={rotulo} htmlFor="v2-sexo">Sexo</label>
                        <Icone icon={Users} seta><select id="v2-sexo" className={`${comIcone} ${lista}`} value={form.gender} onChange={mudar('gender')}>
                          <option value="">Selecione</option><option value="male">Masculino</option><option value="female">Feminino</option>
                        </select></Icone></div>
                      <Radios id="v2-cnh" titulo="Possui CNH?" name="v2-cnh" value={form.hasDriverLicense} onChange={(v) => set('hasDriverLicense', v)} opcoes={[['sim', 'Sim'], ['nao', 'Não']]} />
                      <div><label className={rotulo} htmlFor="v2-cidade">Cidade</label>
                        <Icone icon={MapPin}><input id="v2-cidade" className={comIcone} value={form.city} onChange={mudar('city')} autoComplete="off" /></Icone>
                        {errosCliente?.city && <span className={erroCampo}>{errosCliente.city}</span>}</div>
                      <div><label className={rotulo} htmlFor="v2-uf">UF</label>
                        <Icone seta><select id="v2-uf" className={`${semIcone} ${lista}`} value={form.state} onChange={mudar('state')}>
                          <option value="">UF</option>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select></Icone></div>
                    </div>
                  </Cartao>

                  {/* NEGÓCIO */}
                  <Cartao id="v2-negocio" icon={Handshake} titulo="Negócio">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_0.95fr] gap-x-5 gap-y-3 items-end">
                      <div><label className={rotulo} htmlFor="v2-origem">Origem{obrig}</label>
                        <Icone icon={Megaphone} seta><select id="v2-origem" value={form.origin} onChange={mudar('origin')} className={`${comIcone} ${lista}`}>
                          <option value="" disabled>Selecione…</option>{ORIGENS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select></Icone></div>
                      <div><label className={rotulo} htmlFor="v2-veiculo">Veículo de interesse{obrig}</label>
                        <Icone icon={Car}><input id="v2-veiculo" value={form.vehicleInterest} onChange={mudar('vehicleInterest')} className={comIcone} placeholder="Ex.: Vectra 2.2" /></Icone></div>
                      <Aviso>O veículo exato (marca, modelo, versão e anos) será confirmado na etapa da simulação.</Aviso>
                    </div>
                  </Cartao>

                  {/* FORMAÇÃO DO NEGÓCIO */}
                  <Cartao id="v2-formacao" icon={Coins} titulo="Formação do negócio">
                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-[1fr_0.9fr_0.9fr_0.95fr] gap-x-5 gap-y-3 items-end">
                      <div><span className={rotulo}>Valor do bem{obrig}</span>
                        <CurrencyInput label="Valor do bem" className={`${semIcone} text-[15px] font-semibold tnum`} value={form.assetValue} onChange={(v) => set('assetValue', v)} /></div>
                      <div><span className={rotulo}>Entrada</span>
                        <CurrencyInput label="Entrada" className={`${semIcone} text-[15px] font-semibold tnum ${form.cemPorCento ? 'text-ink2' : ''}`} value={form.cemPorCento ? 0 : form.downPayment} onChange={(v) => set('downPayment', v)} /></div>
                      <div><span className={rotulo} id="v2-financiar-rotulo">Valor a financiar</span>
                        <output aria-labelledby="v2-financiar-rotulo" data-testid="valor-a-financiar"
                          className="flex items-center w-full bg-surface3 border border-[rgb(var(--v2-borda))] rounded-[9px] px-3.5 h-11 text-[15px] font-semibold text-ink2 tnum cursor-default">
                          {f.financiar != null ? formatBRL(f.financiar) : 'R$ 0,00'}
                        </output></div>
                      <button type="button" aria-pressed={form.cemPorCento} onClick={() => set('cemPorCento', !form.cemPorCento)}
                        className={`flex items-center gap-3 rounded-[10px] border px-4 h-[54px] text-left transition ${form.cemPorCento ? 'border-brand bg-brand/[0.07] ring-1 ring-brand/25 shadow-[0_6px_14px_-10px_rgb(var(--brand)/0.9)]' : 'border-[rgb(var(--v2-campo))] bg-surface hover:border-brand/50'}`}>
                        <span className={`grid place-items-center w-6 h-6 rounded-full shrink-0 transition ${form.cemPorCento ? 'bg-brand text-brandInk' : 'border-2 border-[rgb(var(--v2-campo))]'}`} aria-hidden="true">
                          {form.cemPorCento && <Check size={15} strokeWidth={3} />}
                        </span>
                        <span className="leading-tight"><span className={`block text-[14.5px] font-bold ${form.cemPorCento ? 'text-brand' : 'text-[rgb(var(--v2-navy))]'}`}>100% financiado</span>
                          <span className="block text-[13px] text-ink2">(entrada R$ 0,00)</span></span>
                      </button>
                    </div>
                    {f.erro && <p className="text-[12.5px] text-critical">{f.erro}</p>}
                    <div>
                      <span className={rotulo} id="v2-prazos-rotulo">Prazos para simulação <span className="font-normal text-ink2">(selecione um ou mais)</span></span>
                      <div role="group" aria-labelledby="v2-prazos-rotulo" className="flex flex-wrap gap-2.5">
                        {PRAZOS_V2.map((p) => {
                          const on = form.installmentOptions.includes(p)
                          return (
                            <button key={p} type="button" aria-pressed={on} aria-label={`${p}x`} onClick={() => set('installmentOptions', alternarPrazo(form.installmentOptions, p))}
                              className={`flex items-center justify-center gap-2.5 min-w-[96px] sm:min-w-[108px] h-11 px-4 rounded-[9px] border text-[16px] font-bold tnum transition ${on ? 'border-brand bg-brand/[0.07] text-brand shadow-[0_4px_10px_-8px_rgb(var(--brand)/0.9)]' : 'border-[rgb(var(--v2-campo))] bg-surface text-[rgb(var(--v2-navy))] hover:border-brand/50'}`}>
                              {on ? <Check size={18} strokeWidth={3} aria-hidden="true" /> : <Square size={17} strokeWidth={1.8} className="text-[rgb(var(--v2-icone))]" aria-hidden="true" />}{p}x
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
                            <Icone icon={Car}><input id="v2-troca-veiculo" className={comIcone} value={form.tradeInVehicle} onChange={mudar('tradeInVehicle')} /></Icone></div>
                          <div><span className={rotulo}>Valor da troca</span>
                            <CurrencyInput label="Valor da troca" className={`${semIcone} font-semibold tnum`} value={form.tradeInValue} onChange={(v) => set('tradeInValue', v)} /></div>
                        </div>
                      )}
                    </Cartao>
                    <Cartao id="v2-pagamento" icon={CreditCard} titulo="Pagamento">
                      <div className="max-w-[372px]"><label className={rotulo} htmlFor="v2-composicao">Composição do pagamento</label>
                        <Icone seta><select id="v2-composicao" className={`${semIcone} ${lista}`} value={form.paymentComposition} onChange={mudar('paymentComposition')}>
                          <option value="">Não informado</option>{Object.entries(payments).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                        </select></Icone></div>
                    </Cartao>
                  </div>

                  {/* OBSERVAÇÕES */}
                  <Cartao id="v2-obs" icon={MessageSquareText} titulo="Observações">
                    <textarea aria-labelledby="v2-obs" rows={2} placeholder="Anotações sobre o atendimento, preferências do cliente…" className="w-full bg-surface border border-[rgb(var(--v2-campo))] rounded-[9px] px-3.5 py-3 text-[14px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 resize-y placeholder:text-ink3"
                      value={form.notes} onChange={mudar('notes')} />
                  </Cartao>

                  {/* RESPONSÁVEL */}
                  <Cartao id="v2-responsavel-titulo" icon={BriefcaseBusiness} titulo="Responsável comercial">
                    <div className="max-w-[640px]">
                      <Icone icon={User} seta={ehGerente}>
                        {ehGerente ? (
                          <select aria-labelledby="v2-responsavel-titulo" value={form.ownerId} onChange={mudar('ownerId')} className={`${comIcone} ${lista}`}>
                            <option value="" disabled>Selecione um responsável…</option>{responsaveis.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                          </select>
                        ) : <input aria-labelledby="v2-responsavel-titulo" value={usuario?.nome || ''} disabled className={`${comIcone} bg-surface2 text-ink2 cursor-not-allowed`} />}
                      </Icone>
                    </div>
                  </Cartao>

                  {/* REQUISITOS DA SIMULAÇÃO (informativo) */}
                  <aside aria-label="Requisitos da Zinix" className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 rounded-[12px] border border-[rgb(var(--v2-info-borda))] bg-gradient-to-r from-[rgb(var(--v2-info))] to-[rgb(var(--v2-info)/0.45)] px-4 sm:px-6 py-4">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <span className="grid place-items-center w-8 h-8 rounded-full bg-[rgb(var(--v2-azul))] text-white text-[16px] font-bold font-serif shrink-0 mt-0.5 shadow-[0_4px_10px_-6px_rgb(var(--v2-azul))]" aria-hidden="true">i</span>
                    <div className="min-w-0">
                      <p className="text-[15.5px] font-bold text-[rgb(var(--v2-navy))]">Importante – Requisitos da Zinix</p>
                      <p className="text-[13px] text-[rgb(var(--v2-rotulo))] leading-snug mt-0.5">
                        Para liberar a simulação, o CRM utiliza: Nome, CPF, Nascimento, Sexo, E-mail, Telefone, Cidade/UF, CNH, dados do veículo (identificado na simulação),
                        Valor do bem, Entrada e Prazos. Esses dados podem ser completados depois: não impedem criar a oportunidade.
                      </p>
                    </div>
                    </div>
                    <span className="inline-flex items-center gap-2 self-start sm:self-center shrink-0 rounded-full border border-[rgb(var(--v2-info-borda))] bg-surface/80 px-3.5 py-1.5 text-[12.5px] font-semibold text-[rgb(var(--v2-navy))] whitespace-nowrap">
                      <ShieldCheck size={16} strokeWidth={2} className="text-[rgb(var(--v2-azul))]" aria-hidden="true" />Usados para liberar a simulação
                    </span>
                  </aside>
                </form>
              )}
            </div>

            {!criadaSemDados && !duplicado && (
              <footer className="shrink-0 border-t border-[rgb(var(--v2-borda))] bg-surface px-4 sm:px-7 py-3.5 flex items-center justify-end gap-3 shadow-[0_-6px_16px_-12px_rgb(15_23_42/0.25)]">
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
