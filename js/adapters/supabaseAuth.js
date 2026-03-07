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
