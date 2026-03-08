/**
 * validatePrestamo.js
 * Reglas de negocio y validación para Préstamos.
 */

export const validatePrestamo = (prestamo) => {
  const errors = []

  if (!prestamo.cliente_id) errors.push('El préstamo debe estar asociado a un cliente')
  if (!prestamo.monto_original || prestamo.monto_original <= 0) errors.push('El monto debe ser mayor a 0')
  if (!prestamo.tasa_interes || prestamo.tasa_interes < 0) errors.push('Tasa de interés inválida')
  if (!prestamo.tipo_interes) errors.push('El tipo de interés es requerido')
  if (!prestamo.frecuencia_pago) errors.push('La frecuencia de pago es requerida')
  if (!prestamo.fecha_inicio) errors.push('La fecha de inicio es requerida')
  if (!prestamo.fecha_fin) errors.push('La fecha fin es requerida')

  const frecuenciasValidas = ['DIARIO', 'INTERDIARIO', 'SEMANAL', 'BISEMANAL', 'QUINCENAL', '15_Y_FIN_MES', 'MENSUAL', 'ANUAL']
  if (prestamo.frecuencia_pago && !frecuenciasValidas.includes(prestamo.frecuencia_pago.toUpperCase())) {
    errors.push(`Frecuencia inválida. Debe ser una de: ${frecuenciasValidas.join(', ')}`)
  }

  const tiposValidos = ['CUOTA_FIJA', 'DISMINUIR_CUOTA', 'INTERES_FIJO', 'CAPITAL_AL_FINAL']
  if (prestamo.tipo_interes && !tiposValidos.includes(prestamo.tipo_interes.toUpperCase())) {
    errors.push(`Tipo de interés (amortización) inválido. Debe ser uno de: ${tiposValidos.join(', ')}`)
  }

  if (prestamo.fecha_inicio && isNaN(new Date(prestamo.fecha_inicio).getTime())) {
    errors.push('Fecha de inicio inválida')
  }

  if (prestamo.fecha_fin && isNaN(new Date(prestamo.fecha_fin).getTime())) {
    errors.push('Fecha fin inválida')
  }

  if (prestamo.fecha_inicio && prestamo.fecha_fin) {
    if (new Date(prestamo.fecha_fin) <= new Date(prestamo.fecha_inicio)) {
      errors.push('La fecha fin debe ser posterior a la fecha de inicio')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export const validatePrestamoUpdate = (cambios) => {
  const errors = []

  if (cambios.monto_original !== undefined && cambios.monto_original <= 0) errors.push('El monto debe ser mayor a 0')
  if (cambios.tasa_interes !== undefined && cambios.tasa_interes < 0) errors.push('Tasa de interés inválida')

  const estadosValidos = ['ACTIVO', 'COMPLETADO', 'ARCHIVADO']
  if (cambios.estado && !estadosValidos.includes(cambios.estado.toUpperCase())) {
    errors.push(`Estado del préstamo inválido. Debe ser uno de: ${estadosValidos.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
