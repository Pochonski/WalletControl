import { DOM_IDS } from '../../app/ui/domIds.js'
import { ACTION_TYPES } from '../../app/state/actions.js'
import { getEl, showError, showSuccess } from '../../app/ui/domAdapter.js'
import { bindEventEl } from '../../app/ui/domEvents.js'
import { showView } from '../../app/controllers/appController.js'
import { supabaseClient } from '../../adapters/supabaseClient.js'
import { activosDataAdapter } from '../../adapters/dataAdapters/activosDataAdapter.js'

export const initActivosDetailController = (store) => {
  const detailContainer = getEl(DOM_IDS.VIEW_ACTIVO_DETAIL)
  
  if (!detailContainer) return

  // Suscribirse al estado, pero esto normalmente se renderiza cuando se le pasa un ID
  // En Redux o en la UI, necesitamos una forma de saber qué activo está seleccionado
  // Podemos escuchar un evento custom o usar el state.ui.currentViewParams (si existiera)
  // Como solución sencilla, expondremos una función para abrir el detalle
  
  // Función global para que la tabla pueda llamarla
  window.abrirDetalleActivo = async (id) => {
    const state = store.getState()
    const activo = state.activos.list.find(a => a.id === id)
    
    if (!activo) {
      showError(null, 'Activo no encontrado')
      return
    }

    // Preparar contenedor
    detailContainer.innerHTML = `
      <div class="view-toolbar">
        <span class="toolbar-title">Detalle del Activo</span>
        <div>
          <button id="btn-edit-activo" class="btn btn-secondary btn-sm">Editar</button>
          <button id="btn-archive-activo" class="btn btn-danger btn-sm">Archivar</button>
        </div>
      </div>
      
      <div class="card detail-card">
        <div class="detail-header">
          <h3>${activo.nombre}</h3>
          <span class="badge ${activo.estado.toLowerCase()}">${activo.estado.replace('_', ' ')}</span>
        </div>
        
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Categoría</span>
            <span class="detail-value">${activo.categoria}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Costo de compra</span>
            <span class="detail-value">$${Number(activo.costo_compra).toFixed(2)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Fecha compra</span>
            <span class="detail-value">${new Date(activo.fecha_compra).toLocaleDateString()}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Cantidad</span>
            <span class="detail-value">${activo.cantidad || 1}</span>
          </div>
          ${activo.precio_venta_esperado ? `
          <div class="detail-item">
            <span class="detail-label">Precio de venta est.</span>
            <span class="detail-value">$${Number(activo.precio_venta_esperado).toFixed(2)}</span>
          </div>` : ''}
          ${activo.proveedor ? `
          <div class="detail-item">
            <span class="detail-label">Proveedor</span>
            <span class="detail-value">${activo.proveedor}</span>
          </div>` : ''}
          ${activo.numero_serie ? `
          <div class="detail-item">
            <span class="detail-label">N/S</span>
            <span class="detail-value">${activo.numero_serie}</span>
          </div>` : ''}
        </div>
        
        ${activo.notas ? `
        <div class="detail-section">
          <h4>Notas</h4>
          <p>${activo.notas}</p>
        </div>` : ''}
        
        <div class="detail-section">
          <h4>Fotos</h4>
          <div id="activo-fotos-gallery" class="photo-gallery">
            ${activo.fotos_paths && activo.fotos_paths.length > 0 
              ? '<span class="loading-text">Cargando fotos...</span>' 
              : '<span class="empty-text">No hay fotos registradas.</span>'}
          </div>
        </div>
      </div>
    `

    // Mostrar la vista
    showView('activo-detail', store)

    // Cargar URLs firmadas de las fotos
    if (activo.fotos_paths && activo.fotos_paths.length > 0) {
      const gallery = document.getElementById('activo-fotos-gallery')
      try {
        const urls = await Promise.all(
          activo.fotos_paths.map(async path => {
            const { data, error } = await supabaseClient
              .storage
              .from('fotos')
              .createSignedUrl(path, 3600) // 1 hora
            if (error) throw error
            return data.signedUrl
          })
        )
        
        gallery.innerHTML = urls.map(url => `
          <img src="${url}" alt="Foto del activo" class="gallery-img" onclick="window.open('${url}', '_blank')" />
        `).join('')
      } catch (err) {
        gallery.innerHTML = '<span class="error-text">Error al cargar las imágenes.</span>'
        console.error('Error cargando fotos:', err)
      }
    }

    // Binds de botones del detalle
    const btnEdit = document.getElementById('btn-edit-activo')
    const btnArchive = document.getElementById('btn-archive-activo')

    if (btnEdit) {
      bindEventEl(btnEdit, 'click', () => {
        // Podríamos poblar el form y abrirlo aquí
        store.dispatch({
          type: ACTION_TYPES.SHOW_TOAST,
          payload: { message: 'Edición en construcción...', type: 'info' }
        })
      })
    }

    if (btnArchive) {
      bindEventEl(btnArchive, 'click', async () => {
        if (!confirm('¿Seguro que deseas archivar este activo?')) return
        
        try {
          // Optimista
          store.dispatch({
            type: ACTION_TYPES.ARCHIVE_ACTIVO,
            payload: id
          })
          
          showView('activos', store)

          // Remoto
          await activosDataAdapter.update(id, { estado: 'DESCARTADO' })
          
          store.dispatch({
            type: ACTION_TYPES.SHOW_TOAST,
            payload: { message: 'Activo archivado', type: 'success' }
          })
        } catch (err) {
          console.error('Error archivando', err)
          store.dispatch({
            type: ACTION_TYPES.SHOW_TOAST,
            payload: { message: 'Error al archivar. Se reintentará luego.', type: 'error' }
          })
        }
      })
    }
  }
}
