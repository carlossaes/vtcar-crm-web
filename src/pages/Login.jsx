import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import { aceitarConvite, conferirConvite, esqueciSenha, login, precisaConfigurar, primeiroAcesso, redefinirSenha } from '../api'
import { salvarSessao } from '../auth'

// Telas: entrar | esqueci | redefinir (veio do link do e-mail) | configurar
export default function Login({ onEntrou }) {
  const [tela, setTela] = useState('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [repetir, setRepetir] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [tokenReset, setTokenReset] = useState(null)
  const [tokenConvite, setTokenConvite] = useState(null)
  const [papelConvite, setPapelConvite] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // Link de convite: ?convite=<token>
    const conv = params.get('convite')
    if (conv) {
      setTokenConvite(conv)
      setTela('convite')
      conferirConvite(conv)
        .then((r) => setPapelConvite(r.papel))
        .catch((err) => { setErro(err.message); setTela('conviteInvalido') })
      return
    }

    // Link de recuperação: ?reset=<token>
    const t = params.get('reset')
    if (t) {
      setTokenReset(t)
      setTela('redefinir')
      return
    }
    // Sistema ainda sem nenhuma conta: mostra o primeiro acesso
    precisaConfigurar()
      .then((r) => {
        if (r?.precisaConfigurar) setTela('configurar')
      })
      .catch(() => {})
  }, [])

  const limparUrl = () => window.history.replaceState({}, '', window.location.pathname)

  const submeter = async (e) => {
    e.preventDefault()
    setErro(null)
    setAviso(null)
    setCarregando(true)
    try {
      if (tela === 'entrar') {
        const r = await login(email, senha)
        salvarSessao(r.token, r.usuario)
        onEntrou(r.usuario)
      } else if (tela === 'configurar') {
        if (novaSenha !== repetir) throw new Error('As duas senhas não são iguais')
        const r = await primeiroAcesso({ nome, email, senha: novaSenha })
        salvarSessao(r.token, r.usuario)
        onEntrou(r.usuario)
      } else if (tela === 'convite') {
        if (novaSenha !== repetir) throw new Error('As duas senhas não são iguais')
        const r = await aceitarConvite({ token: tokenConvite, nome, email, senha: novaSenha })
        salvarSessao(r.token, r.usuario)
        limparUrl()
        onEntrou(r.usuario)
      } else if (tela === 'esqueci') {
        const r = await esqueciSenha(email)
        setAviso(r.mensagem)
      } else if (tela === 'redefinir') {
        const r = await redefinirSenha(tokenReset, novaSenha)
        salvarSessao(r.token, r.usuario)
        limparUrl()
        onEntrou(r.usuario)
      }
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  const titulos = {
    entrar: { t: 'Entrar', s: 'Acesse o CRM da VT Car' },
    esqueci: { t: 'Esqueci minha senha', s: 'Enviamos um link para você criar uma nova' },
    redefinir: { t: 'Criar nova senha', s: 'Escolha a senha que você vai usar daqui pra frente' },
    configurar: { t: 'Primeiro acesso', s: 'Crie a conta de gerente que vai administrar o CRM' },
    convite: {
      t: 'Criar seu acesso',
      s: papelConvite === 'gerente'
        ? 'Você foi convidado como gerente do CRM da VT Car'
        : 'Você foi convidado para usar o CRM da VT Car',
    },
    conviteInvalido: { t: 'Convite não disponível', s: 'Peça um link novo a quem administra o CRM' },
  }[tela]

  const campo =
    'w-full bg-surface2 border border-line rounded-control px-3 h-11 text-[14px] outline-none focus:border-brand transition-colors'
  const rotulo = 'text-[12.5px] font-medium text-ink2 mb-1.5 block'

  return (
    <div className="min-h-screen bg-plane flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-[400px]"
      >
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-10 h-10 rounded-[11px] bg-brand grid place-items-center text-brandInk font-extrabold text-[14px]">
            VT
          </div>
          <div>
            <div className="font-bold text-[16px] tracking-tight leading-tight">VT Car</div>
            <div className="text-[11.5px] text-ink3 leading-tight">CRM de vendas</div>
          </div>
        </div>

        <form
          onSubmit={submeter}
          className="bg-surface border border-line rounded-card shadow-card p-6"
        >
          <h1 className="text-[17px] font-bold tracking-tight">{titulos.t}</h1>
          <p className="text-[12.5px] text-ink3 mt-0.5 mb-5">{titulos.s}</p>

          {erro && (
            <div className="flex items-start gap-2 text-[12.5px] text-critical bg-critical/10 border border-critical/25 rounded-control px-3 py-2.5 mb-4">
              <AlertTriangle size={14} className="shrink-0 mt-px" />
              <span>{erro}</span>
            </div>
          )}
          {aviso && (
            <div className="flex items-start gap-2 text-[12.5px] text-ink2 bg-surface2 border border-line rounded-control px-3 py-2.5 mb-4">
              <Check size={14} className="shrink-0 mt-px text-good" />
              <span className="break-words">{aviso}</span>
            </div>
          )}

          {(tela === 'configurar' || tela === 'convite') && (
            <div className="mb-4">
              <label className={rotulo} htmlFor="nome">Seu nome</label>
              <input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoFocus
                className={campo}
                placeholder="Carlos Sales"
              />
            </div>
          )}

          {tela !== 'redefinir' && tela !== 'conviteInvalido' && (
            <div className="mb-4">
              <label className={rotulo} htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={tela !== 'configurar'}
                autoComplete="username"
                className={campo}
                placeholder="voce@vtcar.com.br"
              />
            </div>
          )}

          {(tela === 'entrar' || tela === 'redefinir' || tela === 'configurar' || tela === 'convite') && (
            <div className="mb-2">
              <label className={rotulo} htmlFor="senha">
                {tela === 'entrar' ? 'Senha' : 'Escolha uma senha (mínimo 8 caracteres)'}
              </label>
              <div className="relative">
                <input
                  id="senha"
                  type={verSenha ? 'text' : 'password'}
                  value={tela === 'entrar' ? senha : novaSenha}
                  onChange={(e) => (tela === 'entrar' ? setSenha(e.target.value) : setNovaSenha(e.target.value))}
                  required
                  minLength={tela === 'entrar' ? undefined : 8}
                  autoComplete={tela === 'entrar' ? 'current-password' : 'new-password'}
                  autoFocus={tela === 'redefinir'}
                  className={`${campo} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setVerSenha((v) => !v)}
                  aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-0 top-0 h-11 w-11 grid place-items-center text-ink3 hover:text-ink transition-colors"
                >
                  {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {(tela === 'configurar' || tela === 'convite') && (
            <div className="mb-2 mt-4">
              <label className={rotulo} htmlFor="repetir">Repita a senha</label>
              <input
                id="repetir"
                type={verSenha ? 'text' : 'password'}
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={campo}
              />
            </div>
          )}

          {tela === 'entrar' && (
            <button
              type="button"
              onClick={() => { setTela('esqueci'); setErro(null); setAviso(null) }}
              className="text-[12.5px] text-ink3 hover:text-ink2 transition-colors"
            >
              Esqueci minha senha
            </button>
          )}

          {tela !== 'conviteInvalido' && (
          <button
            type="submit"
            disabled={carregando}
            className="w-full mt-5 bg-brand hover:bg-brandHover text-brandInk rounded-control h-11 text-[14px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {carregando && <Loader2 size={15} className="animate-spin" />}
            {tela === 'entrar' && 'Entrar'}
            {tela === 'esqueci' && 'Enviar link de recuperação'}
            {tela === 'redefinir' && 'Salvar nova senha'}
            {tela === 'configurar' && 'Criar minha conta e entrar'}
            {tela === 'convite' && 'Criar meu acesso'}
          </button>
          )}

          {(tela === 'esqueci' || tela === 'redefinir') && (
            <button
              type="button"
              onClick={() => { setTela('entrar'); setErro(null); setAviso(null); limparUrl() }}
              className="w-full mt-3 flex items-center justify-center gap-1.5 text-[12.5px] text-ink2 hover:text-ink transition-colors"
            >
              <ArrowLeft size={13} />
              Voltar para o login
            </button>
          )}
        </form>
      </motion.div>
    </div>
  )
}
