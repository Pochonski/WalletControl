/**
 * reportesController.js - Selector y navegación del módulo de Reportes.
 *
 * Renderiza la cuadrícula de cards de reportes disponibles.
 * Al seleccionar uno, carga y renderiza el sub-módulo correspondiente.
 */

import { getEl } from '../../app/ui/domAdapter.js'
import { DOM_IDS } from '../../app/ui/domIds.js'
import { renderCarteraReport } from './carteraReport.js'
import { renderCobrosReport } from './cobrosReport.js'
import { renderMorosidadReport } from './morosidadReport.js'
import { renderActivosReport } from './activosReport.js'
import { renderRentabilidadReport } from './rentabilidadReport.js'
import { exportarCSV } from './reporteExport.js'

// Catálogo de reportes disponibles
const REPORTES = [
  {
    id: 'cartera',
    titulo: 'Cartera Activa',
    descripcion: 'Total prestado, cobrado, saldo pendiente y en mora',
    icono: '📊',
    render: renderCarteraReport
  },
  {
    id: 'cobros',
    titulo: 'Cobros del Período',
    descripcion: 'Pagos recibidos por fecha y método de pago',
    icono: '💵',
    render: renderCobrosReport
  },
  {
    id: 'morosidad',
    titulo: 'Morosidad',
    descripcion: 'Cuotas vencidas, días de atraso y monto en riesgo',
    icono: '⚠️',
    render: renderMorosidadReport
  },
  {
    id: 'activos',
    titulo: 'Activos',
    descripcion: 'Inventario, ventas, ganancia y margen por categoría',
    icono: '🏷️',
    render: renderActivosReport
  },
  {
    id: 'rentabilidad',
    titulo: 'Rentabilidad Global',
    descripcion: 'Interés + activos combinados por mes',
    icono: '📈',
    render: renderRentabilidadReport
  }
]

// Estado local del módulo
let _reporteActivo = null
let _datosActivos = null

export const initReportesController = (store, appCtrl) => {
  const selector = getEl(DOM_IDS.REPORTES_SELECTOR)
  const viewer   = getEl(DOM_IDS.REPORTES_VIEWER)

  if (!selector) {
    console.warn('[reportesController] DOM selector not found')
    return
  }

  // ──────────────────────────────────────────────────────────────
  // Renderizar selector (cards)
  // ──────────────────────────────────────────────────────────────

  const renderSelector = () => {
    selector.classList.remove('hidden')
    if (viewer) viewer.classList.add('hidden')
    _reporteActivo = null

    selector.innerHTML = `
      <div class="view-toolbar">
        <span class="toolbar-title">Reportes</span>
      </div>
      <div class="reportes-grid">
        ${REPORTES.map(r => `
          <button class="reporte-card" data-id="${r.id}" type="button">
            <div class="reporte-card-icon">${r.icono}</div>
            <span class="reporte-card-titulo">${r.titulo}</span>
            <span class="reporte-card-desc">${r.descripcion}</span>
          </button>
        `).join('')}
      </div>
    `

    selector.querySelectorAll('.reporte-card').forEach(card => {
      card.addEventListener('click', () => {
        const reporte = REPORTES.find(r => r.id === card.dataset.id)
        if (reporte) _abrirReporte(reporte)
      })
    })
  }

  // ──────────────────────────────────────────────────────────────
  // Abrir un reporte específico
  // ──────────────────────────────────────────────────────────────

  const _abrirReporte = async (reporte) => {
    _reporteActivo = reporte
    selector.classList.add('hidden')

    if (!viewer) return

    viewer.classList.remove('hidden')
    viewer.innerHTML = `
      <div class="reporte-header">
        <button class="btn btn-ghost btn-sm" id="btn-reporte-volver" type="button">← Volver</button>
        <span class="reporte-titulo">${reporte.icono} ${reporte.titulo}</span>
        <button class="btn btn-secondary btn-sm" id="btn-exportar-csv" type="button">↓ CSV</button>
      </div>
      <div id="reporte-content" class="reporte-content">
        <div class="loading-state">Cargando datos…</div>
      </div>
    `

    document.getElementById('btn-reporte-volver')?.addEventListener('click', renderSelector)

    document.getElementById('btn-exportar-csv')?.addEventListener('click', () => {
      if (_datosActivos?.length) exportarCSV(_datosActivos, reporte.id)
    })

    try {
      const contentEl = document.getElementById('reporte-content')
      _datosActivos = await reporte.render(contentEl)
    } catch (err) {
      console.error('[reportesController] Error rendering report:', err)
      const contentEl = document.getElementById('reporte-content')
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="error-state">
            <p>Error al cargar el reporte: ${err.message}</p>
            <button class="btn btn-secondary btn-sm" id="btn-retry">Reintentar</button>
          </div>
        `
        document.getElementById('btn-retry')?.addEventListener('click', () => _abrirReporte(reporte))
      }
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Inicializar al navegar a view-reportes
  // ──────────────────────────────────────────────────────────────

  // Detectar cuando se navega a reportes y mostrar el selector
  store.subscribe((newState, prevState) => {
    if (
      newState.ui?.currentView === 'reportes' &&
      prevState?.ui?.currentView !== 'reportes'
    ) {
      renderSelector()
    }
  })

  // Renderizar si ya estamos en reportes al iniciar
  if (store.getState().ui?.currentView === 'reportes') {
    renderSelector()
  }
}
