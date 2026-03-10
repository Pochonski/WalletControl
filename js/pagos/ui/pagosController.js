/**
 * PagosController - Gestión completa de pagos
 *
 * Responsabilidades:
 * - Cargar historial de pagos vía adapter
 * - Mostrar formulario para registrar un nuevo pago
 * - Marcar cuota como PAGADA al registrar
 * - Render de lista con información del préstamo asociado
 * - Exporta abrirNuevoPago() para que prestamosController lo use
 */

import { ACTION_TYPES } from '../../app/state/actions.js'
import { pagosDataAdapter } from '../../adapters/dataAdapters/pagosDataAdapter.js'
import { showSuccess, showError } from '../../common/uiHelpers.js'
import { DOM_IDS } from '../../app/ui/domIds.js'
import { getEl } from '../../app/ui/domAdapter.js'

// Estado local del formulario (cuota pre-seleccionada al venir desde prestamos)
let _cuotaSeleccionada = null
let _appCtrl = null
let _store = null

// ────────────────────────────────────────────────────────────────────
// API PÚBLICA: llamar desde prestamosController para abrir el form
// ────────────────────────────────────────────────────────────────────

/**
 * Abre el formulario de pago con una cuota pre-seleccionada.
 * Llamar desde prestamosController al hacer clic en "Registrar pago".
 *
 * @param {string} cuotaId - UUID de la cuota a pagar
 * @param {object} cuotaInfo - { numero_cuota, monto_cuota, fecha_vencimiento, prestamo }
 */
export const abrirNuevoPago = (cuotaId, cuotaInfo = null) => {
  _cuotaSeleccionada = { id: cuotaId, ...cuotaInfo }
  _renderCuotaInfo()

  if (_appCtrl) {
    _appCtrl.showView('pago-form')
  }
}

// ────────────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────────────

export const initPagosController = (dom, store, appCtrl) => {
  _store = store
  _appCtrl = appCtrl

  const pagosSection = dom.pagos
  if (!pagosSection) {
    console.warn('[pagosController] DOM pagos section not found')
    return
  }

  const lista = getEl(DOM_IDS.PAGOS_LIST)
  const formulario = getEl(DOM_IDS.PAGO_FORM)
  const btnNuevo = getEl(DOM_IDS.BTN_NUEVO_PAGO)
  const btnCancel = getEl(DOM_IDS.BTN_CANCEL_PAGO)

  // ──────────────────────────────────────────────────────────────────
  // 1. CARGAR pagos al iniciar
  // ──────────────────────────────────────────────────────────────────

  const cargarPagos = async () => {
    store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
    try {
      const pagos = await pagosDataAdapter.load()
      store.dispatch({ type: ACTION_TYPES.LOAD_PAGOS, payload: pagos })
    } catch (err) {
      console.error('[pagosController] Error loading:', err)
      showError('Error al cargar pagos: ' + err.message)
    } finally {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 2. BOTÓN "nuevo pago" desde la lista (sin cuota pre-cargada)
  // ──────────────────────────────────────────────────────────────────

  if (btnNuevo) {
    btnNuevo.addEventListener('click', () => {
      _cuotaSeleccionada = null
      _renderCuotaInfo()
      appCtrl.showView('pago-form')
    })
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      _cuotaSeleccionada = null
      formulario?.reset()
      _limpiarError()
      appCtrl.showView('pagos')
    })
  }

  // ──────────────────────────────────────────────────────────────────
  // 3. SUBMIT del formulario
  // ──────────────────────────────────────────────────────────────────

  if (formulario) {
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault()
      _limpiarError()

      const cuotaId = _cuotaSeleccionada?.id
        || formulario.querySelector('[name="cuota_id"]')?.value
        || null

      if (!cuotaId) {
        _mostrarError('Debes seleccionar una cuota a pagar.')
        return
      }

      const nuevoPago = {
        cuota_id: cuotaId,
        monto: parseFloat(getEl(DOM_IDS.PAGO_MONTO)?.value || '0'),
        fecha_pago: getEl(DOM_IDS.PAGO_FECHA)?.value,
        metodo_pago: getEl(DOM_IDS.PAGO_METODO)?.value,
        referencia_pago: getEl(DOM_IDS.PAGO_REFERENCIA)?.value || null,
        notas: getEl(DOM_IDS.PAGO_NOTAS)?.value || null
      }

      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
      try {
        const guardado = await pagosDataAdapter.save(nuevoPago)

        store.dispatch({ type: ACTION_TYPES.ADD_PAGO, payload: guardado })

        showSuccess('Pago registrado exitosamente')
        formulario.reset()
        _cuotaSeleccionada = null
        _renderCuotaInfo()
        appCtrl.showView('pagos')
      } catch (err) {
        console.error('[pagosController] Save error:', err)
        _mostrarError(err.message)
      } finally {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
      }
    })
  }

  // ──────────────────────────────────────────────────────────────────
  // 4. RENDER lista de pagos
  // ──────────────────────────────────────────────────────────────────

  const render = () => {
    if (!lista) return
    const { pagos } = store.getState()
    const list = pagos?.list ?? []

    if (list.length === 0) {
      lista.innerHTML = `
        <div class="empty-state">
          <p>No hay pagos registrados.</p>
        </div>
      `
      return
    }

    const fmt = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' })

    lista.innerHTML = list.map(pago => {
      const clienteNombre = pago.cuotas?.prestamos?.clientes?.nombre ?? '—'
      const numeroCuota = pago.cuotas?.numero_cuota ?? '—'
      const monto = fmt.format(pago.monto)
      const fecha = pago.fecha_pago
        ? new Date(pago.fecha_pago + 'T00:00:00').toLocaleDateString('es-CR')
        : '—'
      const badge = _badgeEstado(pago.estado)

      return `
        <div class="card pago-card">
          <div class="card-header">
            <span class="card-title">${clienteNombre}</span>
            ${badge}
          </div>
          <div class="card-body">
            <p><strong>Monto:</strong> ${monto}</p>
            <p><strong>Fecha:</strong> ${fecha}</p>
            <p><strong>Cuota #:</strong> ${numeroCuota}</p>
            <p><strong>Método:</strong> ${pago.metodo_pago}</p>
            ${pago.referencia_pago ? `<p><strong>Ref:</strong> ${pago.referencia_pago}</p>` : ''}
          </div>
        </div>
      `
    }).join('')
  }

  // ──────────────────────────────────────────────────────────────────
  // 5. SUSCRIBIR al store
  // ──────────────────────────────────────────────────────────────────

  store.subscribe((newState, prevState) => {
    if (newState.pagos !== prevState?.pagos) {
      render()
    }
  })

  // ──────────────────────────────────────────────────────────────────
  // 6. INIT INICIAL
  // ──────────────────────────────────────────────────────────────────

  cargarPagos()
  render()
}

