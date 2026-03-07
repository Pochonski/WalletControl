import { supabaseClient } from './supabaseClient.js'

/**
 * Registra un nuevo usuario con email y password.
 * @param {string} email
 * @param {string} password
 * @returns {{ user: object, session: object }}
 */
export async function register(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({ email, password })
  if (error) throw error
  return data
}

/**
 * Inicia sesion con email y password.
 * @param {string} email
 * @param {string} password
 * @returns {{ user: object, session: object }}
 */
export async function login(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

/**
 * Cierra la sesion actual.
 * El caller es responsable de limpiar Redux y localStorage despues de esto.
 */
export async function logout() {
  const { error } = await supabaseClient.auth.signOut()
  if (error) throw error
}

/**
 * Retorna el usuario autenticado actualmente, o null si no hay sesion.
 * @returns {object|null} user
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabaseClient.auth.getUser()
  return user
}

/**
 * Obtiene la sesión actual y el JWT token.
 * Supabase maneja el token internamente, pero lo exponemos para uso avanzado.
 * @returns {{ session: object|null, token: string|null }}
 */
export async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession()
  return {
    session,
    token: session?.access_token ?? null,
  }
}

/**
 * Refresca el JWT token manualmente.
 * Normalmente Supabase lo hace automáticamente, pero está disponible para casos especiales.
 * @returns {{ session: object|null, error: object|null }}
 */
export async function refreshToken() {
  const { data, error } = await supabaseClient.auth.refreshSession()
  return { session: data.session, error }
}

/**
 * Verifica si la sesión actual es válida.
 * @returns {boolean}
 */
export async function isSessionValid() {
  const { session } = await getSession()
  if (!session) return false

  // Verificar si el token no ha expirado
  const expiresAt = session.expires_at * 1000 // convertir a milisegundos
  return Date.now() < expiresAt
}

/**
 * Obtiene el tiempo restante antes de que expire el token (en milisegundos).
 * Retorna -1 si no hay sesión.
 * @returns {number}
 */
export async function getTokenExpiresIn() {
  const { session } = await getSession()
  if (!session) return -1

  const expiresAt = session.expires_at * 1000 // convertir a milisegundos
  const timeRemaining = expiresAt - Date.now()
  return Math.max(timeRemaining, 0)
}

/**
 * Suscribe un callback a cambios de estado de autenticacion.
 * Retorna una funcion para cancelar la suscripcion.
 *
 * @param {function} callback - Recibe { event, session }
 *   Eventos posibles: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED
 * @returns {function} unsubscribe
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
    (event, session) => callback({ event, session })
  )
  return () => subscription.unsubscribe()
}

/**
 * Extrae claims del JWT token (información del usuario codificada).
 * Nota: Los claims están disponibles en session.user, pero este método
 * permite acceder a claims adicionales si están presentes en custom claims de Supabase.
 * @returns {object|null}
 */
export async function getTokenClaims() {
  const user = await getCurrentUser()
  if (!user) return null

  return {
    sub: user.id,
    email: user.email,
    email_confirmed_at: user.email_confirmed_at,
    created_at: user.created_at,
    // Supabase guarda user_metadata y app_metadata
    metadata: {
      user_metadata: user.user_metadata || {},
      app_metadata: user.app_metadata || {},
    },
  }
}
