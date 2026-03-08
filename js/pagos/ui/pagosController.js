/**
 * PagosController - Gestión completa de pagos
 *
 * Responsabilidades:
 * - Bind de eventos (crear pago, ver comprobantes)
 * - Dispatch de acciones a Redux
 * - Render de lista de pagos
 * - Validación y feedback de usuario
 */

import { ACTION_TYPES } from '../../app/state/actions.js'
import { showSuccess, showError } from '../../common/uiHelpers.js'
import { fileUploadManager } from '../../storage/fileUploadManager.js'
import { fileManager } from '../../storage/fileManager.js'

export const initPagosController = (dom, store) => {
  const pagosSection = dom.pagos
  if (!pagosSection) {
    console.warn('[pagosController] DOM pagos section not found')
    return
  }

  const formulario = pagosSection.form
  const lista = pagosSection.list

  // ────────────────────────────────────────────────────────────────
  // 1. CARGAR pagos al iniciar
  // ────────────────────────────────────────────────────────────────

  const cargarPagos = async () => {
    store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
    try {
      // TODO: Implement pagos data adapter
      const pagos = []
      store.dispatch({
        type: ACTION_TYPES.LOAD_PAGOS,
        payload: pagos
      })
      showSuccess('Pagos cargados')
    } catch (err) {
      console.error('[pagosController] Error loading:', err)
      showError('Error al cargar pagos: ' + err.message)
    } finally {
      store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 2. CREAR nuevo pago
  // ────────────────────────────────────────────────────────────────

  if (formulario) {
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault()

      const formData = new FormData(formulario)
      const nuevoPago = Object.fromEntries(formData)

      // Dispatch local (feedback inmediato)
      store.dispatch({
        type: ACTION_TYPES.ADD_PAGO,
        payload: nuevoPago
      })

      try {
        store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })

        // Handle file upload
        const uploadResults = await handlePagoFileUploads(formulario, nuevoPago.id)

        // Add file path to pago data
        if (uploadResults.voucher) {
          nuevoPago.comprobante_path = uploadResults.voucher
        }

        // TODO: Save to database
        // const guardado = await pagosDataAdapter.save(nuevoPago)

        showSuccess('Pago registrado exitosamente')
        formulario.reset()
        clearPhotoPreviews(formulario)
      } catch (err) {
        console.error('[pagosController] Save error:', err)
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
    const { pagos } = store.getState()
    const { list } = pagos

    if (!lista) return

    lista.innerHTML = ''

    if (list.length === 0) {
      lista.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #999;">
          No hay pagos registrados
        </div>
      `
      return
    }

    const fragment = document.createDocumentFragment()

    list.forEach(async (pago) => {
      const item = document.createElement('div')
      item.className = 'pago-item'

      // Get voucher status
      let voucherHtml = '<span style="color: #999;">Sin comprobante</span>'
      if (pago.comprobante_path) {
        voucherHtml = '<button class="btn-link view-voucher" data-path="' + pago.comprobante_path + '">Ver comprobante</button>'
      }

      item.innerHTML = `
        <div class="pago-header">
          <h4>$${pago.monto} - ${pago.metodo_pago}</h4>
          <span class="badge">${pago.estado}</span>
        </div>
        <div class="pago-details">
          <p>Fecha: ${pago.fecha_pago}</p>
          <p>Comprobante: ${voucherHtml}</p>
        </div>
      `

      // Add voucher view handler
      const viewBtn = item.querySelector('.view-voucher')
      if (viewBtn) {
        viewBtn.addEventListener('click', async (e) => {
          e.preventDefault()
          const path = e.target.dataset.path
          try {
            const result = await fileManager.getFileUrl('payment-vouchers', path)
            if (result.success) {
              window.open(result.url, '_blank')
            }
          } catch (err) {
            console.error('Error viewing voucher:', err)
          }
        })
      }

      fragment.appendChild(item)
    })

    lista.appendChild(fragment)
  }

  // ────────────────────────────────────────────────────────────────
  // 4. SUSCRIBIR a cambios del estado
  // ────────────────────────────────────────────────────────────────

  store.subscribe((newState, previousState) => {
    // Re-render si cambió pagos
    if (newState.pagos !== previousState.pagos) {
      render()
    }
  })

  // ────────────────────────────────────────────────────────────────
  // 5. RENDER INICIAL
  // ────────────────────────────────────────────────────────────────

  cargarPagos()
  render()
}

// ──────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────────────────────────

/**
 * Handles uploading pago voucher
 */
async function handlePagoFileUploads(form, pagoId) {
  const results = {
    voucher: null
  }

  // Get file input
  const voucherInput = form.querySelector('#upload-comprobante')

  // Upload voucher
  if (voucherInput?.files[0]) {
    try {
      const result = await fileUploadManager.uploadPaymentVoucher(
        voucherInput.files[0],
        pagoId,
        store.getState().auth.user?.id
      )
      if (result.success) {
        results.voucher = result.path
      }
    } catch (err) {
      console.error('Error uploading voucher:', err)
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
  const voucherInput = form.querySelector('#upload-comprobante')
  const preview = form.querySelector('#preview-comprobante')

  if (voucherInput && preview) {
    voucherInput.addEventListener('change', (e) => {
      const file = e.target.files[0]
      if (file) {
        if (file.type.startsWith('image/')) {
          showImagePreview(file, preview)
        } else {
          preview.innerHTML = `<span style="color: #666;">Archivo: ${file.name}</span>`
          preview.classList.remove('hidden')
        }
      } else {
        preview.innerHTML = ''
        preview.classList.add('hidden')
      }
    })
  }
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
