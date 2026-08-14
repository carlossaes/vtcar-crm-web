import { useCallback, useEffect, useState } from 'react'
import { UserCircle, Car, Activity, BarChart3, Hammer, AlertTriangle } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import BackendModal from './components/BackendModal'
import EmptyState from './components/EmptyState'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Pipeline from './pages/Pipeline'
import Contatos from './pages/Contatos'
import Usuarios from './pages/Usuarios'
import Login from './pages/Login'
import TrocarSenha from './pages/TrocarSenha'
import { getToken, getUsuario, limparSessao, salvarSessao } from './auth'
import { getApiBase, setApiBase, getLeads, updateLeadStage, meuUsuario, definirAoPerderSessao } from './api'

// Chave nova de proposito. A anterior ("vtcar_theme") era gravada na montagem,
// entao quem so abriu o CRM enquanto o escuro era padrao ficou com "dark"
// salvo sem nunca ter escolhido. Com a chave nova, todo mundo volta pro claro
// e so fica no escuro quem clicar no botao.
const THEME_KEY = 'vtcar_theme_v2'

const PAGES = {
  dashboard: { title: 'Dashboard', subtitle: 'Visão geral da operação' },
  pipeline: { title: 'Pipeline de vendas', subtitle: 'Arraste o lead pelo funil' },
  leads: { title: 'Leads', subtitle: 'Todo mundo que a Vitória captou' },
  contatos: { title: 'Contatos do WhatsApp', subtitle: 'Direto do GPT Maker, desde o primeiro atendimento' },
  usuarios: { title: 'Usuários', subtitle: 'Quem tem acesso ao CRM' },
  clientes: {
    title: 'Clientes',
    subtitle: 'Quem já comprou',
    icon: UserCircle,
    soon: 'Histórico de compras, veículo atual e hora certa de oferecer a troca.',
  },
  veiculos: {
    title: 'Estoque de veículos',
    subtitle: 'O que está no pátio',
    icon: Car,
    soon: 'Cadastro do estoque e vínculo entre o interesse do lead e o carro real.',
  },
  atividades: {
    title: 'Atividades',
    subtitle: 'Follow-ups e tarefas',
    icon: Activity,
    soon: 'Agenda de retornos, lembretes e o que cada vendedor precisa fazer hoje.',
  },
  relatorios: {
    title: 'Relatórios',
    subtitle: 'Números da operação',
    icon: BarChart3,
    soon: 'Conversão por canal, tempo médio de fechamento e desempenho por vendedor.',
  },
}

function usePersistedTheme() {
  // Claro e o padrao; escuro so se a pessoa tiver escolhido. O valor real ja
  // foi aplicado no <html> pelo script do index.html, entao aqui so lemos.
  const [theme, setTheme] = useState(() => {
    if (typeof document === 'undefined') return 'light'
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  })

  // So aplica no <html>; nao grava nada aqui. Gravar na montagem faria o
  // padrao virar "escolha" da pessoa sem ela ter clicado em nada.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggle = () => {
    setTheme((atual) => {
      const proximo = atual === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_KEY, proximo)
      } catch (e) {
        /* modo privado: so nao persiste */
      }
      return proximo
    })
  }

  return [theme, toggle]
}

