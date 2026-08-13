import { Search, Plus, Sun, Moon, Wifi, WifiOff } from 'lucide-react'

export default function Topbar({
  title,
  subtitle,
  onConfigureBackend,
  backendConnected,
  onNewLead,
  search,
  onSearch,
  theme,
  onToggleTheme,
}) {
  return (
    <header className="h-16 bg-surface/85 backdrop-blur border-b border-line flex items-center px-6 gap-3 sticky top-0 z-20">
      <div className="min-w-0 mr-auto">
        <h1 className="text-[17px] font-bold tracking-tight leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-[12px] text-ink3 leading-tight truncate">{subtitle}</p>}
      </div>

      <label className="hidden md:flex items-center gap-2 bg-surface2 border border-line rounded-control px-3 h-9 w-64 focus-within:border-lineStrong transition-colors">
        <Search size={15} className="text-ink3 shrink-0" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar lead, telefone, canal…"
          aria-label="Buscar"
          className="bg-transparent outline-none text-[13px] flex-1 placeholder:text-ink3 min-w-0"
        />
      </label>

      {/* Estado do backend: icone + texto, nunca so a cor. */}
      <button
        onClick={onConfigureBackend}
        title="Configurar a URL do backend"
        className="flex items-center gap-2 border border-line rounded-control px-3 h-9 text-[13px] font-medium text-ink2 hover:text-ink hover:border-lineStrong transition-colors whitespace-nowrap"
      >
        {backendConnected ? (
          <Wifi size={14} className="text-good" />
        ) : (
          <WifiOff size={14} className="text-ink3" />
        )}
        <span className="hidden lg:inline">{backendConnected ? 'Conectado' : 'Conectar backend'}</span>
      </button>

      <button
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        className="grid place-items-center w-9 h-9 border border-line rounded-control text-ink2 hover:text-ink hover:border-lineStrong transition-colors"
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      <button
        onClick={onNewLead}
        className="flex items-center gap-1.5 bg-brand hover:bg-brandHover transition-colors text-brandInk rounded-control px-3.5 h-9 text-[13px] font-semibold whitespace-nowrap"
      >
        <Plus size={15} strokeWidth={2.5} />
        Novo lead
      </button>
    </header>
  )
}
