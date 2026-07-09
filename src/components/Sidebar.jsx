import { LayoutGrid, GitBranch, Users2, UserCircle, Car, Activity, BarChart3 } from 'lucide-react'

const NAV_SECTIONS = [
  { title: 'Principal', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutGrid }] },
  {
    title: 'Vendas',
    items: [
      { id: 'pipeline', label: 'Pipeline', icon: GitBranch },
      { id: 'leads', label: 'Leads', icon: Users2 },
      { id: 'clientes', label: 'Clientes', icon: UserCircle },
    ],
  },
  { title: 'Estoque', items: [{ id: 'veiculos', label: 'Veículos', icon: Car }] },
  {
    title: 'Gestão',
    items: [
      { id: 'atividades', label: 'Atividades', icon: Activity },
      { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    ],
  },
]

export default function Sidebar({ page, onNavigate, leadsCount, pipelineCount }) {
  return (
    <aside className="w-56 shrink-0 bg-bg2 border-r border-border flex flex-col h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-border flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center font-black text-white">VT</div>
        <span className="font-bold text-[17px]">
          <span className="text-accent">VT</span>Car CRM
        </span>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-text2">{section.title}</div>
            {section.items.map((item) => {
              const Icon = item.icon
              const active = page === item.id
              const badge = item.id === 'leads' ? leadsCount : item.id === 'pipeline' ? pipelineCount : null
              return (
                <div
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-2.5 px-4 py-2 text-[13px] cursor-pointer border-l-2 transition-colors ${
                    active ? 'bg-accent/10 text-accent border-accent' : 'text-text2 border-transparent hover:bg-bg3 hover:text-text'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                  {badge != null && badge > 0 && (
                    <span className="ml-auto bg-accent text-white rounded-full text-[10px] font-bold px-1.5 py-0.5">{badge}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="px-4 py-3.5 border-t border-border flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-bold text-[13px] text-white">CS</div>
        <div>
          <div className="text-[13px] font-semibold">Carlos Sales</div>
          <div className="text-[11px] text-text2">Gerente</div>
        </div>
      </div>
    </aside>
  )
}
