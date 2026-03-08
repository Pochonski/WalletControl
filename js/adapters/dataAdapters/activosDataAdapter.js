import { supabaseClient } from '../supabaseClient.js'

// Funciones de ayuda para persistencia local en caso offline-first
const loadFromLocalStorage = (key) => JSON.parse(localStorage.getItem(key) || '[]')
const saveToLocalStorage = (key, data) => {
  const current = loadFromLocalStorage(key)
  const index = current.findIndex(item => item.id === data.id)
  if (index >= 0) {
    current[index] = data
  } else {
    current.push(data)
  }
  localStorage.setItem(key, JSON.stringify(current))
}

export const activosDataAdapter = {
  // CARGAR datos
  load: async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('activos')
        .select('*')
        // El RLS ya filtra por user_id, pero se puede añadir explícitamente por precaución
        .eq('user_id', user.id)
        .order('fecha_creado', { ascending: false })

      if (error) throw error

      // Actualizar caché local
      localStorage.setItem('activos_cache', JSON.stringify(data))
      
      return data
    } catch (err) {
      console.error('[activosDataAdapter] Error loading:', err.message)
      // Fallback a localStorage
      return loadFromLocalStorage('activos_cache') || []
    }
  },

  // CREAR
  save: async (item) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const payload = {
        ...item,
        user_id: user.id
      }

      const { data, error } = await supabaseClient
        .from('activos')
        .insert([payload])
        .select()

      if (error) throw error

      // Persistir local
      saveToLocalStorage('activos_cache', data[0])
      
      return data[0]
    } catch (err) {
      console.error('[activosDataAdapter] Error saving:', err.message)
      throw err
    }
  },

  // ACTUALIZAR
  update: async (id, cambios) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('activos')
        .update(cambios)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()

      if (error) throw error

      saveToLocalStorage('activos_cache', data[0])
      return data[0]
    } catch (err) {
      console.error('[activosDataAdapter] Error updating:', err.message)
      throw err
    }
  }
}
