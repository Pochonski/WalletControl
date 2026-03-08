/**
 * PrestamosDataAdapter - Capa de integración con Supabase
 * Responsabilidades:
 * - Cargar préstamos del servidor/localStorage
 * - Crear, actualizar, archivar préstamos
 * - Fallback a localStorage si Supabase falla
 * - Logging de auditoría
 */

import { supabaseClient } from '../supabaseClient.js'
import { auditAdapter } from '../auditAdapter.js'
import { localStorageAdapter } from '../localStorageAdapter.js'
import { validatePrestamo, validatePrestamoUpdate } from '../../prestamos/domain/validatePrestamo.js'

export const prestamosDataAdapter = {
  /**
   * Cargar todos los préstamos del usuario actual
   */
  load: async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('prestamos')
        .select(`
          *,
          clientes (
            nombre,
            cedula
          )
        `)
        .eq('user_id', user.id)
        .order('fecha_inicio', { ascending: false })

      if (error) throw error

      // Guardar en localStorage para offline
      localStorageAdapter.set('prestamos', data)

      return data
    } catch (err) {
      console.error('[prestamosDataAdapter.load]', err.message)
      // Fallback a localStorage
      return localStorageAdapter.get('prestamos') || []
    }
  },

  /**
   * Crear nuevo préstamo
   */
  save: async (prestamo) => {
    // Validar
    const { valid, errors } = validatePrestamo(prestamo)
    if (!valid) {
      throw new Error(`Validación falló: ${errors.join(', ')}`)
    }

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const nuevoPrestamo = {
        ...prestamo,
        user_id: user.id,
        estado: 'ACTIVO', // Por defecto al crear
        fecha_creado: new Date().toISOString()
      }

      const { data, error } = await supabaseClient
        .from('prestamos')
        .insert([nuevoPrestamo])
        .select(`
          *,
          clientes (
            nombre,
            cedula
          )
        `)

      if (error) throw error

      const resultado = data[0]

      // Guardar local
      const actual = localStorageAdapter.get('prestamos') || []
      localStorageAdapter.set('prestamos', [resultado, ...actual])

      // Auditoría
      await auditAdapter.log('INSERT', 'prestamo', resultado.id, {
        cliente_id: resultado.cliente_id,
        monto: resultado.monto
      })

      return resultado
    } catch (err) {
      console.error('[prestamosDataAdapter.save]', err.message)

      // Fallback offline: guardar con ID temporal
      const prestamoOffline = {
        ...prestamo,
        id: `temp-${Date.now()}`,
        user_id: null,
        estado: 'ACTIVO',
        fecha_creado: new Date().toISOString(),
        _pendingSync: true
      }

      const actual = localStorageAdapter.get('prestamos') || []
      localStorageAdapter.set('prestamos', [prestamoOffline, ...actual])

      return prestamoOffline
    }
  },

  /**
   * Actualizar préstamo existente
   */
  update: async (prestamoId, cambios) => {
    // Validar cambios
    const { valid, errors } = validatePrestamoUpdate(cambios)
    if (!valid) {
      throw new Error(`Validación falló: ${errors.join(', ')}`)
    }

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('prestamos')
        .update(cambios)
        .eq('id', prestamoId)
        .eq('user_id', user.id)
        .select(`
          *,
          clientes (
            nombre,
            cedula
          )
        `)

      if (error) throw error

      const resultado = data[0]

      // Actualizar local
      const prestamos = localStorageAdapter.get('prestamos') || []
      const updated = prestamos.map(p => p.id === prestamoId ? resultado : p)
      localStorageAdapter.set('prestamos', updated)

      // Auditoría
      await auditAdapter.log('UPDATE', 'prestamo', prestamoId, {
        cambios: Object.keys(cambios)
      })

      return resultado
    } catch (err) {
      console.error('[prestamosDataAdapter.update]', err.message)
      throw err
    }
  },

  /**
   * Archivar préstamo
   */
  archive: async (prestamoId) => {
    return prestamosDataAdapter.update(prestamoId, { estado: 'ARCHIVADO' })
  },

  /**
   * Buscar préstamos por cliente (para vistas específicas de un cliente)
   */
  getByCliente: async (clienteId) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('prestamos')
        .select(`
          *,
          clientes (
            nombre,
            cedula
          )
        `)
        .eq('cliente_id', clienteId)
        .eq('user_id', user.id)
        .order('fecha_inicio', { ascending: false })

      if (error) throw error
      return data
    } catch (err) {
      console.error('[prestamosDataAdapter.getByCliente]', err.message)
      // Fallback local
      const prestamos = localStorageAdapter.get('prestamos') || []
      return prestamos.filter(p => p.cliente_id === clienteId)
    }
  }
}
