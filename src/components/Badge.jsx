const CHANNEL_STYLES = {
  WhatsApp: 'bg-green-500/15 text-green-400',
  Instagram: 'bg-purple-500/15 text-purple-400',
  Site: 'bg-blue-500/15 text-blue-400',
  Facebook: 'bg-blue-500/15 text-blue-400',
  'Indicação': 'bg-yellow-500/15 text-yellow-400',
}

export const STAGE_STYLES = {
  novo: { label: 'Novo', className: 'bg-blue-500/15 text-blue-400' },
  qualificado: { label: 'Qualif.', className: 'bg-purple-500/15 text-purple-400' },
  proposta: { label: 'Proposta', className: 'bg-yellow-500/15 text-yellow-400' },
  negociacao: { label: 'Negociação', className: 'bg-orange-500/15 text-orange-400' },
  fechado: { label: 'Fechado', className: 'bg-green-500/15 text-green-400' },
  perdido: { label: 'Perdida', className: 'bg-gray-500/15 text-gray-400' },
}

export function ChannelBadge({ channel }) {
  const className = CHANNEL_STYLES[channel] || 'bg-gray-500/15 text-gray-400'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}>
      {channel || 'Desconhecido'}
    </span>
  )
}

export function StageBadge({ stage }) {
  const info = STAGE_STYLES[stage] || STAGE_STYLES.novo
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${info.className}`}>
      {info.label}
    </span>
  )
}
