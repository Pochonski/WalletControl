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

  // ────────────────────────────────────────────────────────────────
  // 1. CARGAR cobranzas al iniciar
  // ────────────────────────────────────────────────────────────────

  const cargarCobranzas = async () => {
    store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
    try {
      const [overduePayments, activeCollections] = await Promise.all([
        cobranzasDataAdapter.loadOverduePayments(),
        cobranzasDataAdapter.loadActiveCollections()
      ])

      // Combinar y procesar datos
      const allCollections = processCollectionsData(overduePayments, activeCollections)

      store.dispatch({
        type: ACTION_TYPES.LOAD_COBRANZAS,
        payload: allCollections
      })
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

  const processCollectionsData = (overduePayments, activeCollections) => {
    // Crear mapa de collections activas por payment_id
    const activeMap = new Map()
    activeCollections.forEach(collection => {
      activeMap.set(collection.payment_id, collection)
    })

    // Procesar overdue payments
    const processedCollections = overduePayments.map(payment => {
      const existingCollection = activeMap.get(payment.payment_id)
      const calculations = calculateTotalOwed({
        due_date: payment.due_date,
        amount: payment.amount_due
      })

      return {
        ...payment,
        ...existingCollection,
        // Sobreescribir con cálculos actualizados
        total_owed: calculations.totalOwed,
        days_late: calculations.daysLate,
        scale: calculations.scale,
        priority: getCollectionPriority({
          amount_due: calculations.totalOwed,
          days_late: calculations.daysLate
        }),
        status: existingCollection?.status || COLLECTION_STATUS.PENDING
      }
    })

    // Ordenar por prioridad (más urgente primero)
    return processedCollections.sort((a, b) => b.priority - a.priority)
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
  // 6. RENDER de lista
  // ────────────────────────────────────────────────────────────────

  const render = (collectionsToRender = null) => {
    const { cobranzas } = store.getState()
    const collections = collectionsToRender || cobranzas.list

    if (!listaCobranzas) return

    listaCobranzas.innerHTML = ''

    if (collections.length === 0) {
      listaCobranzas.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--color-text-light);">
          <div style="font-size: 3rem; margin-bottom: 10px; opacity: 0.3;">💰</div>
          <p>No hay cobranzas pendientes</p>
          <small>Todas las cuotas están al día</small>
        </div>
      `
      return
    }

    const fragment = document.createDocumentFragment()

    collections.forEach(collection => {
      const card = document.createElement('div')
      card.className = 'card cobranza-card'
      card.dataset.id = collection.id || collection.payment_id

      // Clases CSS según escala y estado
      const scaleClass = getScaleClass(collection.scale)
      const statusClass = getStatusClass(collection.status)

      // Iniciales del cliente
      const iniciales = (collection.client_name || '??')
        .split(' ')
        .filter(n => n)
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)

      card.innerHTML = `
        <div class="card-avatar">${iniciales}</div>
        <div class="card-body">
          <div class="card-title">${collection.client_name || 'Cliente desconocido'}</div>
          <div class="card-subtitle">Cuota #${collection.payment_id}</div>
          <div class="card-meta">
            <span class="badge ${scaleClass}">${collection.scale?.toUpperCase() || 'PENDING'}</span>
            <span class="badge ${statusClass}">${getStatusText(collection.status)}</span>
          </div>
          <div class="cobranza-amount">
            <strong>$${collection.total_owed?.toLocaleString() || collection.amount_due?.toLocaleString()}</strong>
            <small>${collection.days_late} días atraso</small>
          </div>
        </div>
        <div class="card-right">
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            <button class="btn-icon btn-contacted" title="Marcar como contactado">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </button>
            <button class="btn-icon btn-resolved" title="Marcar como resuelta" style="color: var(--color-success);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
            <button class="btn-icon btn-escalate" title="Escalar a legal" style="color: var(--color-danger);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </button>
          </div>
        </div>
      `

      // Event listeners para acciones rápidas
      card.querySelector('.btn-contacted')?.addEventListener('click', (e) => {
        e.stopPropagation()
        handleQuickAction(collection.id || collection.payment_id, 'contacted')
      })

      card.querySelector('.btn-resolved')?.addEventListener('click', (e) => {
        e.stopPropagation()
        handleQuickAction(collection.id || collection.payment_id, 'resolved')
      })

      card.querySelector('.btn-escalate')?.addEventListener('click', (e) => {
        e.stopPropagation()
        if (confirm('¿Escalar esta cobranza a proceso legal?')) {
          handleQuickAction(collection.id || collection.payment_id, 'escalate')
        }
      })

      // Click en card para ver detalle
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
    [COLLECTION_STATUS.IN_PROGRESS]: 'En proceso',
    [COLLECTION_STATUS.CONTACTED]: 'Contactado',
    [COLLECTION_STATUS.NEGOTIATED]: 'Negociado',
    [COLLECTION_STATUS.RESOLVED]: 'Resuelto',
    [COLLECTION_STATUS.CANCELLED]: 'Cancelado',
    [COLLECTION_STATUS.LEGAL]: 'Legal'
  }
  return statusTexts[status] || 'Desconocido'
}
