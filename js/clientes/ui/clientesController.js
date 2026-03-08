/**
 * ClientesController - Gestión completa de clientes
 *
 * Responsabilidades:
 * - Bind de eventos (crear, editar, buscar, eliminar)
 * - Dispatch de acciones a Redux
 * - Render de tarjetas de clientes
 * - Validación y feedback de usuario
 * - Gestión de subida de fotos y documentos
 */

import { ACTION_TYPES } from '../../app/state/actions.js'
import { clientesDataAdapter } from '../../adapters/dataAdapters/clientesDataAdapter.js'
import { showSuccess, showError } from '../../common/uiHelpers.js'
import { fileUploadManager } from '../../storage/fileUploadManager.js'
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

  // ID del cliente que se está editando (null = modo creación)
  let clienteEditandoId = null

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
  // 2. CREAR / EDITAR cliente
  // ────────────────────────────────────────────────────────────────

  if (formulario) {
    // Actualizar título del botón según modo
    const btnSubmit = document.getElementById('btn-submit-cliente')

    // Configurar previsualización de fotos
    setupPhotoPreviews(formulario)

    formulario.addEventListener('submit', async (e) => {
      e.preventDefault()

      const formData = new FormData(formulario)
      const datos = Object.fromEntries(formData)

      try {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

        if (clienteEditandoId) {
          // MODO EDICIÓN
          // 1. Subir archivos si hay nuevos
          const uploadResults = await handleClientFileUploads(formulario, clienteEditandoId, store)
          if (uploadResults.fotoRostro) datos.foto_rostro_path = uploadResults.fotoRostro
          if (uploadResults.cedulaFrente) datos.cedula_frente_path = uploadResults.cedulaFrente
          if (uploadResults.cedulaReverso) datos.cedula_reverso_path = uploadResults.cedulaReverso

          // 2. Actualizar en BD
          const actualizado = await clientesDataAdapter.update(clienteEditandoId, datos)
          store.dispatch({ type: ACTION_TYPES.UPDATE_CLIENTE, payload: actualizado })
          showSuccess('Cliente actualizado exitosamente')
        } else {
          // MODO CREACIÓN
          // 1. Guardar primero para tener el ID (o usar temp ID si el adapter lo maneja)
          const guardado = await clientesDataAdapter.save(datos)
          
          // 2. Subir archivos usando el ID real
          const uploadResults = await handleClientFileUploads(formulario, guardado.id, store)
          if (uploadResults.fotoRostro || uploadResults.cedulaFrente || uploadResults.cedulaReverso) {
            // Actualizar el cliente con las rutas de archivos
            const conArchivos = await clientesDataAdapter.update(guardado.id, {
              foto_rostro_path: uploadResults.fotoRostro || guardado.foto_rostro_path,
              cedula_frente_path: uploadResults.cedulaFrente || guardado.cedula_frente_path,
              cedula_reverso_path: uploadResults.cedulaReverso || guardado.cedula_reverso_path
            })
            store.dispatch({ type: ACTION_TYPES.ADD_CLIENTE, payload: conArchivos })
          } else {
            store.dispatch({ type: ACTION_TYPES.ADD_CLIENTE, payload: guardado })
          }
          
          showSuccess('Cliente creado exitosamente')
        }

        clienteEditandoId = null
        formulario.reset()
        clearPhotoPreviews(formulario)
        if (btnSubmit) btnSubmit.textContent = 'Guardar cliente'
        appCtrl.showView('clientes')
      } catch (err) {
        console.error('[clientesController] Save error:', err)
        // Dar un mensaje amigable para cédulas duplicadas
        const isDuplicate =
          err.code === '23505' ||
          err.message?.toLowerCase().includes('duplicate') ||
          err.message?.toLowerCase().includes('unique')
        const mensaje = isDuplicate
          ? 'Ya existe un cliente registrado con esa cédula.'
          : 'Error: ' + err.message
        showError(mensaje)
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
      // Asegurarse de limpiar el modo edición
      clienteEditandoId = null
      const btnSubmit = document.getElementById('btn-submit-cliente')
      if (btnSubmit) btnSubmit.textContent = 'Guardar cliente'
      if (formulario) {
        formulario.reset()
        clearPhotoPreviews(formulario)
      }
      appCtrl.showView('cliente-form')
    })
  }

  // ────────────────────────────────────────────────────────────────
  // 5. EDITAR cliente — pre-llena el formulario
  // ────────────────────────────────────────────────────────────────

  const editarCliente = (cliente) => {
    clienteEditandoId = cliente.id

    // Pre-llenar todos los campos del formulario
    const setVal = (id, val) => {
      const el = document.getElementById(id)
      if (el && val !== null && val !== undefined) el.value = val
    }

    setVal('cliente-nombre', cliente.nombre)
    setVal('cliente-cedula', cliente.cedula)
    setVal('cliente-telefono', cliente.telefono)
    setVal('cliente-email', cliente.email)
    setVal('cliente-direccion', cliente.direccion)
    setVal('cliente-nacimiento', cliente.fecha_nacimiento)
    setVal('cliente-riesgo', cliente.nivel_riesgo)
    setVal('cliente-notas', cliente.notas)
    setVal('cliente-contacto-emergencia', cliente.contacto_emergencia)
    setVal('cliente-telefono-emergencia', cliente.telefono_emergencia)

    // Actualizar texto del botón de submit
    const btnSubmit = document.getElementById('btn-submit-cliente')
    if (btnSubmit) btnSubmit.textContent = 'Actualizar cliente'

    // Limpiar previews viejos al editar (opcional: cargar los actuales si existen)
    if (formulario) clearPhotoPreviews(formulario)

    // Navegar al formulario
    appCtrl.showView('cliente-form')
  }

  // ────────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────
  // 6. DETALLE de cliente
  // ────────────────────────────────────────────────────────────────

  const renderClienteDetail = async (cliente) => {
    const detailContainer = dom.clientes.detalle
    if (!detailContainer) return

    const riesgoClass = cliente.nivel_riesgo === 'ALTO' ? 'badge--danger'
      : cliente.nivel_riesgo === 'MEDIO' ? 'badge--warning' : 'badge--success'

    // Iniciales
    const iniciales = (cliente.nombre || '??')
      .split(' ')
      .filter(n => n)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)

    // Foto
    let photoHtml = `<div class="avatar-large">${iniciales}</div>`
    if (cliente.foto_rostro_path) {
      try {
        const photoResult = await fileManager.getFileUrl('client-photos', cliente.foto_rostro_path)
        if (photoResult.success) {
          photoHtml = `<div class="avatar-large"><img src="${photoResult.url}" alt="${cliente.nombre}"></div>`
        }
      } catch (err) {
        console.warn('Error loading detail photo:', err)
      }
    }

    detailContainer.innerHTML = `
      <div class="detail-header">
        <button class="btn-back-circle" id="btn-detail-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <span class="detail-label">Información del Cliente</span>
      </div>

      <div class="detail-profile">
        ${photoHtml}
        <h2 class="detail-name">${cliente.nombre}</h2>
        <span class="badge ${riesgoClass}">${cliente.nivel_riesgo || 'BAJO'}</span>
      </div>

      <h3 class="detail-section-title">Datos Principales</h3>
      <div class="detail-grid">
        <div class="detail-card">
          <span class="detail-label">Cédula / Documento</span>
          <span class="detail-value">${cliente.cedula || 'No registrada'}</span>
        </div>
        <div class="detail-card">
          <span class="detail-label">Teléfono</span>
          <span class="detail-value">${cliente.telefono || 'No registrado'}</span>
        </div>
        <div class="detail-card">
          <span class="detail-label">Email</span>
          <span class="detail-value">${cliente.email || 'No registrado'}</span>
        </div>
        <div class="detail-card">
          <span class="detail-label">Fecha de Nacimiento</span>
          <span class="detail-value">${cliente.fecha_nacimiento || 'No registrada'}</span>
        </div>
      </div>

      <h3 class="detail-section-title">Ubicación y Contacto</h3>
      <div class="detail-grid">
        <div class="detail-card" style="grid-column: 1 / -1;">
          <span class="detail-label">Dirección</span>
          <span class="detail-value">${cliente.direccion || 'No registrada'}</span>
        </div>
        <div class="detail-card">
          <span class="detail-label">Contacto de Emergencia</span>
          <span class="detail-value">${cliente.contacto_emergencia || 'No registrado'}</span>
        </div>
        <div class="detail-card">
          <span class="detail-label">Teléfono de Emergencia</span>
          <span class="detail-value">${cliente.telefono_emergencia || 'No registrado'}</span>
        </div>
      </div>

      <h3 class="detail-section-title">Información Adicional</h3>
      <div class="detail-grid" style="padding-bottom: 120px;">
        <div class="detail-card" style="grid-column: 1 / -1;">
          <span class="detail-label">Notas Internas</span>
          <span class="detail-value">${cliente.notas || 'Sin observaciones'}</span>
        </div>
      </div>

      <div class="detail-actions-bar">
        <button class="btn btn-primary" id="btn-detail-prestamos">Ver Préstamos</button>
        <button class="btn btn-secondary" id="btn-detail-editar">Editar perfil</button>
        <button class="btn btn-danger" id="btn-detail-eliminar" style="flex: 0.5;">×</button>
      </div>

      ${cliente.telefono ? `
      <div class="contact-fabs">
        <a href="https://wa.me/${cliente.telefono.replace(/\D/g, '')}" target="_blank" rel="noopener" class="contact-fab contact-fab--wa" id="btn-detail-whatsapp" title="WhatsApp">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
          </svg>
        </a>
        <a href="tel:${cliente.telefono}" class="contact-fab contact-fab--call" id="btn-detail-llamar" title="Llamar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.13 12 19.79 19.79 0 0 1 1.06 3.4 2 2 0 0 1 3.04 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </a>
      </div>
      ` : ''}
    `

    // Eventos
    detailContainer.querySelector('#btn-detail-back').onclick = () => appCtrl.showView('clientes')
    
    detailContainer.querySelector('#btn-detail-prestamos').onclick = () => {
      appCtrl.showView('prestamos')
    }

    detailContainer.querySelector('#btn-detail-editar').onclick = () => {
      editarCliente(cliente)
    }

    const btnEliminar = detailContainer.querySelector('#btn-detail-eliminar')
    if (btnEliminar) {
      btnEliminar.addEventListener('click', async () => {
        console.log('[clientesController] Deleting from detail view, ID:', cliente.id)
        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${cliente.nombre}"? Esta acción no se puede deshacer.`)) {
          try {
            store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
            const res = await clientesDataAdapter.delete(cliente.id)
            console.log('[clientesController] Delete SUCCESS in adapter:', res)
            
            store.dispatch({ type: ACTION_TYPES.DELETE_CLIENTE, payload: cliente.id })
            showSuccess('Cliente eliminado correctamente')
            appCtrl.showView('clientes')
          } catch (err) {
            console.error('[clientesController] Delete ERROR in detail view:', err)
            showError('Error: ' + err.message)
          } finally {
            store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
          }
        }
      })
    }

    appCtrl.showView('cliente-detail')
  }

  // ────────────────────────────────────────────────────────────────
  // 7. RENDER de tarjetas

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
             <button class="btn-icon btn-eliminar" title="Eliminar" style="color: var(--color-danger);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
             </button>
          </div>
        </div>
      `

      // Botón Editar
      card.querySelector('.btn-editar').addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        editarCliente(cliente)
      })

      // Botón Eliminar
      const btnEliminarList = card.querySelector('.btn-eliminar')
      if (btnEliminarList) {
        btnEliminarList.addEventListener('click', async (e) => {
          e.preventDefault()
          e.stopPropagation()
          console.log('[clientesController] Deleting from list card, ID:', cliente.id)
          
          if (confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${cliente.nombre}"?`)) {
            try {
              store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
              const res = await clientesDataAdapter.delete(cliente.id)
              console.log('[clientesController] Delete SUCCESS in adapter:', res)
              
              store.dispatch({ type: ACTION_TYPES.DELETE_CLIENTE, payload: cliente.id })
              showSuccess('Cliente eliminado correctamente')
            } catch (err) {
              console.error('[clientesController] Delete ERROR in list view:', err)
              showError('Error al eliminar: ' + err.message)
            } finally {
              store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
            }
          }
        })
      }

      card.addEventListener('click', () => {
        renderClienteDetail(cliente)
      })

      fragment.appendChild(card)
    }

    tabla.appendChild(fragment)
  }

  // ────────────────────────────────────────────────────────────────
  // 8. SUSCRIBIR a cambios del estado

  // ────────────────────────────────────────────────────────────────

  store.subscribe((newState, previousState) => {
    // Re-render si cambió clientes
    if (newState.clientes !== previousState.clientes) {
      render()
    }
  })

  // ────────────────────────────────────────────────────────────────
  // 9. RENDER INICIAL

  // ────────────────────────────────────────────────────────────────

  cargarClientes()
  render()
}

// ──────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────────────────────────

/**
 * Handles uploading client photos and ID documents
 */
async function handleClientFileUploads(form, clientId, store) {
  const results = {
    fotoRostro: null,
    cedulaFrente: null,
    cedulaReverso: null
  }

  // Get file inputs
  const fotoRostroInput = form.querySelector('#upload-foto-rostro')
  const cedulaFrenteInput = form.querySelector('#upload-cedula-frente')
  const cedulaReversoInput = form.querySelector('#upload-cedula-reverso')

  const authUser = store.getState().session.user

  // Upload face photo
  if (fotoRostroInput?.files[0]) {
    try {
      const result = await fileUploadManager.uploadClientPhoto(
        fotoRostroInput.files[0],
        clientId,
        authUser?.id
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
        authUser?.id,
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
        authUser?.id,
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
