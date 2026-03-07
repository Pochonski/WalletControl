/**
 * validators — Funciones de validación reutilizables.
 * Funciones puras que retornan { valid: boolean, error: string|null }.
 * Se usan en domain/ ANTES de dispatch.
 */

/**
 * @typedef {{ valid: boolean, error: string|null }} ValidationResult
 */

/**
 * Verifica que un valor no esté vacío.
 * @param {any} value
 * @param {string} fieldName
 * @returns {ValidationResult}
 */
export function isRequired(value, fieldName = 'Campo') {
  const isEmpty = value === null || value === undefined || String(value).trim() === ''
  return isEmpty
    ? { valid: false, error: `${fieldName} es obligatorio.` }
    : { valid: true,  error: null }
}

/**
 * Verifica que un número sea positivo (> 0).
 * @param {number|string} value
 * @param {string} fieldName
 * @returns {ValidationResult}
 */
export function isPositiveNumber(value, fieldName = 'Valor') {
  const num = parseFloat(value)
  if (isNaN(num)) return { valid: false, error: `${fieldName} debe ser un número.` }
  if (num <= 0)   return { valid: false, error: `${fieldName} debe ser mayor a 0.` }
  return { valid: true, error: null }
}

/**
 * Verifica que un número sea >= 0.
 * @param {number|string} value
 * @param {string} fieldName
 * @returns {ValidationResult}
 */
export function isNonNegativeNumber(value, fieldName = 'Valor') {
  const num = parseFloat(value)
  if (isNaN(num)) return { valid: false, error: `${fieldName} debe ser un número.` }
  if (num < 0)    return { valid: false, error: `${fieldName} no puede ser negativo.` }
  return { valid: true, error: null }
}

/**
 * Verifica longitud mínima de string.
 * @param {string} value
 * @param {number} min
 * @param {string} fieldName
 * @returns {ValidationResult}
 */
export function minLength(value, min, fieldName = 'Campo') {
  if (!value || value.length < min) {
    return { valid: false, error: `${fieldName} debe tener al menos ${min} caracteres.` }
  }
  return { valid: true, error: null }
}

/**
 * Verifica longitud máxima de string.
 * @param {string} value
 * @param {number} max
 * @param {string} fieldName
 * @returns {ValidationResult}
 */
export function maxLength(value, max, fieldName = 'Campo') {
  if (value && value.length > max) {
    return { valid: false, error: `${fieldName} no puede exceder ${max} caracteres.` }
  }
  return { valid: true, error: null }
}

/**
 * Valida formato de correo electrónico.
 * @param {string} email
 * @returns {ValidationResult}
 */
export function isValidEmail(email) {
  if (!email) return { valid: true, error: null } // opcional
  const re = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/
  return re.test(email.trim())
    ? { valid: true,  error: null }
    : { valid: false, error: 'Correo electrónico no es válido.' }
}

/**
 * Valida formato de teléfono (mínimo 7 dígitos).
 * @param {string} phone
 * @returns {ValidationResult}
 */
export function isValidPhone(phone) {
  if (!phone) return { valid: true, error: null } // opcional
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 7
    ? { valid: true,  error: null }
    : { valid: false, error: 'Teléfono debe tener al menos 7 dígitos.' }
}

/**
 * Valida que una fecha ISO sea válida.
 * @param {string} isoDate
 * @param {string} fieldName
 * @returns {ValidationResult}
 */
export function isValidDate(isoDate, fieldName = 'Fecha') {
  if (!isoDate) return { valid: false, error: `${fieldName} es obligatoria.` }
  const d = new Date(isoDate)
  return isNaN(d.getTime())
    ? { valid: false, error: `${fieldName} no es una fecha válida.` }
    : { valid: true,  error: null }
}

/**
 * Valida que fecha fin sea posterior a fecha inicio.
 * @param {string} isoStart
 * @param {string} isoEnd
 * @returns {ValidationResult}
 */
export function isEndAfterStart(isoStart, isoEnd) {
  if (!isoStart || !isoEnd) return { valid: false, error: 'Ambas fechas son requeridas.' }
  return new Date(isoEnd) > new Date(isoStart)
    ? { valid: true,  error: null }
    : { valid: false, error: 'La fecha fin debe ser posterior a la fecha inicio.' }
}

/**
 * Valida un monto de pago: positivo y no mayor al saldo pendiente.
 * @param {number} monto
 * @param {number} saldoPendiente
 * @returns {ValidationResult}
 */
export function isValidPaymentAmount(monto, saldoPendiente) {
  const numMonto  = parseFloat(monto)
  const numSaldo  = parseFloat(saldoPendiente)

  if (isNaN(numMonto) || numMonto <= 0) {
    return { valid: false, error: 'El monto debe ser mayor a 0.' }
  }
  if (numMonto > numSaldo + 0.01) { // pequeño margen para decimales
    return { valid: false, error: `El monto no puede superar el saldo pendiente (${numSaldo.toFixed(2)}).` }
  }
  return { valid: true, error: null }
}

/**
 * Valida que un archivo sea imagen JPG/PNG y no exceda 5MB.
 * @param {File} file
 * @returns {ValidationResult}
 */
export function isValidImage(file) {
  if (!file) return { valid: true, error: null }
  const allowed = ['image/jpeg', 'image/png']
  const maxBytes = 5 * 1024 * 1024 // 5MB

  if (!allowed.includes(file.type)) {
    return { valid: false, error: 'Solo se permiten imágenes JPG o PNG.' }
  }
  if (file.size > maxBytes) {
    return { valid: false, error: 'La imagen no puede superar 5 MB.' }
  }
  return { valid: true, error: null }
}

/**
 * Ejecuta múltiples validaciones y retorna el primer error encontrado.
 * @param {ValidationResult[]} results
 * @returns {ValidationResult}
 */
export function combineValidations(results) {
  const failed = results.find(r => !r.valid)
  return failed ?? { valid: true, error: null }
}
