/**
 * UI Helpers - Funciones de feedback al usuario
 */

/**
 * Mostrar mensaje de éxito
 */
export const showSuccess = (message) => {
  console.log('✅', message)
  // TODO: Implementar toast visual
  alert(message)
}

/**
 * Mostrar mensaje de error
 */
export const showError = (message) => {
  console.error('❌', message)
  // TODO: Implementar toast visual
  alert('Error: ' + message)
}

/**
 * Mostrar mensaje de advertencia
 */
export const showWarning = (message) => {
  console.warn('⚠️', message)
  // TODO: Implementar toast visual
  alert('Advertencia: ' + message)
}

/**
 * Mostrar errores de validación
 */
export const showValidationErrors = (errors) => {
  const message = Array.isArray(errors) ? errors.join('\n') : errors
  showError(message)
}

/**
 * Mostrar múltiples errores
 */
export const showMultipleErrors = (errorObj) => {
  const messages = Object.values(errorObj).flat()
  showValidationErrors(messages)
}
