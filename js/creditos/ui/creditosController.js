/**
 * creditosController.js
 * Orquesta toda la UI del módulo de Créditos:
 *   - Lista de acreedores y créditos
 *   - Formulario nuevo acreedor
 *   - Formulario nuevo crédito (con resumen calculado al vuelo)
 *   - Detalle de crédito con calendario de cuotas y pagos
 *   - Registro de pagos al acreedor
 */

import { ACTION_TYPES } from '../../app/state/actions.js'
import { showView }      from '../../app/controllers/appController.js'
import { showToast } from '../../app/ui/domAdapter.js'
import { DOM_IDS }       from '../../app/ui/domIds.js'
import {
  acreedoresDataAdapter,
  creditosDataAdapter,
  cuotasCreditoDataAdapter,
  pagosCreditoDataAdapter,
} from '../../adapters/dataAdapters/creditosDataAdapter.js'
import { calcularResumenCredito } from '../domain/calcularCuotasCredito.js'

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 2 })
const fmtNum = (n) => fmt.format(n ?? 0)
const fmtFecha = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-CR') : '–'

const ESTADO_BADGE = {
  ACTIVO:    '<span class="badge badge--primary">Activo</span>',
  ARCHIVADO: '<span class="badge badge--neutral">Archivado</span>',
  COMPLETADO:'<span class="badge badge--success">Completado</span>',
}

const CUOTA_BADGE = {
  PENDIENTE: '<span class="badge badge--warning">Pendiente</span>',
  PAGADA:    '<span class="badge badge--success">Pagada</span>',
  VENCIDA:   '<span class="badge badge--danger">Vencida</span>',
  PARCIAL:   '<span class="badge badge--primary">Parcial</span>',
}

// ── Estado local del módulo ───────────────────────────────────────────────────

let _store       = null
let _appCtrl     = null
let _creditoActual = null // Crédito actualmente en detalle

// ── Inicialización ────────────────────────────────────────────────────────────

export function initCreditosController(store, appCtrl) {
  _store   = store
  _appCtrl = appCtrl

  _bindNavTrigger()
  _bindAcreedorForm()
  _bindCreditoForm()
  _bindPagoCreditoForm()
  _bindFiltros()
  _bindCreditosList()
}

// ── Navegación: cargar datos al entrar a la vista ────────────────────────────

function _bindNavTrigger() {
  const navBtn = document.getElementById(DOM_IDS.NAV_CREDITOS)
  if (!navBtn) return

  navBtn.addEventListener('click', async () => {
    await _cargarDatos()
    _renderDashboard()
  })
}

async function _cargarDatos() {
  const state = _store.getState()

  // Cargar acreedores si no están en caché
  if (!state.acreedores.loaded) {
    const acreedores = await acreedoresDataAdapter.load()
    _store.dispatch({ type: ACTION_TYPES.LOAD_ACREEDORES, payload: acreedores })
  }

  // Cargar créditos si no están en caché
  if (!state.creditos.loaded) {
    const creditos = await creditosDataAdapter.load()
    _store.dispatch({ type: ACTION_TYPES.LOAD_CREDITOS, payload: creditos })
  }
}

// ── Dashboard / lista principal ───────────────────────────────────────────────

function _renderDashboard() {
  const state    = _store.getState()
  const creditos = state.creditos.list || []

  // Métricas
  const totalRecibido   = creditos.reduce((s, c) => s + (c.monto_original ?? 0), 0)
  const totalPagado     = creditos.reduce((s, c) => s + (c.monto_pagado ?? 0), 0)
  const deudaPendiente  = creditos.reduce((s, c) => s + (c.saldo_pendiente ?? 0), 0)
  const creditosActivos = creditos.filter(c => c.estado === 'ACTIVO').length

  const metricsEl = document.getElementById('creditos-metrics')
  if (metricsEl) {
    metricsEl.innerHTML = `
      <div class="metric-card">
        <div class="metric-label">Total recibido</div>
        <div class="metric-value">${fmtNum(totalRecibido)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total pagado</div>
        <div class="metric-value text-success">${fmtNum(totalPagado)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Deuda pendiente</div>
        <div class="metric-value text-danger">${fmtNum(deudaPendiente)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Créditos activos</div>
        <div class="metric-value">${creditosActivos}</div>
      </div>
    `
  }

  _renderListaCreditos(creditos)
}

