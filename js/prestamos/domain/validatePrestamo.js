/**
 * validatePrestamo.js
 * Reglas de negocio y validación para Préstamos.
 */

export const validatePrestamo = (prestamo) => {
  const errors = []

  if (!prestamo.cliente_id) errors.push('El préstamo debe estar asociado a un cliente')
  if (!prestamo.monto || prestamo.monto <= 0) errors.push('El monto debe ser mayor a 0')
  if (!prestamo.tasa_interes || prestamo.tasa_interes < 0) errors.push('Tasa de interés inválida')
  if (!prestamo.plazo_meses || prestamo.plazo_meses <= 0) errors.push('El plazo debe ser mayor a 0 meses')
  if (!prestamo.frecuencia_pago) errors.push('La frecuencia de pago es requerida (DIARIO, SEMANAL, QUINCENAL, MENSUAL)')
  
  // Validar enum frecuencia
  const frecuenciasValidas = ['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL']
  if (prestamo.frecuencia_pago && !frecuenciasValidas.includes(prestamo.frecuencia_pago.toUpperCase())) {
      errors.push(`Frecuencia inválida. Debe ser una de: ${frecuenciasValidas.join(', ')}`)
  }

  // Opcional: Validar que fecha_inicio sea válida si existe
  if (prestamo.fecha_inicio && isNaN(new Date(prestamo.fecha_inicio).getTime())) {
      errors.push('Fecha de inicio inválida')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export const validatePrestamoUpdate = (cambios) => {
  const errors = []

  // Si intentan modificar monto o plazo, que sean válidos
  if (cambios.monto !== undefined && cambios.monto <= 0) errors.push('El monto debe ser mayor a 0')
  if (cambios.plazo_meses !== undefined && cambios.plazo_meses <= 0) errors.push('El plazo debe ser mayor a 0 meses')
  if (cambios.tasa_interes !== undefined && cambios.tasa_interes < 0) errors.push('Tasa de interés inválida')

  const estadosValidos = ['ACTIVO', 'PAGADO', 'MORA', 'ARCHIVADO', 'PENDIENTE']
  if (cambios.estado && !estadosValidos.includes(cambios.estado.toUpperCase())) {
      errors.push(`Estado inválido. Debe ser uno de: ${estadosValidos.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
