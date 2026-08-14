// Sessão do usuário: token e dados de quem está logado.
// O token fica no localStorage — some ao limpar o navegador, e o backend
// confere a validade a cada chamada.

const TOKEN_KEY = 'vtcar_token'
const USER_KEY = 'vtcar_usuario'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null
  } catch (e) {
    return null
  }
}

export function getUsuario() {
  try {
    const cru = localStorage.getItem(USER_KEY)
    return cru ? JSON.parse(cru) : null
  } catch (e) {
    return null
  }
}

export function salvarSessao(token, usuario) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    if (usuario) localStorage.setItem(USER_KEY, JSON.stringify(usuario))
  } catch (e) {
    /* modo privado: a sessão vale só enquanto a aba estiver aberta */
  }
}

export function limparSessao() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch (e) {
    /* nada a fazer */
  }
}

export const ehGerente = (usuario) => usuario?.papel === 'gerente'
