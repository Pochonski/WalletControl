/**
 * CobranzaDetailController - Gestión de detalle de cobranza individual
 *
 * Responsabilidades:
 * - Mostrar información detallada de una cobranza específica
 * - Gestionar acciones de cobranza (llamadas, emails, visitas)
 * - Agregar notas y actualizar estado
 * - Crear y gestionar planes de pago
 * - Historial completo de acciones
 */

import { ACTION_TYPES } from '../../app/state/actions.js'
import { cobranzasDataAdapter } from '../../adapters/cobranzasDataAdapter.js'
import { showSuccess, showError } from '../../common/uiHelpers.js'
import { calculateTotalOwed, generateReminderMessage } from '../domain/cobranzaCalculations.js'
import { COLLECTION_STATUS, COLLECTION_ACTION_TYPES, validateCollectionAction } from '../domain/cobranzaValidation.js'

export const initCobranzaDetailController = (dom, store, appCtrl) => {
  const detailSection = dom['cobranza-detail']
  if (!detailSection) {
    console.warn('[cobranzaDetailController] DOM cobranza-detail section not found')
    return
  }

  const infoPanel = detailSection.info
  const actionsList = detailSection.actions
  const actionForm = detailSection.actionForm
  const paymentPlanSection = detailSection.paymentPlan
  const btnBack = detailSection.btnBack

  let currentCollectionId = null
  let currentCollection = null

  // ────────────────────────────────────────────────────────────────
  // 1. CARGAR detalle de cobranza
  // ────────────────────────────────────────────────────────────────

  const cargarDetalleCobranza = async (cuotaId) => {
    if (!cuotaId) {
      showError('ID de cuota no válido')
      appCtrl.showView('cobranzas')
      return
    }

    currentCollectionId = cuotaId
    store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

    try {
      const { cobranzas } = store.getState()
      currentCollection = cobranzas.list.find(c => c.id === cuotaId || c.payment_id === cuotaId)

      if (!currentCollection) {
        throw new Error('Cuota no encontrada en la lista activa')
      }

      // Cargar pagos relacionados como "acciones"
      const actions = await cobranzasDataAdapter.loadCollectionActions(currentCollectionId)

      store.dispatch({
        type: ACTION_TYPES.LOAD_COBRANZA_DETAIL,
        payload: {
          collection: currentCollection,
          actions: actions
        }
      })

      renderDetalle()
      renderActions(actions)
    } catch (err) {
      console.error('[cobranzaDetailController] Error loading detail:', err)
      showError('Error al cargar detalle: ' + err.message)
      appCtrl.showView('cobranzas')
    } finally {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 2. AGREGAR acción de cobranza
  // ────────────────────────────────────────────────────────────────

  const agregarAccion = async (actionData) => {
    try {
      const validation = validateCollectionAction({
        ...actionData,
        collection_id: currentCollectionId
      })

      if (!validation.isValid) {
        showError('Datos inválidos: ' + validation.errors.join(', '))
        return
      }

      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

      const newAction = await cobranzasDataAdapter.addCollectionAction({
        ...actionData,
        collection_id: currentCollectionId
      })

      // Recargar acciones
      const actions = await cobranzasDataAdapter.loadCollectionActions(currentCollectionId)
      store.dispatch({
        type: ACTION_TYPES.UPDATE_COBRANZA_ACTIONS,
        payload: actions
      })

      renderActions(actions)
      showSuccess('Acción registrada exitosamente')

      // Limpiar formulario
      if (actionForm) {
        actionForm.reset()
      }
    } catch (err) {
      console.error('[cobranzaDetailController] Error adding action:', err)
      showError('Error al agregar acción: ' + err.message)
    } finally {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 3. ACTUALIZAR estado de cobranza
  // ────────────────────────────────────────────────────────────────

  const actualizarEstado = async (newStatus) => {
    try {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

      await cobranzasDataAdapter.updateCollectionStatus(currentCollectionId, newStatus)

      // Invalida la lista para forzar recarga al volver (simplificado)
      store.dispatch({ type: ACTION_TYPES.LOAD_COBRANZAS, payload: [] })
      
      showSuccess(`Estado actualizado a: ${newStatus}`)
      appCtrl.showView('cobranzas')
    } catch (err) {
      console.error('[cobranzaDetailController] Error updating status:', err)
      showError('Error al actualizar estado: ' + err.message)
    } finally {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 4. CREAR plan de pago
  // ────────────────────────────────────────────────────────────────

  const crearPlanPago = async (planData) => {
    try {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

      const paymentPlan = await cobranzasDataAdapter.createPaymentPlan({
        ...planData,
        collection_id: currentCollectionId
      })

      // Actualizar estado a negotiated
      await actualizarEstado(COLLECTION_STATUS.NEGOTIATED, `Plan de pago creado: ${paymentPlan.installments.length} cuotas`)

      showSuccess('Plan de pago creado exitosamente')
      renderPaymentPlan(paymentPlan)
    } catch (err) {
      console.error('[cobranzaDetailController] Error creating payment plan:', err)
      showError('Error al crear plan de pago: ' + err.message)
    } finally {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 5. RENDER detalle de cobranza
  // ────────────────────────────────────────────────────────────────

  const renderDetalle = () => {
    if (!infoPanel || !currentCollection) return

    const calculations = calculateTotalOwed({
      due_date: currentCollection.due_date,
      amount: currentCollection.amount_due || currentCollection.total_owed
    })

    const reminderMessage = generateReminderMessage({
      due_date: currentCollection.due_date,
      amount: currentCollection.amount_due || currentCollection.total_owed
    })

    const statusText = getStatusText(currentCollection.status)
    const statusClass = getStatusClass(currentCollection.status)
    const scaleClass = getScaleClass(calculations.scale)

    infoPanel.innerHTML = `
      <div class="detail-header">
        <button id="btn-back-detail" class="btn-back-circle" title="Volver">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div class="header-info">
          <h1 class="detail-name">Detalle de Cobranza</h1>
          <div class="header-meta">
            <span class="badge ${statusClass}">${statusText}</span>
            <span class="badge ${scaleClass}">${calculations.scale?.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div class="detail-profile">
        <div class="avatar-large ${scaleClass}">
          ${(currentCollection.client_name || '??').charAt(0)}
        </div>
        <h2 class="detail-name">${currentCollection.client_name || 'Cliente sin nombre'}</h2>
        <span class="detail-label">${currentCollection.client_phone || 'Sin teléfono'}</span>
      </div>

      <div class="detail-grid">
        <div class="metric-card">
          <div class="metric-icon" style="background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-label">Monto Cuota</span>
            <span class="metric-value">$${(currentCollection.amount_due || 0).toLocaleString()}</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon" style="background: rgba(var(--color-danger-rgb), 0.1); color: var(--color-danger);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-label">Mora Acumulada</span>
            <span class="metric-value">+$${(calculations.totalOwed - calculations.originalAmount).toLocaleString()}</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon" style="background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-label">Atraso</span>
            <span class="metric-value">${calculations.daysLate} días</span>
          </div>
        </div>

        <div class="metric-card highlight-success">
          <div class="metric-icon" style="background: rgba(var(--color-success-rgb), 0.1); color: var(--color-success);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-label">Total a Cobrar</span>
            <span class="metric-value">$${calculations.totalOwed.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div class="detail-section-title">Acciones de Seguimiento</div>
      <div class="quick-actions-bar">
        <button class="btn-pill btn-contacted" id="btn-status-contacted">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          Contactado
        </button>
        <button class="btn-pill btn-negotiated" id="btn-status-negotiated">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Negociar
        </button>
        <button class="btn-pill btn-success" id="btn-status-resolved">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Resuelto
        </button>
        <button class="btn-pill btn-danger" id="btn-status-legal">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Legal
        </button>
      </div>

      <div class="reminder-card-container">
        <div class="reminder-header">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
           <h4>Sugerencia de Recordatorio</h4>
        </div>
        <p id="reminder-text">${reminderMessage}</p>
        <button class="btn btn-secondary btn-sm" id="btn-copy-message">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copiar mensaje
        </button>
      </div>
    `

    // Event listeners
    infoPanel.querySelector('#btn-back-detail')?.addEventListener('click', () => appCtrl.showView('cobranzas'))
    infoPanel.querySelector('#btn-status-contacted')?.addEventListener('click', () => actualizarEstado(COLLECTION_STATUS.CONTACTED))
    infoPanel.querySelector('#btn-status-resolved')?.addEventListener('click', () => actualizarEstado(COLLECTION_STATUS.RESOLVED))
    infoPanel.querySelector('#btn-status-negotiated')?.addEventListener('click', () => actualizarEstado(COLLECTION_STATUS.NEGOTIATED))
    infoPanel.querySelector('#btn-status-legal')?.addEventListener('click', () => {
      if (confirm('¿Escalar esta cobranza a proceso legal?')) {
        actualizarEstado(COLLECTION_STATUS.LEGAL)
      }
    })

    infoPanel.querySelector('#btn-copy-message')?.addEventListener('click', () => {
      navigator.clipboard.writeText(reminderMessage).then(() => {
        showSuccess('Mensaje copiado al portapapeles')
      }).catch(() => {
        showError('Error al copiar mensaje')
      })
    })
  }

  // ────────────────────────────────────────────────────────────────
  // 6. RENDER lista de acciones
  // ────────────────────────────────────────────────────────────────

  const renderActions = (actions) => {
    if (!actionsList) return

    actionsList.innerHTML = ''

    if (actions.length === 0) {
      actionsList.innerHTML = `
        <div class="empty-state-small">
          <p>No hay acciones registradas</p>
          <small>Use el formulario para agregar el seguimiento</small>
        </div>
      `
      return
    }

    const fragment = document.createDocumentFragment()

    actions.forEach(action => {
      const actionItem = document.createElement('div')
      const isPayment = action.action_type === 'payment_attempt'
      actionItem.className = `timeline-card ${isPayment ? 'is-payment' : ''}`

      const actionIcon = getActionIcon(action.action_type)

      actionItem.innerHTML = `
        <div class="timeline-content">
          <div class="timeline-header-premium">
            <div class="action-meta">
              <div class="action-icon-wrapper">
                ${actionIcon}
              </div>
              <strong>${getActionTypeText(action.action_type)}</strong>
            </div>
            <span class="timeline-date">${new Date(action.action_date).toLocaleDateString()}</span>
          </div>
          <p class="timeline-desc">${action.description}</p>
          ${action.contact_result ? `
            <div class="timeline-detail-box">
              <strong>Detalle:</strong> ${action.contact_result}
            </div>` : ''}
        </div>
      `

      fragment.appendChild(actionItem)
    })

    actionsList.appendChild(fragment)
  }

  function getActionIcon(type) {
    switch(type) {
      case COLLECTION_ACTION_TYPES.PHONE_CALL: return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'
      case COLLECTION_ACTION_TYPES.EMAIL: return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>'
      case COLLECTION_ACTION_TYPES.VISIT: return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
      default: return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 7. RENDER sección de plan de pago
  // ────────────────────────────────────────────────────────────────

  const renderPaymentPlan = (paymentPlan) => {
    if (!paymentPlanSection) return

    // TODO: Implementar render de plan de pago
    paymentPlanSection.innerHTML = `
      <div class="payment-plan-info">
        <h4>Plan de Pago Activo</h4>
        <p>Funcionalidad de planes de pago próximamente disponible</p>
      </div>
    `
  }

  // ────────────────────────────────────────────────────────────────
  // 8. EVENT LISTENERS
  // ────────────────────────────────────────────────────────────────

  if (btnBack) {
    btnBack.addEventListener('click', () => {
      appCtrl.showView('cobranzas')
    })
  }

  if (actionForm) {
    actionForm.addEventListener('submit', (e) => {
      e.preventDefault()
      const formData = new FormData(actionForm)
      const actionData = Object.fromEntries(formData)
      agregarAccion(actionData)
    })
  }

  // ────────────────────────────────────────────────────────────────
  // 9. SUSCRIBIR a cambios del estado
  // ────────────────────────────────────────────────────────────────

  store.subscribe((newState, previousState) => {
    // Si cambió la cobranza seleccionada, recargar
    if (newState.cobranzas?.selectedId !== previousState.cobranzas?.selectedId) {
      const selectedId = newState.cobranzas?.selectedId
      if (selectedId && selectedId !== currentCollectionId) {
        cargarDetalleCobranza(selectedId)
      }
    }
  })

  // ────────────────────────────────────────────────────────────────
  // 10. INICIALIZACIÓN
  // ────────────────────────────────────────────────────────────────

  // Cargar cobranza seleccionada desde el store
  const { cobranzas } = store.getState()
  if (cobranzas?.selectedId) {
    cargarDetalleCobranza(cobranzas.selectedId)
  }
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

/**
 * Get human-readable action type text
 */
function getActionTypeText(actionType) {
  const actionTexts = {
    'payment_attempt': 'Intento de pago',
    'phone_call': 'Llamada telefónica',
    'email': 'Correo electrónico',
    'sms': 'Mensaje SMS',
    'visit': 'Visita'
  }
  return actionTexts[actionType] || actionType
}