// ────────────────────────────────────────────────────────────────────
// HELPERS PRIVADOS
// ────────────────────────────────────────────────────────────────────

function _renderCuotaInfo() {
  const infoEl = getEl(DOM_IDS.PAGO_CUOTA_INFO)
  if (!infoEl) return

  if (!_cuotaSeleccionada) {
    infoEl.innerHTML = '<p style="color:#999;">Ninguna cuota seleccionada.</p>'
    return
  }

  const fmt = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' })
  const monto = _cuotaSeleccionada.monto_total
    ? fmt.format(_cuotaSeleccionada.monto_total)
    : '—'
  const vencimiento = _cuotaSeleccionada.fecha_vencimiento
    ? new Date(_cuotaSeleccionada.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CR')
    : '—'

  infoEl.innerHTML = `
    <p><strong>Cuota #${_cuotaSeleccionada.numero_cuota ?? '—'}</strong></p>
    <p>Monto: ${monto}</p>
    <p>Vencimiento: ${vencimiento}</p>
  `

  // Pre-llenar monto del formulario
  const montoInput = getEl(DOM_IDS.PAGO_MONTO)
  if (montoInput && _cuotaSeleccionada.monto_total) {
    montoInput.value = _cuotaSeleccionada.monto_total
  }

  // Establecer fecha de hoy por defecto
  const fechaInput = getEl(DOM_IDS.PAGO_FECHA)
  if (fechaInput && !fechaInput.value) {
    fechaInput.value = new Date().toISOString().split('T')[0]
  }
}

function _mostrarError(mensaje) {
  const errEl = getEl(DOM_IDS.PAGO_FORM_ERROR)
  if (!errEl) return
  errEl.textContent = mensaje
  errEl.classList.remove('hidden')
}

function _limpiarError() {
  const errEl = getEl(DOM_IDS.PAGO_FORM_ERROR)
  if (!errEl) return
  errEl.textContent = ''
  errEl.classList.add('hidden')
}

function _badgeEstado(estado) {
  const clases = {
    CONFIRMADO: 'badge-success',
    PENDIENTE: 'badge-warning',
    RECHAZADO: 'badge-error'
  }
  const cls = clases[estado] ?? 'badge-neutral'
  return `<span class="badge ${cls}">${estado ?? '—'}</span>`
}
