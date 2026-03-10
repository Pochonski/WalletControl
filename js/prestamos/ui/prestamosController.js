/**
 * PrestamosController - Gestión de Préstamos en la UI
 *
 * Responsabilidades:
 * - Renderizar la lista de préstamos con filtros de estado
 * - Manejar el formulario de creación con validación inline
 * - Calcular cuotas (PMT real) y resumen en vivo
 * - Cachear cuotas en Redux y actualizar saldo tras pagar
 * - Delegar el detalle a prestamosDetailView
 */

import { ACTION_TYPES } from '../../app/state/actions.js'
import { prestamosDataAdapter } from '../../adapters/dataAdapters/prestamosDataAdapter.js'
import { clientesDataAdapter } from '../../adapters/dataAdapters/clientesDataAdapter.js'
import { cuotasDataAdapter } from '../../adapters/dataAdapters/cuotasDataAdapter.js'
import { showSuccess, showError } from '../../common/uiHelpers.js'
import { formatDate } from '../../common/dateUtils.js'
import {
  calcularFechaFin,
  calcularMontoCuota,
  calcularInteresTotal,
} from '../domain/prestamoUtils.js'
import { renderDetallePrestamo } from './prestamosDetailView.js'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS LOCALES
// ─────────────────────────────────────────────────────────────────────────────
const fmtCRC = (n) =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(n || 0)

/** Muestra error inline bajo un input */
function setInputError(input, msg) {
  if (!input) return
  input.classList.add('input-error')
  const wrap = input.closest('.form-group')
  if (!wrap) return
  let errEl = wrap.querySelector('.field-error')
  if (!errEl) {
    errEl = document.createElement('span')
    errEl.className = 'field-error'
    errEl.style.cssText = 'color: var(--color-danger); font-size: 0.72rem; display: block; margin-top: 3px;'
    wrap.appendChild(errEl)
  }
  errEl.textContent = msg
}

/** Limpia el error inline de un input */
function clearInputError(input) {
  if (!input) return
  input.classList.remove('input-error')
  const wrap = input.closest('.form-group')
  const errEl = wrap?.querySelector('.field-error')
  if (errEl) errEl.textContent = ''
}

