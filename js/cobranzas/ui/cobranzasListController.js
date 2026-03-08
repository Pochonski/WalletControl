/**
 * CobranzasListController - Gestión de lista de cobranzas
 *
 * Responsabilidades:
 * - Mostrar cuotas vencidas que requieren cobranza
 * - Filtrar y ordenar cobranzas por prioridad
 * - Acciones rápidas (marcar como contactado, etc.)
 * - Navegación a detalle de cobranza
 */

import { ACTION_TYPES } from '../../app/state/actions.js'
import { cobranzasDataAdapter } from '../../adapters/cobranzasDataAdapter.js'
import { showSuccess, showError } from '../../common/uiHelpers.js'
import { calculateTotalOwed, getCollectionPriority } from '../domain/cobranzaCalculations.js'
import { COLLECTION_STATUS } from '../domain/cobranzaValidation.js'

export const initCobranzasListController = (dom, store, appCtrl) => {
  const cobranzasSection = dom.cobranzas
  if (!cobranzasSection) {
    console.warn('[cobranzasListController] DOM cobranzas section not found')
    return
  }

  const listaCobranzas = cobranzasSection.lista
  const filtros = cobranzasSection.filtros
  const btnRefresh = cobranzasSection.btnRefresh
  const searchInput = cobranzasSection.searchInput
  const metricsContainer = document.getElementById('cobranzas-metrics')

  // ────────────────────────────────────────────────────────────────
  // 1. CARGAR cobranzas al iniciar
  // ────────────────────────────────────────────────────────────────

  const cargarCobranzas = async () => {
    store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
    try {
      const activeCollections = await cobranzasDataAdapter.loadActiveCollections()

      // Procesar datos para añadir cálculos de mora y prioridad
      const allCollections = processCollectionsData(activeCollections)

      store.dispatch({
        type: ACTION_TYPES.LOAD_COBRANZAS,
        payload: allCollections
      })
      
      renderMetrics()
    } catch (err) {
      console.error('[cobranzasListController] Error loading:', err)
      showError('Error al cargar cobranzas: ' + err.message)
    } finally {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 2. PROCESAR datos de cobranzas
  // ────────────────────────────────────────────────────────────────

  const processCollectionsData = (collections) => {
    return collections.map(item => {
      const calculations = calculateTotalOwed({
        due_date: item.due_date,
        amount: item.amount_due
      })

      return {
        ...item,
        total_owed: calculations.totalOwed,
        days_late: calculations.daysLate,
        scale: calculations.scale,
        priority: getCollectionPriority({
          amount_due: calculations.totalOwed,
          days_late: calculations.daysLate
        })
      }
    }).sort((a, b) => b.priority - a.priority)
  }

  // ────────────────────────────────────────────────────────────────
  // 3. FILTROS y búsqueda
  // ────────────────────────────────────────────────────────────────

  const aplicarFiltros = () => {
    if (!filtros) return

    const estadoFilter = filtros.querySelector('#filtro-estado')?.value
    const escalaFilter = filtros.querySelector('#filtro-escala')?.value
    const searchTerm = searchInput?.value?.toLowerCase() || ''

    const { cobranzas } = store.getState()
    let filtered = [...cobranzas.list]

    // Filtro por estado
    if (estadoFilter) {
      filtered = filtered.filter(c => c.status === estadoFilter)
    }

    // Filtro por escala
    if (escalaFilter) {
      filtered = filtered.filter(c => c.scale === escalaFilter)
    }

    // Búsqueda por nombre de cliente
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.client_name?.toLowerCase().includes(searchTerm) ||
        c.payment_id?.toString().includes(searchTerm)
      )
    }

    render(filtered)
  }

  // ────────────────────────────────────────────────────────────────
  // 4. ACCIONES rápidas
  // ────────────────────────────────────────────────────────────────

  const handleQuickAction = async (collectionId, action) => {
    try {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

      switch (action) {
        case 'contacted':
          await cobranzasDataAdapter.updateCollectionStatus(collectionId, COLLECTION_STATUS.CONTACTED)
          showSuccess('Marcado como contactado')
          break

        case 'resolved':
          await cobranzasDataAdapter.updateCollectionStatus(collectionId, COLLECTION_STATUS.RESOLVED)
          showSuccess('Cobranza resuelta')
          break

        case 'escalate':
          await cobranzasDataAdapter.updateCollectionStatus(collectionId, COLLECTION_STATUS.LEGAL)
          showSuccess('Escalado a legal')
          break
      }

      // Recargar datos
      await cargarCobranzas()
    } catch (err) {
      console.error('[cobranzasListController] Quick action error:', err)
      showError('Error en acción: ' + err.message)
    } finally {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 5. NAVEGACIÓN a detalle
  // ────────────────────────────────────────────────────────────────

  const verDetalleCobranza = (collectionId) => {
    // Guardar ID de cobranza en el store para que el controller de detalle lo use
    store.dispatch({
      type: ACTION_TYPES.SET_SELECTED_COBRANZA,
      payload: collectionId
    })
    appCtrl.showView('cobranza-detail')
  }

  // ────────────────────────────────────────────────────────────────
  // 6. RENDER de métricas
  // ────────────────────────────────────────────────────────────────

  const renderMetrics = async () => {
    if (!metricsContainer) return

    try {
      const metrics = await cobranzasDataAdapter.getCollectionMetrics()
      
      const totalOverdueFmt = new Intl.NumberFormat('es-DO', { 
        style: 'currency', 
        currency: 'DOP', 
        maximumFractionDigits: 0 
      }).format(metrics.totalOverdueAmount)

      metricsContainer.innerHTML = `
        <div class="metric-card">
          <div class="metric-icon" style="background: rgba(220, 38, 38, 0.1); color: var(--color-danger);">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-value">${metrics.overduePaymentsCount}</span>
            <span class="metric-label">Cuotas Vencidas</span>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon" style="background: rgba(16, 185, 129, 0.1); color: var(--color-success);">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-value">${totalOverdueFmt}</span>
            <span class="metric-label">Total en Mora</span>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon" style="background: rgba(29, 78, 216, 0.1); color: var(--color-primary);">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-value">${Math.round(metrics.effectivenessRate)}%</span>
            <span class="metric-label">Efectividad</span>
          </div>
        </div>
      `
    } catch (err) {
      console.error('[cobranzasListController] Error rendering metrics:', err)
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 7. RENDER de lista
  // ────────────────────────────────────────────────────────────────

  const render = (collectionsToRender = null) => {
    const { cobranzas } = store.getState()
    const collections = collectionsToRender || cobranzas.list

    if (!listaCobranzas) return

    listaCobranzas.innerHTML = ''

    if (collections.length === 0) {
      listaCobranzas.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💰</div>
          <p>No hay cobranzas pendientes</p>
          <small>Todas las cuotas están al día</small>
        </div>
      `
      return
    }

    const fragment = document.createDocumentFragment()

    collections.forEach(collection => {
      const card = document.createElement('div')
      card.className = 'card premium-card cobranza-card'
      card.dataset.id = collection.id || collection.payment_id

      const calculations = calculateTotalOwed({
        due_date: collection.due_date,
        amount: collection.amount_due
      })

      const scaleClass = getScaleClass(calculations.scale)
      const statusClass = getStatusClass(collection.status)
      
      const iniciales = (collection.client_name || '??')
        .split(' ')
        .filter(n => n)
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)

      const montoFmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(calculations.totalOwed)
      const moraFmt = calculations.lateAmount > 0 
        ? `<span class="mora-tag">+ ${new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(calculations.lateAmount - calculations.originalAmount)} mora</span>`
        : ''

      card.innerHTML = `
        <div class="card-header-main">
          <div class="card-avatar-wrapper">
             <div class="card-avatar ${scaleClass}">${iniciales}</div>
             <div class="status-indicator ${statusClass}"></div>
          </div>
          <div class="card-title-group">
            <div class="card-main-title">${collection.client_name || 'Cliente desconocido'}</div>
            <div class="card-meta-line">
              <span class="badge ${statusClass}">${getStatusText(collection.status)}</span>
              <span class="badge ${scaleClass}">${calculations.scale?.toUpperCase()}</span>
            </div>
          </div>
          <div class="card-price-primary">
            ${montoFmt}
            ${moraFmt}
          </div>
        </div>
        
        <div class="card-content-grid">
           <div class="content-item">
             <span class="item-label">Cuota</span>
             <span class="item-value">#${collection.payment_id.substring(0, 8)}</span>
           </div>
           <div class="content-item">
             <span class="item-label">Vencimiento</span>
             <span class="item-value">${new Date(collection.due_date).toLocaleDateString()}</span>
           </div>
           <div class="content-item">
             <span class="item-label">Atraso</span>
             <span class="item-value text-danger">${calculations.daysLate} días</span>
           </div>
        </div>

        <div class="card-actions-row">
          <button class="btn-card-action btn-contacted" title="Marcar como contactado">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Contactar
          </button>
          <button class="btn-card-action btn-resolved text-success" title="Cobranza resuelta">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Resolver
          </button>
          <button class="btn-card-action btn-detail">
            Ver detalle
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      `

      // Event listeners
      card.querySelector('.btn-contacted')?.addEventListener('click', (e) => {
        e.stopPropagation()
        handleQuickAction(collection.id || collection.payment_id, 'contacted')
      })

      card.querySelector('.btn-resolved')?.addEventListener('click', (e) => {
        e.stopPropagation()
        handleQuickAction(collection.id || collection.payment_id, 'resolved')
      })

      card.addEventListener('click', () => {
        verDetalleCobranza(collection.id || collection.payment_id)
      })

      fragment.appendChild(card)
    })

    listaCobranzas.appendChild(fragment)
  }

  // ────────────────────────────────────────────────────────────────
  // 7. EVENT LISTENERS
  // ────────────────────────────────────────────────────────────────

  if (btnRefresh) {
    btnRefresh.addEventListener('click', cargarCobranzas)
  }

  if (searchInput) {
    searchInput.addEventListener('input', aplicarFiltros)
  }

  if (filtros) {
    const filtroElements = filtros.querySelectorAll('select, input')
    filtroElements.forEach(element => {
      element.addEventListener('change', aplicarFiltros)
    })
  }

  // ────────────────────────────────────────────────────────────────
  // 8. SUSCRIBIR a cambios del estado
  // ────────────────────────────────────────────────────────────────

  store.subscribe((newState, previousState) => {
    if (newState.cobranzas !== previousState.cobranzas) {
      render()
      renderMetrics()
    }
  })

  // ────────────────────────────────────────────────────────────────
  // 9. INICIALIZACIÓN
  // ────────────────────────────────────────────────────────────────

  cargarCobranzas()
}

// ──────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────────────────────────

/**
 * Get CSS class for collection scale
 */
function getScaleClass(scale) {
  switch (scale) {
    case 'critical': return 'badge--danger'
    case 'high': return 'badge--danger'
    case 'medium': return 'badge--warning'
    case 'low': return 'badge--info'
    case 'current': return 'badge--success'
    default: return 'badge--secondary'
  }
}

/**
 * Get CSS class for collection status
 */
function getStatusClass(status) {
  switch (status) {
    case COLLECTION_STATUS.RESOLVED: return 'badge--success'
    case COLLECTION_STATUS.IN_PROGRESS: return 'badge--warning'
    case COLLECTION_STATUS.LEGAL: return 'badge--danger'
    case COLLECTION_STATUS.CANCELLED: return 'badge--secondary'
    default: return 'badge--info'
  }
}

/**
 * Get human-readable status text
 */
function getStatusText(status) {
  const statusTexts = {
    [COLLECTION_STATUS.PENDING]: 'Pendiente',
    'pendiente': 'Pendiente',
    'vencida': 'Vencida',
    [COLLECTION_STATUS.IN_PROGRESS]: 'En proceso',
    [COLLECTION_STATUS.CONTACTED]: 'Contactado',
    [COLLECTION_STATUS.NEGOTIATED]: 'Negociado',
    [COLLECTION_STATUS.RESOLVED]: 'Resuelto',
    [COLLECTION_STATUS.CANCELLED]: 'Cancelado',
    [COLLECTION_STATUS.LEGAL]: 'Legal',
    'current': 'Al día'
  }
  return statusTexts[status] || 'Desconocido'
}
