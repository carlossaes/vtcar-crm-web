import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let start = null
    let raf
    const step = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setValue(Math.round(progress * target))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

export default function KpiCard({ icon: Icon, iconClass, label, value, change, changeUp, delay = 0 }) {
  const isNumber = typeof value === 'number'
  const animated = useCountUp(isNumber ? value : 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-bg2 border border-border rounded-xl p-5 flex flex-col gap-1.5"
    >
      {Icon && (
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-1 ${iconClass}`}>
          <Icon size={18} />
        </div>
      )}
      <div className="text-xs text-text2">{label}</div>
      <div className="text-[26px] font-extrabold">{isNumber ? animated.toLocaleString('pt-BR') : value}</div>
      {change && (
        <div className={`text-xs flex items-center gap-1 ${changeUp ? 'text-green-400' : 'text-accent'}`}>
          {changeUp ? '▲' : '▼'} {change}
        </div>
      )}
    </motion.div>
  )
}
