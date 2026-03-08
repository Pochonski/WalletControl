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
   * Cargar todas las cuotas vencidas que requieren cobranza
   */
  loadOverduePayments: async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const today = new Date().toISOString().split('T')[0]

      // Query cuotas vencidas que no están pagadas completamente
      const { data, error } = await supabaseClient
        .from('cuotas')
        .select(`
          *,
          prestamos (
            id,
            cliente_id,
            clientes (
              id,
              nombre,
              telefono,
              email
            )
          )
        `)
        .eq('estado', 'PENDIENTE')
        .lt('fecha_vencimiento', today)
        .order('fecha_vencimiento', { ascending: true })

      if (error) throw error

      // Transformar datos para incluir cálculos de cobranza
      const overduePayments = data.map(cuota => ({
        id: cuota.id,
        payment_id: cuota.id,
        prestamo_id: cuota.prestamo_id,
        client_id: cuota.prestamos?.cliente_id,
        client_name: cuota.prestamos?.clientes?.nombre,
        client_phone: cuota.prestamos?.clientes?.telefono,
        client_email: cuota.prestamos?.clientes?.email,
        amount_due: cuota.monto,
        due_date: cuota.fecha_vencimiento,
        days_late: Math.floor((new Date() - new Date(cuota.fecha_vencimiento)) / (1000 * 60 * 60 * 24)),
        status: 'pending',
        created_at: cuota.created_at
      }))

      // Guardar en localStorage para offline
      localStorageAdapter.set('overdue_payments', overduePayments)

      return overduePayments
    } catch (err) {
      console.error('[cobranzasDataAdapter.loadOverduePayments]', err.message)
      // Fallback a localStorage
      return localStorageAdapter.get('overdue_payments') || []
    }
  },

  /**
   * Cargar registros de cobranza activos
   */
  loadActiveCollections: async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('cobranzas')
        .select(`
          *,
          cuotas (
            id,
            monto,
            fecha_vencimiento,
            prestamos (
              id,
              clientes (
                id,
                nombre,
                telefono,
                email
              )
            )
          )
        `)
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress', 'contacted', 'negotiated'])
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transformar datos
      const collections = data.map(cobranza => ({
        ...cobranza,
        client_name: cobranza.cuotas?.prestamos?.clientes?.nombre,
        client_phone: cobranza.cuotas?.prestamos?.clientes?.telefono,
        client_email: cobranza.cuotas?.prestamos?.clientes?.email,
        amount_due: cobranza.cuotas?.monto,
        due_date: cobranza.cuotas?.fecha_vencimiento
      }))

      // Guardar en localStorage
      localStorageAdapter.set('active_collections', collections)

      return collections
    } catch (err) {
      console.error('[cobranzasDataAdapter.loadActiveCollections]', err.message)
      // Fallback a localStorage
      return localStorageAdapter.get('active_collections') || []
    }
  },

  /**
   * Crear nuevo registro de cobranza
   */
  createCollection: async (collectionData) => {
    // Validar datos
    const validation = validateCollectionData(collectionData)
    if (!validation.isValid) {
      throw new Error(`Validación falló: ${validation.errors.join(', ')}`)
    }

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const collectionRecord = {
        ...collectionData,
        user_id: user.id,
        status: collectionData.status || COLLECTION_STATUS.PENDING,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabaseClient
        .from('cobranzas')
        .insert([collectionRecord])
        .select()

      if (error) throw error

      const newCollection = data[0]

      // Actualizar localStorage
      const collections = localStorageAdapter.get('active_collections') || []
      localStorageAdapter.set('active_collections', [newCollection, ...collections])

      // Auditoría
      await auditAdapter.log('INSERT', 'cobranza', newCollection.id, {
        payment_id: newCollection.payment_id,
        amount_due: newCollection.amount_due
      })

      return newCollection
    } catch (err) {
      console.error('[cobranzasDataAdapter.createCollection]', err.message)

      // Fallback offline
      const offlineCollection = {
        ...collectionData,
        id: `temp-${Date.now()}`,
        user_id: null,
        status: COLLECTION_STATUS.PENDING,
        created_at: new Date().toISOString(),
        _pendingSync: true
      }

      const collections = localStorageAdapter.get('active_collections') || []
      localStorageAdapter.set('active_collections', [offlineCollection, ...collections])

      return offlineCollection
    }
  },

  /**
   * Actualizar estado de cobranza
   */
  updateCollectionStatus: async (collectionId, newStatus, notes = null) => {
    // Validar transición de estado
    const currentCollections = localStorageAdapter.get('active_collections') || []
    const currentCollection = currentCollections.find(c => c.id === collectionId)

    if (currentCollection && !currentCollection._pendingSync) {
      const transitionValidation = validateStatusTransition(currentCollection.status, newStatus)
      if (!transitionValidation.isValid) {
        throw new Error(transitionValidation.error)
      }
    }

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...(notes && { notes })
      }

      const { data, error } = await supabaseClient
        .from('cobranzas')
        .update(updateData)
        .eq('id', collectionId)
        .eq('user_id', user.id)
        .select()

      if (error) throw error

      const updatedCollection = data[0]

      // Actualizar localStorage
      const collections = localStorageAdapter.get('active_collections') || []
      const updated = collections.map(c => c.id === collectionId ? updatedCollection : c)
      localStorageAdapter.set('active_collections', updated)

      // Auditoría
      await auditAdapter.log('UPDATE', 'cobranza', collectionId, {
        old_status: currentCollection?.status,
        new_status: newStatus,
        notes: notes
      })

      return updatedCollection
    } catch (err) {
      console.error('[cobranzasDataAdapter.updateCollectionStatus]', err.message)

      // Fallback offline: actualizar local
      const collections = localStorageAdapter.get('active_collections') || []
      const updated = collections.map(c =>
        c.id === collectionId
          ? { ...c, status: newStatus, updated_at: new Date().toISOString(), ...(notes && { notes }) }
          : c
      )
      localStorageAdapter.set('active_collections', updated)

      return updated.find(c => c.id === collectionId)
    }
  },

  /**
   * Agregar acción de cobranza (llamada, email, etc.)
   */
  addCollectionAction: async (actionData) => {
    // Validar datos de acción
    const validation = validateCollectionAction(actionData)
    if (!validation.isValid) {
      throw new Error(`Validación falló: ${validation.errors.join(', ')}`)
    }

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const actionRecord = {
        ...actionData,
        user_id: user.id,
        action_date: actionData.action_date || new Date().toISOString(),
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabaseClient
        .from('cobranza_actions')
        .insert([actionRecord])
        .select()

      if (error) throw error

      const newAction = data[0]

      // Actualizar fecha de último contacto en cobranza
      await this.updateCollectionStatus(actionData.collection_id, null, null, newAction.action_date)

      // Auditoría
      await auditAdapter.log('INSERT', 'cobranza_action', newAction.id, {
        collection_id: newAction.collection_id,
        action_type: newAction.action_type
      })

      return newAction
    } catch (err) {
      console.error('[cobranzasDataAdapter.addCollectionAction]', err.message)
      throw err
    }
  },

  /**
   * Cargar acciones de cobranza para una colección específica
   */
  loadCollectionActions: async (collectionId) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('cobranza_actions')
        .select('*')
        .eq('collection_id', collectionId)
        .eq('user_id', user.id)
        .order('action_date', { ascending: false })

      if (error) throw error

      return data
    } catch (err) {
      console.error('[cobranzasDataAdapter.loadCollectionActions]', err.message)
      return []
    }
  },

  /**
   * Crear plan de pago
   */
  createPaymentPlan: async (paymentPlanData) => {
    // Validar datos del plan de pago
    const validation = validatePaymentPlan(paymentPlanData)
    if (!validation.isValid) {
      throw new Error(`Validación falló: ${validation.errors.join(', ')}`)
    }

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const planRecord = {
        ...paymentPlanData,
        user_id: user.id,
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabaseClient
        .from('payment_plans')
        .insert([planRecord])
        .select()

      if (error) throw error

      const newPlan = data[0]

      // Actualizar estado de cobranza a negotiated
      await this.updateCollectionStatus(paymentPlanData.collection_id, COLLECTION_STATUS.NEGOTIATED)

      // Auditoría
      await auditAdapter.log('INSERT', 'payment_plan', newPlan.id, {
        collection_id: newPlan.collection_id,
        total_amount: newPlan.total_amount,
        installments_count: newPlan.installments.length
      })

      return newPlan
    } catch (err) {
      console.error('[cobranzasDataAdapter.createPaymentPlan]', err.message)
      throw err
    }
  },

  /**
   * Obtener métricas de cobranza para dashboard
   */
  getCollectionMetrics: async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      // Obtener estadísticas de cobranzas
      const { data: collections, error: collectionsError } = await supabaseClient
        .from('cobranzas')
        .select('status, created_at, resolved_at')
        .eq('user_id', user.id)

      if (collectionsError) throw collectionsError

      // Calcular métricas
      const totalCollections = collections.length
      const resolvedCollections = collections.filter(c => c.status === 'resolved').length
      const effectivenessRate = totalCollections > 0 ? (resolvedCollections / totalCollections) * 100 : 0

      // Calcular tiempo promedio de resolución
      const resolvedWithDates = collections.filter(c => c.status === 'resolved' && c.resolved_at && c.created_at)
      const avgResolutionTime = resolvedWithDates.length > 0
        ? resolvedWithDates.reduce((sum, c) => {
            return sum + (new Date(c.resolved_at) - new Date(c.created_at)) / (1000 * 60 * 60 * 24)
          }, 0) / resolvedWithDates.length
        : 0

      // Obtener cuotas vencidas activas
      const today = new Date().toISOString().split('T')[0]
      const { data: overduePayments, error: overdueError } = await supabaseClient
        .from('cuotas')
        .select('monto')
        .eq('estado', 'PENDIENTE')
        .lt('fecha_vencimiento', today)

      if (overdueError) throw overdueError

      const totalOverdueAmount = overduePayments.reduce((sum, p) => sum + p.monto, 0)

      return {
        totalCollections,
        resolvedCollections,
        effectivenessRate: Math.round(effectivenessRate * 100) / 100,
        avgResolutionTime: Math.round(avgResolutionTime * 100) / 100,
        overduePaymentsCount: overduePayments.length,
        totalOverdueAmount: Math.round(totalOverdueAmount * 100) / 100
      }
    } catch (err) {
      console.error('[cobranzasDataAdapter.getCollectionMetrics]', err.message)
      return {
        totalCollections: 0,
        resolvedCollections: 0,
        effectivenessRate: 0,
        avgResolutionTime: 0,
        overduePaymentsCount: 0,
        totalOverdueAmount: 0
      }
    }
  }
}
