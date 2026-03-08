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
import { fileManager } from '../../storage/fileManager.js'

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

  if (inputBuscar) {
    // Búsqueda reactiva en tiempo real
    inputBuscar.addEventListener('input', async () => {
      const termino = inputBuscar.value.trim()

      if (!termino) {
        // Restaurar lista completa del estado
        render()
        return
      }

      try {
        const resultados = await clientesDataAdapter.search(termino)
        store.dispatch({
          type: ACTION_TYPES.LOAD_CLIENTES,
          payload: resultados
        })
      } catch (err) {
        showError('Error en búsqueda: ' + err.message)
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

  const render = async () => {
    const { clientes } = store.getState()
    const { list } = clientes

    if (!tabla) return

    tabla.innerHTML = ''

    const fragment = document.createDocumentFragment()
    const visibles = list.filter(c => c.estado !== 'ARCHIVADO')

    if (visibles.length === 0) {
      tabla.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--color-text-light);">
          <div style="font-size: 3rem; margin-bottom: 10px; opacity: 0.3;">👥</div>
          <p>No hay clientes registrados</p>
        </div>
      `
      return
    }

    for (const cliente of visibles) {
      const card = document.createElement('div')
      card.className = 'card'
      card.dataset.id = cliente.id

      const riesgoClass = cliente.nivel_riesgo === 'ALTO' ? 'badge--danger'
        : cliente.nivel_riesgo === 'MEDIO' ? 'badge--warning' : 'badge--success'

      // Iniciales para el avatar
      const iniciales = (cliente.nombre || '??')
        .split(' ')
        .filter(n => n)
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)

      // Intentar cargar foto si existe
      let photoHtml = `<div class="card-avatar">${iniciales}</div>`
      if (cliente.foto_rostro_path) {
        try {
          const photoResult = await fileManager.getFileUrl('client-photos', cliente.foto_rostro_path)
          if (photoResult.success) {
            photoHtml = `
              <div class="card-avatar" style="padding:0; overflow:hidden; background:none;">
                <img src="${photoResult.url}" alt="${cliente.nombre}" style="width:100%; height:100%; object-fit:cover;">
              </div>
            `
          }
        } catch (err) {
          console.warn('Error loading client photo:', err)
        }
      }

      card.innerHTML = `
        ${photoHtml}
        <div class="card-body">
          <div class="card-title">${cliente.nombre}</div>
          <div class="card-subtitle">${cliente.cedula || 'Sin documento'}</div>
          <div class="card-meta">
             <span class="card-subtitle" style="font-size: 0.75rem;">
               ${cliente.telefono || 'Sin teléfono'}
             </span>
          </div>
        </div>
        <div class="card-right">
          <span class="badge ${riesgoClass}">${cliente.nivel_riesgo || 'BAJO'}</span>
          <div style="display: flex; gap: 8px; margin-top: auto;">
             <button class="btn-icon btn-editar" title="Editar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
             </button>
             <button class="btn-icon btn-archivar" title="Archivar" style="color: var(--color-danger);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
             </button>
          </div>
        </div>
      `

      // Eventos
      card.querySelector('.btn-editar').addEventListener('click', (e) => {
        e.stopPropagation()
        console.log('Editar:', cliente.id)
      })

      card.querySelector('.btn-archivar').addEventListener('click', async (e) => {
        e.stopPropagation()
        if (confirm(`¿Archivar cliente "${cliente.nombre}"?`)) {
          try {
            store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
            await clientesDataAdapter.archive(cliente.id)
            store.dispatch({ type: ACTION_TYPES.ARCHIVE_CLIENTE, payload: cliente.id })
            showSuccess('Cliente archivado')
          } catch (err) {
            showError('Error: ' + err.message)
          } finally {
            store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
          }
        }
      })

      card.addEventListener('click', () => {
        console.log('Ver detalle:', cliente.id)
      })

      fragment.appendChild(card)
    }

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
