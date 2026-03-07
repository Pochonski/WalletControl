/**
 * AuditAdapter - Logging de auditoría
 *
 * Registra todas las acciones (INSERT, UPDATE, DELETE)
 * para compliance y debugging
 */

import { supabaseClient } from './supabaseClient.js'

export const auditAdapter = {
  /**
   * Registrar una acción en audit_logs
   *
   * @param {string} action - INSERT, UPDATE, DELETE, DOWNLOAD, etc
   * @param {string} entity - cliente, prestamo, pago, etc
   * @param {string} entityId - ID de la entidad afectada
   * @param {object} details - Información adicional
   */
  log: async (action, entity, entityId, details = {}) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) return

      await supabaseClient
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action,
          entity,
          entity_id: entityId,
          details: {
            ...details,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          }
        })
    } catch (err) {
      // No bloquea si falla el logging
      console.warn('[auditAdapter] Logging failed:', err.message)
    }
  },

  /**
   * Obtener logs de auditoría (para admin)
   */
  getLogs: async (filters = {}) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      let query = supabaseClient
        .from('audit_logs')
        .select('*')
        .eq('user_id', user.id)

      if (filters.entity) {
        query = query.eq('entity', filters.entity)
      }

      if (filters.action) {
        query = query.eq('action', filters.action)
      }

      if (filters.entityId) {
        query = query.eq('entity_id', filters.entityId)
      }

      const { data, error } = await query
        .order('fecha_creado', { ascending: false })
        .limit(100)

      if (error) throw error

      return data || []
    } catch (err) {
      console.error('[auditAdapter.getLogs]', err)
      return []
    }
  }
}
