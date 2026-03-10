/**
 * cobrosReport.js - Reporte de Cobros del Período.
 * Filtro: selector de fecha desde/hasta.
 * KPIs: total cobrado, N° pagos, por método.
 * Gráfica: barras de cobros por día.
 * Tabla: detalle de pagos.
 */

import { reportesDataAdapter } from '../../adapters/dataAdapters/reportesDataAdapter.js'
import { formatCurrency, formatCurrencyAbbrev } from '../../common/currencyFormatter.js'
import { filtroMesActual, validarRango, formatFechaCorta } from '../domain/reporteFilters.js'
import { renderBarChart } from '../charts/svgCharts.js'

export const renderCobrosReport = async (container) => {
  const { desde, hasta } = filtroMesActual()

  // Renderizar shell con filtros primero
  container.innerHTML = `
    <div class="reporte-filtros">
      <div class="form-group">
        <label>Desde</label>
        <input type="date" id="cobros-desde" value="${desde}">
      </div>
      <div class="form-group">
        <label>Hasta</label>
        <input type="date" id="cobros-hasta" value="${hasta}">
      </div>
      <button class="btn btn-primary btn-sm" id="btn-cobros-filtrar">Consultar</button>
    </div>
    <div id="cobros-resultado"></div>
  `

  const aplicarFiltro = async () => {
    const d = document.getElementById('cobros-desde')?.value
    const h = document.getElementById('cobros-hasta')?.value
    const { valid, error } = validarRango(d, h)
    const resultado = document.getElementById('cobros-resultado')

    if (!valid) {
      resultado.innerHTML = `<p class="error-text">${error}</p>`
      return
    }

    resultado.innerHTML = '<div class="loading-state">Cargando…</div>'

    try {
      const pagos = await reportesDataAdapter.getCobrosDelPeriodo(d, h)
      _renderResultado(resultado, pagos, d, h)
      return pagos // para CSV
    } catch (err) {
      resultado.innerHTML = `<p class="error-text">Error: ${err.message}</p>`
    }
  }

  document.getElementById('btn-cobros-filtrar')?.addEventListener('click', aplicarFiltro)

  // Carga automática con el mes actual
  const datos = await aplicarFiltro()
  return datos ?? []
}

function _renderResultado(container, pagos, desde, hasta) {
  if (!pagos.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Sin cobros entre ${formatFechaCorta(desde)} y ${formatFechaCorta(hasta)}.</p>
      </div>
    `
    return
  }

  const total = pagos.reduce((s, p) => s + Number(p.monto), 0)
  const byMetodo = _agrupar(pagos, 'metodo_pago')
  const byDia = _agruparSumas(pagos, p => p.fecha_pago?.slice(0, 10), 'monto')

  const metodoCards = Object.entries(byMetodo).map(([metodo, items]) => {
    const subtotal = items.reduce((s, p) => s + Number(p.monto), 0)
    return `
      <div class="kpi-card kpi-card--small">
        <span class="kpi-valor">${formatCurrencyAbbrev(subtotal)}</span>
        <span class="kpi-titulo">${metodo} (${items.length})</span>
      </div>
    `
  }).join('')

  const barData = Object.entries(byDia)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, total]) => ({ label: fecha.slice(5), value: total }))

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card kpi-card--green">
        <span class="kpi-valor">${formatCurrencyAbbrev(total)}</span>
        <span class="kpi-titulo">Total Cobrado</span>
        <span class="kpi-subtitulo">${pagos.length} pagos</span>
      </div>
      ${metodoCards}
    </div>

    <div class="reporte-section">
      <h3 class="section-title">Cobros por día</h3>
      <div id="chart-cobros" class="chart-container"></div>
    </div>

    <div class="reporte-section">
      <h3 class="section-title">Detalle de pagos</h3>
      <div class="table-wrapper">
        <table class="reporte-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Cuota #</th>
              <th>Método</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            ${pagos.map(p => `
              <tr>
                <td>${formatFechaCorta(p.fecha_pago)}</td>
                <td>${p.cliente_nombre ?? '—'}</td>
                <td>${p.numero_cuota ?? '—'}</td>
                <td>${p.metodo_pago}</td>
                <td class="td-monto">${formatCurrency(p.monto)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `

  renderBarChart(document.getElementById('chart-cobros'), barData, {
    color: '#10b981',
    valuePrefix: '₡'
  })
}

function _agrupar(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] ?? 'SIN_DATO'
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}

function _agruparSumas(arr, keyFn, valueKey) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item) ?? 'SIN_DATO'
    acc[k] = (acc[k] ?? 0) + Number(item[valueKey] ?? 0)
    return acc
  }, {})
}
