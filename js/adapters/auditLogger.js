/**
 * auditLogger.js — Audit logging infrastructure
 *
 * Registra todas las operaciones importantes para compliance y debugging:
 * - Inserciones, actualizaciones, eliminaciones (soft deletes)
 * - Accesos a datos sensibles
 * - Descargas de documentos
 * - Errores y excepciones
 *
 * Nota: Los logs se guardan en la tabla audit_logs de Supabase.
 * Supabase RLS asegura que cada usuario solo vea sus propios logs.
 */

import { supabaseClient } from './supabaseClient.js'

export const AUDIT_ACTIONS = Object.freeze({
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  VIEW: 'VIEW',
  DOWNLOAD: 'DOWNLOAD',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  ERROR: 'ERROR',
  EXPORT: 'EXPORT',
})

export const AUDIT_ENTITIES = Object.freeze({
  CLIENTE: 'cliente',
  PRESTAMO: 'prestamo',
  CUOTA: 'cuota',
  PAGO: 'pago',
  ACTIVO: 'activo',
  USER: 'usuario',
  DOCUMENTO: 'documento',
  SISTEMA: 'sistema',
})

/**
 * Registra una auditoría en Supabase.
 *
 * @param {object} params
 *   - action: AUDIT_ACTIONS
 *   - entity: AUDIT_ENTITIES
 *   - entity_id: UUID del objeto afectado (opcional)
 *   - user_id: UUID del usuario (se obtiene automáticamente si no se pasa)
 *   - details: objeto con información adicional
 *   - ip_address: IP del usuario (opcional, solo en servidor)
 *   - user_agent: User agent (opcional)
 * @returns {object} el log creado o error
 */
export async function logAudit({
  action,
  entity,
  entity_id = null,
  user_id = null,
  details = {},
  ip_address = null,
  user_agent = navigator?.userAgent || null,
}) {
  try {
    // Obtener user_id actual si no se proporciona
    if (!user_id) {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) {
        console.warn('[AuditLogger] No hay usuario autenticado para registrar auditoría')
        return null
      }
      user_id = user.id
    }

    const { data, error } = await supabaseClient
      .from('audit_logs')
      .insert([{
        action,
        entity,
        entity_id,
        user_id,
        details: details || {},
        ip_address,
        user_agent,
      }])
      .select()

    if (error) {
      console.error('[AuditLogger] Error registrando auditoría:', error)
      return null
    }

    return data?.[0] ?? null
  } catch (err) {
    console.error('[AuditLogger] Excepción registrando auditoría:', err)
    return null
  }
}

/**
 * Registra la creación de una entidad.
 *
 * @param {string} entity - AUDIT_ENTITIES
 * @param {string} entity_id - UUID de la entidad
 * @param {object} newData - Los datos insertados
 * @param {object} options - Opciones adicionales
 */
export async function logInsert(entity, entity_id, newData, options = {}) {
  return logAudit({
    action: AUDIT_ACTIONS.INSERT,
    entity,
    entity_id,
    details: {
      nuevo_registro: newData,
      timestamp: new Date().toISOString(),
      ...options.extraDetails,
    },
    user_id: options.user_id,
  })
}

/**
 * Registra una actualización de entidad.
 *
 * @param {string} entity - AUDIT_ENTITIES
 * @param {string} entity_id - UUID de la entidad
 * @param {object} oldData - Los datos anteriores
 * @param {object} newData - Los datos nuevos
 * @param {object} options - Opciones adicionales
 */
export async function logUpdate(entity, entity_id, oldData, newData, options = {}) {
  // Detectar qué campos cambiaron
  const cambios = {}
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])

  allKeys.forEach(key => {
    if (oldData[key] !== newData[key]) {
      cambios[key] = {
        anterior: oldData[key],
        nuevo: newData[key],
      }
    }
  })

  return logAudit({
    action: AUDIT_ACTIONS.UPDATE,
    entity,
    entity_id,
    details: {
      cambios,
      timestamp: new Date().toISOString(),
      ...options.extraDetails,
    },
    user_id: options.user_id,
  })
}

/**
 * Registra una eliminación (soft delete).
 *
 * @param {string} entity - AUDIT_ENTITIES
 * @param {string} entity_id - UUID de la entidad
 * @param {object} deletedData - Los datos eliminados (para referencia)
 * @param {object} options - Opciones adicionales
 */
export async function logDelete(entity, entity_id, deletedData, options = {}) {
  return logAudit({
    action: AUDIT_ACTIONS.DELETE,
    entity,
    entity_id,
    details: {
      registro_eliminado: deletedData,
      razon: options.razon || 'Eliminado por usuario',
      timestamp: new Date().toISOString(),
      ...options.extraDetails,
    },
    user_id: options.user_id,
  })
}

/**
 * Registra acceso a datos sensibles.
 *
 * @param {string} entity - AUDIT_ENTITIES
 * @param {string} entity_id - UUID de la entidad
 * @param {string[]} camposSensibles - Qué campos se vieron (ej: ['cedula', 'cédula_frente'])
 * @param {object} options
 */
