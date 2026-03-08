/**
 * CobranzasDataAdapter - Capa de integración con Supabase para cobranzas
 * Responsabilidades:
 * - Gestionar registros de cobranza (cuotas vencidas)
 * - Crear, actualizar, gestionar estados de cobranza
 * - Registrar acciones de cobranza (llamadas, emails, etc.)
 * - Gestionar planes de pago
 * - Encriptar datos sensibles si aplica
 * - Fallback a localStorage si Supabase falla
 * - Logging de auditoría
 */

import { supabaseClient } from './supabaseClient.js'
import { encryptionAdapter } from './encryptionAdapter.js'
import { auditAdapter } from './auditAdapter.js'
import { localStorageAdapter } from './localStorageAdapter.js'
import { validateCollectionData, validateCollectionAction, validatePaymentPlan, COLLECTION_STATUS } from '../cobranzas/domain/cobranzaValidation.js'

export const cobranzasDataAdapter = {
  /**
   * Cargar todas las cuotas que requieren gestión de cobranza (Pendientes o Vencidas)
   */
  loadActiveCollections: async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const today = new Date().toISOString().split('T')[0]

      // Query cuotas que requieren atención (PENDIENTE o VENCIDA)
      // Nota: Supabase asume RLS para filtrar por usuario a través de la relación con prestamos
      const { data, error } = await supabaseClient
        .from('cuotas')
        .select(`
          *,
          prestamos!inner (
            id,
            user_id,
            cliente_id,
            clientes (
              id,
              nombre,
              telefono,
              email
            )
          )
        `)
        .in('estado', ['PENDIENTE', 'VENCIDA'])
        .eq('prestamos.user_id', user.id)
        .order('fecha_vencimiento', { ascending: true })

      if (error) throw error

      // Transformar datos para que la UI los consuma como "cobranzas"
      const collections = data.map(cuota => ({
        id: cuota.id,
        payment_id: cuota.id,
        prestamo_id: cuota.prestamo_id,
        client_id: cuota.prestamos?.cliente_id,
        client_name: cuota.prestamos?.clientes?.nombre,
        client_phone: cuota.prestamos?.clientes?.telefono,
        client_email: cuota.prestamos?.clientes?.email,
        amount_due: cuota.monto_total - cuota.monto_pagado,
        original_amount: cuota.monto_total,
        due_date: cuota.fecha_vencimiento,
        status: cuota.estado.toLowerCase(),
        created_at: cuota.fecha_creado
      }))

      // Guardar en localStorage
      localStorageAdapter.set('active_collections', collections)

      return collections
    } catch (err) {
      console.error('[cobranzasDataAdapter.loadActiveCollections]', err.message)
      return localStorageAdapter.get('active_collections') || []
    }
  },

  /**
   * Cargar historial de pagos (acciones) para una cuota específica
   */
  loadCollectionActions: async (cuotaId) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('pagos')
        .select('*')
        .eq('cuota_id', cuotaId)
        .eq('user_id', user.id)
        .order('fecha_pago', { ascending: false })

      if (error) throw error

      // Transformar pagos en "acciones" para la UI de cobranza
      return data.map(pago => ({
        id: pago.id,
        collection_id: cuotaId,
        action_type: 'payment_attempt',
        description: `Registro de pago: ${pago.metodo_pago}`,
        action_date: pago.fecha_pago,
        contact_result: `Monto: $${pago.monto.toLocaleString()}`,
        status: pago.estado,
        created_at: pago.fecha_registro
      }))
    } catch (err) {
      console.error('[cobranzasDataAdapter.loadCollectionActions]', err.message)
      return []
    }
  },

  /**
   * En este nuevo esquema, "actualizar estado" significa actualizar la cuota
   */
  updateCollectionStatus: async (cuotaId, newStatus) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      let statusToSave = newStatus.toUpperCase()
      if (statusToSave === 'RESOLVED') statusToSave = 'PAGADA'

      const { data, error } = await supabaseClient
        .from('cuotas')
        .update({ 
          estado: statusToSave,
          fecha_actualizado: new Date().toISOString()
        })
        .eq('id', cuotaId)
        .select()

      if (error) throw error

      // Auditoría simple via log (la tabla audit_logs de Supabase se encarga del resto via trigger)
      await auditAdapter.log('UPDATE', 'cuotas', cuotaId, { estado: newStatus })

      return data[0]
    } catch (err) {
      console.error('[cobranzasDataAdapter.updateCollectionStatus]', err.message)
      throw err
    }
  },

  /**
   * Obtener métricas basadas en cuotas pendientes vs pagadas
   */
  getCollectionMetrics: async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data: cuotas, error } = await supabaseClient
        .from('cuotas')
        .select('monto_total, monto_pagado, estado, fecha_vencimiento, prestamos!inner(user_id)')
        .eq('prestamos.user_id', user.id)

      if (error) throw error

      const today = new Date()
      const metrics = {
        totalCollections: cuotas.filter(c => c.estado !== 'PAGADA').length,
        resolvedCollections: cuotas.filter(c => c.estado === 'PAGADA').length,
        overduePaymentsCount: cuotas.filter(c => new Date(c.fecha_vencimiento) < today && c.estado !== 'PAGADA').length,
        totalOverdueAmount: cuotas
          .filter(c => new Date(c.fecha_vencimiento) < today && c.estado !== 'PAGADA')
          .reduce((sum, c) => sum + (c.monto_total - c.monto_pagado), 0)
      }

      metrics.effectivenessRate = cuotas.length > 0 ? (metrics.resolvedCollections / cuotas.length) * 100 : 0
      
      return metrics
    } catch (err) {
      console.error('[cobranzasDataAdapter.getCollectionMetrics]', err.message)
      return {
        totalCollections: 0,
        resolvedCollections: 0,
        effectivenessRate: 0,
        overduePaymentsCount: 0,
        totalOverdueAmount: 0
      }
    }
  },

  // Los métodos de creación de "cobranzas" o "planes de pago" directos se omiten 
  // en favor de la gestión nativa de cuotas y pagos del sistema de préstamos.
}
