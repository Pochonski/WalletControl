/**
 * creditosDataAdapter.js
 * Capa de integración con Supabase para el módulo de Créditos.
 *
 * Entidades:
 *   - acreedores        : personas que le prestan al prestamista
 *   - creditos          : el préstamo recibido por el prestamista
 *   - cuotas_credito    : cuotas que el prestamista debe pagar
 *   - pagos_credito     : pagos realizados por el prestamista a su acreedor
 */

import { supabaseClient } from '../supabaseClient.js'
import { localStorageAdapter } from '../localStorageAdapter.js'
import { auditAdapter } from '../auditAdapter.js'
import { validateAcreedor, validateCredito, validatePagoCredito } from '../../creditos/domain/validateCredito.js'

// ── ACREEDORES ───────────────────────────────────────────────────────────────

export const acreedoresDataAdapter = {
  /**
   * Cargar todos los acreedores del usuario
   */
  load: async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('acreedores')
        .select('*')
        .eq('user_id', user.id)
        .order('nombre', { ascending: true })

      if (error) throw error

      localStorageAdapter.set('acreedores', data)
      return data
    } catch (err) {
      console.error('[acreedoresDataAdapter.load]', err.message)
      return localStorageAdapter.get('acreedores') || []
    }
  },

  /**
   * Crear nuevo acreedor
   */
  save: async (acreedor) => {
    const { valid, errors } = validateAcreedor(acreedor)
    if (!valid) throw new Error(`Validación falló: ${errors.join(', ')}`)

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const payload = { ...acreedor, user_id: user.id }

      const { data, error } = await supabaseClient
        .from('acreedores')
        .insert([payload])
        .select()

      if (error) throw error

      const resultado = data[0]
      const actual = localStorageAdapter.get('acreedores') || []
      localStorageAdapter.set('acreedores', [...actual, resultado].sort((a, b) => a.nombre.localeCompare(b.nombre)))

      await auditAdapter.log('INSERT', 'acreedores', resultado.id, { nombre: resultado.nombre })
      return resultado
    } catch (err) {
      console.error('[acreedoresDataAdapter.save]', err.message)
      throw err
    }
  },

  /**
   * Actualizar acreedor
   */
  update: async (id, cambios) => {
    const { valid, errors } = validateAcreedor({ nombre: cambios.nombre ?? 'x', ...cambios })
    if (!valid) throw new Error(`Validación falló: ${errors.join(', ')}`)

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('acreedores')
        .update(cambios)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()

      if (error) throw error

      const resultado = data[0]
      const actual = localStorageAdapter.get('acreedores') || []
      localStorageAdapter.set('acreedores', actual.map(a => a.id === id ? resultado : a))

      await auditAdapter.log('UPDATE', 'acreedores', id, { cambios: Object.keys(cambios) })
      return resultado
    } catch (err) {
      console.error('[acreedoresDataAdapter.update]', err.message)
      throw err
    }
  }
}

// ── CRÉDITOS ─────────────────────────────────────────────────────────────────

export const creditosDataAdapter = {
  /**
   * Cargar todos los créditos del usuario (con datos del acreedor)
   */
  load: async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('creditos')
        .select(`
          *,
          acreedores (
            nombre,
            telefono
          )
        `)
        .eq('user_id', user.id)
        .order('fecha_inicio', { ascending: false })

      if (error) throw error

      localStorageAdapter.set('creditos', data)
      return data
    } catch (err) {
      console.error('[creditosDataAdapter.load]', err.message)
      return localStorageAdapter.get('creditos') || []
    }
  },

  /**
   * Crear nuevo crédito recibido y generar cuotas vía RPC
   */
  save: async (credito) => {
    const { valid, errors } = validateCredito(credito)
    if (!valid) throw new Error(`Validación falló: ${errors.join(', ')}`)

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const payload = {
        ...credito,
        user_id: user.id,
        estado: 'ACTIVO',
        fecha_creado: new Date().toISOString()
      }

      const { data, error } = await supabaseClient
        .from('creditos')
        .insert([payload])
        .select(`
          *,
          acreedores (
            nombre,
            telefono
          )
        `)

      if (error) throw error

      const resultado = data[0]

      // Generar cuotas del crédito vía RPC
      const { error: rpcError } = await supabaseClient.rpc('crear_cuotas_credito', {
        p_credito_id:        resultado.id,
        p_monto_original:    resultado.monto_original,
        p_tasa_interes:      resultado.tasa_interes,
        p_tipo_amortizacion: resultado.tipo_amortizacion,
        p_frecuencia_pago:   resultado.frecuencia_pago,
        p_fecha_inicio:      resultado.fecha_inicio,
        p_fecha_primer_pago: resultado.fecha_primer_pago,
        p_num_cuotas:        resultado.num_cuotas ?? null
      })

      if (rpcError) {
        console.error('[creditosDataAdapter.save] Error RPC cuotas:', rpcError)
        throw new Error('El crédito se registró pero hubo un error al generar las cuotas.')
      }

      const actual = localStorageAdapter.get('creditos') || []
      localStorageAdapter.set('creditos', [resultado, ...actual])

      await auditAdapter.log('INSERT', 'creditos', resultado.id, {
        acreedor_id: resultado.acreedor_id,
        monto_original: resultado.monto_original
      })

      return resultado
    } catch (err) {
      console.error('[creditosDataAdapter.save]', err.message)
      throw err
    }
  },

  /**
   * Archivar / cambiar estado de un crédito
   */
  update: async (id, cambios) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('creditos')
        .update(cambios)
        .eq('id', id)
        .eq('user_id', user.id)
        .select(`
          *,
          acreedores (
            nombre,
            telefono
          )
        `)

      if (error) throw error

      const resultado = data[0]
      const actual = localStorageAdapter.get('creditos') || []
      localStorageAdapter.set('creditos', actual.map(c => c.id === id ? resultado : c))

      await auditAdapter.log('UPDATE', 'creditos', id, { cambios: Object.keys(cambios) })
      return resultado
    } catch (err) {
      console.error('[creditosDataAdapter.update]', err.message)
      throw err
    }
  },

  archive: async (id) => creditosDataAdapter.update(id, { estado: 'ARCHIVADO' }),

  /**
   * Cargar créditos de un acreedor específico
   */
  getByAcreedor: async (acreedorId) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('creditos')
        .select(`*, acreedores (nombre, telefono)`)
        .eq('acreedor_id', acreedorId)
        .eq('user_id', user.id)
        .order('fecha_inicio', { ascending: false })

      if (error) throw error
      return data
    } catch (err) {
      console.error('[creditosDataAdapter.getByAcreedor]', err.message)
      const creditos = localStorageAdapter.get('creditos') || []
      return creditos.filter(c => c.acreedor_id === acreedorId)
    }
  }
}

