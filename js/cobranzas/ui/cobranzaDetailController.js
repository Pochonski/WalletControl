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

  const cargarDetalleCobranza = async (collectionId) => {
    if (!collectionId) {
      showError('ID de cobranza no válido')
      appCtrl.showView('cobranzas')
      return
    }

    currentCollectionId = collectionId
    store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

    try {
      // Intentar cargar desde collections activas primero
      const { cobranzas } = store.getState()
      currentCollection = cobranzas.list.find(c => c.id === collectionId || c.payment_id === collectionId)

      // Si no está en el store, intentar crear una nueva cobranza para este payment
      if (!currentCollection) {
        // Buscar el payment vencido correspondiente
        const overduePayments = await cobranzasDataAdapter.loadOverduePayments()
        const overduePayment = overduePayments.find(p => p.payment_id === collectionId)

        if (overduePayment) {
          // Crear nueva cobranza
          currentCollection = await cobranzasDataAdapter.createCollection({
            payment_id: overduePayment.payment_id,
            prestamo_id: overduePayment.prestamo_id,
            client_id: overduePayment.client_id,
            amount_due: overduePayment.amount_due,
            due_date: overduePayment.due_date
          })
        } else {
          throw new Error('Cobranza no encontrada')
        }
      }

      // Cargar acciones de la cobranza
      const actions = await cobranzasDataAdapter.loadCollectionActions(currentCollectionId)

      // Actualizar store
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

  const actualizarEstado = async (newStatus, notes = '') => {
    try {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

      await cobranzasDataAdapter.updateCollectionStatus(currentCollectionId, newStatus, notes)

      // Actualizar en store
      const updatedCollection = { ...currentCollection, status: newStatus }
      store.dispatch({
        type: ACTION_TYPES.UPDATE_COBRANZA_DETAIL,
        payload: updatedCollection
      })

      currentCollection = updatedCollection
      renderDetalle()
      showSuccess(`Estado actualizado a: ${getStatusText(newStatus)}`)
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

    infoPanel.innerHTML = `
      <div class="cobranza-header">
        <h3>Cobranza #${currentCollection.id || currentCollection.payment_id}</h3>
        <div class="status-badges">
          <span class="badge ${getScaleClass(calculations.scale)}">${calculations.scale?.toUpperCase()}</span>
          <span class="badge ${getStatusClass(currentCollection.status)}">${getStatusText(currentCollection.status)}</span>
        </div>
      </div>

      <div class="cobranza-info-grid">
        <div class="info-section">
          <h4>Información del Cliente</h4>
          <div class="info-item">
            <strong>Nombre:</strong> ${currentCollection.client_name || 'No disponible'}
          </div>
          <div class="info-item">
            <strong>Teléfono:</strong> ${currentCollection.client_phone || 'No disponible'}
          </div>
          <div class="info-item">
            <strong>Email:</strong> ${currentCollection.client_email || 'No disponible'}
          </div>
        </div>

        <div class="info-section">
          <h4>Información del Pago</h4>
          <div class="info-item">
            <strong>Monto original:</strong> $${(currentCollection.amount_due || 0).toLocaleString()}
          </div>
          <div class="info-item">
            <strong>Monto total adeudado:</strong> $${calculations.totalOwed.toLocaleString()}
          </div>
          <div class="info-item">
            <strong>Días de atraso:</strong> ${calculations.daysLate}
          </div>
          <div class="info-item">
            <strong>Fecha vencimiento:</strong> ${new Date(currentCollection.due_date).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div class="cobranza-actions">
        <h4>Acciones Rápidas</h4>
        <div class="action-buttons">
          <button class="btn btn-secondary" id="btn-status-contacted">
            Marcar como Contactado
          </button>
          <button class="btn btn-success" id="btn-status-resolved">
            Marcar como Resuelta
          </button>
          <button class="btn btn-warning" id="btn-status-negotiated">
            En Negociación
          </button>
          <button class="btn btn-danger" id="btn-status-legal">
            Escalar a Legal
          </button>
        </div>
      </div>

      <div class="reminder-message">
        <h4>Mensaje de Recordatorio</h4>
        <p>${reminderMessage}</p>
        <button class="btn btn-primary" id="btn-copy-message">
          Copiar Mensaje
        </button>
      </div>
    `

    // Event listeners para botones de acción
    const btnContacted = infoPanel.querySelector('#btn-status-contacted')
    const btnResolved = infoPanel.querySelector('#btn-status-resolved')
    const btnNegotiated = infoPanel.querySelector('#btn-status-negotiated')
    const btnLegal = infoPanel.querySelector('#btn-status-legal')
    const btnCopyMessage = infoPanel.querySelector('#btn-copy-message')

    btnContacted?.addEventListener('click', () => actualizarEstado(COLLECTION_STATUS.CONTACTED))
    btnResolved?.addEventListener('click', () => actualizarEstado(COLLECTION_STATUS.RESOLVED))
    btnNegotiated?.addEventListener('click', () => actualizarEstado(COLLECTION_STATUS.NEGOTIATED))
    btnLegal?.addEventListener('click', () => {
      if (confirm('¿Está seguro de escalar esta cobranza a proceso legal?')) {
        actualizarEstado(COLLECTION_STATUS.LEGAL)
      }
    })

    btnCopyMessage?.addEventListener('click', () => {
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
        <div style="text-align: center; padding: 20px; color: var(--color-text-light);">
          <p>No hay acciones registradas</p>
          <small>Use el formulario abajo para agregar la primera acción</small>
        </div>
      `
      return
    }

    const fragment = document.createDocumentFragment()

    actions.forEach(action => {
      const actionItem = document.createElement('div')
      actionItem.className = 'action-item'

      actionItem.innerHTML = `
        <div class="action-header">
          <div class="action-type">
            <strong>${getActionTypeText(action.action_type)}</strong>
            <small>${new Date(action.action_date).toLocaleDateString()}</small>
          </div>
          <div class="action-time">
            ${new Date(action.created_at).toLocaleTimeString()}
          </div>
        </div>
        <div class="action-description">
          ${action.description}
        </div>
        ${action.contact_result ? `<div class="action-result"><strong>Resultado:</strong> ${action.contact_result}</div>` : ''}
        ${action.follow_up_date ? `<div class="action-followup"><strong>Seguimiento:</strong> ${new Date(action.follow_up_date).toLocaleDateString()}</div>` : ''}
      `

      fragment.appendChild(actionItem)
    })

    actionsList.appendChild(fragment)
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
    [COLLECTION_ACTION_TYPES.PHONE_CALL]: 'Llamada telefónica',
    [COLLECTION_ACTION_TYPES.EMAIL]: 'Correo electrónico',
    [COLLECTION_ACTION_TYPES.SMS]: 'Mensaje SMS',
    [COLLECTION_ACTION_TYPES.LETTER]: 'Carta',
    [COLLECTION_ACTION_TYPES.VISIT]: 'Visita',
    [COLLECTION_ACTION_TYPES.PAYMENT_PLAN]: 'Plan de pago',
    [COLLECTION_ACTION_TYPES.SETTLEMENT]: 'Acuerdo',
    [COLLECTION_ACTION_TYPES.LEGAL_NOTICE]: 'Notificación legal',
    [COLLECTION_ACTION_TYPES.OTHER]: 'Otro'
  }
  return actionTexts[actionType] || actionType
}
