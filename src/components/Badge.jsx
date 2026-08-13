/**
 * Estagios do funil sao ORDENADOS, entao a cor deles e uma rampa de um unico
 * tom (claro -> escuro) e nao um arco-iris: a posicao no funil fica legivel
 * pela propria cor. "Perdido" sai da rampa e vira neutro, porque nao e um
 * degrau do funil — e a saida dele.
 */
export const STAGE_META = {
  novo: { label: 'Novo', dot: 'bg-stage1', order: 0 },
  qualificado: { label: 'Qualificado', dot: 'bg-stage2', order: 1 },
  proposta: { label: 'Proposta', dot: 'bg-stage3', order: 2 },
  negociacao: { label: 'Negociação', dot: 'bg-stage4', order: 3 },
  fechado: { label: 'Fechado', dot: 'bg-stage5', order: 4 },
  perdido: { label: 'Perdido', dot: 'bg-ink3', order: 5 },
}

export const STAGE_ORDER = ['novo', 'qualificado', 'proposta', 'negociacao', 'fechado']

const PILL = 'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface2 px-2.5 py-[3px] text-[11.5px] font-medium text-ink2 whitespace-nowrap'

export function StageBadge({ stage }) {
  const info = STAGE_META[stage] || STAGE_META.novo
  return (
    <span className={PILL}>
      <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${info.dot}`} aria-hidden="true" />
      {info.label}
    </span>
  )
}

export function ChannelBadge({ channel }) {
  return <span className={PILL}>{channel || 'Desconhecido'}</span>
}
