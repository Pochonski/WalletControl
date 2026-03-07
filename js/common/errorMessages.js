/**
 * ERROR_MESSAGES — Mensajes de error centralizados.
 * Importar de aquí para consistencia en el UI.
 */
export const ERROR_MESSAGES = Object.freeze({
  // Genéricos
  GENERIC:              'Ocurrió un error inesperado. Intenta de nuevo.',
  OFFLINE:              'Sin conexión. El cambio se guardó localmente y se sincronizará cuando vuelvas a conectarte.',
  LOAD_FAILED:          'No se pudieron cargar los datos. Verifica tu conexión.',
  SAVE_FAILED:          'No se pudo guardar. Intenta de nuevo.',
  DELETE_FAILED:        'No se pudo archivar. Intenta de nuevo.',

  // Auth
  AUTH_INVALID:         'Correo o contraseña incorrectos.',
  AUTH_EMAIL_TAKEN:     'Este correo ya está registrado.',
  AUTH_WEAK_PASSWORD:   'La contraseña debe tener al menos 6 caracteres.',
  AUTH_SESSION_EXPIRED: 'Tu sesión expiró. Por favor inicia sesión de nuevo.',
  AUTH_NOT_CONFIRMED:   'Revisa tu correo y confirma tu cuenta antes de entrar.',
  AUTH_REQUIRED:        'Debes iniciar sesión para continuar.',

  // Clientes
  CLIENTE_NOMBRE_REQUIRED: 'El nombre del cliente es obligatorio.',
  CLIENTE_CEDULA_REQUIRED: 'La cédula o documento es obligatorio.',
  CLIENTE_CEDULA_DUPLICATE:'Ya existe un cliente con esta cédula.',
  CLIENTE_NOT_FOUND:       'Cliente no encontrado.',

  // Préstamos
  PRESTAMO_MONTO_INVALID:   'El monto debe ser un número mayor a 0.',
  PRESTAMO_TASA_INVALID:    'La tasa de interés debe ser >= 0.',
  PRESTAMO_FECHAS_INVALID:  'La fecha fin debe ser posterior a la fecha inicio.',
  PRESTAMO_CLIENTE_REQUIRED:'Debes seleccionar un cliente.',
  PRESTAMO_NOT_FOUND:       'Préstamo no encontrado.',

  // Pagos
  PAGO_MONTO_INVALID:       'El monto del pago debe ser mayor a 0.',
  PAGO_EXCEDE_SALDO:        'El monto no puede superar el saldo pendiente.',
  PAGO_FECHA_REQUIRED:      'La fecha del pago es obligatoria.',
  PAGO_METODO_REQUIRED:     'Selecciona el método de pago.',
  PAGO_CUOTA_REQUIRED:      'Debes seleccionar una cuota.',

  // Activos
  ACTIVO_NOMBRE_REQUIRED:   'El nombre del activo es obligatorio.',
  ACTIVO_COSTO_INVALID:     'El costo de compra debe ser mayor a 0.',
  ACTIVO_FECHA_REQUIRED:    'La fecha de compra es obligatoria.',
  ACTIVO_CATEGORIA_REQUIRED:'Selecciona una categoría.',

  // Archivos
  FILE_TOO_LARGE:       'El archivo no puede superar 5 MB.',
  FILE_INVALID_TYPE:    'Solo se permiten imágenes JPG/PNG o archivos PDF.',
  FILE_UPLOAD_FAILED:   'No se pudo subir el archivo. Intenta de nuevo.',
})

/**
 * Traduce errores de Supabase Auth al español.
 * @param {string} supabaseErrorMessage
 * @returns {string}
 */
export function translateAuthError(supabaseErrorMessage) {
  if (!supabaseErrorMessage) return ERROR_MESSAGES.GENERIC

  const msg = supabaseErrorMessage.toLowerCase()

  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return ERROR_MESSAGES.AUTH_INVALID
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return ERROR_MESSAGES.AUTH_EMAIL_TAKEN
  }
  if (msg.includes('password should be at least')) {
    return ERROR_MESSAGES.AUTH_WEAK_PASSWORD
  }
  if (msg.includes('email not confirmed')) {
    return ERROR_MESSAGES.AUTH_NOT_CONFIRMED
  }
  if (msg.includes('expired') || msg.includes('jwt')) {
    return ERROR_MESSAGES.AUTH_SESSION_EXPIRED
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return ERROR_MESSAGES.OFFLINE
  }

  return ERROR_MESSAGES.GENERIC
}
