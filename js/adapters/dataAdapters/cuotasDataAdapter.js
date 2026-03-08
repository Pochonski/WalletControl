/**
 * CuotasDataAdapter - Capa de integración con Supabase
 *
 * Responsabilidades:
 * - Cargar las cuotas asociadas a un préstamo
 * - (Los inserts de cuotas ocurren vía RPC al crear el préstamo, por lo que no hay save() directo aquí)
 */

import { supabaseClient } from '../supabaseClient.js'
import { localStorageAdapter } from '../localStorageAdapter.js'
import { auditAdapter } from '../auditAdapter.js'

export const cuotasDataAdapter = {
  /**
   * Cargar todas las cuotas de un préstamo
   * @param {string} prestamoId UUID del préstamo
   */
  getByPrestamo: async (prestamoId) => {
    try {
      // Si el préstamo se guardó offline, tiene un id temporal
      if (typeof prestamoId === 'string' && prestamoId.startsWith('temp-')) {
        return localStorageAdapter.get(`cuotas_${prestamoId}`) || []
      }

      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('cuotas')
        .select('*')
        .eq('prestamo_id', prestamoId)
        .order('numero_cuota', { ascending: true })

      if (error) throw error

      // Guardar en localStorage para offline fallback
      localStorageAdapter.set(`cuotas_${prestamoId}`, data)

      return data
    } catch (err) {
      console.error('[cuotasDataAdapter.getByPrestamo]', err.message)
      // Fallback local
      return localStorageAdapter.get(`cuotas_${prestamoId}`) || []
    }
  },

  /**
   * Actualizar estado de una cuota (ej. marcar como PAGADA)
   */
  update: async (cuotaId, cambios) => {
    try {
      const { data, error } = await supabaseClient
        .from('cuotas')
        .update(cambios)
        .eq('id', cuotaId)
        .select()

      if (error) throw error

      const resultado = data[0]

      // Actualizar local (opcionalmente se podría actualizar el array guardado)
      // localStorageAdapter.set(`cuotas_${resultado.prestamo_id}`, ...)

      // Auditoría
      await auditAdapter.log('UPDATE', 'cuotas', cuotaId, {
        cambios: Object.keys(cambios)
      })

      return resultado
    } catch (err) {
      console.error('[cuotasDataAdapter.update]', err.message)
      throw err
    }
  }
}