export async function logSensitiveView(entity, entity_id, camposSensibles = [], options = {}) {
  return logAudit({
    action: AUDIT_ACTIONS.VIEW,
    entity,
    entity_id,
    details: {
      campos_sensibles: camposSensibles,
      tipo: 'ACCESO_DATOS_SENSIBLES',
      timestamp: new Date().toISOString(),
      ...options.extraDetails,
    },
    user_id: options.user_id,
  })
}

/**
 * Registra descarga de documentos/archivos.
 *
 * @param {string} entity - AUDIT_ENTITIES
 * @param {string} entity_id - UUID de la entidad
 * @param {string} documentPath - Ruta del documento descargado
 * @param {object} options
 */
export async function logDownload(entity, entity_id, documentPath, options = {}) {
  return logAudit({
    action: AUDIT_ACTIONS.DOWNLOAD,
    entity: AUDIT_ENTITIES.DOCUMENTO,
    entity_id,
    details: {
      documento_path: documentPath,
      entidad_original: entity,
      timestamp: new Date().toISOString(),
      ...options.extraDetails,
    },
    user_id: options.user_id,
  })
}

/**
 * Registra login de usuario.
 *
 * @param {string} user_id - UUID del usuario
 * @param {object} options
 */
export async function logLogin(user_id, options = {}) {
  return logAudit({
    action: AUDIT_ACTIONS.LOGIN,
    entity: AUDIT_ENTITIES.USER,
    entity_id: user_id,
    details: {
      timestamp: new Date().toISOString(),
      ...options.extraDetails,
    },
    user_id,
  })
}

/**
 * Registra logout de usuario.
 *
 * @param {string} user_id - UUID del usuario
 * @param {object} options
 */
export async function logLogout(user_id, options = {}) {
  return logAudit({
    action: AUDIT_ACTIONS.LOGOUT,
    entity: AUDIT_ENTITIES.USER,
    entity_id: user_id,
    details: {
      timestamp: new Date().toISOString(),
      ...options.extraDetails,
    },
    user_id,
  })
}

/**
 * Registra un error/excepción.
 *
 * @param {string} errorMessage - Mensaje de error
 * @param {string} entity - AUDIT_ENTITIES o 'SISTEMA'
 * @param {string} entity_id - ID relevante (opcional)
 * @param {object} errorDetails - Detalles del error
 * @param {object} options
 */
export async function logError(errorMessage, entity, entity_id = null, errorDetails = {}, options = {}) {
  return logAudit({
    action: AUDIT_ACTIONS.ERROR,
    entity,
    entity_id,
    details: {
      mensaje: errorMessage,
      stack: errorDetails.stack || '',
      tipo: errorDetails.type || 'UNKNOWN',
      timestamp: new Date().toISOString(),
      ...options.extraDetails,
    },
    user_id: options.user_id,
  })
}

/**
 * Registra exportación de datos.
 *
 * @param {string} tipo - Tipo de exportación (ej: 'PDF', 'CSV', 'EXCEL')
 * @param {string} entity - Qué se exportó
 * @param {number} cantidadRegistros - Cuántos registros se exportaron
 * @param {object} options
 */
export async function logExport(tipo, entity, cantidadRegistros = 0, options = {}) {
  return logAudit({
    action: AUDIT_ACTIONS.EXPORT,
    entity,
    details: {
      formato: tipo,
      cantidad_registros: cantidadRegistros,
      timestamp: new Date().toISOString(),
      ...options.extraDetails,
    },
    user_id: options.user_id,
  })
}

/**
 * Obtiene los logs de auditoría del usuario actual.
 * Supabase RLS limitará automáticamente a sus propios logs.
 *
 * @param {object} options
 *   - limit: número máximo de registros (default: 100)
 *   - offset: para paginación
 *   - entity: filtrar por entidad
 *   - action: filtrar por acción
 *   - start_date: filtrar por fecha inicio
 *   - end_date: filtrar por fecha fin
 * @returns {object[]} audit logs
 */
export async function getAuditLogs(options = {}) {
  try {
    const {
      limit = 100,
      offset = 0,
      entity = null,
      action = null,
      start_date = null,
      end_date = null,
    } = options

    let query = supabaseClient
      .from('audit_logs')
      .select('*')
      .order('fecha_creado', { ascending: false })
      .range(offset, offset + limit - 1)

    if (entity) query = query.eq('entity', entity)
    if (action) query = query.eq('action', action)
    if (start_date) query = query.gte('fecha_creado', start_date)
    if (end_date) query = query.lte('fecha_creado', end_date)

    const { data, error } = await query

    if (error) {
      console.error('[AuditLogger] Error obteniendo logs:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('[AuditLogger] Excepción obteniendo logs:', err)
    return []
  }
}

/**
 * Obtiene el historial de cambios de una entidad específica.
 *
 * @param {string} entity - AUDIT_ENTITIES
 * @param {string} entity_id - UUID de la entidad
 * @param {object} options
 * @returns {object[]} logs específicos de esa entidad
 */
export async function getEntityHistory(entity, entity_id, options = {}) {
  return getAuditLogs({
    entity,
    ...options,
  }).then(logs => logs.filter(log => log.entity_id === entity_id))
}
