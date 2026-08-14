import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy, KeyRound, Link2, Loader2, Trash2, UserPlus, Users2, X } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { atualizarUsuario, criarConvite, criarUsuario, listarConvites, listarUsuarios, removerUsuario, reenviarSenha, revogarConvite } from '../api'

const PAPEIS = [
  { id: 'vendedor', label: 'Vendedor', descricao: 'Usa o CRM; não mexe em usuários' },
  { id: 'gerente', label: 'Gerente', descricao: 'Usa o CRM e administra quem tem acesso' },
]

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function Usuarios({ usuarioAtual }) {
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', papel: 'vendedor' })
  const [convites, setConvites] = useState([])
  const [papelConvite, setPapelConvite] = useState('vendedor')
  const [obsConvite, setObsConvite] = useState('')
  const [linkNovo, setLinkNovo] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [modoDireto, setModoDireto] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    try {
      const [us, cs] = await Promise.all([listarUsuarios(), listarConvites().catch(() => [])])
      setLista(us)
      setConvites(cs)
      setErro(null)
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const criar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    setAviso(null)
    try {
      const r = await criarUsuario(form)
      setAviso(
        r.emailEnviado
          ? `Conta criada. A senha foi enviada para ${r.usuario.email}.`
          : `Conta criada, mas o e-mail não saiu. Passe esta senha para ${r.usuario.nome}: ${r.senhaProvisoria}`
      )
      setForm({ nome: '', email: '', papel: 'vendedor' })
      carregar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const mexer = async (fn, confirmacao) => {
    if (confirmacao && !window.confirm(confirmacao)) return
    setErro(null)
    setAviso(null)
    try {
      const r = await fn()
      if (r?.senhaProvisoria) setAviso(`Senha nova gerada (o e-mail não saiu): ${r.senhaProvisoria}`)
      else if (r?.emailEnviado) setAviso('Senha nova enviada por e-mail.')
      carregar()
    } catch (err) {
      setErro(err.message)
    }
  }

  const gerarLink = async (e) => {
    e.preventDefault()
    setGerando(true)
    setErro(null)
    setAviso(null)
    setLinkNovo(null)
    try {
      const r = await criarConvite({ papel: papelConvite, observacao: obsConvite || null })
      setLinkNovo(r.link)
      setObsConvite('')
      carregar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setGerando(false)
    }
  }

  const copiar = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch (err) {
      setErro('Não consegui copiar automaticamente. Selecione o link e copie na mão.')
    }
  }

  const campo =
    'w-full bg-surface2 border border-line rounded-control px-3 h-10 text-[13.5px] outline-none focus:border-brand transition-colors'

  return (
    <div className="space-y-4">
      {erro && (
        <div className="flex items-start gap-2 text-[12.5px] text-critical bg-critical/10 border border-critical/25 rounded-control px-3 py-2.5">
          <AlertTriangle size={14} className="shrink-0 mt-px" />
          <span>{erro}</span>
        </div>
      )}
      {aviso && (
        <div className="flex items-start gap-2 text-[12.5px] text-ink2 bg-surface border border-line rounded-control px-3 py-2.5">
          <Check size={14} className="shrink-0 mt-px text-good" />
          <span className="break-words">{aviso}</span>
        </div>
      )}

      <section className="bg-surface border border-line rounded-card shadow-card p-5">
        <h2 className="text-[13.5px] font-semibold flex items-center gap-1.5">
          <Link2 size={15} className="text-brand" />
          Convidar por link
        </h2>
        <p className="text-[12.5px] text-ink3 mt-0.5 mb-4">
          Gere um link, mande pela pessoa por WhatsApp ou e-mail e ela mesma cria o acesso. O link vale 7 dias e só
          funciona uma vez.
        </p>

        <form onSubmit={gerarLink} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2.5 items-end">
          <div>
            <label className="text-[12px] font-medium text-ink2 mb-1.5 block" htmlFor="c-obs">
              Para quem é? <span className="text-ink3 font-normal">(opcional, só pra você lembrar)</span>
            </label>
            <input
              id="c-obs"
              value={obsConvite}
              onChange={(e) => setObsConvite(e.target.value)}
              className={campo}
              placeholder="Maria do balcão"
              maxLength={80}
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-ink2 mb-1.5 block" htmlFor="c-papel">Acesso</label>
            <select id="c-papel" value={papelConvite} onChange={(e) => setPapelConvite(e.target.value)} className={`${campo} pr-8`}>
              {PAPEIS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={gerando}
            className="bg-brand hover:bg-brandHover text-brandInk rounded-control h-10 px-4 text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {gerando && <Loader2 size={14} className="animate-spin" />}
            Gerar link
          </button>
        </form>

        {linkNovo && (
          <div className="mt-4 border border-line rounded-control bg-surface2 p-3">
            <div className="text-[11.5px] text-ink3 mb-2">
              Copie e mande para a pessoa. Este link aparece só agora — depois não dá pra recuperar, só gerar outro.
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={linkNovo}
                onFocus={(e) => e.target.select()}
                className="flex-1 bg-surface border border-line rounded-control px-3 h-10 text-[12.5px] outline-none"
              />
              <button
                onClick={() => copiar(linkNovo)}
                className="flex items-center gap-1.5 bg-brand hover:bg-brandHover text-brandInk rounded-control h-10 px-3.5 text-[12.5px] font-semibold transition-colors shrink-0"
              >
                {copiado ? <Check size={14} /> : <Copy size={14} />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        )}

        {convites.filter((c) => c.situacao === 'pendente').length > 0 && (
          <div className="mt-4">
            <div className="text-micro uppercase font-semibold text-ink3 mb-2">Convites aguardando</div>
            <div className="flex flex-col gap-1.5">
              {convites
                .filter((c) => c.situacao === 'pendente')
                .map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-[12.5px] text-ink2 border border-line rounded-control px-3 py-2">
                    <span className="font-medium text-ink">{c.observacao || 'Sem identificação'}</span>
                    <span className="text-ink3">· {c.papel}</span>
                    <span className="text-ink3 ml-auto tnum">vence {fmtData.format(new Date(c.expiraEm))}</span>
                    <button
                      onClick={() => mexer(() => revogarConvite(c.id), `Cancelar o convite de "${c.observacao || 'sem identificação'}"? O link para de funcionar.`)}
                      title="Cancelar convite"
                      className="grid place-items-center w-7 h-7 rounded-control text-ink3 hover:text-critical transition-colors shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setModoDireto((v) => !v)}
          className="text-[12px] text-ink3 hover:text-ink2 transition-colors mt-4"
        >
          {modoDireto ? 'Esconder' : 'Prefiro cadastrar a pessoa direto, sem link'}
        </button>
      </section>

      <section className={`bg-surface border border-line rounded-card shadow-card p-5 ${modoDireto ? '' : 'hidden'}`}>
        <h2 className="text-[13.5px] font-semibold flex items-center gap-1.5">
          <UserPlus size={15} className="text-brand" />
          Cadastrar direto
        </h2>
        <p className="text-[12.5px] text-ink3 mt-0.5 mb-4">
          O sistema gera uma senha e envia por e-mail. Se o e-mail não estiver configurado, a senha aparece aqui pra
          você repassar.
        </p>

        <form onSubmit={criar} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2.5 items-end">
          <div>
            <label className="text-[12px] font-medium text-ink2 mb-1.5 block" htmlFor="u-nome">Nome</label>
            <input
              id="u-nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
              className={campo}
              placeholder="Maria Souza"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-ink2 mb-1.5 block" htmlFor="u-email">E-mail</label>
            <input
              id="u-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className={campo}
              placeholder="maria@vtcar.com.br"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-ink2 mb-1.5 block" htmlFor="u-papel">Acesso</label>
            <select
              id="u-papel"
              value={form.papel}
              onChange={(e) => setForm({ ...form, papel: e.target.value })}
              className={`${campo} pr-8`}
            >
              {PAPEIS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={salvando}
            className="bg-brand hover:bg-brandHover text-brandInk rounded-control h-10 px-4 text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            Criar acesso
          </button>
        </form>

        <p className="text-[11.5px] text-ink3 mt-3 leading-relaxed">
          {PAPEIS.map((p) => `${p.label}: ${p.descricao}`).join(' · ')}
        </p>
      </section>

      <section className="bg-surface border border-line rounded-card shadow-card overflow-hidden">
        <header className="px-5 py-4 border-b border-line">
          <h2 className="text-[13.5px] font-semibold">
            Quem tem acesso <span className="text-ink3 font-normal tnum">{carregando ? '' : `(${lista.length})`}</span>
          </h2>
        </header>

        {carregando ? (
          <div className="py-12 text-center text-[13px] text-ink2">Carregando…</div>
        ) : lista.length === 0 ? (
          <EmptyState icon={Users2} title="Ninguém cadastrado ainda" description="Crie o primeiro acesso no formulário acima." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-micro uppercase font-semibold text-ink3 bg-surface2/60">
                  <th className="py-2.5 px-5 font-semibold">Pessoa</th>
                  <th className="py-2.5 px-3 font-semibold">Acesso</th>
                  <th className="py-2.5 px-3 font-semibold">Situação</th>
                  <th className="py-2.5 px-3 font-semibold">Último acesso</th>
                  <th className="py-2.5 px-5 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => {
                  const souEu = u.id === usuarioAtual?.id
                  return (
                    <tr key={u.id} className="border-t border-line">
                      <td className="py-3 px-5">
                        <div className="text-[13.5px] font-medium">
                          {u.nome}
                          {souEu && <span className="text-ink3 font-normal"> · você</span>}
                        </div>
                        <div className="text-[12px] text-ink3">{u.email}</div>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={u.papel}
                          onChange={(e) => mexer(() => atualizarUsuario(u.id, { papel: e.target.value }))}
                          className="bg-surface2 border border-line rounded-control px-2 h-8 text-[12.5px] outline-none focus:border-brand"
                        >
                          {PAPEIS.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => mexer(() => atualizarUsuario(u.id, { ativo: !u.ativo }))}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11.5px] font-medium transition-colors ${
                            u.ativo
                              ? 'border-line bg-surface2 text-ink2 hover:border-lineStrong'
                              : 'border-brand/35 bg-brand/[0.07] text-brand'
                          }`}
                          title={u.ativo ? 'Clique para desativar' : 'Clique para reativar'}
                        >
                          <span className={`w-[7px] h-[7px] rounded-full ${u.ativo ? 'bg-good' : 'bg-brand'}`} aria-hidden="true" />
                          {u.ativo ? 'Ativo' : 'Desativado'}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-[12.5px] text-ink3 tnum">
                        {u.ultimoAcesso ? fmtData.format(new Date(u.ultimoAcesso)) : 'nunca entrou'}
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() =>
                              mexer(
                                () => reenviarSenha(u.id),
                                `Gerar uma senha nova para ${u.nome} e enviar por e-mail? A senha atual deixa de funcionar.`
                              )
                            }
                            title="Enviar nova senha por e-mail"
                            className="grid place-items-center w-8 h-8 rounded-control border border-line text-ink2 hover:text-ink hover:border-lineStrong transition-colors"
                          >
                            <KeyRound size={14} />
                          </button>
                          <button
                            onClick={() =>
                              mexer(() => removerUsuario(u.id), `Remover ${u.nome} definitivamente? Ela perde o acesso na hora.`)
                            }
                            disabled={souEu}
                            title={souEu ? 'Você não pode remover a própria conta' : 'Remover acesso'}
                            className="grid place-items-center w-8 h-8 rounded-control border border-line text-ink2 hover:text-critical hover:border-critical/40 transition-colors disabled:opacity-30 disabled:hover:text-ink2 disabled:hover:border-line"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