function _renderListaCreditos(creditos) {
  const contenedor = document.getElementById('creditos-content')
  if (!contenedor) return

  if (!creditos.length) {
    contenedor.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        </div>
        <div class="empty-state-title">Sin créditos registrados</div>
        <p class="empty-state-desc">Registra los préstamos que recibes de tus acreedores.</p>
        <button id="btn-credito-vacio" class="btn btn-primary" type="button">+ Nuevo crédito</button>
      </div>
    `
    document.getElementById('btn-credito-vacio')?.addEventListener('click', _abrirFormCredito)
    return
  }

  contenedor.innerHTML = creditos.map(c => `
    <div class="premium-card card-credito" data-id="${c.id}" role="button" tabindex="0" style="cursor:pointer">
      <div style="padding: var(--space-4); display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div class="card-main-title">${c.acreedores?.nombre ?? 'Acreedor'}</div>
          <div class="card-subtitle">${(c.tipo_amortizacion ?? '').replace(/_/g, ' ')} · ${c.frecuencia_pago ?? ''}</div>
        </div>
        ${ESTADO_BADGE[c.estado] ?? ''}
      </div>
      <div class="card-content-grid">
        <div class="content-item">
          <span class="item-label">Capital recibido</span>
          <span class="item-value">${fmtNum(c.monto_original)}</span>
        </div>
        <div class="content-item">
          <span class="item-label">Saldo pendiente</span>
          <span class="item-value" style="color:var(--color-danger)">${fmtNum(c.saldo_pendiente ?? c.monto_original)}</span>
        </div>
        <div class="content-item">
          <span class="item-label">Tasa de interés</span>
          <span class="item-value">${c.tasa_interes}%</span>
        </div>
        <div class="content-item">
          <span class="item-label">Fecha inicio</span>
          <span class="item-value">${fmtFecha(c.fecha_inicio)}</span>
        </div>
      </div>
    </div>
  `).join('')

  contenedor.querySelectorAll('.card-credito').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id
      const credito = _store.getState().creditos.list.find(c => c.id === id)
      if (credito) _abrirDetalleCredito(credito)
    })
  })
}

// ── Formulario nuevo crédito ─────────────────────────────────────────────────

function _abrirFormCredito() {
  _popularSelectAcreedor()
  const section = document.getElementById('view-credito-form')
  if (section) {
    section.classList.remove('hidden')
    section.classList.add('active')
    document.getElementById('credito-form-error')?.classList.add('hidden')
    document.getElementById('credito-resumen')?.classList.add('hidden')
    document.getElementById('credito-form')?.reset()
  }
  showView('credito-form', _store)
}

function _popularSelectAcreedor() {
  const select = document.getElementById('credito-acreedor-id')
  if (!select) return

  const acreedores = _store.getState().acreedores.list || []
  select.innerHTML = `<option value="">Seleccionar acreedor...</option>` +
    acreedores.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('')
}

function _bindCreditoForm() {
  const form = document.getElementById('credito-form')
  if (!form) return

  // Calcular resumen al cambiar campos clave
  const camposCalculo = ['credito-monto', 'credito-tasa', 'credito-tipo', 'credito-frecuencia',
    'credito-fecha', 'credito-fecha-primer-pago', 'credito-num-cuotas']

  camposCalculo.forEach(id => {
    document.getElementById(id)?.addEventListener('input', _actualizarResumenCredito)
    document.getElementById(id)?.addEventListener('change', _actualizarResumenCredito)
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const errorEl = document.getElementById('credito-form-error')

    try {
      const credito = {
        acreedor_id:      document.getElementById('credito-acreedor-id')?.value,
        monto_original:   parseFloat(document.getElementById('credito-monto')?.value),
        tasa_interes:     parseFloat(document.getElementById('credito-tasa')?.value),
        tipo_amortizacion: document.getElementById('credito-tipo')?.value,
        frecuencia_pago:  document.getElementById('credito-frecuencia')?.value,
        fecha_inicio:     document.getElementById('credito-fecha')?.value,
        fecha_primer_pago: document.getElementById('credito-fecha-primer-pago')?.value,
        num_cuotas:       document.getElementById('credito-num-cuotas')?.value
          ? parseInt(document.getElementById('credito-num-cuotas').value) : null,
        notas:            document.getElementById('credito-notas')?.value || null,
      }

      const resultado = await creditosDataAdapter.save(credito)
      _store.dispatch({ type: ACTION_TYPES.ADD_CREDITO, payload: resultado })
      showToast('Crédito registrado con éxito', 'success')
      showView('creditos', _store)
      _renderDashboard()
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message
        errorEl.classList.remove('hidden')
      }
    }
  })

  document.getElementById('btn-cancel-credito')?.addEventListener('click', () => {
    showView('creditos', _store)
  })
}

function _actualizarResumenCredito() {
  const resumenEl = document.getElementById('credito-resumen')
  if (!resumenEl) return

  try {
    const monto     = parseFloat(document.getElementById('credito-monto')?.value)
    const tasa      = parseFloat(document.getElementById('credito-tasa')?.value)
    const tipo      = document.getElementById('credito-tipo')?.value
    const frecuencia= document.getElementById('credito-frecuencia')?.value
    const fechaIni  = document.getElementById('credito-fecha')?.value
    const fechaPag  = document.getElementById('credito-fecha-primer-pago')?.value
    const numCuotas = document.getElementById('credito-num-cuotas')?.value

    if (!monto || !tipo || !frecuencia || !fechaIni || !fechaPag) {
      resumenEl.classList.add('hidden')
      return
    }

    const resumen = calcularResumenCredito({
      monto_original:    monto,
      tasa_interes:      tasa || 0,
      tipo_amortizacion: tipo,
      frecuencia_pago:   frecuencia,
      fecha_inicio:      fechaIni,
      fecha_primer_pago: fechaPag,
      num_cuotas:        numCuotas ? parseInt(numCuotas) : null
    })

    resumenEl.classList.remove('hidden')
    resumenEl.innerHTML = `
    <div class="loan-summary-title">Resumen del crédito</div>
    <div class="info-row">
      <span class="info-row-label">Cuotas</span>
      <strong class="info-row-value">${resumen.num_cuotas}</strong>
    </div>
    <div class="info-row">
      <span class="info-row-label">Cuota estimada</span>
      <strong class="info-row-value">${fmtNum(resumen.cuota_estimada)}</strong>
    </div>
    <div class="info-row">
      <span class="info-row-label">Total a pagar</span>
      <strong class="info-row-value">${fmtNum(resumen.total_a_pagar)}</strong>
    </div>
    <div class="info-row">
      <span class="info-row-label">Total intereses</span>
      <strong class="info-row-value" style="color:var(--color-danger)">${fmtNum(resumen.total_intereses)}</strong>
    </div>
  `
  } catch {
    // No mostrar errores mientras el usuario escribe
    document.getElementById('credito-resumen')?.classList.add('hidden')
  }
}

// ── Formulario nuevo acreedor ────────────────────────────────────────────────

function _bindAcreedorForm() {
  const form = document.getElementById('acreedor-form')
  if (!form) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const errorEl = document.getElementById('acreedor-form-error')

    try {
      const acreedor = {
        nombre:    document.getElementById('acreedor-nombre')?.value?.trim(),
        telefono:  document.getElementById('acreedor-telefono')?.value?.trim() || null,
        email:     document.getElementById('acreedor-email')?.value?.trim() || null,
        direccion: document.getElementById('acreedor-direccion')?.value?.trim() || null,
        notas:     document.getElementById('acreedor-notas')?.value?.trim() || null,
      }

      const resultado = await acreedoresDataAdapter.save(acreedor)
      _store.dispatch({ type: ACTION_TYPES.ADD_ACREEDOR, payload: resultado })
      showToast('Acreedor registrado con éxito', 'success')
      showView('creditos', _store)
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message
        errorEl.classList.remove('hidden')
      }
    }
  })

  document.getElementById('btn-cancel-acreedor')?.addEventListener('click', () => {
    showView('creditos', _store)
  })
}

// ── Detalle de crédito ────────────────────────────────────────────────────────

async function _abrirDetalleCredito(credito) {
  _creditoActual = credito
  _store.dispatch({ type: ACTION_TYPES.SET_SELECTED_CREDITO, payload: credito.id })

  // Cargar cuotas
  const cuotas = await cuotasCreditoDataAdapter.getByCredito(credito.id)
  _store.dispatch({ type: ACTION_TYPES.LOAD_CUOTAS_CREDITO, payload: { creditoId: credito.id, cuotas } })

  // Cargar pagos
  const pagos = await pagosCreditoDataAdapter.getByCredito(credito.id)
  _store.dispatch({ type: ACTION_TYPES.LOAD_PAGOS_CREDITO, payload: pagos })

  _renderDetalleCredito(credito, cuotas, pagos)
  showView('credito-detail', _store)
}

function _renderDetalleCredito(credito, cuotas, pagos) {
  const contenedor = document.getElementById('credito-detail-content')
  if (!contenedor) return

  const totalPagado = pagos.reduce((s, p) => s + (p.monto ?? 0), 0)
  const saldo = (credito.monto_original ?? 0) - totalPagado

  // Cuotas vencidas
  const hoy = new Date().toISOString().split('T')[0]
  const vencidas = cuotas.filter(c => c.fecha_vencimiento < hoy && c.estado !== 'PAGADA')

  const cuotasHtml = cuotas.map(c => `
    <div class="cuota-credito-row ${c.estado === 'PAGADA' ? 'cuota-pagada' : c.fecha_vencimiento < hoy ? 'cuota-vencida' : ''}">
      <div class="cuota-credito-header">
        <span class="cuota-num">#${c.numero_cuota}</span>
        <span class="cuota-fecha">${fmtFecha(c.fecha_vencimiento)}</span>
        ${CUOTA_BADGE[c.estado] ?? ''}
      </div>
      <div class="cuota-credito-montos">
        <div class="info-row"><span class="info-row-label">Principal</span><strong class="info-row-value">${fmtNum(c.monto_principal)}</strong></div>
        <div class="info-row"><span class="info-row-label">Interés</span><strong class="info-row-value">${fmtNum(c.monto_interes)}</strong></div>
        <div class="info-row"><span class="info-row-label">Total</span><strong class="info-row-value">${fmtNum(c.monto_total)}</strong></div>
      </div>
      ${c.estado !== 'PAGADA' ? `<button class="btn btn-sm btn-primary btn-pagar-cuota" data-cuota-id="${c.id}" data-monto="${c.monto_total}">Pagar</button>` : '<span class="badge badge--success">&#10003; Pagada</span>'}
    </div>
  `).join('')

  const pagosHtml = pagos.length ? pagos.map(p => `
    <div class="info-row" style="padding: var(--space-3) var(--space-4); border-bottom:1px solid var(--color-border);">
      <span>${fmtFecha(p.fecha_pago)} · ${p.metodo_pago ?? 'Efectivo'}</span>
      <strong>${fmtNum(p.monto)}</strong>
    </div>
  `).join('') : '<p style="padding:var(--space-4);color:var(--color-text-muted);font-size:0.875rem;">Sin pagos registrados aún.</p>'

  contenedor.innerHTML = `
    <div style="padding: var(--space-4);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-3);">
        <h3 style="font-size:1.125rem;">${credito.acreedores?.nombre ?? 'Acreedor'}</h3>
        ${ESTADO_BADGE[credito.estado] ?? ''}
      </div>
    </div>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Capital original</div>
        <div class="metric-value">${fmtNum(credito.monto_original)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total pagado</div>
        <div class="metric-value text-success">${fmtNum(totalPagado)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Saldo pendiente</div>
        <div class="metric-value text-danger">${fmtNum(saldo)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Cuotas vencidas</div>
        <div class="metric-value ${vencidas.length ? 'text-danger' : ''}">${vencidas.length}</div>
      </div>
    </div>

    <div class="info-card" style="margin: 0 var(--space-4) var(--space-3);">
      <div class="info-row"><span class="info-row-label">Tasa</span><strong class="info-row-value">${credito.tasa_interes}%</strong></div>
      <div class="info-row"><span class="info-row-label">Tipo</span><strong class="info-row-value">${(credito.tipo_amortizacion ?? '').replace(/_/g, ' ')}</strong></div>
      <div class="info-row"><span class="info-row-label">Frecuencia</span><strong class="info-row-value">${credito.frecuencia_pago}</strong></div>
      <div class="info-row"><span class="info-row-label">Inicio</span><strong class="info-row-value">${fmtFecha(credito.fecha_inicio)}</strong></div>
    </div>

    <div class="section-block">
      <div class="view-toolbar">
        <h3 style="flex:1">Calendario de cuotas</h3>
        <button id="btn-nuevo-pago-credito" class="btn btn-primary btn-sm" type="button">+ Registrar pago</button>
      </div>
      <div class="cuotas-credito-list">${cuotasHtml || '<p style="padding:var(--space-4);color:var(--color-text-muted)">Sin cuotas generadas.</p>'}</div>
    </div>

    <div class="section-block" style="margin-bottom:var(--space-4);">
      <div style="padding:var(--space-4); border-bottom:1px solid var(--color-border);">
        <h3>Historial de pagos</h3>
      </div>
      <div>${pagosHtml}</div>
    </div>
  `

  // Bind botones "Pagar" cuota individual
  contenedor.querySelectorAll('.btn-pagar-cuota').forEach(btn => {
    btn.addEventListener('click', () => {
      const cuotaId = btn.dataset.cuotaId
      const monto   = btn.dataset.monto
      _preLlenarPagoCredito(monto, cuotaId)
    })
  })

  // Bind botón "Registrar pago"
  document.getElementById('btn-nuevo-pago-credito')?.addEventListener('click', () => {
    _preLlenarPagoCredito()
  })
}

// ── Formulario pago de crédito ────────────────────────────────────────────────

function _preLlenarPagoCredito(monto = '', cuotaId = '') {
  const montoEl = document.getElementById('pago-credito-monto')
  const cuotaEl = document.getElementById('pago-credito-cuota-id')
  const fechaEl = document.getElementById('pago-credito-fecha')

  if (montoEl)  montoEl.value  = monto
  if (cuotaEl)  cuotaEl.value  = cuotaId
  if (fechaEl)  fechaEl.value  = new Date().toISOString().split('T')[0]

  document.getElementById('pago-credito-form-error')?.classList.add('hidden')
  showView('pago-credito-form', _store)
}

function _bindPagoCreditoForm() {
  const form = document.getElementById('pago-credito-form')
  if (!form) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const errorEl = document.getElementById('pago-credito-form-error')

    try {
      if (!_creditoActual) throw new Error('No hay crédito seleccionado')

      const pago = {
        credito_id:       _creditoActual.id,
        cuota_credito_id: document.getElementById('pago-credito-cuota-id')?.value || null,
        monto:            parseFloat(document.getElementById('pago-credito-monto')?.value),
        fecha_pago:       document.getElementById('pago-credito-fecha')?.value,
        metodo_pago:      document.getElementById('pago-credito-metodo')?.value,
        notas:            document.getElementById('pago-credito-notas')?.value || null,
      }

      const resultado = await pagosCreditoDataAdapter.save(pago)
      _store.dispatch({ type: ACTION_TYPES.ADD_PAGO_CREDITO, payload: resultado })
      showToast('Pago registrado con éxito', 'success')

      // Volver al detalle y recargar
      await _abrirDetalleCredito(_creditoActual)
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message
        errorEl.classList.remove('hidden')
      }
    }
  })

  document.getElementById('btn-cancel-pago-credito')?.addEventListener('click', () => {
    if (_creditoActual) _abrirDetalleCredito(_creditoActual)
    else showView('creditos', _store)
  })
}

// ── Filtros y búsqueda ────────────────────────────────────────────────────────

function _bindFiltros() {
  document.getElementById('creditos-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase()
    const todos = _store.getState().creditos.list || []
    const filtrados = q
      ? todos.filter(c => c.acreedores?.nombre?.toLowerCase().includes(q))
      : todos
    _renderListaCreditos(filtrados)
  })

  document.getElementById('creditos-filtro-estado')?.addEventListener('change', (e) => {
    const estado = e.target.value
    const todos = _store.getState().creditos.list || []
    const filtrados = estado ? todos.filter(c => c.estado === estado) : todos
    _renderListaCreditos(filtrados)
  })
}

// ── Botones de acción en la vista principal ───────────────────────────────────

function _bindCreditosList() {
  document.getElementById('btn-nuevo-credito')?.addEventListener('click', _abrirFormCredito)
  document.getElementById('btn-nuevo-acreedor')?.addEventListener('click', () => {
    document.getElementById('acreedor-form')?.reset()
    document.getElementById('acreedor-form-error')?.classList.add('hidden')
    showView('acreedor-form', _store)
  })
}