export default function App() {
  const [usuario, setUsuario] = useState(() => (getToken() ? getUsuario() : null))
  const [validandoSessao, setValidandoSessao] = useState(() => Boolean(getToken()))
  const [page, setPage] = useState('dashboard')
  const [leads, setLeads] = useState([])
  const [search, setSearch] = useState('')
  const [backendModalOpen, setBackendModalOpen] = useState(false)
  const [backendConnected, setBackendConnected] = useState(false)
  const [moveError, setMoveError] = useState(null)
  const [theme, toggleTheme] = usePersistedTheme()

  const sair = useCallback(() => {
    limparSessao()
    setUsuario(null)
    setLeads([])
    setPage('dashboard')
  }, [])

  // Qualquer 401 vindo da API derruba a sessao e volta pro login.
  useEffect(() => {
    definirAoPerderSessao(() => setUsuario(null))
  }, [])

  // Ao abrir, confere com o servidor se o token guardado ainda vale. Sem
  // isso, a pessoa veria o CRM montar e so depois cair pra tela de login.
  useEffect(() => {
    if (!getToken()) return
    let cancelado = false
    meuUsuario()
      .then((r) => {
        if (cancelado) return
        salvarSessao(null, r.usuario)
        setUsuario(r.usuario)
      })
      .catch(() => {
        if (!cancelado) {
          limparSessao()
          setUsuario(null)
        }
      })
      .finally(() => {
        if (!cancelado) setValidandoSessao(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  const refreshLeads = useCallback(async () => {
    if (!getApiBase() || !getToken()) return
    try {
      const data = await getLeads()
      setLeads(Array.isArray(data) ? data : [])
      setBackendConnected(true)
    } catch (err) {
      console.warn('Falha ao buscar leads:', err)
      setBackendConnected(false)
    }
  }, [])

  useEffect(() => {
    if (!usuario || usuario.precisaTrocarSenha) return
    refreshLeads()
    const interval = setInterval(refreshLeads, 30000)
    return () => clearInterval(interval)
  }, [refreshLeads, usuario])

  // Move otimista: o card muda de coluna na hora e so depois confirma com a
  // API. Se o backend recusar, volta pro estado anterior e avisa.
  const handleMoveStage = async (id, stage) => {
    const previous = leads
    setLeads((current) => current.map((l) => (l.id === id ? { ...l, stage } : l)))
    try {
      await updateLeadStage(id, stage)
      refreshLeads()
    } catch (err) {
      console.warn('Falha ao mover o lead:', err)
      setLeads(previous)
      setMoveError('Não deu pra salvar a mudança de estágio. O card voltou pro lugar.')
      setTimeout(() => setMoveError(null), 4000)
    }
  }

  const leadsCount = leads.length
  const pipelineCount = leads.filter((l) => ['novo', 'qualificado', 'proposta', 'negociacao'].includes(l.stage)).length
  const meta = PAGES[page]

  // Tela em branco enquanto confirmamos o token, pra nao piscar o login
  // pra quem ja esta logado.
  if (validandoSessao) {
    return <div className="min-h-screen bg-plane" />
  }

  if (!usuario) {
    return <Login onEntrou={(u) => { setUsuario(u); setValidandoSessao(false) }} />
  }

  if (usuario.precisaTrocarSenha) {
    return <TrocarSenha usuario={usuario} onPronto={setUsuario} onSair={sair} />
  }

  // Vendedor nao acessa a area de usuarios nem digitando a rota na mao.
  const podeVer = page !== 'usuarios' || usuario.papel === 'gerente'
  const paginaAtual = podeVer ? page : 'dashboard'

  return (
    <div className="flex min-h-screen bg-plane">
      <Sidebar
        page={paginaAtual}
        onNavigate={setPage}
        leadsCount={leadsCount}
        pipelineCount={pipelineCount}
        usuario={usuario}
        onSair={sair}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title={meta.title}
          subtitle={meta.subtitle}
          onConfigureBackend={() => setBackendModalOpen(true)}
          backendConnected={backendConnected}
          onNewLead={() => setPage('leads')}
          search={search}
          onSearch={setSearch}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main className="flex-1 p-6 max-w-[1400px] w-full">
          {page === 'dashboard' && <Dashboard leads={leads} onGoToLeads={() => setPage('leads')} />}
          {page === 'leads' && <Leads leads={leads} search={search} onMoveStage={handleMoveStage} />}
          {page === 'pipeline' && <Pipeline leads={leads} search={search} onMoveStage={handleMoveStage} />}
          {page === 'contatos' && <Contatos search={search} usuario={usuario} />}
          {paginaAtual === 'usuarios' && <Usuarios usuarioAtual={usuario} />}
          {meta.soon && (
            <div className="bg-surface border border-line rounded-card shadow-card">
              <EmptyState
                icon={meta.icon || Hammer}
                title={`${meta.title} — em construção`}
                description={meta.soon}
              />
            </div>
          )}
        </main>
      </div>

      {moveError && (
        <div
          role="alert"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-surface border border-critical/40 text-[13px] rounded-control shadow-pop px-3.5 py-2.5"
        >
          <AlertTriangle size={15} className="text-critical shrink-0" />
          {moveError}
        </div>
      )}

      <BackendModal
        open={backendModalOpen}
        currentUrl={getApiBase()}
        onClose={() => setBackendModalOpen(false)}
        onSave={(url) => {
          setApiBase(url)
          setBackendModalOpen(false)
          refreshLeads()
        }}
      />
    </div>
  )
}
