import { useEffect, useState } from 'react'
import { AlertTriangle, Check, KeyRound, Loader2, Trash2, UserPlus, Users2 } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { atualizarUsuario, criarUsuario, listarUsuarios, removerUsuario, reenviarSenha } from '../api'

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

  const carregar = async () => {
    setCarregando(true)
    try {
      setLista(await listarUsuarios())
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
          <UserPlus size={15} className="text-brand" />
          Dar acesso a alguém
        </h2>
        <p className="text-[12.5px] text-ink3 mt-0.5 mb-4">
          A pessoa recebe a senha por e-mail e escolhe a própria no primeiro acesso.
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
