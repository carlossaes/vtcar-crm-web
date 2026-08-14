import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { trocarSenha } from '../api'
import { salvarSessao } from '../auth'

/**
 * Aparece no primeiro acesso, quando a senha ainda é a que veio por e-mail.
 * Enquanto a pessoa não escolher a própria senha, o CRM não abre — assim a
 * senha provisória não fica valendo para sempre na caixa de entrada dela.
 */
export default function TrocarSenha({ usuario, onPronto, onSair }) {
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [repetir, setRepetir] = useState('')
  const [ver, setVer] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  const submeter = async (e) => {
    e.preventDefault()
    setErro(null)
    if (novaSenha !== repetir) {
      setErro('As duas senhas novas não são iguais')
      return
    }
    setCarregando(true)
    try {
      const r = await trocarSenha(senhaAtual, novaSenha)
      const atualizado = r.usuario || { ...usuario, precisaTrocarSenha: false }
      salvarSessao(null, atualizado)
      onPronto(atualizado)
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  const campo =
    'w-full bg-surface2 border border-line rounded-control px-3 h-11 text-[14px] outline-none focus:border-brand transition-colors'
  const rotulo = 'text-[12.5px] font-medium text-ink2 mb-1.5 block'

  return (
    <div className="min-h-screen bg-plane flex items-center justify-center p-4">
      <motion.form
        onSubmit={submeter}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-[400px] bg-surface border border-line rounded-card shadow-card p-6"
      >
        <div className="w-10 h-10 rounded-card bg-surface2 border border-line grid place-items-center mb-4">
          <ShieldCheck size={19} className="text-brand" strokeWidth={1.8} />
        </div>

        <h1 className="text-[17px] font-bold tracking-tight">Escolha sua senha</h1>
        <p className="text-[12.5px] text-ink3 mt-0.5 mb-5">
          Olá, {usuario?.nome?.split(' ')[0]}. Você entrou com a senha que veio por e-mail — agora defina uma só sua.
        </p>

        {erro && (
          <div className="flex items-start gap-2 text-[12.5px] text-critical bg-critical/10 border border-critical/25 rounded-control px-3 py-2.5 mb-4">
            <AlertTriangle size={14} className="shrink-0 mt-px" />
            <span>{erro}</span>
          </div>
        )}

        <div className="mb-4">
          <label className={rotulo} htmlFor="atual">Senha que veio no e-mail</label>
          <input
            id="atual"
            type="password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            required
            autoFocus
            autoComplete="current-password"
            className={campo}
          />
        </div>

        <div className="mb-4">
          <label className={rotulo} htmlFor="nova">Nova senha (mínimo 8 caracteres)</label>
          <div className="relative">
            <input
              id="nova"
              type={ver ? 'text' : 'password'}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={`${campo} pr-11`}
            />
            <button
              type="button"
              onClick={() => setVer((v) => !v)}
              aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-0 top-0 h-11 w-11 grid place-items-center text-ink3 hover:text-ink transition-colors"
            >
              {ver ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="mb-1">
          <label className={rotulo} htmlFor="repetir">Repita a nova senha</label>
          <input
            id="repetir"
            type={ver ? 'text' : 'password'}
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={campo}
          />
        </div>

        <button
          type="submit"
          disabled={carregando}
          className="w-full mt-5 bg-brand hover:bg-brandHover text-brandInk rounded-control h-11 text-[14px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {carregando && <Loader2 size={15} className="animate-spin" />}
          Salvar e entrar
        </button>

        <button
          type="button"
          onClick={onSair}
          className="w-full mt-3 text-[12.5px] text-ink2 hover:text-ink transition-colors"
        >
          Sair
        </button>
      </motion.form>
    </div>
  )
}
