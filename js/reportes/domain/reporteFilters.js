/**
 * reporteFilters.js - Validación y helpers de filtros de fecha para reportes.
 */

/**
 * Retorna el primer y último día del mes actual.
 * @returns {{ desde: string, hasta: string }} Formato YYYY-MM-DD
 */
export const filtroMesActual = () => {
  const hoy = new Date()
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  return {
    desde: _toInputDate(desde),
    hasta: _toInputDate(hasta)
  }
}

/**
 * Retorna los últimos N días.
 * @param {number} dias
 */
export const filtroUltimosDias = (dias) => {
  const hasta = new Date()
  const desde = new Date()
  desde.setDate(desde.getDate() - dias)
  return {
    desde: _toInputDate(desde),
    hasta: _toInputDate(hasta)
  }
}

/**
 * Valida un rango de fechas.
 * @returns {{ valid: boolean, error: string|null }}
 */
export const validarRango = (desde, hasta) => {
  if (!desde || !hasta) return { valid: false, error: 'Selecciona fecha desde y hasta.' }
  if (new Date(desde) > new Date(hasta)) return { valid: false, error: 'La fecha "desde" debe ser anterior a "hasta".' }
  const diffMs = new Date(hasta) - new Date(desde)
  const diffDias = diffMs / (1000 * 60 * 60 * 24)
  if (diffDias > 365) return { valid: false, error: 'El rango máximo es 365 días.' }
  return { valid: true, error: null }
}

/**
 * Formatea una fecha a string legible en español.
 * @param {string} isoDate - YYYY-MM-DD
 */
export const formatFechaCorta = (isoDate) => {
  if (!isoDate) return '—'
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('es-CR', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

// ─── helpers privados ────────────────────────────────────────────
function _toInputDate(date) {
  return date.toISOString().split('T')[0]
}
