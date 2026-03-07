/**
 * dateUtils — Utilidades de fecha con JS nativo.
 * Funciones puras, sin DOM ni side effects.
 * Todas las fechas se manejan en formato ISO 'YYYY-MM-DD' internamente.
 */

/**
 * Retorna la fecha de hoy como string ISO 'YYYY-MM-DD'.
 * @returns {string}
 */
export function today() {
  return toISODate(new Date())
}

/**
 * Convierte una Date a string ISO 'YYYY-MM-DD'.
 * @param {Date} date
 * @returns {string}
 */
export function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parsea un string 'YYYY-MM-DD' a objeto Date (sin problemas de timezone).
 * @param {string} isoString
 * @returns {Date}
 */
export function parseDate(isoString) {
  if (!isoString) return null
  const [y, m, d] = isoString.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Formatea una fecha para mostrar al usuario.
 * @param {string|Date} date  - ISO string o Date
 * @param {'short'|'medium'|'long'} [format='medium']
 * @returns {string}  Ej: 'medium' = '15 mar 2026' | 'short' = '15/03/26' | 'long' = '15 de marzo de 2026'
 */
export function formatDate(date, format = 'medium') {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseDate(date) : date
  if (!d || isNaN(d)) return '—'

  if (format === 'short') {
    return d.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }
  if (format === 'long') {
    return d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  // medium
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Retorna cuántos días han pasado desde una fecha hasta hoy.
 * Positivo = pasado, negativo = futuro.
 * @param {string} isoDate
 * @returns {number}
 */
export function daysSince(isoDate) {
  const fecha = parseDate(isoDate)
  if (!fecha) return 0
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  fecha.setHours(0, 0, 0, 0)
  return Math.round((hoy - fecha) / (1000 * 60 * 60 * 24))
}

/**
 * Calcula los días entre dos fechas ISO.
 * @param {string} isoStart
 * @param {string} isoEnd
 * @returns {number}
 */
export function daysBetween(isoStart, isoEnd) {
  const start = parseDate(isoStart)
  const end   = parseDate(isoEnd)
  if (!start || !end) return 0
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}

/**
 * Verifica si una fecha ISO ya venció (es anterior a hoy).
 * @param {string} isoDate
 * @returns {boolean}
 */
export function isOverdue(isoDate) {
  return daysSince(isoDate) > 0
}

/**
 * Verifica si una fecha ISO es hoy.
 * @param {string} isoDate
 * @returns {boolean}
 */
export function isToday(isoDate) {
  return isoDate === today()
}

/**
 * Agrega N días a una fecha ISO y retorna el nuevo ISO string.
 * @param {string} isoDate
 * @param {number} days
 * @returns {string}
 */
export function addDays(isoDate, days) {
  const d = parseDate(isoDate)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/**
 * Agrega N meses a una fecha ISO y retorna el nuevo ISO string.
 * @param {string} isoDate
 * @param {number} months
 * @returns {string}
 */
export function addMonths(isoDate, months) {
  const d = parseDate(isoDate)
  d.setMonth(d.getMonth() + months)
  return toISODate(d)
}

/**
 * Retorna el primer día del mes de una fecha ISO.
 * @param {string} isoDate
 * @returns {string}
 */
export function startOfMonth(isoDate) {
  const d = parseDate(isoDate)
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1))
}

/**
 * Retorna el último día del mes de una fecha ISO.
 * @param {string} isoDate
 * @returns {string}
 */
export function endOfMonth(isoDate) {
  const d = parseDate(isoDate)
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

/**
 * Retorna 'hace X días', 'hoy', 'en X días', etc.
 * @param {string} isoDate
 * @returns {string}
 */
export function relativeDate(isoDate) {
  const dias = daysSince(isoDate)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias === -1) return 'mañana'
  if (dias > 0) return `hace ${dias} días`
  return `en ${Math.abs(dias)} días`
}

/**
 * Retorna el nombre del mes y año de una fecha ISO.
 * @param {string} isoDate
 * @returns {string}  Ej: 'Marzo 2026'
 */
export function monthYearLabel(isoDate) {
  const d = parseDate(isoDate)
  return d.toLocaleDateString('es', { month: 'long', year: 'numeric' })
}
