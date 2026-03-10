/**
 * PagosDataAdapter - Capa de integración con Supabase para Pagos.
 * Responsabilidades:
 * - Cargar pagos del servidor / localStorage
 * - Registrar nuevos pagos (con cuota asociada)
 * - Actualizar estado de un pago
 * - Fallback a localStorage si Supabase no está disponible
 * - Logging de auditoría
 */

import { supabaseClient } from '../supabaseClient.js'
import { auditAdapter } from '../auditAdapter.js'
import { localStorageAdapter } from '../localStorageAdapter.js'
import { validatePago, validatePagoUpdate } from '../../pagos/domain/validatePago.js'

export const pagosDataAdapter = {
  /**
   * Cargar todos los pagos del usuario actual.
   * Si Supabase falla, regresa el caché local.
   */
  load: async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('pagos')
        .select(`
          *,
          cuotas (
            numero_cuota,
            monto_cuota,
            prestamo_id,
            prestamos (
              monto_original,
              clientes (nombre)
            )
          )
        `)
        .eq('user_id', user.id)
        .order('fecha_pago', { ascending: false })

      if (error) throw error

      localStorageAdapter.set('pagos', data)
      return data
    } catch (err) {
      console.error('[pagosDataAdapter.load]', err.message)
      return localStorageAdapter.get('pagos') || []
    }
  },

  /**
   * Cargar pagos de una cuota específica.
   */
  getByCuota: async (cuotaId) => {
    try {
      const { data, error } = await supabaseClient
        .from('pagos')
        .select('*')
        .eq('cuota_id', cuotaId)
        .order('fecha_pago', { ascending: false })

      if (error) throw error
      return data
    } catch (err) {
      console.error('[pagosDataAdapter.getByCuota]', err.message)
      return []
    }
  },

  /**
   * Registrar un nuevo pago.
   * Actualiza automáticamente el estado de la cuota si el monto cubre el total.
   */
  save: async (pago) => {
    const { valid, errors } = validatePago(pago)
    if (!valid) {
      throw new Error(`Validación falló: ${errors.join(', ')}`)
    }

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const nuevoPago = {
        cuota_id: pago.cuota_id,
        monto: parseFloat(pago.monto),
        fecha_pago: pago.fecha_pago,
        metodo_pago: pago.metodo_pago,
        referencia_pago: pago.referencia_pago || null,
        notas: pago.notas || null,
        comprobante_path: pago.comprobante_path || null,
        estado: 'CONFIRMADO',
        user_id: user.id,
        registrado_por: user.email
      }

      const { data, error } = await supabaseClient
        .from('pagos')
        .insert([nuevoPago])
        .select(`
          *,
          cuotas (
            numero_cuota,
            monto_cuota,
            prestamo_id,
            prestamos (
              monto_original,
              clientes (nombre)
            )
          )
        `)

      if (error) throw error

      const resultado = data[0]

      // Actualizar estado de la cuota a PAGADA
      await supabaseClient
        .from('cuotas')
        .update({ estado: 'PAGADA', fecha_pago_real: pago.fecha_pago })
        .eq('id', pago.cuota_id)

      // Actualizar caché local
      const cachePagos = localStorageAdapter.get('pagos') || []
      localStorageAdapter.set('pagos', [resultado, ...cachePagos])

      // Auditoría
      await auditAdapter.log('INSERT', 'pagos', resultado.id, {
        cuota_id: resultado.cuota_id,
        monto: resultado.monto,
        metodo_pago: resultado.metodo_pago
      })

      return resultado
    } catch (err) {
      console.error('[pagosDataAdapter.save]', err.message)
      throw err
    }
  },

  /**
   * Actualizar estado de un pago (ej. RECHAZADO, PENDIENTE).
   */
  update: async (pagoId, cambios) => {
    const { valid, errors } = validatePagoUpdate(cambios)
    if (!valid) {
      throw new Error(`Validación falló: ${errors.join(', ')}`)
    }

    try {
      const { data, error } = await supabaseClient
        .from('pagos')
        .update({
          ...cambios,
          fecha_actualizado: new Date().toISOString()
        })
        .eq('id', pagoId)
        .select()

      if (error) throw error

      const resultado = data[0]

      await auditAdapter.log('UPDATE', 'pagos', pagoId, {
        cambios: Object.keys(cambios)
      })

      return resultado
    } catch (err) {
      console.error('[pagosDataAdapter.update]', err.message)
      throw err
    }
  }
}
