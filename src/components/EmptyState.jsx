import { motion } from 'framer-motion'

/**
 * Um vazio bem resolvido explica por que a tela esta vazia e o que fazer —
 * nunca so "sem dados".
 */
export default function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex flex-col items-center text-center ${compact ? 'py-10' : 'py-16'}`}
    >
      {Icon && (
        <div className="w-11 h-11 rounded-card bg-surface2 border border-line grid place-items-center mb-3.5">
          <Icon size={19} className="text-ink3" strokeWidth={1.8} />
        </div>
      )}
      <div className="text-[14.5px] font-semibold">{title}</div>
      {description && <p className="text-[13px] text-ink2 mt-1.5 max-w-[380px] leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  )
}
