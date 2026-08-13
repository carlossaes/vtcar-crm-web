// Os leads chegam do WhatsApp com o telefone cru (554396497125) e com o nome
// que a pessoa pos no proprio perfil — que as vezes e so um emoji, um ponto
// ou "...". Estas funcoes deixam isso apresentavel na tela sem alterar o dado
// guardado no backend.

const DDD_E_NUMERO = (ddd, numero) => {
  // Celular novo tem 9 digitos, fixo e numero antigo tem 8.
  const meio = numero.length === 9 ? numero.slice(0, 5) : numero.slice(0, 4)
  const fim = numero.length === 9 ? numero.slice(5) : numero.slice(4)
  return `(${ddd}) ${meio}-${fim}`
}

export function formatPhone(raw) {
  if (!raw) return null
  const d = String(raw).replace(/\D/g, '')

  // Com codigo do pais (55): 55 + DDD + 8 ou 9 digitos
  if (d.length === 13 && d.startsWith('55')) return DDD_E_NUMERO(d.slice(2, 4), d.slice(4))
  if (d.length === 12 && d.startsWith('55')) return DDD_E_NUMERO(d.slice(2, 4), d.slice(4))
  // Sem codigo do pais: DDD + 8 ou 9 digitos
  if (d.length === 11) return DDD_E_NUMERO(d.slice(0, 2), d.slice(2))
  if (d.length === 10) return DDD_E_NUMERO(d.slice(0, 2), d.slice(2))

  // Formato que a gente nao reconhece: devolve como veio, sem inventar.
  return String(raw)
}

// Tira emoji e simbolos, deixando letras, espacos e a pontuacao que aparece
// em nome de gente de verdade.
function limparNome(nome) {
  return String(nome || '')
    .replace(/[^\p{L}\p{M}\s'.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// "gustavo" -> "Gustavo", mas "C. Henrique" e "João arthur" continuam
// respeitados: so mexe na palavra que esta inteiramente em minuscula.
function capitalizar(nome) {
  return nome
    .split(' ')
    .map((p) => (p && p === p.toLowerCase() ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(' ')
}

/**
 * Nome que vai pra tela. Se o que veio do WhatsApp nao tem pelo menos duas
 * letras (casos "❤️💓", ".", "…"), mostra o telefone no lugar — mais util
 * pro vendedor do que um card sem identificacao.
 */
export function displayName(lead) {
  if (!lead) return 'Sem nome'
  const limpo = limparNome(lead.name)
  const letras = (limpo.match(/\p{L}/gu) || []).length
  if (letras >= 2) return capitalizar(limpo)
  return formatPhone(lead.phone) || 'Sem nome'
}

/** O lead tem nome de verdade, ou a gente esta caindo no telefone? */
export function hasName(lead) {
  if (!lead) return false
  return (limparNome(lead.name).match(/\p{L}/gu) || []).length >= 2
}

/** Iniciais pro avatar, a partir do nome ja tratado. */
export function initials(lead) {
  const nome = displayName(lead)
  const partes = nome.split(/\s+/).filter((p) => /^\p{L}/u.test(p))
  if (!partes.length) return '#'
  return partes
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}
