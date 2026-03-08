import { DOM_IDS } from '../../app/ui/domIds.js'
import { getEl } from '../../app/ui/domAdapter.js'
import { bindEventEl } from '../../app/ui/domEvents.js'

export const initActivosSearchAndMetricsController = (store) => {
  const searchInput = getEl(DOM_IDS.ACTIVOS_SEARCH)
  const filterBar = getEl(DOM_IDS.ACTIVOS_FILTER_BAR)
  const metricsContainer = getEl(DOM_IDS.ACTIVOS_METRICS)

  // -- BUSCADOR --
  if (searchInput) {
    bindEventEl(searchInput, 'input', (e) => {
      const termino = e.target.value.toLowerCase().trim()
      const cards = document.querySelectorAll('#' + DOM_IDS.ACTIVOS_LIST + ' .activo-card')
      
      cards.forEach(card => {
        const textCentral = card.innerText.toLowerCase()
        if (textCentral.includes(termino)) {
          card.style.display = 'block'
        } else {
          card.style.display = 'none'
        }
      })
    })
  }

  // Opcional: Filtros (ej. por categoria) podrían poblar el filterBar.
  // Podríamos escuchar store changes e inyectar botones: [Todas] [Inmuebles] [Vehículos]

  // -- METRICAS --
  const renderMetrics = () => {
    if (!metricsContainer) return

    const state = store.getState()
    const activosActivos = state.activos.list.filter(a => a.estado !== 'DESCARTADO' && a.estado !== 'VENDIDO')
    
    // Contar total
    const totalCantidad = activosActivos.length
    
    // Sumar capital
    const totalValorCosto = activosActivos.reduce((acc, curr) => acc + (Number(curr.costo_compra) * (curr.cantidad || 1)), 0)
    const costoFmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(totalValorCosto)

    metricsContainer.innerHTML = `
      <div class="metric-card">
        <div class="metric-icon" style="background: rgba(29, 78, 216, 0.1); color: var(--color-primary);">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-9l-3-3h-5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-9c0-1.1-.9-2-2-2z"/></svg>
        </div>
        <div class="metric-info">
          <span class="metric-value">${totalCantidad}</span>
          <span class="metric-label">Activos</span>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-icon" style="background: rgba(16, 185, 129, 0.1); color: var(--color-success);">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="metric-info">
          <span class="metric-value">${costoFmt}</span>
          <span class="metric-label">Inversión Total</span>
        </div>
      </div>
    `
  }

  // Escuchar a Redux para actualizar las métricas en tiempo real
  store.subscribe(() => {
    // Renderear solo si estamos en la vista de activos (optimización)
    const { currentView } = store.getState().ui
    if (currentView === 'activos' || currentView === 'activo-detail') {
      renderMetrics()
    }
  })

  // Render inicial
  renderMetrics()
}
