import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { StageBadge } from './Badge'
import { createLead } from '../api'
import CommercialFields from './CommercialFields'
import { commercialPayload } from '../opportunity'
import { formatPhoneInput, normalizePhoneInput, normalizeEmailInput, requiredText } from '../formInputs'

// Lista fixa nesta entrega -- virar cadastro configuravel fica pra depois.
export const ORIGENS = ['Webmotors', 'OLX', 'iCarros', 'Indicação', 'Loja', 'Telefone', 'Instagram', 'Outro']

const ESTADO_INICIAL = {
  name: '',
  phone: '',
  email: '',
  vehicleInterest: '',
  origin: '',
  notes: '',
  ownerId: '',
}

const campo =
  'w-full bg-surface2 border border-line rounded-control px-3 h-10 text-[13.5px] outline-none focus:border-brand transition-colors'
const label = 'text-[12px] font-medium text-ink2 mb-1.5 block'

export default function NovaOportunidadeModal({ open, usuario, vendedores = [], onClose, onCreated, onAbrirExistente }) {
  const [form, setForm] = useState(ESTADO_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [duplicado, setDuplicado] = useState(null)
  const ehGerente = usuario?.papel === 'gerente'
  const responsaveis = [
    ...(ehGerente && usuario.id && usuario.ativo !== false ? [usuario] : []),
    ...vendedores.filter((v) => v.ativo !== false && v.papel === 'vendedor' && v.id !== usuario?.id),
  ]

  useEffect(() => {
    if (open) {
      setForm({ ...ESTADO_INICIAL, ownerId: usuario?.id || '' })
      setErro(null)
      setDuplicado(null)
    }
  }, [open, usuario?.id])

  const mudar = (campoNome) => (e) => setForm((f) => ({ ...f, [campoNome]: e.target.value }))

  const salvar = async (e) => {
    e.preventDefault()
    setErro(null)
    setDuplicado(null)
    setSalvando(true)
    try {
      const dados = {
        ...commercialPayload(form),
        name: requiredText(form.name, 'Informe o nome do cliente.'),
        phone: normalizePhoneInput(form.phone),
        email: normalizeEmailInput(form.email),
        vehicleInterest: requiredText(form.vehicleInterest, 'Informe o veículo de interesse.'),
        origin: form.origin,
        notes: form.notes.trim() || null,
      }
      if (!form.origin) throw new Error('Selecione a origem.')
      if (ehGerente && !form.ownerId) throw new Error('Selecione um responsável.')
      if (ehGerente) dados.ownerId = form.ownerId
      const lead = await createLead(dados)
      onCreated(lead)
    } catch (err) {
      if (err.status === 409 && err.body?.existente) {
        setDuplicado(err.body.existente)
      } else {
        setErro(err.message)
      }
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/55 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border border-line rounded-card shadow-pop w-[520px] max-w-full max-h-[88vh] overflow-y-auto"
          >
            <header className="sticky top-0 bg-surface/95 backdrop-blur border-b border-line px-6 py-4 flex items-center justify-between gap-4 z-10">
              <h2 className="text-[17px] font-bold tracking-tight">Nova oportunidade</h2>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="grid place-items-center w-8 h-8 rounded-control text-ink3 hover:text-ink hover:bg-surface2 transition-colors shrink-0"
              >
                <X size={17} />
              </button>
            </header>

            <div className="px-6 py-5">
              {duplicado ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 text-[12.5px] text-critical bg-critical/10 border border-critical/25 rounded-control px-3 py-2.5">
                    <AlertTriangle size={14} className="shrink-0 mt-px" />
                    <span>Já existe um registro com este telefone.</span>
                  </div>
                  <div className="border border-line rounded-control p-3.5 space-y-2">
                    <div className="text-[13.5px] font-medium">{duplicado.name || 'Sem nome'}</div>
                    <div className="text-[12.5px] text-ink2">
                      Responsável: {duplicado.ownerName || 'Sem responsável'}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-ink3">Estágio:</span>
                      <StageBadge stage={duplicado.stage} />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDuplicado(null)}
                      className="border border-line rounded-control h-10 px-3.5 text-[13px] font-medium text-ink2 hover:text-ink hover:border-lineStrong transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={() => onAbrirExistente(duplicado)}
                      className="bg-brand hover:bg-brandHover text-brandInk rounded-control h-10 px-3.5 text-[13px] font-semibold transition-colors"
                    >
                      Abrir registro existente
                    </button>
                  </div>
                </div>
              ) : (
                <form noValidate onSubmit={salvar} className="space-y-4">
                  {erro && (
                    <div role="alert" className="flex items-start gap-2 text-[12.5px] text-critical bg-critical/10 border border-critical/25 rounded-control px-3 py-2.5">
                      <AlertTriangle size={14} className="shrink-0 mt-px" />
                      <span>{erro}</span>
                    </div>
                  )}

                  <h3 className="text-micro uppercase font-semibold text-ink3">Cliente</h3>
                  <div>
                    <label className={label} htmlFor="op-nome">Nome *</label>
                    <input id="op-nome" required value={form.name} onChange={mudar('name')} className={campo} placeholder="Nome do cliente" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={label} htmlFor="op-telefone">Telefone *</label>
                      <input id="op-telefone" type="tel" required value={formatPhoneInput(form.phone)} onChange={mudar('phone')} className={campo} placeholder="(11) 98888-7777" />
                    </div>
                    <div>
                      <label className={label} htmlFor="op-email">E-mail</label>
                      <input id="op-email" type="email" value={form.email} onChange={mudar('email')} className={campo} placeholder="opcional" />
                    </div>
                  </div>

                  <h3 className="text-micro uppercase font-semibold text-ink3">Negócio</h3>

                  <div>
                    <label className={label} htmlFor="op-origem">Origem *</label>
                    <select id="op-origem" required value={form.origin} onChange={mudar('origin')} className={`${campo} pr-8`}>
                      <option value="" disabled>Selecione…</option>
                      {ORIGENS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>

                  <CommercialFields form={form} setForm={setForm} creation />

                  <div>
                    <label className={label}>Responsável comercial</label>
                    {ehGerente ? (
                      <select
                        required
                        value={form.ownerId}
                        onChange={mudar('ownerId')}
                        className={`${campo} pr-8`}
                        aria-label="Responsável comercial"
                      >
                        <option value="" disabled>Selecione um responsável…</option>
                        {responsaveis.map((v) => (
                          <option key={v.id} value={v.id}>{v.nome}</option>
                        ))}
                      </select>
                    ) : (
                      <input value={usuario?.nome || ''} disabled className={`${campo} opacity-70`} aria-label="Responsável comercial" />
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={onClose}
                      className="border border-line rounded-control h-10 px-3.5 text-[13px] font-medium text-ink2 hover:text-ink hover:border-lineStrong transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={salvando}
                      className="flex items-center gap-1.5 bg-brand hover:bg-brandHover text-brandInk rounded-control h-10 px-4 text-[13px] font-semibold transition-colors disabled:opacity-60"
                    >
                      {salvando && <Loader2 size={14} className="animate-spin" />}
                      Criar oportunidade
                    </button>
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
