import { getToken, limparSessao } from './auth'

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

// Quando a sessao cai, avisamos o App pra voltar pra tela de login em vez
// de deixar a pessoa olhando telas vazias sem entender o motivo.
let aoPerderSessao = () => {}
export function definirAoPerderSessao(fn) {
  aoPerderSessao = typeof fn === 'function' ? fn : () => {}
}

async function request(path, options = {}) {
  const base = getApiBase()
  if (!base) throw new Error('Backend nao configurado')

  const token = getToken()
  const res = await fetch(base + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    limparSessao()
    aoPerderSessao()
    throw new Error('Sessão expirada. Entre novamente.')
  }

  if (!res.ok) {
    // O backend manda { error: "mensagem" }; preferimos ela ao "HTTP 400" cru.
    const corpo = await res.json().catch(() => null)
    throw new Error(corpo?.error || `HTTP ${res.status}`)
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

// Traz pro CRM os contatos que existem no GPT Maker e nunca viraram lead.
// Com ensaio = true nada e gravado; serve pra conferir antes.
export function importarAntigos(ensaio = false) {
  return request(`/api/gptmaker/importar-antigos${ensaio ? '?dryRun=1' : ''}`, { method: 'POST' })
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

/* ---------- autenticação ---------- */

export function precisaConfigurar() {
  return request('/api/auth/precisa-configurar')
}

export function conferirConvite(token) {
  return request(`/api/auth/convite/${encodeURIComponent(token)}`)
}

export function aceitarConvite(dados) {
  return request('/api/auth/aceitar-convite', { method: 'POST', body: JSON.stringify(dados) })
}

export function listarConvites() {
  return request('/api/usuarios/convites')
}

export function criarConvite(dados) {
  return request('/api/usuarios/convites', { method: 'POST', body: JSON.stringify(dados) })
}

export function revogarConvite(id) {
  return request(`/api/usuarios/convites/${id}`, { method: 'DELETE' })
}

export function primeiroAcesso(dados) {
  return request('/api/auth/primeiro-acesso', { method: 'POST', body: JSON.stringify(dados) })
}

export function login(email, senha) {
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) })
}

export function meuUsuario() {
  return request('/api/auth/eu')
}

export function trocarSenha(senhaAtual, novaSenha) {
  return request('/api/auth/trocar-senha', { method: 'POST', body: JSON.stringify({ senhaAtual, novaSenha }) })
}

export function esqueciSenha(email) {
  return request('/api/auth/esqueci-senha', { method: 'POST', body: JSON.stringify({ email }) })
}

export function redefinirSenha(token, novaSenha) {
  return request('/api/auth/redefinir-senha', { method: 'POST', body: JSON.stringify({ token, novaSenha }) })
}

/* ---------- usuários (só gerente) ---------- */

export function listarUsuarios() {
  return request('/api/usuarios')
}

export function criarUsuario(dados) {
  return request('/api/usuarios', { method: 'POST', body: JSON.stringify(dados) })
}

export function atualizarUsuario(id, campos) {
  return request(`/api/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(campos) })
}

export function removerUsuario(id) {
  return request(`/api/usuarios/${id}`, { method: 'DELETE' })
}

export function reenviarSenha(id) {
  return request(`/api/usuarios/${id}/reenviar-senha`, { method: 'POST' })
}
