/**
 * ActivosController - Gestión completa de activos
 *
 * Responsabilidades:
 * - Bind de eventos (crear, editar, buscar, archivar)
 * - Dispatch de acciones a Redux
 * - Render de lista de activos
 * - Validación y feedback de usuario
 */

import { ACTION_TYPES } from '../../app/state/actions.js'
import { showSuccess, showError } from '../../common/uiHelpers.js'
import { fileUploadManager } from '../../storage/fileUploadManager.js'
import { fileManager } from '../../storage/fileManager.js'

export const initActivosController = (dom, store) => {
  const activosSection = dom.activos
  if (!activosSection) {
    console.warn('[activosController] DOM activos section not found')
    return
  }

  const formulario = activosSection.form
  const lista = activosSection.list

  // ────────────────────────────────────────────────────────────────
  // 1. CARGAR activos al iniciar
  // ────────────────────────────────────────────────────────────────

  const cargarActivos = async () => {
    store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
    try {
      // TODO: Implement activos data adapter
      const activos = []
      store.dispatch({
        type: ACTION_TYPES.LOAD_ACTIVOS,
        payload: activos
      })
      showSuccess('Activos cargados')
    } catch (err) {
      console.error('[activosController] Error loading:', err)
      showError('Error al cargar activos: ' + err.message)
    } finally {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 2. CREAR nuevo activo
  // ────────────────────────────────────────────────────────────────

  if (formulario) {
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault()

      const formData = new FormData(formulario)
      const nuevoActivo = Object.fromEntries(formData)

      // Dispatch local (feedback inmediato)
      store.dispatch({
        type: ACTION_TYPES.ADD_ACTIVO,
        payload: nuevoActivo
      })

      try {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

        // Handle file uploads
        const uploadResults = await handleActivoFileUploads(formulario, nuevoActivo.id)

        // Add file paths to activo data
        if (uploadResults.photos && uploadResults.photos.length > 0) {
          nuevoActivo.fotos_paths = uploadResults.photos
        }

        // TODO: Save to database
        // const guardado = await activosDataAdapter.save(nuevoActivo)

        showSuccess('Activo creado exitosamente')
        formulario.reset()
        clearPhotoPreviews(formulario)
      } catch (err) {
        console.error('[activosController] Save error:', err)
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
  // 3. RENDER de lista
  // ────────────────────────────────────────────────────────────────

  const render = () => {
    const { activos } = store.getState()
    const { list } = activos

    if (!lista) return

    lista.innerHTML = ''

    if (list.length === 0) {
      lista.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #999;">
          No hay activos
        </div>
      `
      return
    }

    const fragment = document.createDocumentFragment()

    list.forEach(activo => {
      const item = document.createElement('div')
      item.className = 'activo-item'

      // Get first photo if available
      let photoHtml = '<span style="color: #999;">Sin foto</span>'
      if (activo.fotos_paths && activo.fotos_paths.length > 0) {
        // TODO: Get photo URL
        photoHtml = '<span style="color: #666;">Foto disponible</span>'
      }

      item.innerHTML = `
        <div class="activo-header">
          <h4>${activo.nombre}</h4>
          <span class="badge">${activo.categoria}</span>
        </div>
        <div class="activo-details">
          <p>Costo: $${activo.costo_compra}</p>
          <p>Fotos: ${photoHtml}</p>
        </div>
        <div class="activo-actions">
          <button class="btn-editar" data-id="${activo.id}">Editar</button>
        </div>
      `

      fragment.appendChild(item)
    })

    lista.appendChild(fragment)
  }

  // ────────────────────────────────────────────────────────────────
  // 4. SUSCRIBIR a cambios del estado
  // ────────────────────────────────────────────────────────────────

  store.subscribe((newState, previousState) => {
    // Re-render si cambió activos
    if (newState.activos !== previousState.activos) {
      render()
    }
  })

  // ────────────────────────────────────────────────────────────────
  // 5. RENDER INICIAL
  // ────────────────────────────────────────────────────────────────

  cargarActivos()
  render()
}

// ──────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────────────────────────

/**
 * Handles uploading activo photos
 */
async function handleActivoFileUploads(form, activoId) {
  const results = {
    photos: []
  }

  // Get file inputs
  const photosInput = form.querySelector('#upload-fotos-activo-input')

  // Upload photos
  if (photosInput?.files && photosInput.files.length > 0) {
    try {
      const result = await fileUploadManager.uploadAssetPhotos(
        Array.from(photosInput.files),
        activoId,
        store.getState().auth.user?.id
      )
      if (result.success) {
        results.photos = result.paths
      }
    } catch (err) {
      console.error('Error uploading photos:', err)
    }
  }

  return results
}

/**
 * Clears photo previews when form is reset
 */
function clearPhotoPreviews(form) {
  const previews = form.querySelectorAll('.photo-preview, .photo-gallery')
  previews.forEach(preview => {
    preview.innerHTML = ''
    if (preview.classList.contains('photo-preview')) {
      preview.classList.add('hidden')
    }
  })
}

/**
 * Sets up photo preview handlers for file inputs
 */
function setupPhotoPreviews(form) {
  const photosInput = form.querySelector('#upload-fotos-activo-input')
  const gallery = form.querySelector('#preview-fotos-activo')

  if (photosInput && gallery) {
    photosInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files)
      if (files.length > 0) {
        showMultipleImagePreviews(files, gallery)
      } else {
        gallery.innerHTML = ''
      }
    })
  }
}

/**
 * Shows multiple image previews in gallery
 */
function showMultipleImagePreviews(files, galleryElement) {
  galleryElement.innerHTML = ''

  files.forEach((file, index) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = document.createElement('img')
        img.src = e.target.result
        img.alt = `Preview ${index + 1}`
        img.style.width = '80px'
        img.style.height = '80px'
        img.style.objectFit = 'cover'
        img.style.borderRadius = '4px'
        img.style.margin = '4px'
        galleryElement.appendChild(img)
      }
      reader.readAsDataURL(file)
    }
  })
}
