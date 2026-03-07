/**
 * LocalStorageAdapter - Persistencia local para offline-first
 *
 * Almacena datos en localStorage para:
 * - Cache de datos cuando no hay conexión
 * - Fallback si Supabase falla
 * - Pending sync queue
 */

export const localStorageAdapter = {
  /**
   * Obtener datos del localStorage
   */
  get: (key) => {
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (err) {
      console.warn(`[localStorageAdapter.get] Error reading ${key}:`, err)
      return null
    }
  },

  /**
   * Guardar datos en localStorage
   */
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (err) {
      console.warn(`[localStorageAdapter.set] Error writing ${key}:`, err)
      // Si localStorage está lleno, limpiar datos antiguos
      if (err.name === 'QuotaExceededError') {
        console.error('localStorage full, clearing old data')
        localStorage.clear()
      }
    }
  },

  /**
   * Agregar un item a un array en localStorage
   */
  push: (key, item) => {
    const array = localStorageAdapter.get(key) || []
    array.push(item)
    localStorageAdapter.set(key, array)
  },

  /**
   * Actualizar un item en un array por ID
   */
  updateById: (key, id, updates) => {
    const array = localStorageAdapter.get(key) || []
    const updated = array.map(item => item.id === id ? { ...item, ...updates } : item)
    localStorageAdapter.set(key, updated)
  },

  /**
   * Remover un item de un array por ID
   */
  removeById: (key, id) => {
    const array = localStorageAdapter.get(key) || []
    const filtered = array.filter(item => item.id !== id)
    localStorageAdapter.set(key, filtered)
  },

  /**
   * Limpiar una clave
   */
  remove: (key) => {
    try {
      localStorage.removeItem(key)
    } catch (err) {
      console.warn(`[localStorageAdapter.remove] Error removing ${key}:`, err)
    }
  },

  /**
   * Limpiar todo
   */
  clear: () => {
    try {
      localStorage.clear()
    } catch (err) {
      console.warn('[localStorageAdapter.clear] Error clearing all:', err)
    }
  }
}
