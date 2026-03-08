import { DOM_IDS } from '../../app/ui/domIds.js'
import { ACTION_TYPES } from '../../app/state/actions.js'
import { getEl } from '../../app/ui/domAdapter.js'
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
      store.dispatch({
        type: ACTION_TYPES.SHOW_TOAST,
        payload: { message: 'Activo no encontrado', type: 'error' }
      })
      return
    }

    // Preparar contenedor
    const costoFmt = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(activo.costo_compra)
    const precioFmt = activo.precio_venta_esperado ? new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(activo.precio_venta_esperado) : '—'
    const gananciaEstimada = activo.precio_venta_esperado ? activo.precio_venta_esperado - activo.costo_compra : 0
    const gananciaFmt = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(gananciaEstimada)

    detailContainer.innerHTML = `
      <div class="detail-header">
        <button class="btn-back-circle" id="btn-activo-detail-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <span class="detail-label">Detalle del Activo</span>
      </div>

      <div class="detail-profile">
        <div class="avatar-large" style="background: var(--color-surface-hover); color: var(--color-primary);">
           <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <h2 class="detail-name">${activo.nombre}</h2>
        <span class="badge ${activo.estado === 'DISPONIBLE' ? 'badge--success' : 'badge--primary'}">
          ${(activo.estado || 'INVENTARIO').replace('_', ' ')}
        </span>
      </div>

      <h3 class="detail-section-title">Resumen Financiero</h3>
      <div class="detail-grid">
        <div class="detail-card">
          <span class="detail-label">Costo de Inversión</span>
          <span class="detail-value" style="color: var(--color-primary); font-weight: 700;">${costoFmt}</span>
        </div>
        <div class="detail-card">
          <span class="detail-label">Precio Esperado</span>
          <span class="detail-value">${precioFmt}</span>
        </div>
        <div class="detail-card">
          <span class="detail-label">Ganancia Estimada</span>
          <span class="detail-value" style="color: var(--color-success); font-weight: 600;">${gananciaFmt}</span>
        </div>
        <div class="detail-card">
          <span class="detail-label">Categoría</span>
          <span class="detail-value">${activo.categoria.toLowerCase()}</span>
        </div>
      </div>

      <h3 class="detail-section-title">Información Técnica</h3>
      <div class="detail-list-card" style="margin: 0 16px; background: var(--color-surface); border-radius: 12px; padding: 16px; box-shadow: var(--shadow-sm);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span class="detail-label">Número de Serie</span>
          <span class="detail-value" style="font-size: 0.9rem;">${activo.numero_serie || 'N/A'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span class="detail-label">Proveedor</span>
          <span class="detail-value" style="font-size: 0.9rem;">${activo.proveedor || 'No especificado'}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span class="detail-label">Fecha de Compra</span>
          <span class="detail-value" style="font-size: 0.9rem;">${new Date(activo.fecha_compra).toLocaleDateString()}</span>
        </div>
      </div>

      ${activo.notas ? `
      <h3 class="detail-section-title">Notas y Observaciones</h3>
      <div style="margin: 0 16px; padding: 16px; background: var(--color-surface); border-radius: 12px; font-size: 0.9rem; line-height: 1.5; color: var(--color-text-light);">
        ${activo.notas}
      </div>` : ''}

      <h3 class="detail-section-title">Galería de Fotos</h3>
      <div id="activo-fotos-gallery" class="photo-gallery" style="margin: 0 16px; padding-bottom: 24px;">
        ${activo.fotos_paths && activo.fotos_paths.length > 0 
          ? '<div style="padding: 20px; text-align: center; opacity: 0.5;">Cargando imágenes...</div>' 
          : '<div style="padding: 20px; text-align: center; opacity: 0.5;">No hay fotos registradas</div>'}
      </div>

      <div class="detail-actions-bar" style="padding-bottom: 40px;">
        <button class="btn btn-secondary btn-full" id="btn-edit-activo">Editar Activo</button>
        <button class="btn btn-danger-ghost btn-full" id="btn-archive-activo" style="margin-top: 12px;">Archivar Activo</button>
      </div>
    `

    // Mostrar la vista
    showView('activo-detail', store)

    // Eventos de botones
    document.getElementById('btn-activo-detail-back').onclick = () => showView('activos', store)

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
