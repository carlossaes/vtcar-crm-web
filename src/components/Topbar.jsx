import { Search, Settings2, Plus } from 'lucide-react'

export default function Topbar({ title, onConfigureBackend, backendConnected, onNewLead, search, onSearch }) {
  return (
    <header className="h-14 bg-bg2 border-b border-border flex items-center px-6 gap-4 sticky top-0 z-20">
      <h1 className="text-base font-bold flex-1">{title}</h1>
      <div className="flex items-center gap-2 bg-bg3 border border-border rounded-lg px-3 py-1.5 w-56">
        <Search size={14} className="text-text2 shrink-0" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar cliente, veículo…"
          className="bg-transparent outline-none text-[13px] flex-1 placeholder:text-text2 min-w-0"
        />
      </div>
      <button
        onClick={onConfigureBackend}
        className="flex items-center gap-1.5 border border-border rounded-lg px-3.5 py-1.5 text-[13px] text-text2 hover:text-text hover:border-text2 transition-colors whitespace-nowrap"
      >
        <Settings2 size={14} />
        {backendConnected ? 'Backend conectado' : 'Conectar backend'}
      </button>
      <button
        onClick={onNewLead}
        className="flex items-center gap-1.5 bg-accent hover:bg-accent2 transition-colors text-white rounded-lg px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap"
      >
        <Plus size={14} />
        Novo Lead
      </button>
    </header>
  )
}
