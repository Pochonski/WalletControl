/**
 * rbac.js — Role-Based Access Control (RBAC)
 *
 * Define roles, permisos y validaciones de acceso.
 *
 * Roles:
 * - ADMIN: Control total, auditoría completa, gestión de usuarios
 * - ASSISTANT: Ayudante del prestamista, puede gestionar clientes y cobros
 * - CLIENT: Usuario solo lectura de sus datos (no usado actualmente)
 *
 * Nota: La autorización real ocurre en Supabase (RLS), este módulo
 * proporciona validación de lado del cliente y manejo de permisos.
 */

export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  ASSISTANT: 'ASSISTANT',
  CLIENT: 'CLIENT',
})

export const PERMISSIONS = Object.freeze({
  // Clientes
  CLIENTE_CREATE: 'CLIENTE_CREATE',
  CLIENTE_READ: 'CLIENTE_READ',
  CLIENTE_UPDATE: 'CLIENTE_UPDATE',
  CLIENTE_DELETE: 'CLIENTE_DELETE',
  CLIENTE_VIEW_SENSITIVE: 'CLIENTE_VIEW_SENSITIVE', // Ver cédula, documentos

  // Préstamos
  PRESTAMO_CREATE: 'PRESTAMO_CREATE',
  PRESTAMO_READ: 'PRESTAMO_READ',
  PRESTAMO_UPDATE: 'PRESTAMO_UPDATE',
  PRESTAMO_DELETE: 'PRESTAMO_DELETE',

  // Pagos
  PAGO_CREATE: 'PAGO_CREATE',
  PAGO_READ: 'PAGO_READ',
  PAGO_UPDATE: 'PAGO_UPDATE',
  PAGO_DELETE: 'PAGO_DELETE',

  // Activos
  ACTIVO_CREATE: 'ACTIVO_CREATE',
  ACTIVO_READ: 'ACTIVO_READ',
  ACTIVO_UPDATE: 'ACTIVO_UPDATE',
  ACTIVO_DELETE: 'ACTIVO_DELETE',

  // Auditoría
  AUDIT_READ: 'AUDIT_READ',
  AUDIT_EXPORT: 'AUDIT_EXPORT',

  // Gestión de usuarios (solo ADMIN)
  USER_MANAGE: 'USER_MANAGE',
})

/**
 * Define qué permisos tiene cada rol.
 * Matriz: ROLE -> [PERMISSIONS]
 */
const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: [
    // Clientes - acceso total
    PERMISSIONS.CLIENTE_CREATE,
    PERMISSIONS.CLIENTE_READ,
    PERMISSIONS.CLIENTE_UPDATE,
    PERMISSIONS.CLIENTE_DELETE,
    PERMISSIONS.CLIENTE_VIEW_SENSITIVE,

    // Préstamos - acceso total
    PERMISSIONS.PRESTAMO_CREATE,
    PERMISSIONS.PRESTAMO_READ,
    PERMISSIONS.PRESTAMO_UPDATE,
    PERMISSIONS.PRESTAMO_DELETE,

    // Pagos - acceso total
    PERMISSIONS.PAGO_CREATE,
    PERMISSIONS.PAGO_READ,
    PERMISSIONS.PAGO_UPDATE,
    PERMISSIONS.PAGO_DELETE,

    // Activos - acceso total
    PERMISSIONS.ACTIVO_CREATE,
    PERMISSIONS.ACTIVO_READ,
    PERMISSIONS.ACTIVO_UPDATE,
    PERMISSIONS.ACTIVO_DELETE,

    // Auditoría completa
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.AUDIT_EXPORT,

    // Gestión de usuarios
    PERMISSIONS.USER_MANAGE,
  ],

  [ROLES.ASSISTANT]: [
    // Clientes - CRUD completo
    PERMISSIONS.CLIENTE_CREATE,
    PERMISSIONS.CLIENTE_READ,
    PERMISSIONS.CLIENTE_UPDATE,
    // No puede deletear, solo ADMIN
    PERMISSIONS.CLIENTE_VIEW_SENSITIVE,

    // Préstamos - CRUD completo
    PERMISSIONS.PRESTAMO_CREATE,
    PERMISSIONS.PRESTAMO_READ,
    PERMISSIONS.PRESTAMO_UPDATE,
    // No puede deletear

    // Pagos - puede crear y leer
    PERMISSIONS.PAGO_CREATE,
    PERMISSIONS.PAGO_READ,
    // No puede editar ni deletear pagos (son confirmados)

    // Activos - lectura
    PERMISSIONS.ACTIVO_READ,
    // No puede crear, editar, deletear

    // Sin acceso a auditoría
  ],

  [ROLES.CLIENT]: [
    // Cliente solo puede leer sus datos
    PERMISSIONS.CLIENTE_READ,
    PERMISSIONS.PRESTAMO_READ,
    PERMISSIONS.PAGO_READ,
  ],
})

/**
 * Obtiene el rol del usuario desde su app_metadata.
 * Si no tiene rol definido, retorna null.
 * @param {object} user - Usuario de Supabase
 * @returns {string|null} ROLE o null
 */
