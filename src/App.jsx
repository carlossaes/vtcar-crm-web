import { useCallback, useEffect, useState } from 'react'
import { UserCircle, Car, Activity, BarChart3, Hammer, AlertTriangle } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import BackendModal from './components/BackendModal'
import EmptyState from './components/EmptyState'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Pipeline from './pages/Pipeline'
import { getApiBase, setApiBase, getLeads, updateLeadStage } from './api'

const PAGES = {
  dashboard: { title: 'Dashboard', subtitle: 'Visão geral da operação' },
  pipeline: { title: 'Pipeline de vendas', subtitle: 'Arraste o lead pelo funil' },
  leads: { title: 'Leads', subtitle: 'Todo mundo que a Vitória captou' },
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
  const [theme, setTheme] = useState(() => {
    if (typeof document === 'undefined') return 'dark'
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('vtcar_theme', theme)
    } catch (e) {
      /* modo privado: só não persiste */
    }
  }, [theme])

  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [leads, setLeads] = useState([])
  const [search, setSearch] = useState('')
  const [backendModalOpen, setBackendModalOpen] = useState(false)
  const [backendConnected, setBackendConnected] = useState(false)
  const [moveError, setMoveError] = useState(null)
  const [theme, toggleTheme] = usePersistedTheme()

  const refreshLeads = useCallback(async () => {
    if (!getApiBase()) return
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
    refreshLeads()
    const interval = setInterval(refreshLeads, 30000)
    return () => clearInterval(interval)
  }, [refreshLeads])

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

  return (
    <div className="flex min-h-screen bg-plane">
      <Sidebar page={page} onNavigate={setPage} leadsCount={leadsCount} pipelineCount={pipelineCount} />

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
