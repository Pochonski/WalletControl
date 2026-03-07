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
import { fileUploadManager } from '../../storage/fileUploadManager.js'
import { fileManager } from '../../storage/fileManager.js'

export const initClientesController = (dom, store) => {
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

      try {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

        // Handle file uploads
        const uploadResults = await handleClientFileUploads(formulario, nuevoCliente.id)

        // Add file paths to client data
        if (uploadResults.fotoRostro) {
          nuevoCliente.foto_rostro_path = uploadResults.fotoRostro
        }
        if (uploadResults.cedulaFrente) {
          nuevoCliente.cedula_frente_path = uploadResults.cedulaFrente
        }
        if (uploadResults.cedulaReverso) {
          nuevoCliente.cedula_reverso_path = uploadResults.cedulaReverso
        }

        // Sincronizar con Supabase
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
        clearPhotoPreviews(formulario)
      } catch (err) {
        console.error('[clientesController] Save error:', err)
        showError('Error: ' + err.message)
      } finally {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
      }
    })
  }

  // ────────────────────────────────────────────────────────────────
  // PHOTO PREVIEW HANDLERS
  // ────────────────────────────────────────────────────────────────

  if (formulario) {
    setupPhotoPreviews(formulario)
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
        formulario.scrollIntoView({ behavior: 'smooth' })
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

    // Process clients sequentially to avoid overwhelming the browser with concurrent requests
    for (const cliente of list) {
      const row = document.createElement('tr')
      const riesgoClass = cliente.nivel_riesgo === 'HIGH' ? 'riesgo-high'
        : cliente.nivel_riesgo === 'MEDIUM' ? 'riesgo-medium' : 'riesgo-low'

      // Get photo URL if available
      let photoHtml = '<span style="color: #999;">Sin foto</span>'
      if (cliente.foto_rostro_path) {
        try {
          const photoResult = await fileManager.getFileUrl('client-photos', cliente.foto_rostro_path)
          if (photoResult.success) {
            photoHtml = `<img src="${photoResult.url}" alt="Foto" style="width: 40px; height: 40px; object-fit: cover; border-radius: 50%;">`
          }
        } catch (err) {
          console.error('Error loading client photo:', err)
        }
      }

      row.innerHTML = `
        <td style="text-align: center;">${photoHtml}</td>
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
  render() // async call
}

// ──────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────────────────────────

/**
 * Handles uploading client photos and ID documents
 */
async function handleClientFileUploads(form, clientId) {
  const results = {
    fotoRostro: null,
    cedulaFrente: null,
    cedulaReverso: null
  }

  // Get file inputs
  const fotoRostroInput = form.querySelector('#upload-foto-rostro')
  const cedulaFrenteInput = form.querySelector('#upload-cedula-frente')
  const cedulaReversoInput = form.querySelector('#upload-cedula-reverso')

  // Upload face photo
  if (fotoRostroInput?.files[0]) {
    try {
      const result = await fileUploadManager.uploadClientPhoto(
        fotoRostroInput.files[0],
        clientId,
        store.getState().auth.user?.id
      )
      if (result.success) {
        results.fotoRostro = result.path
      }
    } catch (err) {
      console.error('Error uploading face photo:', err)
    }
  }

  // Upload ID front
  if (cedulaFrenteInput?.files[0]) {
    try {
      const result = await fileUploadManager.uploadClientIdDocument(
        cedulaFrenteInput.files[0],
        clientId,
        store.getState().auth.user?.id,
        'cedula-frente'
      )
      if (result.success) {
        results.cedulaFrente = result.path
      }
    } catch (err) {
      console.error('Error uploading ID front:', err)
    }
  }

  // Upload ID reverse
  if (cedulaReversoInput?.files[0]) {
    try {
      const result = await fileUploadManager.uploadClientIdDocument(
        cedulaReversoInput.files[0],
        clientId,
        store.getState().auth.user?.id,
        'cedula-reverso'
      )
      if (result.success) {
        results.cedulaReverso = result.path
      }
    } catch (err) {
      console.error('Error uploading ID reverse:', err)
    }
  }

  return results
}

/**
 * Clears photo previews when form is reset
 */
function clearPhotoPreviews(form) {
  const previews = form.querySelectorAll('.photo-preview')
  previews.forEach(preview => {
    preview.innerHTML = ''
    preview.classList.add('hidden')
  })
}

/**
 * Sets up photo preview handlers for file inputs
 */
function setupPhotoPreviews(form) {
  const fileInputs = [
    { inputId: '#upload-foto-rostro', previewId: '#preview-foto-rostro' },
    { inputId: '#upload-cedula-frente', previewId: '#preview-cedula-frente' },
    { inputId: '#upload-cedula-reverso', previewId: '#preview-cedula-reverso' }
  ]

  fileInputs.forEach(({ inputId, previewId }) => {
    const input = form.querySelector(inputId)
    const preview = form.querySelector(previewId)

    if (input && preview) {
      input.addEventListener('change', (e) => {
        const file = e.target.files[0]
        if (file) {
          showImagePreview(file, preview)
        } else {
          preview.innerHTML = ''
          preview.classList.add('hidden')
        }
      })
    }
  })
}

/**
 * Shows image preview in the specified element
 */
function showImagePreview(file, previewElement) {
  if (!file.type.startsWith('image/')) {
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    previewElement.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 150px; border-radius: 4px;">`
    previewElement.classList.remove('hidden')
  }
  reader.readAsDataURL(file)
}
