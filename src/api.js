const STORAGE_KEY = 'vtcar_api_base'

export function getApiBase() {
  return (localStorage.getItem(STORAGE_KEY) || '').trim()
}

export function setApiBase(url) {
  localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/$/, ''))
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
