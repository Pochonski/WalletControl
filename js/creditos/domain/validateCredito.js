/**
 * validateCredito.js
 * Reglas de negocio y validación para Créditos recibidos y Acreedores.
 */

const TIPOS_VALIDOS = ['CUOTA_FIJA', 'DISMINUIR_CUOTA', 'INTERES_FIJO', 'CAPITAL_AL_FINAL']
const FRECUENCIAS_VALIDAS = ['DIARIO', 'INTERDIARIO', 'SEMANAL', 'BISEMANAL', 'QUINCENAL', '15_Y_FIN_MES', 'MENSUAL', 'ANUAL']

// ── Acreedores ───────────────────────────────────────────────────────────────

export const validateAcreedor = (acreedor) => {
  const errors = []

  if (!acreedor.nombre || acreedor.nombre.trim().length < 2)
    errors.push('El nombre del acreedor es requerido (mínimo 2 caracteres)')

  return { valid: errors.length === 0, errors }
}

// ── Créditos ─────────────────────────────────────────────────────────────────

export const validateCredito = (credito) => {
  const errors = []

  if (!credito.acreedor_id)
    errors.push('El crédito debe estar asociado a un acreedor')

  if (!credito.monto_original || credito.monto_original <= 0)
    errors.push('El monto recibido debe ser mayor a 0')

  if (credito.tasa_interes === undefined || credito.tasa_interes === null || credito.tasa_interes < 0)
    errors.push('La tasa de interés no puede ser negativa')

  if (!credito.tipo_amortizacion)
    errors.push('El tipo de amortización es requerido')
  else if (!TIPOS_VALIDOS.includes(credito.tipo_amortizacion.toUpperCase()))
    errors.push(`Tipo de amortización inválido. Debe ser: ${TIPOS_VALIDOS.join(', ')}`)

  if (!credito.frecuencia_pago)
    errors.push('La frecuencia de pago es requerida')
  else if (!FRECUENCIAS_VALIDAS.includes(credito.frecuencia_pago.toUpperCase()))
    errors.push(`Frecuencia inválida. Debe ser: ${FRECUENCIAS_VALIDAS.join(', ')}`)

  if (!credito.fecha_inicio)
    errors.push('La fecha de inicio es requerida')
  else if (isNaN(new Date(credito.fecha_inicio).getTime()))
    errors.push('Fecha de inicio inválida')

  if (!credito.fecha_primer_pago)
    errors.push('La fecha del primer pago es requerida')
  else if (isNaN(new Date(credito.fecha_primer_pago).getTime()))
    errors.push('Fecha del primer pago inválida')

  if (credito.fecha_inicio && credito.fecha_primer_pago) {
    if (new Date(credito.fecha_primer_pago) < new Date(credito.fecha_inicio))
      errors.push('La fecha del primer pago no puede ser anterior a la fecha de inicio')
  }

  return { valid: errors.length === 0, errors }
}

// ── Pagos de crédito ──────────────────────────────────────────────────────────

export const validatePagoCredito = (pago) => {
  const errors = []

  if (!pago.credito_id)
    errors.push('El pago debe estar asociado a un crédito')

  if (!pago.monto || pago.monto <= 0)
    errors.push('El monto del pago debe ser mayor a 0')

  if (!pago.fecha_pago)
    errors.push('La fecha de pago es requerida')
  else if (isNaN(new Date(pago.fecha_pago).getTime()))
    errors.push('Fecha de pago inválida')

  return { valid: errors.length === 0, errors }
}
