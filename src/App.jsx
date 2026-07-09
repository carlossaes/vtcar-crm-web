import { useCallback, useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import BackendModal from './components/BackendModal'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import { getApiBase, setApiBase, getLeads, updateLeadStage } from './api'

const TITLES = {
  dashboard: 'Dashboard',
  pipeline: 'Pipeline de Vendas',
  leads: 'Leads',
  clientes: 'Clientes',
  veiculos: 'Estoque de Veículos',
  atividades: 'Atividades',
  relatorios: 'Relatórios',
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [leads, setLeads] = useState([])
  const [search, setSearch] = useState('')
  const [backendModalOpen, setBackendModalOpen] = useState(false)
  const [backendConnected, setBackendConnected] = useState(!!getApiBase())

  const refreshLeads = useCallback(async () => {
    if (!getApiBase()) return
    try {
      const data = await getLeads()
      setLeads(data)
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

  const handleMoveStage = async (id, stage) => {
    await updateLeadStage(id, stage)
    refreshLeads()
  }

  const leadsCount = leads.length
  const pipelineCount = leads.filter((l) => ['novo', 'qualificado', 'proposta', 'negociacao'].includes(l.stage)).length

  return (
    <div className="flex min-h-screen">
      <Sidebar page={page} onNavigate={setPage} leadsCount={leadsCount} pipelineCount={pipelineCount} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title={TITLES[page]}
          onConfigureBackend={() => setBackendModalOpen(true)}
          backendConnected={backendConnected}
          onNewLead={() => setPage('leads')}
          search={search}
          onSearch={setSearch}
        />
        <div className="flex-1 p-6">
          {page === 'dashboard' && <Dashboard leads={leads} />}
          {page === 'leads' && <Leads leads={leads} search={search} onMoveStage={handleMoveStage} />}
          {!['dashboard', 'leads'].includes(page) && (
            <div className="bg-bg2 border border-border rounded-xl p-8 text-center text-text2 text-sm">
              Essa página ainda está em construção — em breve com o mesmo nível de acabamento do Dashboard e Leads.
            </div>
          )}
        </div>
      </div>
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
