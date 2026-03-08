export const validateActivo = (data) => {
  const errors = []
  
  if (!data.nombre || data.nombre.trim() === '') {
    errors.push('El nombre del activo es requerido')
  }
  
  if (!data.categoria) {
    errors.push('La categoría es requerida')
  }
  
  if (!data.costo_compra || isNaN(data.costo_compra) || Number(data.costo_compra) <= 0) {
    errors.push('El costo de compra debe ser mayor a 0')
  }
  
  if (!data.fecha_compra) {
    errors.push('La fecha de compra es requerida')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
