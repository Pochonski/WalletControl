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

    // Agrupar categorías (Top 1)
    const catCount = {}
    let topCat = 'N/A'
    let maxCatItems = 0
    activosActivos.forEach(a => {
      catCount[a.categoria] = (catCount[a.categoria] || 0) + 1
      if (catCount[a.categoria] > maxCatItems) {
        maxCatItems = catCount[a.categoria]
        topCat = a.categoria
      }
    })

    metricsContainer.innerHTML = `
      <div class="metric-card">
        <span class="metric-label">En Inventario</span>
        <span class="metric-value">${totalCantidad}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Valor de Costo Total</span>
        <span class="metric-value">$${totalValorCosto.toFixed(2)}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">Categoría Principal</span>
        <span class="metric-value">${topCat.replace('_', ' ')}</span>
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
