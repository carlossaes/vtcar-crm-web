// FINALIZAÇÃO V2 — campo de data no padrão brasileiro (dd/mm/aaaa).
// Só APRESENTAÇÃO: o valor entregue ao formulário continua ISO (aaaa-mm-dd),
// o mesmo formato que o backend e a Zinix já recebem. Não depende do idioma
// do navegador (o <input type="date"> nativo mostrava mm/dd/yyyy em inglês).
// - data completa → onChange('aaaa-mm-dd') (validade/idade seguem as regras atuais);
// - data incompleta → onChange com o texto parcial (as validações atuais a recusam);
// - vazio → onChange('').
import { useEffect, useState } from 'react'

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/
export function isoParaBR(iso) {
  const m = ISO.exec(iso || '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
export function mascaraData(texto) {
  const d = String(texto || '').replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}
// Valor que o formulário recebe a partir do que foi digitado.
export function valorDigitado(texto) {
  if (ISO.test(texto || '')) return texto // colado/preenchido já em ISO
  const d = String(texto || '').replace(/\D/g, '').slice(0, 8)
  if (!d) return ''
  if (d.length === 8) return `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`
  return mascaraData(d)
}

export default function DataBR({ value, onChange, id, className, ...rest }) {
  const [texto, setTexto] = useState(() => isoParaBR(value) || (ISO.test(value || '') ? '' : mascaraData(value)))
  // Valor trocado de fora (reabrir, limpar o formulário, dado vindo do servidor).
  useEffect(() => {
    if (ISO.test(value || '')) { const br = isoParaBR(value); if (br !== texto) setTexto(br) }
    else if (!value && texto) setTexto('')
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input id={id} type="text" inputMode="numeric" autoComplete="off" maxLength={10} placeholder="dd/mm/aaaa"
      className={className} value={texto} {...rest}
      onChange={(e) => {
        const v = e.target.value
        setTexto(ISO.test(v) ? isoParaBR(v) : mascaraData(v))
        onChange(valorDigitado(v))
      }} />
  )
}