export function getUserRole(user) {
  if (!user) return null
  const role = user.app_metadata?.role ?? null
  return role && Object.values(ROLES).includes(role) ? role : null
}

/**
 * Verifica si el usuario tiene un rol específico.
 * @param {object} user
 * @param {string} role - ROLE a verificar
 * @returns {boolean}
 */
export function hasRole(user, role) {
  return getUserRole(user) === role
}

/**
 * Verifica si el usuario tiene uno de varios roles.
 * @param {object} user
 * @param {string[]} roles - Lista de ROLEs a verificar
 * @returns {boolean}
 */
export function hasAnyRole(user, roles) {
  const userRole = getUserRole(user)
  return roles.includes(userRole)
}

/**
 * Verifica si el usuario tiene un permiso específico.
 * @param {object} user
 * @param {string} permission - PERMISSION a verificar
 * @returns {boolean}
 */
export function hasPermission(user, permission) {
  const role = getUserRole(user)
  if (!role) return false

  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes(permission)
}

/**
 * Verifica si el usuario tiene uno de varios permisos.
 * @param {object} user
 * @param {string[]} permissions - Lista de PERMISSIONs
 * @returns {boolean}
 */
export function hasAnyPermission(user, permissions) {
  return permissions.some(permission => hasPermission(user, permission))
}

/**
 * Obtiene todos los permisos del usuario.
 * @param {object} user
 * @returns {string[]}
 */
export function getUserPermissions(user) {
  const role = getUserRole(user)
  if (!role) return []
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Valida si el usuario puede realizar una acción en un recurso.
 * Combina rol + permiso + validación de propiedad.
 *
 * @param {object} user
 * @param {string} action - CREATE, READ, UPDATE, DELETE
 * @param {string} resource - cliente, prestamo, pago, activo
 * @param {object} data - Datos del recurso (puede incluir user_id, etc)
 * @returns {boolean}
 */
export function canAccess(user, action, resource, data = {}) {
  if (!user) return false

  const role = getUserRole(user)
  if (!role) return false

  // Construir permission name basado en acción y recurso
  const permissionName = `${resource.toUpperCase()}_${action}`
  const permission = Object.values(PERMISSIONS).find(p => p === permissionName)

  if (!permission) {
    console.warn(`[RBAC] Permiso no definido: ${permissionName}`)
    return false
  }

  // Verificar permiso en el rol
  if (!hasPermission(user, permission)) {
    return false
  }

  // Validación adicional: propietario del recurso
  // RLS en Supabase es la línea de defensa, pero validamos aquí para UX
  if (data.user_id && data.user_id !== user.id) {
    // El usuario no es propietario del recurso
    return false
  }

  return true
}

/**
 * Obtiene la descripción legible de un rol.
 * @param {string} role
 * @returns {string}
 */
export function getRoleLabel(role) {
  const labels = {
    [ROLES.ADMIN]: 'Administrador',
    [ROLES.ASSISTANT]: 'Ayudante',
    [ROLES.CLIENT]: 'Cliente',
  }
  return labels[role] || role
}

/**
 * Obtiene la descripción de un permiso.
 * @param {string} permission
 * @returns {string}
 */
export function getPermissionLabel(permission) {
  const labels = {
    [PERMISSIONS.CLIENTE_CREATE]: 'Crear clientes',
    [PERMISSIONS.CLIENTE_READ]: 'Ver clientes',
    [PERMISSIONS.CLIENTE_UPDATE]: 'Editar clientes',
    [PERMISSIONS.CLIENTE_DELETE]: 'Eliminar clientes',
    [PERMISSIONS.CLIENTE_VIEW_SENSITIVE]: 'Ver documentos sensibles',
    [PERMISSIONS.PRESTAMO_CREATE]: 'Crear préstamos',
    [PERMISSIONS.PRESTAMO_READ]: 'Ver préstamos',
    [PERMISSIONS.PRESTAMO_UPDATE]: 'Editar préstamos',
    [PERMISSIONS.PRESTAMO_DELETE]: 'Eliminar préstamos',
    [PERMISSIONS.PAGO_CREATE]: 'Registrar pagos',
    [PERMISSIONS.PAGO_READ]: 'Ver pagos',
    [PERMISSIONS.PAGO_UPDATE]: 'Editar pagos',
    [PERMISSIONS.PAGO_DELETE]: 'Eliminar pagos',
    [PERMISSIONS.ACTIVO_CREATE]: 'Crear activos',
    [PERMISSIONS.ACTIVO_READ]: 'Ver activos',
    [PERMISSIONS.ACTIVO_UPDATE]: 'Editar activos',
    [PERMISSIONS.ACTIVO_DELETE]: 'Eliminar activos',
    [PERMISSIONS.AUDIT_READ]: 'Ver auditoría',
    [PERMISSIONS.AUDIT_EXPORT]: 'Exportar auditoría',
    [PERMISSIONS.USER_MANAGE]: 'Gestionar usuarios',
  }
  return labels[permission] || permission
}
