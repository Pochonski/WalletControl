/**
 * validatePago.js
 * Reglas de negocio y validación para Pagos.
 */

const METODOS_VALIDOS = ['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'OTRO']
const ESTADOS_VALIDOS = ['CONFIRMADO', 'PENDIENTE', 'RECHAZADO']

export const validatePago = (pago) => {
  const errors = []

  if (!pago.cuota_id) errors.push('Debes seleccionar una cuota')
  if (!pago.monto || pago.monto <= 0) errors.push('El monto del pago debe ser mayor a 0')
  if (!pago.fecha_pago) errors.push('La fecha del pago es obligatoria')
  if (!pago.metodo_pago) errors.push('Selecciona el método de pago')

  if (pago.monto && isNaN(parseFloat(pago.monto))) {
    errors.push('El monto debe ser un número válido')
  }

  if (pago.fecha_pago && isNaN(new Date(pago.fecha_pago).getTime())) {
    errors.push('La fecha del pago es inválida')
  }

  if (pago.metodo_pago && !METODOS_VALIDOS.includes(pago.metodo_pago.toUpperCase())) {
    errors.push(`Método de pago inválido. Debe ser uno de: ${METODOS_VALIDOS.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export const validatePagoUpdate = (cambios) => {
  const errors = []

  if (cambios.monto !== undefined && cambios.monto <= 0) {
    errors.push('El monto debe ser mayor a 0')
  }

  if (cambios.estado && !ESTADOS_VALIDOS.includes(cambios.estado.toUpperCase())) {
    errors.push(`Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
