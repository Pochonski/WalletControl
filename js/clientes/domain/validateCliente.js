/**
 * Validaciones puras para Cliente
 * Sin dependencias externas, sin side effects
 */

export const validateCliente = (data) => {
  const errors = []

  // Nombre
  if (!data.nombre || typeof data.nombre !== 'string') {
    errors.push('Nombre es requerido')
  } else if (data.nombre.trim().length < 3) {
    errors.push('Nombre debe tener al menos 3 caracteres')
  }

  // Cédula
  if (!data.cedula || typeof data.cedula !== 'string') {
    errors.push('Cédula es requerida')
  } else if (!/^\d{7,15}$/.test(data.cedula.replace(/[-.\s]/g, ''))) {
    errors.push('Cédula inválida (7-15 dígitos)')
  }

  // Email (opcional pero validar si existe)
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Email inválido')
  }

  // Teléfono (opcional pero validar si existe)
  if (data.telefono && !/^\d{7,15}$/.test(data.telefono.replace(/[-.()\s]/g, ''))) {
    errors.push('Teléfono inválido (7-15 dígitos)')
  }

  // Fecha nacimiento (opcional pero validar si existe)
  if (data.fecha_nacimiento) {
    const date = new Date(data.fecha_nacimiento)
    if (isNaN(date.getTime())) {
      errors.push('Fecha de nacimiento inválida')
    }
  }

  // Nivel de riesgo (si existe)
  if (data.nivel_riesgo && !['BAJO', 'MEDIO', 'ALTO'].includes(data.nivel_riesgo)) {
    errors.push('Nivel de riesgo inválido')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export const validateClienteUpdate = (data) => {
  // Actualización es más flexible (campos opcionales)
  const errors = []

  if (data.nombre !== undefined && data.nombre.trim().length < 3) {
    errors.push('Nombre debe tener al menos 3 caracteres')
  }

  if (data.email !== undefined && data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Email inválido')
  }

  if (data.telefono !== undefined && data.telefono && !/^\d{7,15}$/.test(data.telefono.replace(/[-.()\s]/g, ''))) {
    errors.push('Teléfono inválido')
  }

  if (data.nivel_riesgo !== undefined && !['BAJO', 'MEDIO', 'ALTO'].includes(data.nivel_riesgo)) {
    errors.push('Nivel de riesgo inválido')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
