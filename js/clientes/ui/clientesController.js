/**
 * ClientesController - Gestión completa de clientes
 *
 * Responsabilidades:
 * - Bind de eventos (crear, editar, buscar, archivar)
 * - Dispatch de acciones a Redux
 * - Render de tabla de clientes
 * - Validación y feedback de usuario
 */

import { ACTION_TYPES } from '../../app/state/actions.js'
import { clientesDataAdapter } from '../../adapters/dataAdapters/clientesDataAdapter.js'
import { showSuccess, showError } from '../../common/uiHelpers.js'

export const initClientesController = (dom, store, appCtrl) => {
  const clientesSection = dom.clientes
  if (!clientesSection) {
    console.warn('[clientesController] DOM clientes section not found')
    return
  }

  const formulario = clientesSection.form
  const tabla = clientesSection.tabla
  const btnBuscar = clientesSection.btnBuscar
  const inputBuscar = clientesSection.inputBuscar
  const btnNuevo = clientesSection.btnNuevo

  // ────────────────────────────────────────────────────────────────
  // 1. CARGAR clientes al iniciar
  // ────────────────────────────────────────────────────────────────

  const cargarClientes = async () => {
    store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
    try {
      const clientes = await clientesDataAdapter.load()
      store.dispatch({
        type: ACTION_TYPES.LOAD_CLIENTES,
        payload: clientes
      })
      showSuccess('Clientes cargados')
    } catch (err) {
      console.error('[clientesController] Error loading:', err)
      showError('Error al cargar clientes: ' + err.message)
    } finally {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 2. CREAR nuevo cliente
  // ────────────────────────────────────────────────────────────────

  if (formulario) {
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault()

      const formData = new FormData(formulario)
      const nuevoCliente = Object.fromEntries(formData)

      // Dispatch local (feedback inmediato)
      store.dispatch({
        type: ACTION_TYPES.ADD_CLIENTE,
        payload: nuevoCliente
      })

      // Sincronizar con Supabase
      try {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

        const guardado = await clientesDataAdapter.save(nuevoCliente)

        // Si fue temporal, actualizar con ID real
        if (nuevoCliente.id?.startsWith('temp-')) {
          store.dispatch({
            type: ACTION_TYPES.SYNC_REMOTE_ID,
            payload: {
              localId: nuevoCliente.id,
              remoteId: guardado.id,
              entityType: 'cliente'
            }
          })
        }

        showSuccess('Cliente creado exitosamente')
        formulario.reset()
        appCtrl.showView('clientes')
      } catch (err) {
        console.error('[clientesController] Save error:', err)
        showError('Error: ' + err.message)
      } finally {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
      }
    })
  }

  // ────────────────────────────────────────────────────────────────
  // 3. BÚSQUEDA
  // ────────────────────────────────────────────────────────────────

  if (btnBuscar && inputBuscar) {
    btnBuscar.addEventListener('click', async () => {
      const termino = inputBuscar.value.trim()

      if (!termino) {
        cargarClientes()
        return
      }

      try {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

        const resultados = await clientesDataAdapter.search(termino)
        store.dispatch({
          type: ACTION_TYPES.LOAD_CLIENTES,
          payload: resultados
        })

        showSuccess(`Se encontraron ${resultados.length} cliente(s)`)
      } catch (err) {
        showError('Error en búsqueda: ' + err.message)
      } finally {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
      }
    })

    // Buscar al presionar Enter
    inputBuscar.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        btnBuscar.click()
      }
    })
  }

  // ────────────────────────────────────────────────────────────────
  // 4. NUEVO botón
  // ────────────────────────────────────────────────────────────────

  if (btnNuevo) {
    btnNuevo.addEventListener('click', () => {
      if (formulario) {
        formulario.reset()
        appCtrl.showView('cliente-form')
      }
    })
  }

  // ────────────────────────────────────────────────────────────────
  // 5. RENDER de tabla
  // ────────────────────────────────────────────────────────────────

  const render = () => {
    const { clientes } = store.getState()
    const { list } = clientes

    if (!tabla) return

    tabla.innerHTML = ''

    if (list.length === 0) {
      tabla.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 20px; color: #999;">
            No hay clientes
          </td>
        </tr>
      `
      return
    }

    const fragment = document.createDocumentFragment()

    list.forEach(cliente => {
      const row = document.createElement('tr')
      const riesgoClass = cliente.nivel_riesgo === 'HIGH' ? 'riesgo-high'
        : cliente.nivel_riesgo === 'MEDIUM' ? 'riesgo-medium' : 'riesgo-low'

      row.innerHTML = `
        <td>${cliente.nombre}</td>
        <td>${cliente.cedula || '-'}</td>
        <td>${cliente.telefono || '-'}</td>
        <td>${cliente.email || '-'}</td>
        <td><span class="badge ${riesgoClass}">${cliente.nivel_riesgo || 'N/A'}</span></td>
        <td>
          <button class="btn-editar" data-id="${cliente.id}">Editar</button>
          <button class="btn-archivar" data-id="${cliente.id}">Archivar</button>
        </td>
      `

      // Eventos de editar y archivar
      const btnEditar = row.querySelector('.btn-editar')
      const btnArchivar = row.querySelector('.btn-archivar')

      if (btnEditar) {
        btnEditar.addEventListener('click', () => {
          // TODO: Implementar modal de edición
          console.log('Editar cliente:', cliente.id)
        })
      }

      if (btnArchivar) {
        btnArchivar.addEventListener('click', async () => {
          if (confirm(`¿Archivar cliente "${cliente.nombre}"?`)) {
            try {
              store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
              await clientesDataAdapter.archive(cliente.id)
              store.dispatch({
                type: ACTION_TYPES.ARCHIVE_CLIENTE,
                payload: cliente.id
              })
              showSuccess('Cliente archivado')
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
  // 6. SUSCRIBIR a cambios del estado
  // ────────────────────────────────────────────────────────────────

  store.subscribe((newState, previousState) => {
    // Re-render si cambió clientes
    if (newState.clientes !== previousState.clientes) {
      render()
    }
  })

  // ────────────────────────────────────────────────────────────────
  // 7. RENDER INICIAL
  // ────────────────────────────────────────────────────────────────

  cargarClientes()
  render()
}
