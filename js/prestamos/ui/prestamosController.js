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
    // Podríamos recalcular cuotas estimadas aquí al cambiar inputs
    // (Omitido por brevedad en MVP, pero sería un `input` event listener o similar)

    formulario.addEventListener('submit', async (e) => {
      e.preventDefault()

      // Usamos el ID del DOM para estar seguros o name si existiera. 
      // Como no hay names en el HTML, extraemos manualmente los values.
      const getVal = (id) => document.getElementById(id)?.value

      const nuevoPrestamo = {
        cliente_id: getVal('prestamo-cliente-id'),
        monto_original: parseFloat(getVal('prestamo-monto')),
        tasa_interes: parseFloat(getVal('prestamo-tasa')),
        tipo_interes: getVal('prestamo-tipo'),
        frecuencia_pago: getVal('prestamo-frecuencia'),
        fecha_inicio: getVal('prestamo-fecha-inicio'),
        fecha_fin: getVal('prestamo-fecha-fin')
      }

      // Dispatch local inmediato
      store.dispatch({
        type: ACTION_TYPES.ADD_PRESTAMO,
        payload: nuevoPrestamo
      })

      try {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

        const guardado = await prestamosDataAdapter.save(nuevoPrestamo)

        // Sync ID temporal si aplica
        if (nuevoPrestamo.id && nuevoPrestamo.id.startsWith('temp-')) {
          store.dispatch({
            type: ACTION_TYPES.SYNC_REMOTE_ID,
            payload: {
              localId: nuevoPrestamo.id,
              remoteId: guardado.id,
              entityType: 'prestamo'
            }
          })
        }

        showSuccess('Préstamo creado exitosamente')
        formulario.reset()
        
        // Refrescar para tener el objeto completo con `clientes.nombre` que retorna Supabase
        await cargarDatos() 

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
      if (formulario) {
        formulario.reset()
        formulario.scrollIntoView({ behavior: 'smooth' })
      }
    })
  }

  // ────────────────────────────────────────────────────────────────
  // 4. RENDER de tabla
  // ────────────────────────────────────────────────────────────────

  const render = () => {
    const { prestamos } = store.getState()
    const { list } = prestamos

    if (!tabla) return

    tabla.innerHTML = ''

    if (list.length === 0) {
      tabla.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 20px; color: #999;">
            No hay préstamos registrados
          </td>
        </tr>
      `
      return
    }

    const fragment = document.createDocumentFragment()

    list.forEach(prestamo => {
      const row = document.createElement('tr')
      const estadoClass = prestamo.estado === 'MORA' ? 'riesgo-high'
        : prestamo.estado === 'PAGADO' ? 'estado-pagado' 
        : prestamo.estado === 'ARCHIVADO' ? 'estado-archivado' 
        : 'estado-activo'
        
      // Intentar sacar el nombre del cliente de la relación join, o del estado local si es reciente
      let nombreCliente = 'Cargando...'
      if (prestamo.clientes && prestamo.clientes.nombre) {
          nombreCliente = prestamo.clientes.nombre
      } else {
          const { clientes } = store.getState()
          const c = clientes.list.find(c => c.id === prestamo.cliente_id)
          if (c) nombreCliente = c.nombre
      }

      // Formatear moneda
      const montoFmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(prestamo.monto_original)

      row.innerHTML = `
        <td>${nombreCliente}</td>
        <td>${montoFmt}</td>
        <td>${prestamo.tasa_interes}%</td>
        <td>${prestamo.tipo_interes}</td>
        <td>${prestamo.frecuencia_pago}</td>
        <td><span class="badge ${estadoClass}">${prestamo.estado || 'ACTIVO'}</span></td>
        <td>
          <button class="btn-ver-cuotas" data-id="${prestamo.id}">Ver Cuotas</button>
          <button class="btn-archivar" data-id="${prestamo.id}">Archivar</button>
        </td>
      `

      // Eventos
      const btnCuotas = row.querySelector('.btn-ver-cuotas')
      const btnArchivar = row.querySelector('.btn-archivar')

      if (btnCuotas) {
        btnCuotas.addEventListener('click', async () => {
          try {
            store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
            const cuotas = await cuotasDataAdapter.getByPrestamo(prestamo.id)
            renderPrestamoDetail(prestamo, cuotas, nombreCliente)
            appCtrl.showView('prestamo-detail')
          } catch (err) {
            showError('Error al cargar cuotas: ' + err.message)
          } finally {
            store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
          }
        })
      }

      if (btnArchivar) {
        btnArchivar.addEventListener('click', async () => {
          if (confirm(`¿Archivar préstamo de ${nombreCliente}?`)) {
            try {
              store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
              await prestamosDataAdapter.archive(prestamo.id)
              store.dispatch({
                type: ACTION_TYPES.ARCHIVE_PRESTAMO,
                payload: prestamo.id
              })
              showSuccess('Préstamo archivado')
            } catch (err) {
              showError('Error: ' + err.message)
            } finally {
              store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
            }
          }
        })
      }

      fragment.appendChild(row)
    })

    tabla.appendChild(fragment)
  }

  // ────────────────────────────────────────────────────────────────
  // 5. RENDER DETALLE DE PRÉSTAMO (CUOTAS)
  // ────────────────────────────────────────────────────────────────

  const renderPrestamoDetail = (prestamo, cuotas, nombreCliente) => {
    const detailView = document.getElementById('view-prestamo-detail')
    if (!detailView) return

    const montoFmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(prestamo.monto_original)
    const saldoFmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(prestamo.saldo_pendiente || prestamo.monto_original)

    detailView.innerHTML = `
      <div class="detail-header">
        <h2>Préstamo de ${nombreCliente}</h2>
        <div class="detail-metrics">
          <div class="metric-card">
            <span class="metric-label">Monto Original</span>
            <span class="metric-value">${montoFmt}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Saldo Pendiente</span>
            <span class="metric-value">${saldoFmt}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Estado</span>
            <span class="metric-value badge ${prestamo.estado === 'ACTIVO' ? 'estado-activo' : ''}">${prestamo.estado}</span>
          </div>
        </div>
      </div>
      
      <div class="detail-body" style="margin-top: 20px;">
        <h3>Tabla de Cuotas</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Vencimiento</th>
                <th>Monto Total</th>
                <th>Cobrado</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${cuotas.length === 0 ? '<tr><td colspan="7" style="text-align:center;">No hay cuotas generadas</td></tr>' : 
                cuotas.map(c => {
                  const estadoClass = c.estado === 'PENDIENTE' ? 'estado-pendiente' : c.estado === 'PAGADA' ? 'estado-pagado' : 'riesgo-high'
                  return `
                  <tr>
                    <td>${c.numero_cuota}</td>
                    <td>${c.fecha_vencimiento}</td>
                    <td>${new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(c.monto_total)}</td>
                    <td>${new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(c.monto_pagado)}</td>
                    <td>${new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(c.saldo_pendiente || c.monto_total)}</td>
                    <td><span class="badge ${estadoClass}">${c.estado}</span></td>
                    <td>
                      <button class="btn btn-sm btn-primary" ${c.estado === 'PAGADA' ? 'disabled' : ''}>Pagar</button>
                    </td>
                  </tr>`
                }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
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
