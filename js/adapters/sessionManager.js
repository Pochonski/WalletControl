/**
 * sessionManager.js — Gestiona sesiones de usuario y tokens JWT.
 *
 * Responsabilidades:
 * - Mantener el estado de sesión en memoria
 * - Refrescar tokens antes de que expiren
 * - Validar permisos de usuario
 * - Manejar expiración de sesión
 *
 * Nota: Supabase ya maneja tokens, pero este módulo añade lógica de negocio.
 */

import * as supabaseAuth from './supabaseAuth.js'

// Estado de sesión actual (memoria)
let currentSession = null
let tokenRefreshTimer = null
let expirationCallbacks = []

/**
 * Inicializa el gestor de sesiones.
 * Debe llamarse una sola vez al startup de la aplicación.
 * @param {function} onSessionExpired - Callback cuando la sesión expira
 */
export async function initSessionManager(onSessionExpired = null) {
  // Cargar sesión actual
  currentSession = await supabaseAuth.getSession()

  // Si hay sesión, configurar refresh automático
  if (currentSession.session) {
    _scheduleTokenRefresh(currentSession.session)
  }

  // Registrar callback de expiración si se proporciona
  if (onSessionExpired) {
    expirationCallbacks.push(onSessionExpired)
  }
}

/**
 * Obtiene la sesión actual.
 * @returns {{ session: object|null, token: string|null }}
 */
export function getSession() {
  return currentSession
}

/**
 * Obtiene el token JWT actual.
 * @returns {string|null}
 */
export function getToken() {
  return currentSession?.token ?? null
}

/**
 * Verifica si la sesión actual es válida.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!currentSession?.session && !!currentSession?.token
}

/**
 * Obtiene información del usuario actual desde la sesión.
 * @returns {object|null}
 */
export function getCurrentUserSession() {
  return currentSession?.session?.user ?? null
}

/**
 * Actualiza la sesión actual (después de login, por ejemplo).
 * @param {object} newSession - Nueva sesión
 */
export async function updateSession(newSession) {
  currentSession = newSession

  if (newSession?.session) {
    _scheduleTokenRefresh(newSession.session)
  } else {
    _clearTokenRefreshTimer()
  }
}

/**
 * Limpia la sesión (logout).
 */
export function clearSession() {
  currentSession = null
  _clearTokenRefreshTimer()
}

/**
 * Valida si el usuario tiene permisos para una operación.
 * Nota: Los permisos reales se validan en Supabase (RLS), pero esta función
 * proporciona validación de lado del cliente para UX.
 *
 * @param {string} action - Acción a validar (CREATE, READ, UPDATE, DELETE)
 * @param {string} resource - Recurso (cliente, prestamo, pago, etc)
 * @param {object} data - Datos opcionales para validación adicional
 * @returns {boolean}
 */
export function hasPermission(action, resource, data = {}) {
  if (!isAuthenticated()) return false

  const user = getCurrentUserSession()
  if (!user) return false

  // Validaciones básicas de permisos por acción
  switch (action) {
    case 'CREATE':
      // Todos los usuarios autenticados pueden crear
      return true
    case 'READ':
      // El usuario puede leer si es propietario (validado en RLS)
      return !!data.user_id || true
    case 'UPDATE':
      // El usuario puede actualizar si es propietario
      return !data.user_id || data.user_id === user.id
    case 'DELETE':
      // Los deletes son soft-deletes (actualizaciones)
      return !data.user_id || data.user_id === user.id
    default:
      return false
  }
}

/**
 * Registra un callback para cuando la sesión expira.
 * @param {function} callback
 */
export function onSessionExpire(callback) {
  expirationCallbacks.push(callback)
}

/**
 * Desuscribe un callback de expiración de sesión.
 * @param {function} callback
 */
export function offSessionExpire(callback) {
  expirationCallbacks = expirationCallbacks.filter(cb => cb !== callback)
}

// ── Internos ───────────────────────────────────────────────────────────────

/**
 * Programa el refresh automático de token.
 * Se ejecuta 5 minutos antes de que expire el token.
 * @param {object} session
 */
function _scheduleTokenRefresh(session) {
  _clearTokenRefreshTimer()

  const expiresAt = session.expires_at * 1000 // milisegundos
  const now = Date.now()
  const refreshBefore = 5 * 60 * 1000 // 5 minutos antes de expirar

  const timeUntilRefresh = expiresAt - now - refreshBefore

  if (timeUntilRefresh > 0) {
    tokenRefreshTimer = setTimeout(async () => {
      try {
        const { session: newSession, error } = await supabaseAuth.refreshToken()
        if (!error && newSession) {
          await updateSession({ session: newSession, token: newSession.access_token })
        } else {
          // Token refresh falló, notificar callbacks
          _notifySessionExpired()
        }
      } catch (err) {
        console.error('[SessionManager] Error refrescando token:', err)
        _notifySessionExpired()
      }
    }, timeUntilRefresh)
  } else {
    // Token ya está por expirar o expirado
    _notifySessionExpired()
  }
}

/**
 * Limpia el timer de refresh.
 */
function _clearTokenRefreshTimer() {
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer)
    tokenRefreshTimer = null
  }
}

/**
 * Notifica todos los callbacks que la sesión expiró.
 */
function _notifySessionExpired() {
  clearSession()
  expirationCallbacks.forEach(cb => {
    try {
      cb()
    } catch (err) {
      console.error('[SessionManager] Error en callback de expiración:', err)
    }
  })
}
