/**
 * rentabilidadReport.js - Reporte de Rentabilidad Global.
 * KPIs: interés total ganado, ganancia activos, total combinado.
 * Gráfica: línea mensual (últimos 12 meses).
 * Tabla: resumen por mes.
 */

import { reportesDataAdapter } from '../../adapters/dataAdapters/reportesDataAdapter.js'
import { formatCurrency, formatCurrencyAbbrev } from '../../common/currencyFormatter.js'
import { renderLineChart } from '../charts/svgCharts.js'

export const renderRentabilidadReport = async (container) => {
  const [mensual, acumulada] = await Promise.all([
    reportesDataAdapter.getRentabilidadMensual(12),
    reportesDataAdapter.getRentabilidadAcumulada().catch(() => null)
  ])

  if (!mensual.length && !acumulada) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px; text-align:center;">
        <p style="font-size: 2rem;">📊</p>
        <p>Sin datos de rentabilidad disponibles.</p>
      </div>
    `
    return []
  }

  const interesTotal  = Number(acumulada?.interes_total ?? 0)
  const gananciaActivos = Number(acumulada?.ganancia_activos ?? 0)
  const totalCombinado  = interesTotal + gananciaActivos

  const lineData = mensual.map(m => ({
    label: _labelMes(m.mes),
    value: Number(m.total_mes ?? 0)
  }))

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card kpi-card--blue">
        <span class="kpi-valor">${formatCurrencyAbbrev(interesTotal)}</span>
        <span class="kpi-titulo">Interés Cobrado</span>
        <span class="kpi-subtitulo">Préstamos</span>
      </div>
      <div class="kpi-card kpi-card--green">
        <span class="kpi-valor">${formatCurrencyAbbrev(gananciaActivos)}</span>
        <span class="kpi-titulo">Ganancia Activos</span>
        <span class="kpi-subtitulo">Activos vendidos</span>
      </div>
      <div class="kpi-card kpi-card--green">
        <span class="kpi-valor">${formatCurrencyAbbrev(totalCombinado)}</span>
        <span class="kpi-titulo">Total Combinado</span>
        <span class="kpi-subtitulo">Rentabilidad total</span>
      </div>
    </div>

    <div class="reporte-section">
      <h3 class="section-title">Rentabilidad mensual (últimos 12 meses)</h3>
      <div id="chart-rentabilidad" class="chart-container"></div>
    </div>

    ${mensual.length ? `
    <div class="reporte-section">
      <h3 class="section-title">Detalle por mes</h3>
      <div class="table-wrapper">
        <table class="reporte-table">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Interés Prestamos</th>
              <th>Ganancia Activos</th>
              <th>Total Mes</th>
            </tr>
          </thead>
          <tbody>
            ${mensual.map(m => `
              <tr>
                <td>${_labelMes(m.mes)}</td>
                <td class="td-monto">${formatCurrency(m.interes_prestamos ?? 0)}</td>
                <td class="td-monto">${formatCurrency(m.ganancia_activos ?? 0)}</td>
                <td class="td-monto"><strong>${formatCurrency(m.total_mes ?? 0)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}
  `

  renderLineChart(document.getElementById('chart-rentabilidad'), lineData, {
    color: '#10b981',
    valuePrefix: '₡'
  })

  return mensual.map(m => ({
    Mes: m.mes,
    Interes_Prestamos: m.interes_prestamos ?? 0,
    Ganancia_Activos: m.ganancia_activos ?? 0,
    Total_Mes: m.total_mes ?? 0
  }))
}

function _labelMes(mesStr) {
  if (!mesStr) return '—'
  // mesStr esperado: 'YYYY-MM'
  const [year, month] = mesStr.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('es-CR', { month: 'short', year: '2-digit' })
}