// ── CUOTAS DE CRÉDITO ────────────────────────────────────────────────────────

export const cuotasCreditoDataAdapter = {
  /**
   * Cargar cuotas de un crédito
   */
  getByCredito: async (creditoId) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('cuotas_credito')
        .select('*')
        .eq('credito_id', creditoId)
        .order('numero_cuota', { ascending: true })

      if (error) throw error

      localStorageAdapter.set(`cuotas_credito_${creditoId}`, data)
      return data
    } catch (err) {
      console.error('[cuotasCreditoDataAdapter.getByCredito]', err.message)
      return localStorageAdapter.get(`cuotas_credito_${creditoId}`) || []
    }
  },

  /**
   * Actualizar estado de una cuota (ej. PAGADA)
   */
  update: async (cuotaId, cambios) => {
    try {
      const { data, error } = await supabaseClient
        .from('cuotas_credito')
        .update(cambios)
        .eq('id', cuotaId)
        .select()

      if (error) throw error

      await auditAdapter.log('UPDATE', 'cuotas_credito', cuotaId, { cambios: Object.keys(cambios) })
      return data[0]
    } catch (err) {
      console.error('[cuotasCreditoDataAdapter.update]', err.message)
      throw err
    }
  }
}

// ── PAGOS DE CRÉDITO ─────────────────────────────────────────────────────────

export const pagosCreditoDataAdapter = {
  /**
   * Cargar pagos realizados a un crédito
   */
  getByCredito: async (creditoId) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('pagos_credito')
        .select('*')
        .eq('credito_id', creditoId)
        .order('fecha_pago', { ascending: false })

      if (error) throw error

      localStorageAdapter.set(`pagos_credito_${creditoId}`, data)
      return data
    } catch (err) {
      console.error('[pagosCreditoDataAdapter.getByCredito]', err.message)
      return localStorageAdapter.get(`pagos_credito_${creditoId}`) || []
    }
  },

  /**
   * Registrar un pago al acreedor
   */
  save: async (pago) => {
    const { valid, errors } = validatePagoCredito(pago)
    if (!valid) throw new Error(`Validación falló: ${errors.join(', ')}`)

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const payload = {
        ...pago,
        user_id: user.id,
        fecha_registro: new Date().toISOString()
      }

      const { data, error } = await supabaseClient
        .from('pagos_credito')
        .insert([payload])
        .select()

      if (error) throw error

      const resultado = data[0]

      // Actualizar cuota asociada si se indicó
      if (pago.cuota_credito_id) {
        await cuotasCreditoDataAdapter.update(pago.cuota_credito_id, {
          estado: 'PAGADA',
          monto_pagado: pago.monto,
          fecha_pago_real: pago.fecha_pago
        })
      }

      await auditAdapter.log('INSERT', 'pagos_credito', resultado.id, {
        credito_id: resultado.credito_id,
        monto: resultado.monto
      })

      return resultado
    } catch (err) {
      console.error('[pagosCreditoDataAdapter.save]', err.message)
      throw err
    }
  }
}
