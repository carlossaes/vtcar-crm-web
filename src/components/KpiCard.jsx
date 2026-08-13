import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const semAnimacao =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden

    // Em aba de fundo o navegador congela o requestAnimationFrame, e a
    // contagem ficava parada num numero errado — 85 no lugar de 201, por
    // exemplo. Aqui a gente simplesmente nao anima e ja mostra o valor certo.
    if (semAnimacao) {
      setValue(target)
      return
    }

    let start = null
    let raf
    const step = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      // easeOutCubic — chega no numero final sem parecer que travou
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) raf = requestAnimationFrame(step)
      else setValue(target)
    }
    raf = requestAnimationFrame(step)

    // Rede de seguranca: aconteca o que acontecer com a animacao, depois do
    // tempo previsto o numero exibido e o numero real.
    const guarda = setTimeout(() => setValue(target), duration + 500)
    // Se a aba voltar pro primeiro plano no meio do caminho, corrige na hora.
    const aoVoltar = () => !document.hidden && setValue(target)
    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(guarda)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [target, duration])

  return value
}

const TREND = {
  up: { Icon: ArrowUpRight, className: 'text-good' },
  down: { Icon: ArrowDownRight, className: 'text-critical' },
  flat: { Icon: Minus, className: 'text-ink3' },
}

/**
 * Stat tile. O numero e o protagonista; o icone fica discreto no canto.
 * A variacao vem sempre com seta + texto — nunca so cor.
 */
export default function KpiCard({ icon: Icon, label, value, hint, trend = 'flat', delay = 0 }) {
  const isNumber = typeof value === 'number'
  const animated = useCountUp(isNumber ? value : 0)
  const { Icon: TrendIcon, className: trendClass } = TREND[trend] || TREND.flat

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: 'easeOut' }}
      className="bg-surface border border-line rounded-card p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[12.5px] font-medium text-ink2">{label}</div>
        {Icon && <Icon size={16} className="text-ink3 shrink-0" strokeWidth={2} />}
      </div>
      <div className="text-kpi font-bold mt-2.5">{isNumber ? animated.toLocaleString('pt-BR') : value}</div>
      {hint && (
        <div className={`text-[12px] mt-1.5 flex items-center gap-1 ${trend === 'flat' ? 'text-ink3' : trendClass}`}>
          {/* Seta so aparece quando ha comparacao de verdade — sem ela, o
              texto sozinho ja diz tudo e o card fica mais limpo. */}
          {trend !== 'flat' && <TrendIcon size={13} strokeWidth={2.5} className="shrink-0" />}
          <span>{hint}</span>
        </div>
      )}
    </motion.div>
  )
}
