/**
 * activosReport.js - Reporte de Activos.
 * KPIs: en inventario, vendidos, ganancia total, margen promedio.
 * Gráfica: donut por categoría.
 * Tabla: activos ordenados por ganancia.
 */

import { reportesDataAdapter } from '../../adapters/dataAdapters/reportesDataAdapter.js'
import { formatCurrency, formatCurrencyAbbrev } from '../../common/currencyFormatter.js'
import { renderPieChart } from '../charts/svgCharts.js'

export const renderActivosReport = async (container) => {
  const activos = await reportesDataAdapter.getActivos()

  if (!activos.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px; text-align:center;">
        <p style="font-size: 2rem;">📦</p>
        <p>No hay activos registrados.</p>
      </div>
    `
    return []
  }

  const vendidos  = activos.filter(a => a.estado === 'VENDIDO')
  const inventario = activos.filter(a => a.estado !== 'VENDIDO')
  const gananciaTot = vendidos.reduce((s, a) => s + Number(a.ganancia ?? 0), 0)
  const margenProm  = vendidos.length
    ? Math.round(vendidos.reduce((s, a) => s + Number(a.margen_porcentaje ?? 0), 0) / vendidos.length)
    : 0

  // Agrupar por categoría (todos los activos)
  const porCategoria = {}
  activos.forEach(a => {
    const cat = a.categoria ?? 'SIN CATEGORÍA'
    porCategoria[cat] = (porCategoria[cat] ?? 0) + 1
  })
  const pieData = Object.entries(porCategoria)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card kpi-card--blue">
        <span class="kpi-valor">${inventario.length}</span>
        <span class="kpi-titulo">En Inventario</span>
      </div>
      <div class="kpi-card kpi-card--green">
        <span class="kpi-valor">${vendidos.length}</span>
        <span class="kpi-titulo">Vendidos</span>
      </div>
      <div class="kpi-card kpi-card--green">
        <span class="kpi-valor">${formatCurrencyAbbrev(gananciaTot)}</span>
        <span class="kpi-titulo">Ganancia Total</span>
      </div>
      <div class="kpi-card kpi-card--amber">
        <span class="kpi-valor">${margenProm}%</span>
        <span class="kpi-titulo">Margen Promedio</span>
      </div>
    </div>

    <div class="reporte-section">
      <h3 class="section-title">Distribución por categoría</h3>
      <div id="chart-activos" class="chart-container"></div>
    </div>

    <div class="reporte-section">
      <h3 class="section-title">Detalle de activos (${activos.length})</h3>
      <div class="table-wrapper">
        <table class="reporte-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Estado</th>
              <th>Costo</th>
              <th>Precio Venta</th>
              <th>Ganancia</th>
              <th>Margen</th>
            </tr>
          </thead>
          <tbody>
            ${activos
              .sort((a, b) => Number(b.ganancia ?? 0) - Number(a.ganancia ?? 0))
              .map(a => `
              <tr>
                <td>${a.nombre ?? '—'}</td>
                <td>${a.categoria ?? '—'}</td>
                <td>${_badgeEstado(a.estado)}</td>
                <td class="td-monto">${formatCurrency(a.costo_compra)}</td>
                <td class="td-monto">${a.precio_venta_final ? formatCurrency(a.precio_venta_final) : '—'}</td>
                <td class="td-monto ${Number(a.ganancia ?? 0) >= 0 ? 'td-positive' : 'td-negative'}">
                  ${a.ganancia != null ? formatCurrency(a.ganancia) : '—'}
                </td>
                <td>${a.margen_porcentaje != null ? `${Number(a.margen_porcentaje).toFixed(1)}%` : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `

  renderPieChart(document.getElementById('chart-activos'), pieData, {
    donut: true
  })

  return activos.map(a => ({
    Nombre: a.nombre,
    Categoria: a.categoria,
    Estado: a.estado,
    Costo_Compra: a.costo_compra,
    Precio_Venta: a.precio_venta_final ?? '',
    Ganancia: a.ganancia ?? '',
    Margen_Porcentaje: a.margen_porcentaje ?? '',
    Fecha_Compra: a.fecha_compra ?? '',
    Fecha_Venta: a.fecha_venta ?? ''
  }))
}

function _badgeEstado(estado) {
  const map = {
    VENDIDO:    'badge-success',
    DISPONIBLE: 'badge-info',
    RESERVADO:  'badge-warning',
    REPARACION: 'badge-warning'
  }
  const cls = map[estado] ?? 'badge'
  return `<span class="badge ${cls}">${estado ?? '—'}</span>`
}