function clearAllErrors(fields) {
  fields.forEach(clearInputError)
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export const initPrestamosController = (dom, store, appCtrl) => {
  const prestamosSection = dom.prestamos
  if (!prestamosSection) {
    console.warn('[prestamosController] DOM prestamos section not found')
    return
  }

  const formulario = prestamosSection.form
  const tabla = prestamosSection.tabla
  const selectCliente = prestamosSection.selectCliente
  const btnNuevo = prestamosSection.btnNuevo
  const inputBuscar = document.getElementById('prestamos-search')
  const filterBar = document.getElementById('prestamos-filter-bar')

  // Estado local del filtro activo
  let filtroActivo = 'TODOS'

  // ── Campos del formulario ─────────────────────────────────────────────────
  const elCliente = () => document.getElementById('prestamo-cliente-id')
  const elMonto = () => document.getElementById('prestamo-monto')
  const elTasa = () => document.getElementById('prestamo-tasa')
  const elTipo = () => document.getElementById('prestamo-tipo')
  const elFrecuencia = () => document.getElementById('prestamo-frecuencia')
  const elNumCuotas = () => document.getElementById('prestamo-num-cuotas')
  const elFechaInicio = () => document.getElementById('prestamo-fecha-inicio')
  const elFechaPrimer = () => document.getElementById('prestamo-fecha-primer-pago')
  const elMontoCuotas = () => document.getElementById('prestamo-monto-cuotas')
  const elCuotaLabel = () => document.getElementById('prestamo-cuota-label')
  const elResumen = () => document.getElementById('prestamo-resumen')

  // ────────────────────────────────────────────────────────────────
  // 1. CARGA INICIAL
  // ────────────────────────────────────────────────────────────────

  const cargarDatos = async () => {
    store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
    try {
      const prestamos = await prestamosDataAdapter.load()
      store.dispatch({ type: ACTION_TYPES.LOAD_PRESTAMOS, payload: prestamos })

      const { clientes } = store.getState()
      if (!clientes.loaded) {
        const loadedClientes = await clientesDataAdapter.load()
        store.dispatch({ type: ACTION_TYPES.LOAD_CLIENTES, payload: loadedClientes })
      }

      actualizarSelectClientes()
      initFilterBar()
    } catch (err) {
      console.error('[prestamosController] Error loading:', err)
      showError('Error al cargar préstamos: ' + err.message)
    } finally {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
    }
  }

  const actualizarSelectClientes = () => {
    if (!selectCliente) return
    const { clientes } = store.getState()
    selectCliente.innerHTML = '<option value="">Seleccione un cliente...</option>'
    clientes.list
      .filter(c => c.estado !== 'ARCHIVADO')
      .forEach(c => {
        const option = document.createElement('option')
        option.value = c.id
        option.textContent = `${c.nombre}${c.cedula ? ` (${c.cedula})` : ''}`
        selectCliente.appendChild(option)
      })
  }

  // ────────────────────────────────────────────────────────────────
  // 2. FILTROS DE ESTADO
  // ────────────────────────────────────────────────────────────────

  const FILTROS = [
    { key: 'TODOS', label: 'Todos' },
    { key: 'ACTIVO', label: 'Activos' },
    { key: 'MORA', label: 'En mora' },
    { key: 'COMPLETADO', label: 'Completados' },
    { key: 'ARCHIVADO', label: 'Archivados' },
  ]

  const initFilterBar = () => {
    if (!filterBar) return
    filterBar.innerHTML = ''
    FILTROS.forEach(f => {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = `filter-chip${filtroActivo === f.key ? ' filter-chip--active' : ''}`
      chip.dataset.filtro = f.key
      chip.textContent = f.label
      chip.addEventListener('click', () => {
        filtroActivo = f.key
        filterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('filter-chip--active'))
        chip.classList.add('filter-chip--active')
        render()
      })
      filterBar.appendChild(chip)
    })
  }

  // ────────────────────────────────────────────────────────────────
  // 3. CÁLCULO EN VIVO (monto cuota + resumen)
  // ────────────────────────────────────────────────────────────────

  const actualizarCuotaEstimada = () => {
    const monto = parseFloat(elMonto()?.value) || 0
    const tasa = parseFloat(elTasa()?.value) || 0
    const tipo = elTipo()?.value || 'CUOTA_FIJA'
    const frecuencia = elFrecuencia()?.value || 'MENSUAL'
    const numCuotas = parseInt(elNumCuotas()?.value, 10) || 0
    const fechaPrimer = elFechaPrimer()?.value || ''

    const montoCuotasEl = elMontoCuotas()
    const cuotaLabelEl = elCuotaLabel()
    const resumenEl = elResumen()

    if (!montoCuotasEl) return

    if (!monto || !tasa || !numCuotas) {
      montoCuotasEl.value = ''
      if (cuotaLabelEl) cuotaLabelEl.textContent = ''
      if (resumenEl) resumenEl.style.display = 'none'
      return
    }

    const { cuota, label } = calcularMontoCuota(monto, tasa, numCuotas, tipo, frecuencia)
    const interesTotal = calcularInteresTotal(monto, tasa, numCuotas, tipo, frecuencia)
    const totalPagar = monto + interesTotal

    montoCuotasEl.value = fmtCRC(cuota)
    if (cuotaLabelEl) cuotaLabelEl.textContent = label

    // Calcular fecha fin estimada
    const fechaFin = fechaPrimer
      ? calcularFechaFin(fechaPrimer, numCuotas, frecuencia)
      : null

    // Mostrar resumen
    if (resumenEl) {
      resumenEl.style.display = 'block'
      resumenEl.innerHTML = `
        <div class="loan-summary-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 14px; background: var(--color-primary-light, #eff6ff); border-radius: 12px; margin: 0 0 12px 0; border: 1px solid var(--color-primary, #2563eb)22;">
          <div>
            <div style="font-size: 0.7rem; color: var(--color-text-light);">Capital</div>
            <div style="font-weight: 700; color: var(--color-primary);">${fmtCRC(monto)}</div>
          </div>
          <div>
            <div style="font-size: 0.7rem; color: var(--color-text-light);">Interés total</div>
            <div style="font-weight: 700;">${fmtCRC(interesTotal)}</div>
          </div>
          <div>
            <div style="font-size: 0.7rem; color: var(--color-text-light);">Total a pagar</div>
            <div style="font-weight: 700;">${fmtCRC(totalPagar)}</div>
          </div>
          <div>
            <div style="font-size: 0.7rem; color: var(--color-text-light);">Fecha fin estimada</div>
            <div style="font-weight: 700;">${fechaFin ? formatDate(fechaFin, 'medium') : '—'}</div>
          </div>
        </div>
      `
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 4. CREAR NUEVO PRÉSTAMO
  // ────────────────────────────────────────────────────────────────

  if (formulario) {
    const inputs = [elCliente, elMonto, elTasa, elTipo, elFrecuencia, elNumCuotas, elFechaInicio, elFechaPrimer]

    // Limpiar error al editar
    inputs.forEach(getEl => {
      const el = document.getElementById(getEl()?.id || '')
      if (el) el.addEventListener('input', () => clearInputError(el))
    })

      // Recalcular en cada cambio
      ;[elMonto, elTasa, elTipo, elFrecuencia, elNumCuotas, elFechaPrimer].forEach(getEl => {
        const idFn = () => {
          // hay que obtenerlo después de que el DOM esté listo
          const el = getEl()
          if (el) {
            el.addEventListener('input', actualizarCuotaEstimada)
            el.addEventListener('change', actualizarCuotaEstimada)
          }
        }
        idFn()
      })

    formulario.addEventListener('submit', async (e) => {
      e.preventDefault()

      // Leer valores
      const clienteId = elCliente()?.value?.trim()
      const monto = parseFloat(elMonto()?.value)
      const tasa = parseFloat(elTasa()?.value)
      const tipo = elTipo()?.value
      const frecuencia = elFrecuencia()?.value
      const numCuotas = parseInt(elNumCuotas()?.value, 10)
      const fechaInicio = elFechaInicio()?.value
      const fechaPrimer = elFechaPrimer()?.value

      // ── Validación inline ──────────────────────────────────────
      let hasErrors = false
      clearAllErrors([elCliente(), elMonto(), elTasa(), elTipo(), elFrecuencia(), elNumCuotas(), elFechaInicio(), elFechaPrimer()])

      if (!clienteId) {
        setInputError(elCliente(), 'Seleccione un cliente')
        hasErrors = true
      }
      if (!monto || monto <= 0) {
        setInputError(elMonto(), 'El monto debe ser mayor a 0')
        hasErrors = true
      }
      if (isNaN(tasa) || tasa < 0) {
        setInputError(elTasa(), 'Tasa de interés inválida')
        hasErrors = true
      }
      if (!tipo) {
        setInputError(elTipo(), 'Seleccione un tipo de amortización')
        hasErrors = true
      }
      if (!frecuencia) {
        setInputError(elFrecuencia(), 'Seleccione la frecuencia de pago')
        hasErrors = true
      }
      if (!numCuotas || numCuotas < 1) {
        setInputError(elNumCuotas(), 'Ingrese un número de cuotas válido (mínimo 1)')
        hasErrors = true
      }
      if (!fechaInicio) {
        setInputError(elFechaInicio(), 'La fecha de desembolso es requerida')
        hasErrors = true
      }
      if (!fechaPrimer) {
        setInputError(elFechaPrimer(), 'La fecha del primer pago es requerida')
        hasErrors = true
      }
      if (fechaPrimer && fechaInicio && fechaPrimer < fechaInicio) {
        setInputError(elFechaPrimer(), 'El primer pago debe ser posterior al desembolso')
        hasErrors = true
      }

      if (hasErrors) return

      // ── Calcular fecha_fin ────────────────────────────────────
      const fechaFin = calcularFechaFin(fechaPrimer, numCuotas, frecuencia)
      if (!fechaFin) {
        showError('No se pudo calcular la fecha de fin del préstamo')
        return
      }

      const nuevoPrestamo = {
        cliente_id: clienteId,
        monto_original: monto,
        tasa_interes: tasa,
        tipo_interes: tipo,
        frecuencia_pago: frecuencia,
        fecha_inicio: fechaInicio,
        fecha_primer_pago: fechaPrimer,
        fecha_fin: fechaFin,
      }

      try {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
        const guardado = await prestamosDataAdapter.save(nuevoPrestamo)
        store.dispatch({ type: ACTION_TYPES.ADD_PRESTAMO, payload: guardado })
        showSuccess('Préstamo creado exitosamente')
        formulario.reset()
        if (elResumen()) elResumen().style.display = 'none'
        appCtrl.showView('prestamos')
      } catch (err) {
        console.error('[prestamosController] Save error:', err)
        showError('Error: ' + err.message)
      } finally {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
      }
    })
  }

  // ────────────────────────────────────────────────────────────────
  // 5. BOTÓN NUEVO
  // ────────────────────────────────────────────────────────────────

  if (btnNuevo) {
    btnNuevo.addEventListener('click', () => {
      appCtrl.showView('prestamo-form')
      if (formulario) {
        formulario.reset()
        if (elResumen()) elResumen().style.display = 'none'
      }
    })
  }

  // ────────────────────────────────────────────────────────────────
  // 6. BÚSQUEDA REACTIVA
  // ────────────────────────────────────────────────────────────────

  if (inputBuscar) {
    inputBuscar.addEventListener('input', () => render())
  }

  // ────────────────────────────────────────────────────────────────
  // 7. RENDER DE TARJETAS
  // ────────────────────────────────────────────────────────────────

  const render = () => {
    const { prestamos, clientes } = store.getState()
    if (!tabla) return

    const termino = inputBuscar ? inputBuscar.value.toLowerCase().trim() : ''
    const hoy = new Date().toISOString().split('T')[0]

    let list = prestamos.list

    // Filtro de estado
    if (filtroActivo === 'MORA') {
      // Mostrar préstamos que tienen cuotas vencidas (aproximación: usando los datos del store)
      list = list.filter(p => p.estado === 'ACTIVO')
      // La detección de mora real requeriría cuotas; usamos el valor del campo estado si existe
      // Como fallback: prestamos activos donde fecha_fin < hoy
      list = list.filter(p => p.estado === 'ACTIVO' && p.fecha_fin < hoy)
    } else if (filtroActivo !== 'TODOS') {
      list = list.filter(p => p.estado === filtroActivo)
    }

    // Filtro de búsqueda
    list = list.filter(p => {
      if (!termino) return true
      let nombre = p.clientes?.nombre?.toLowerCase() || ''
      if (!nombre) {
        const c = clientes.list.find(c => c.id === p.cliente_id)
        if (c) nombre = c.nombre.toLowerCase()
      }
      return nombre.includes(termino)
    })

    tabla.innerHTML = ''

    if (list.length === 0) {
      tabla.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--color-text-light);">
          <div style="font-size: 3rem; margin-bottom: 10px; opacity: 0.3;">📄</div>
          <p>${termino ? 'No se encontraron préstamos para esta búsqueda' : 'No hay préstamos en esta categoría'}</p>
        </div>
      `
      return
    }

    const fragment = document.createDocumentFragment()

    list.forEach(prestamo => {
      const card = document.createElement('div')
      card.className = 'card'
      card.dataset.id = prestamo.id

      // Detectar mora: prestamo activo con fecha de fin pasada
      const enMora = prestamo.estado === 'ACTIVO' && prestamo.fecha_fin < hoy
      const estadoDisplay = enMora ? 'MORA' : (prestamo.estado || 'ACTIVO')

      const estadoClass = estadoDisplay === 'MORA' ? 'badge--danger'
        : estadoDisplay === 'COMPLETADO' ? 'badge--success'
          : estadoDisplay === 'PAGADO' ? 'badge--success'
            : estadoDisplay === 'ARCHIVADO' ? 'badge--secondary'
              : 'badge--primary'

      let nombreCliente = 'Cargando...'
      if (prestamo.clientes?.nombre) {
        nombreCliente = prestamo.clientes.nombre
      } else {
        const c = clientes.list.find(c => c.id === prestamo.cliente_id)
        if (c) nombreCliente = c.nombre
      }

      const iniciales = (nombreCliente || '??')
        .split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase().substring(0, 2)

      const montoFmt = fmtCRC(prestamo.monto_original)
      const saldoFmt = prestamo.saldo_pendiente != null
        ? fmtCRC(prestamo.saldo_pendiente) : montoFmt
      const frecuenciaFmt = prestamo.frecuencia_pago?.toLowerCase() || ''

      card.innerHTML = `
        <div class="card-avatar">${iniciales}</div>
        <div class="card-body">
          <div class="card-title">${nombreCliente}</div>
          <div class="card-subtitle">${saldoFmt} pendiente</div>
          <div class="card-meta">
            <span class="card-subtitle" style="font-size: 0.75rem;">
              ${prestamo.tasa_interes}% · ${prestamo.tipo_interes || ''}
            </span>
          </div>
        </div>
        <div class="card-right">
          <span class="badge ${estadoClass}">${estadoDisplay}</span>
          <div style="display: flex; gap: 8px; margin-top: auto;">
            <button class="btn-icon btn-archivar" title="Archivar" style="color: var(--color-danger);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="21 8 21 21 3 21 3 8"/>
                <rect x="1" y="3" width="22" height="5"/>
                <line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
            </button>
            <span class="card-subtitle" style="font-size: 0.70rem; align-self: flex-end;">${frecuenciaFmt}</span>
          </div>
        </div>
      `

      // Click → detalle
      card.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-archivar')) return
        try {
          store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

          // Usar cuotas del store si ya están cacheadas
          const { cuotas: cuotasState } = store.getState()
          let cuotas = cuotasState.byPrestamoId[prestamo.id]
          if (!cuotas) {
            cuotas = await cuotasDataAdapter.getByPrestamo(prestamo.id)
            store.dispatch({
              type: ACTION_TYPES.LOAD_CUOTAS,
              payload: { prestamoId: prestamo.id, cuotas }
            })
          }

          mostrarDetalle(prestamo, cuotas, nombreCliente)
        } catch (err) {
          showError('Error al cargar cuotas: ' + err.message)
        } finally {
          store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
        }
      })

      // Botón Archivar (fix bug #9: antes decía "eliminar")
      const btnArchivar = card.querySelector('.btn-archivar')
      if (btnArchivar) {
        btnArchivar.addEventListener('click', async (e) => {
          e.stopPropagation()
          if (confirm('¿Archivar este préstamo? Quedará oculto de la lista activa.')) {
            try {
              store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
              await prestamosDataAdapter.update(prestamo.id, { estado: 'ARCHIVADO' })
              store.dispatch({
                type: ACTION_TYPES.UPDATE_PRESTAMO,
                payload: { ...prestamo, estado: 'ARCHIVADO' }
              })
              showSuccess('Préstamo archivado')
            } catch (err) {
              showError('Error al archivar préstamo: ' + err.message)
            } finally {
              store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
            }
          }
        })
      }

      fragment.appendChild(card)
    })

    tabla.appendChild(fragment)
  }

  // ────────────────────────────────────────────────────────────────
  // 8. MOSTRAR DETALLE (delega a prestamosDetailView)
  // ────────────────────────────────────────────────────────────────

  const mostrarDetalle = (prestamo, cuotas, nombreCliente) => {
    renderDetallePrestamo(prestamo, cuotas, nombreCliente, {
      onBack: () => appCtrl.showView('prestamos'),

      onPagar: async (cuotaId, montoCuota, prest, cuotasActuales, nomCliente) => {
        if (!confirm('¿Desea marcar esta cuota como PAGADA?')) return
        try {
          store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

          // 1. Actualizar cuota en BD
          const cuotaActualizada = await cuotasDataAdapter.update(cuotaId, {
            estado: 'PAGADA',
            fecha_pago: new Date().toISOString(),
            monto_pagado: montoCuota,
            saldo_pendiente: 0,
          })

          // 2. Actualizar cuota en Redux
          store.dispatch({ type: ACTION_TYPES.UPDATE_CUOTA, payload: cuotaActualizada })

          // 3. Recalcular saldo del préstamo y actualizar en Redux
          const nuevoMontoPagado = (prest.monto_pagado || 0) + montoCuota
          const nuevoSaldo = Math.max(0, (prest.saldo_pendiente ?? prest.monto_original) - montoCuota)
          const prestamoActualizado = {
            ...prest,
            monto_pagado: nuevoMontoPagado,
            saldo_pendiente: nuevoSaldo,
          }
          store.dispatch({ type: ACTION_TYPES.UPDATE_PRESTAMO, payload: prestamoActualizado })

          showSuccess('Pago registrado exitosamente')

          // 4. Refrescar cuotas y re-renderizar detalle
          const nuevasCuotas = await cuotasDataAdapter.getByPrestamo(prest.id)
          store.dispatch({
            type: ACTION_TYPES.LOAD_CUOTAS,
            payload: { prestamoId: prest.id, cuotas: nuevasCuotas }
          })

          mostrarDetalle(prestamoActualizado, nuevasCuotas, nomCliente)

        } catch (err) {
          showError('Error al registrar pago: ' + err.message)
        } finally {
          store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
        }
      }
    })

    appCtrl.showView('prestamo-detail')
  }

  // ────────────────────────────────────────────────────────────────
  // 9. SUSCRIBIR A CAMBIOS DEL STORE
  // ────────────────────────────────────────────────────────────────

  store.subscribe((newState, previousState) => {
    if (newState.prestamos !== previousState.prestamos) {
      render()
    }
    if (newState.clientes !== previousState.clientes) {
      actualizarSelectClientes()
      render()
    }
  })

  // ────────────────────────────────────────────────────────────────
  // 10. INIT
  // ────────────────────────────────────────────────────────────────

  cargarDatos()
}
