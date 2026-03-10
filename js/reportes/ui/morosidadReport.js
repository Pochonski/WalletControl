/**
 * morosidadReport.js - Reporte de Morosidad.
 * KPIs: cuotas vencidas, monto total en mora, promedio días de atraso.
 * Gráfica: barras por segmento (1-7, 8-30, 31-90, +90 días).
 * Tabla: clientes ordenados por días de atraso.
 */

import { reportesDataAdapter } from '../../adapters/dataAdapters/reportesDataAdapter.js'
import { formatCurrency, formatCurrencyAbbrev } from '../../common/currencyFormatter.js'
import { renderBarChart } from '../charts/svgCharts.js'

const SEGMENTOS = ['1-7 días', '8-30 días', '31-90 días', 'Más de 90 días']
const SEGMENTO_COLORS = ['#f59e0b', '#f97316', '#ef4444', '#991b1b']

export const renderMorosidadReport = async (container) => {
  const cuotas = await reportesDataAdapter.getMorosidad()

  if (!cuotas.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px; text-align:center;">
        <p style="font-size: 2rem;">✅</p>
        <p>Sin cuotas vencidas. ¡Todo al día!</p>
      </div>
    `
    return []
  }

  const totalMora = cuotas.reduce((s, c) => s + Number(c.saldo_pendiente ?? 0), 0)
  const promDias = Math.round(cuotas.reduce((s, c) => s + Number(c.dias_atraso ?? 0), 0) / cuotas.length)

  // Agrupar por segmento
  const porSegmento = SEGMENTOS.reduce((acc, s) => ({ ...acc, [s]: 0 }), {})
  cuotas.forEach(c => {
    const seg = c.segmento_mora
    if (porSegmento[seg] !== undefined) porSegmento[seg]++
  })

  const barData = SEGMENTOS.map(s => ({ label: s, value: porSegmento[s] }))

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card kpi-card--red">
        <span class="kpi-valor">${cuotas.length}</span>
        <span class="kpi-titulo">Cuotas Vencidas</span>
      </div>
      <div class="kpi-card kpi-card--red">
        <span class="kpi-valor">${formatCurrencyAbbrev(totalMora)}</span>
        <span class="kpi-titulo">Monto en Mora</span>
      </div>
      <div class="kpi-card kpi-card--amber">
        <span class="kpi-valor">${promDias} días</span>
        <span class="kpi-titulo">Promedio Atraso</span>
      </div>
    </div>

    <div class="reporte-section">
      <h3 class="section-title">Cuotas por segmento de mora</h3>
      <div id="chart-mora" class="chart-container"></div>
    </div>

    <div class="reporte-section">
      <h3 class="section-title">Clientes en mora (${cuotas.length})</h3>
      <div class="table-wrapper">
        <table class="reporte-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Riesgo</th>
              <th>Cuota #</th>
              <th>Días Atraso</th>
              <th>Saldo</th>
              <th>Cobranza</th>
            </tr>
          </thead>
          <tbody>
            ${cuotas.map(c => `
              <tr class="${_classMora(c.dias_atraso)}">
                <td>${c.cliente_nombre ?? '—'}</td>
                <td>${c.cliente_telefono ?? '—'}</td>
                <td>${_badgeRiesgo(c.nivel_riesgo)}</td>
                <td>${c.numero_cuota ?? '—'}</td>
                <td><strong>${c.dias_atraso}</strong></td>
                <td class="td-monto">${formatCurrency(c.saldo_pendiente)}</td>
                <td>${c.cobranza_status ? `<span class="badge">${c.cobranza_status}</span>` : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `

  renderBarChart(document.getElementById('chart-mora'), barData, {
    color: '#ef4444',
    valueSuffix: ' cuotas'
  })

  return cuotas.map(c => ({
    Cliente: c.cliente_nombre,
    Telefono: c.cliente_telefono,
    Nivel_Riesgo: c.nivel_riesgo,
    Cuota: c.numero_cuota,
    Vencimiento: c.fecha_vencimiento,
    Dias_Atraso: c.dias_atraso,
    Segmento: c.segmento_mora,
    Saldo_Pendiente: c.saldo_pendiente,
    Cobranza_Status: c.cobranza_status ?? ''
  }))
}

function _classMora(dias) {
  if (dias > 90) return 'tr-critico'
  if (dias > 30) return 'tr-alto'
  if (dias > 7) return 'tr-medio'
  return ''
}

function _badgeRiesgo(nivel) {
  const cls = nivel === 'ALTO' ? 'badge-error' : nivel === 'MEDIO' ? 'badge-warning' : 'badge-success'
  return `<span class="badge ${cls}">${nivel ?? '—'}</span>`
}
