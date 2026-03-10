/**
 * carteraReport.js - Reporte de Cartera Activa.
 * KPIs: total prestado, cobrado, pendiente, en mora.
 * Gráfica: pie de préstamos por estado.
 * Tabla: préstamos activos ordenados por saldo.
 */

import { reportesDataAdapter } from '../../adapters/dataAdapters/reportesDataAdapter.js'
import { formatCurrency, formatCurrencyAbbrev } from '../../common/currencyFormatter.js'
import { renderPieChart } from '../charts/svgCharts.js'

/**
 * @param {HTMLElement} container
 * @returns {Promise<object[]>} datos para exportar CSV
 */
export const renderCarteraReport = async (container) => {
  const [resumen, prestamos] = await Promise.all([
    reportesDataAdapter.getResumenCartera(),
    reportesDataAdapter.getPrestamosActivos()
  ])

  const porcMora = resumen.total_prestado > 0
    ? ((resumen.monto_en_mora / resumen.total_prestado) * 100).toFixed(1)
    : '0.0'

  container.innerHTML = `
    <div class="kpi-grid">
      ${_kpi('Total Prestado', formatCurrencyAbbrev(resumen.total_prestado), 'blue')}
      ${_kpi('Total Cobrado', formatCurrencyAbbrev(resumen.total_cobrado), 'green')}
      ${_kpi('Saldo Pendiente', formatCurrencyAbbrev(resumen.total_saldo_pendiente), 'amber')}
      ${_kpi('En Mora', formatCurrencyAbbrev(resumen.monto_en_mora), 'red', `${porcMora}% del total`)}
    </div>

    <div class="kpi-grid kpi-grid--secondary">
      ${_kpiSmall('Préstamos Activos', resumen.prestamos_activos ?? 0)}
      ${_kpiSmall('Cuotas Vencidas', resumen.cuotas_vencidas ?? 0)}
      ${_kpiSmall('Interés Pendiente', formatCurrencyAbbrev(resumen.total_interes_pendiente))}
    </div>

    <div class="reporte-section">
      <h3 class="section-title">Distribución de préstamos</h3>
      <div id="chart-cartera" class="chart-container"></div>
    </div>

    <div class="reporte-section">
      <h3 class="section-title">Préstamos Activos (${prestamos.length})</h3>
      <div class="table-wrapper">
        <table class="reporte-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Riesgo</th>
              <th>Tasa</th>
              <th>Prestado</th>
              <th>Cobrado</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            ${prestamos.map(p => `
              <tr>
                <td>${p.clientes?.nombre ?? '—'}</td>
                <td>${_badgeRiesgo(p.clientes?.nivel_riesgo)}</td>
                <td>${p.tasa_interes}%</td>
                <td>${formatCurrency(p.monto_original)}</td>
                <td>${formatCurrency(p.monto_pagado)}</td>
                <td class="td-monto">${formatCurrency(p.saldo_pendiente)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `

  // Gráfica pie: préstamos por estado
  const pieData = [
    { label: 'Activos', value: resumen.prestamos_activos ?? 0 },
    { label: 'Completados', value: resumen.prestamos_completados ?? 0 },
    { label: 'Archivados', value: resumen.prestamos_archivados ?? 0 }
  ].filter(d => d.value > 0)

  renderPieChart(document.getElementById('chart-cartera'), pieData, {
    title: 'Préstamos por estado'
  })

  // Retornar datos para CSV
  return prestamos.map(p => ({
    Cliente: p.clientes?.nombre ?? '',
    Nivel_Riesgo: p.clientes?.nivel_riesgo ?? '',
    Tasa: p.tasa_interes,
    Prestado: p.monto_original,
    Cobrado: p.monto_pagado,
    Saldo_Pendiente: p.saldo_pendiente,
    Estado: p.estado,
    Fecha_Inicio: p.fecha_inicio,
    Fecha_Fin: p.fecha_fin
  }))
}

// ─── helpers de render ───────────────────────────────────────────
function _kpi(titulo, valor, color, subtitulo = '') {
  return `
    <div class="kpi-card kpi-card--${color}">
      <span class="kpi-valor">${valor}</span>
      <span class="kpi-titulo">${titulo}</span>
      ${subtitulo ? `<span class="kpi-subtitulo">${subtitulo}</span>` : ''}
    </div>
  `
}

function _kpiSmall(titulo, valor) {
  return `
    <div class="kpi-card kpi-card--small">
      <span class="kpi-valor">${valor}</span>
      <span class="kpi-titulo">${titulo}</span>
    </div>
  `
}

function _badgeRiesgo(nivel) {
  const cls = nivel === 'ALTO' ? 'badge-error' : nivel === 'MEDIO' ? 'badge-warning' : 'badge-success'
  return `<span class="badge ${cls}">${nivel ?? '—'}</span>`
}
