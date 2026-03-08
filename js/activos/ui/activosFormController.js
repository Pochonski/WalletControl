import { DOM_IDS } from '../../app/ui/domIds.js'
import { ACTION_TYPES } from '../../app/state/actions.js'
import { activosDataAdapter } from '../../adapters/dataAdapters/activosDataAdapter.js'
import { assetPhotosAdapter } from '../../adapters/fileAdapters/assetPhotosAdapter.js'
import { validateActivo } from '../../domain/activos/validate.js'
import { getEl, showError, clearError } from '../../app/ui/domAdapter.js'
import { bindEventEl } from '../../app/ui/domEvents.js'
import { showView } from '../../app/controllers/appController.js'

export const initActivosFormController = (store) => {
  const formEl = getEl(DOM_IDS.ACTIVO_FORM)
  // errorEl no se necesita cargar como objeto si usamos los metodos de error por ID
  const btnCancel = getEl(DOM_IDS.BTN_CANCEL_ACTIVO)
  const btnNuevo = getEl(DOM_IDS.BTN_NUEVO_ACTIVO)

  if (!formEl) return

  const photoInput = getEl(DOM_IDS.UPLOAD_FOTOS_ACTIVO)
  const photoPreview = getEl(DOM_IDS.PREVIEW_FOTOS_ACTIVO)

  // BIND: Photo preview
  if (photoInput && photoPreview) {
    bindEventEl(photoInput, 'change', () => {
      photoPreview.innerHTML = ''
      photoPreview.classList.remove('hidden')
      Array.from(photoInput.files).forEach(file => {
        const url = URL.createObjectURL(file)
        const img = document.createElement('img')
        img.src = url
        img.className = 'preview-thumb' // Asumiendo que existe o la definimos en styles
        img.style.cssText = `
          width: 80px; 
          height: 80px; 
          object-fit: cover; 
          border-radius: 8px; 
          border: 2px solid var(--color-border-light);
          box-shadow: var(--shadow-sm);
        `
        
        img.onload = () => URL.revokeObjectURL(url)
        photoPreview.appendChild(img)
      })
    })
  }

  // Abrir el formulario (cambiar de vista)
  if (btnNuevo) {
    bindEventEl(btnNuevo, 'click', () => {
      formEl.reset()
      if (photoPreview) photoPreview.innerHTML = ''
      clearError(DOM_IDS.ACTIVO_FORM_ERROR)
      showView('activo-form', store)
    })
  }

  // BIND: Cancelar formulario
  if (btnCancel) {
    bindEventEl(btnCancel, 'click', () => {
      formEl.reset()
      if (photoPreview) photoPreview.innerHTML = ''
      clearError(DOM_IDS.ACTIVO_FORM_ERROR)
      showView('activos', store)
    })
  }

  // BIND: Submit de nuevo activo
  bindEventEl(formEl, 'submit', async (e) => {
    e.preventDefault()

    const formData = new FormData(formEl)
    const data = Object.fromEntries(formData)

    // Ajustar numericos
    data.costo_compra = parseFloat(data.costo_compra)
    if (data.precio_venta_esperado) {
      data.precio_venta_esperado = parseFloat(data.precio_venta_esperado)
    }
    if (data.cantidad) {
      data.cantidad = parseInt(data.cantidad, 10)
    }

    // Validar en el dominio
    const { valid, errors } = validateActivo(data)
    if (!valid) {
      showError(DOM_IDS.ACTIVO_FORM_ERROR, errors.join('<br>'))
      return
    }

    // Ocultar errores previos
    clearError(DOM_IDS.ACTIVO_FORM_ERROR)
    store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

    try {
      // 1. Dispatch local (optimista)
      // Agregamos un ID temp para que la UI lo muestre inmediato
      const tempId = 'temp-' + Date.now()
      const nuevoActivoLocal = { ...data, id: tempId, estado: 'EN_INVENTARIO' }
      store.dispatch({
        type: ACTION_TYPES.ADD_ACTIVO,
        payload: nuevoActivoLocal
      })

      // 2. Transacción de red remota (Adapter real)
      const savedRemote = await activosDataAdapter.save(data)

      // 2.5 Subir fotos si existen
      const photoInput = getEl(DOM_IDS.UPLOAD_FOTOS_ACTIVO)
      if (photoInput && photoInput.files.length > 0) {
        const photoPaths = []
        for (let i = 0; i < photoInput.files.length; i++) {
          const file = photoInput.files[i]
          try {
            const result = await assetPhotosAdapter.upload(savedRemote.id, file, `foto_${i + 1}`)
            photoPaths.push(result.path)
          } catch (uploadErr) {
            console.error('Error uploading photo', uploadErr)
            // No detenemos el proceso si falla una foto, pero lo registramos
          }
        }
        
        // Si logramos subir fotos, actualizamos el registro
        if (photoPaths.length > 0) {
          await activosDataAdapter.update(savedRemote.id, { fotos_paths: photoPaths })
        }
      }

      // 3. Update en local (Sync Success)
      store.dispatch({
        type: ACTION_TYPES.SYNC_REMOTE_ID,
        payload: { localId: tempId, remoteId: savedRemote.id, entityType: 'activo' }
      })

      // 4. Feedback a UI
      store.dispatch({
        type: ACTION_TYPES.SHOW_TOAST,
        payload: { message: 'Activo guardado exitosamente', type: 'success' }
      })

      // Limpiar formulario y volver a la vista lista
      formEl.reset()
      if (photoPreview) photoPreview.innerHTML = ''
      showView('activos', store)

    } catch (err) {
      console.error('Error al guardar activo:', err)
      // Si falla, en una arquitectura madura guardaríamos en syncManager (marcar pending)
      store.dispatch({
        type: ACTION_TYPES.MARK_PENDING_SYNC,
        payload: {
          id: 'temp-' + Date.now(),
          entityType: 'activo',
          action: 'INSERT',
          payload: data
        }
      })
      
      store.dispatch({
        type: ACTION_TYPES.SHOW_TOAST,
        payload: { message: 'Guardado offline (sincronizando al volver internet)', type: 'info' }
      })
      
      // Aún así cerramos form porque fue un guardado optimista exitoso offline
      formEl.reset()
      if (photoPreview) photoPreview.innerHTML = ''
      showView('activos', store)

    } finally {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
    }
  })
}
