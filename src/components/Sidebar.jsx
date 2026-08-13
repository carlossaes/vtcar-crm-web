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
    <aside className="w-[228px] shrink-0 bg-surface border-r border-line flex flex-col h-screen sticky top-0">
      <div className="px-5 h-16 flex items-center gap-3 border-b border-line">
        <div className="w-8 h-8 rounded-[9px] bg-brand grid place-items-center text-brandInk font-extrabold text-[13px] tracking-tight">
          VT
        </div>
        <div className="leading-tight">
          <div className="font-bold text-[15px] tracking-tight">VT Car</div>
          <div className="text-[11px] text-ink3 font-medium">CRM de vendas</div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 overflow-y-auto flex flex-col gap-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="px-2.5 pb-1.5 text-micro uppercase font-semibold text-ink3">{section.title}</div>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const active = page === item.id
                const badge = item.id === 'leads' ? leadsCount : item.id === 'pipeline' ? pipelineCount : null
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`group w-full flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[13.5px] font-medium transition-colors ${
                      active
                        ? 'bg-brand/10 text-brand'
                        : 'text-ink2 hover:bg-surface2 hover:text-ink'
                    }`}
                  >
                    <Icon size={16} strokeWidth={2} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {badge != null && badge > 0 && (
                      <span
                        className={`ml-auto tnum rounded-full text-[11px] font-semibold px-1.5 min-w-[20px] text-center ${
                          active ? 'bg-brand text-brandInk' : 'bg-surface3 text-ink2'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-line">
        <div className="flex items-center gap-2.5 rounded-control px-2 py-2 hover:bg-surface2 transition-colors">
          <div className="w-8 h-8 rounded-full bg-surface3 border border-line grid place-items-center font-semibold text-[12px] text-ink2">
            CS
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold truncate">Carlos Sales</div>
            <div className="text-[11px] text-ink3">Gerente</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
