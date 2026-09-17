import { useState } from 'react'
import { formatCurrencyInput } from '../formInputs'

export default function CurrencyInput({ value, onChange, label, className }) {
  const [focused, setFocused] = useState(false)
  let display = value ?? ''
  if (focused && typeof value === 'number') display = String(value).replace('.', ',')
  if (!focused) {
    try { display = formatCurrencyInput(value) } catch { /* Preserva texto inválido para correção. */ }
  }
  return <input type="text" inputMode="decimal" aria-label={label} className={className}
    placeholder="R$ 0,00" value={display}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    onChange={(event) => onChange(event.target.value)} />
}
