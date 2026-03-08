/**
 * PrestamosController - Gestión de Préstamos en la UI
 *
 * Responsabilidades:
 * - Renderizar la tabla de préstamos
 * - Manejar el formulario de creación de préstamos
 * - Calcular cuotas aproximadas al momento de crear
 * - Conectar eventos con Redux y dataAdapter
 */

import { ACTION_TYPES } from '../../app/state/actions.js'
import { prestamosDataAdapter } from '../../adapters/dataAdapters/prestamosDataAdapter.js'
import { clientesDataAdapter } from '../../adapters/dataAdapters/clientesDataAdapter.js'
import { cuotasDataAdapter } from '../../adapters/dataAdapters/cuotasDataAdapter.js'
import { showSuccess, showError } from '../../common/uiHelpers.js'

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

  // ────────────────────────────────────────────────────────────────
  // 1. CARGA INICIAL (Préstamos y Clientes para el <select>)
  // ────────────────────────────────────────────────────────────────

  const cargarDatos = async () => {
    store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
    try {
      // Cargar préstamos
      const prestamos = await prestamosDataAdapter.load()
      store.dispatch({
        type: ACTION_TYPES.LOAD_PRESTAMOS,
        payload: prestamos
      })

      // Asegurarse de tener clientes para el select de "Nuevo Préstamo"
      const { clientes } = store.getState()
      if (!clientes.loaded) {
          const loadedClientes = await clientesDataAdapter.load()
          store.dispatch({
              type: ACTION_TYPES.LOAD_CLIENTES,
              payload: loadedClientes
          })
      }

      actualizarSelectClientes()
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
      clientes.list.forEach(c => {
          if (c.estado !== 'ARCHIVADO') {
              const option = document.createElement('option')
              option.value = c.id
              // Por si la cédula está desencriptada
              option.textContent = `${c.nombre} ${c.cedula ? `(${c.cedula})` : ''}`
              selectCliente.appendChild(option)
          }
      })
  }

  // ────────────────────────────────────────────────────────────────
  // 2. CREAR nuevo préstamo
  // ────────────────────────────────────────────────────────────────

  if (formulario) {
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault()

      const formData = new FormData(formulario)
      const data = Object.fromEntries(formData)

      const nuevoPrestamo = {
        cliente_id: data['cliente_id'] || document.getElementById('prestamo-cliente-id')?.value,
        monto_original: parseFloat(data['monto'] || document.getElementById('prestamo-monto')?.value),
        tasa_interes: parseFloat(data['tasa'] || document.getElementById('prestamo-tasa')?.value),
        tipo_interes: data['tipo'] || document.getElementById('prestamo-tipo')?.value,
        frecuencia_pago: data['frecuencia'] || document.getElementById('prestamo-frecuencia')?.value,
        fecha_inicio: data['fecha_inicio'] || document.getElementById('prestamo-fecha-inicio')?.value,
        fecha_fin: data['fecha_fin'] || document.getElementById('prestamo-fecha-fin')?.value
      }

      // Validar básicos
      if (!nuevoPrestamo.cliente_id || isNaN(nuevoPrestamo.monto_original)) {
        showError('Por favor complete los campos obligatorios.')
        return
      }

      try {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

        const guardado = await prestamosDataAdapter.save(nuevoPrestamo)
        store.dispatch({ type: ACTION_TYPES.ADD_PRESTAMO, payload: guardado })

        showSuccess('Préstamo creado exitosamente')
        formulario.reset()
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
  // 3. NUEVO botón
  // ────────────────────────────────────────────────────────────────

  if (btnNuevo) {
    btnNuevo.addEventListener('click', () => {
      appCtrl.showView('prestamo-form')
      if (formulario) {
        formulario.reset()
      }
    })
  }

  // ────────────────────────────────────────────────────────────────
  // 3.5 BÚSQUEDA REACTIVA
  // ────────────────────────────────────────────────────────────────

  if (inputBuscar) {
    inputBuscar.addEventListener('input', () => {
      render()
    })
  }

  // ────────────────────────────────────────────────────────────────
  // 4. RENDER de tarjetas (Cards)
  // ────────────────────────────────────────────────────────────────

  const render = () => {
    const { prestamos, clientes } = store.getState()
    const { list } = prestamos

    if (!tabla) return

    tabla.innerHTML = ''

    const termino = inputBuscar ? inputBuscar.value.toLowerCase().trim() : ''
    
    // Filtrar por término de búsqueda (nombre del cliente)
    const filteredList = list.filter(p => {
      if (!termino) return true
      let nombre = ''
      if (p.clientes && p.clientes.nombre) {
        nombre = p.clientes.nombre.toLowerCase()
      } else {
        const c = clientes.list.find(c => c.id === p.cliente_id)
        if (c) nombre = c.nombre.toLowerCase()
      }
      return nombre.includes(termino)
    })

    if (filteredList.length === 0) {
      tabla.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--color-text-light);">
          <div style="font-size: 3rem; margin-bottom: 10px; opacity: 0.3;">📄</div>
          <p>${termino ? 'No se encontraron préstamos para esa búsqueda' : 'No hay préstamos registrados'}</p>
        </div>
      `
      return
    }

    const fragment = document.createDocumentFragment()

    filteredList.forEach(prestamo => {
      const card = document.createElement('div')
      card.className = 'card'
      card.dataset.id = prestamo.id

      const estadoClass = prestamo.estado === 'MORA' ? 'badge--danger'
        : prestamo.estado === 'PAGADO' ? 'badge--success' 
        : prestamo.estado === 'ARCHIVADO' ? 'badge--secondary' 
        : 'badge--primary'
        
      // Obtener nombre del cliente
      let nombreCliente = 'Cargando...'
      if (prestamo.clientes && prestamo.clientes.nombre) {
          nombreCliente = prestamo.clientes.nombre
      } else {
          const c = clientes.list.find(c => c.id === prestamo.cliente_id)
          if (c) nombreCliente = c.nombre
      }

      // Iniciales para el avatar del préstamo (del cliente)
      const iniciales = (nombreCliente || '??')
        .split(' ')
        .filter(n => n)
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)

      // Formatear moneda
      const montoFmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(prestamo.monto_original)
      const frecuenciaFmt = prestamo.frecuencia_pago ? prestamo.frecuencia_pago.toLowerCase() : ''

      card.innerHTML = `
        <div class="card-avatar">${iniciales}</div>
        <div class="card-body">
          <div class="card-title">${nombreCliente}</div>
          <div class="card-subtitle">${montoFmt}</div>
          <div class="card-meta">
             <span class="card-subtitle" style="font-size: 0.75rem;">
               Tasa: ${prestamo.tasa_interes}% (${prestamo.tipo_interes})
             </span>
          </div>
        </div>
        <div class="card-right">
          <span class="badge ${estadoClass}">${prestamo.estado || 'ACTIVO'}</span>
          <div style="display: flex; gap: 8px; margin-top: auto;">
             <button class="btn-icon btn-eliminar" title="Eliminar" style="color: var(--color-danger);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
             </button>
             <span class="card-subtitle" style="font-size: 0.70rem; align-self: flex-end;">
               ${frecuenciaFmt}
             </span>
          </div>
        </div>
      `

      // Click en la tarjeta muestra detalle
      card.addEventListener('click', async () => {
        try {
          store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
          const cuotas = await cuotasDataAdapter.getByPrestamo(prestamo.id)
          renderPrestamoDetail(prestamo, cuotas, nombreCliente)
        } catch (err) {
          showError('Error al cargar cuotas: ' + err.message)
        } finally {
          store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
        }
      })

      // Botón Eliminar
      const btnEliminar = card.querySelector('.btn-eliminar')
      if (btnEliminar) {
        btnEliminar.addEventListener('click', async (e) => {
          e.stopPropagation()
          if (confirm('¿Estás seguro de que deseas eliminar este préstamo y todas sus cuotas?')) {
            try {
              store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
              // Usaremos el adapter para eliminar/archivar (asumimos que delete ya está o lo implementaremos)
              await prestamosDataAdapter.update(prestamo.id, { estado: 'ARCHIVADO' })
              store.dispatch({ type: ACTION_TYPES.UPDATE_PRESTAMO, payload: { ...prestamo, estado: 'ARCHIVADO' } })
              showSuccess('Préstamo enviado a archivo')
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
  // 5. RENDER DETALLE DE PRÉSTAMO (Premium)
  // ────────────────────────────────────────────────────────────────

  const renderPrestamoDetail = (prestamo, cuotas, nombreCliente) => {
    const detailView = document.getElementById('view-prestamo-detail')
    if (!detailView) return

    const montoFmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(prestamo.monto_original)
    const saldoFmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(prestamo.saldo_pendiente || prestamo.monto_original)
    
    // Calcular interés total estimado (simplificado para el render)
    const interesEstimado = (prestamo.monto_original * (prestamo.tasa_interes / 100))
    const interesFmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(interesEstimado)

    detailView.innerHTML = `
      <div class="detail-header">
        <button class="btn-back-circle" id="btn-prestamo-detail-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <span class="detail-label">Detalle del Préstamo</span>
      </div>

      <div class="detail-profile">
        <div class="avatar-large" style="background: var(--color-primary-light); color: var(--color-primary);">
           <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
        </div>
        <h2 class="detail-name">${nombreCliente}</h2>
        <span class="badge ${prestamo.estado === 'ACTIVO' ? 'badge--primary' : 'badge--success'}">${prestamo.estado || 'ACTIVO'}</span>
      </div>

      <h3 class="detail-section-title">Resumen Financiero</h3>
      <div class="detail-grid">
        <div class="detail-card">
          <span class="detail-label">Monto Aprobado</span>
          <span class="detail-value" style="color: var(--color-primary); font-weight: 700;">${montoFmt}</span>
        </div>
        <div class="detail-card">
          <span class="detail-label">Interés (${prestamo.tasa_interes}%)</span>
          <span class="detail-value">${interesFmt}</span>
        </div>
        <div class="detail-card">
          <span class="detail-label">Saldo Pendiente</span>
          <span class="detail-value" style="color: var(--color-danger);">${saldoFmt}</span>
        </div>
        <div class="detail-card">
          <span class="detail-label">Frecuencia</span>
          <span class="detail-value">${prestamo.frecuencia_pago}</span>
        </div>
      </div>

      <h3 class="detail-section-title">Plan de Pagos / Cuotas</h3>
      <div class="table-container" style="background: var(--color-surface); border-radius: 12px; margin: 0 16px; overflow: hidden; box-shadow: var(--shadow-sm);">
        <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead style="background: rgba(0,0,0,0.02); border-bottom: 1px solid var(--color-border);">
            <tr>
              <th style="padding: 12px; text-align: left;">No.</th>
              <th style="padding: 12px; text-align: left;">Vencimiento</th>
              <th style="padding: 12px; text-align: right;">Monto</th>
              <th style="padding: 12px; text-align: center;">Estado</th>
              <th style="padding: 12px; text-align: center;">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${cuotas.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 20px;">No hay cuotas generadas</td></tr>' : 
              cuotas.map(c => {
                const estClass = c.estado === 'PENDIENTE' ? 'badge--warning' : c.estado === 'PAGADA' ? 'badge--success' : 'badge--danger'
                const cuotaMontoFmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(c.monto_total)
                const isPendiente = c.estado === 'PENDIENTE'
                return `
                <tr style="border-bottom: 1px solid var(--color-border-light);">
                  <td style="padding: 12px;">${c.numero_cuota}</td>
                  <td style="padding: 12px;">${c.fecha_vencimiento}</td>
                  <td style="padding: 12px; text-align: right; font-weight: 600;">${cuotaMontoFmt}</td>
                  <td style="padding: 12px; text-align: center;"><span class="badge ${estClass}" style="font-size: 0.65rem;">${c.estado}</span></td>
                  <td style="padding: 12px; text-align: center;">
                    ${isPendiente ? `<button class="btn btn-sm btn-ghost btn-pagar" data-id="${c.id}">Pagar</button>` : '—'}
                  </td>
                </tr>`
              }).join('')}
          </tbody>
        </table>
      </div>

      <div class="detail-actions-bar" style="padding-bottom: 40px;">
        <button class="btn btn-primary btn-full" id="btn-amortizacion">Ver Tabla de Amortización</button>
      </div>
    `

    // Eventos
    detailView.querySelector('#btn-prestamo-detail-back').onclick = () => appCtrl.showView('prestamos')
    
    // Bind pagar cuotas
    detailView.querySelectorAll('.btn-pagar').forEach(btn => {
      btn.onclick = async (e) => {
        const cuotaId = btn.dataset.id
        if (confirm('¿Desea marcar esta cuota como PAGADA?')) {
          try {
            store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
            await cuotasDataAdapter.update(cuotaId, { 
              estado: 'PAGADA',
              fecha_pago: new Date().toISOString()
            })
            showSuccess('Pago registrado exitosamente')
            
            // Recargar datos para refrescar la vista
            const nuevasCuotas = await cuotasDataAdapter.getByPrestamo(prestamo.id)
            renderPrestamoDetail(prestamo, nuevasCuotas, nombreCliente)
            
          } catch (err) {
            showError('Error al registrar pago: ' + err.message)
          } finally {
            store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
          }
        }
      }
    })

    appCtrl.showView('prestamo-detail')
  }

  // ────────────────────────────────────────────────────────────────
  // 6. SUSCRIBIR a cambios del estado
  // ────────────────────────────────────────────────────────────────

  store.subscribe((newState, previousState) => {
    // Re-render si cambió préstamos
    if (newState.prestamos !== previousState.prestamos) {
      render()
    }
    // O si cambiaron clientes (por el select/nombres en tabla)
    if (newState.clientes !== previousState.clientes) {
        actualizarSelectClientes()
        render()
    }
  })

  // ────────────────────────────────────────────────────────────────
  // 6. RENDER INICIAL
  // ────────────────────────────────────────────────────────────────

  cargarDatos()
}
