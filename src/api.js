const STORAGE_KEY = 'vtcar_api_base'

// Padrao usado quando ninguem configurou nada ainda — assim o CRM ja abre
// conectado em vez de exigir o passo manual de "Conectar backend".
// Um valor salvo no navegador sempre ganha deste.
export const DEFAULT_API_BASE = 'https://vtcar-gptmaker-integration-production.up.railway.app'

export function getApiBase() {
  const saved = (localStorage.getItem(STORAGE_KEY) || '').trim()
  return saved || DEFAULT_API_BASE
}

export function setApiBase(url) {
  const clean = url.trim().replace(/\/+$/, '')
  if (!clean) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, clean)
}

async function request(path, options = {}) {
  const base = getApiBase()
  if (!base) throw new Error('Backend nao configurado')
  const res = await fetch(base + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export function getLeads() {
  return request('/api/leads')
}

// Todos os atendimentos do GPT Maker, inclusive os anteriores ao webhook.
// Quem fala com a API do GPT Maker e o backend — o token fica so la.
export function getGptmakerChats() {
  return request('/api/gptmaker/chats')
}

export function createLead(data) {
  return request('/api/leads', { method: 'POST', body: JSON.stringify(data) })
}

export function updateLeadStage(id, stage) {
  return request(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ stage }) })
}

export function getLeadMessages(id) {
  return request(`/api/leads/${id}/messages`)
}

export function getLeadCoach(id) {
  return request(`/api/leads/${id}/coach`)
}

export function regenerateLeadCoach(id) {
  return request(`/api/leads/${id}/coach`, { method: 'POST' })
}
