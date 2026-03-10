/**
 * reporteExport.js - Exportación de reportes a CSV sin dependencias externas.
 */

/**
 * Convierte un array de objetos a CSV y descarga el archivo.
 * @param {object[]} datos - Array de filas (objetos planos)
 * @param {string} nombreReporte - Nombre base del archivo
 */
export const exportarCSV = (datos, nombreReporte = 'reporte') => {
  if (!datos?.length) {
    alert('No hay datos para exportar.')
    return
  }

  const columnas = Object.keys(datos[0])
  const encabezado = columnas.join(',')
  const filas = datos.map(fila =>
    columnas.map(col => _escaparCSV(fila[col])).join(',')
  )

  const csv = [encabezado, ...filas].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const fecha = new Date().toISOString().split('T')[0]
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreReporte}-${fecha}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function _escaparCSV(valor) {
  if (valor == null) return ''
  const str = String(valor)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
