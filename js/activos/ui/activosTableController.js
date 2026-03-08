import { DOM_IDS } from '../../app/ui/domIds.js'
import { ACTION_TYPES } from '../../app/state/actions.js'
import { getEl } from '../../app/ui/domAdapter.js'
import { activosDataAdapter } from '../../adapters/dataAdapters/activosDataAdapter.js'

export const initActivosTableController = (store) => {
  const tableContainer = getEl(DOM_IDS.ACTIVOS_LIST)

  if (!tableContainer) return

  // Render function triggered by Redux changes
  const render = () => {
    const state = store.getState()
    const { list, loaded } = state.activos
    const searchInput = document.getElementById(DOM_IDS.ACTIVOS_SEARCH)
    const termino = searchInput ? searchInput.value.toLowerCase().trim() : ''

    if (!loaded) return

    // Filtrar por término y estado
    const filteredList = list.filter(activo => {
      if (activo.estado === 'DESCARTADO') return false
      if (!termino) return true
      return activo.nombre.toLowerCase().includes(termino) || 
             activo.categoria.toLowerCase().includes(termino)
    })

    if (filteredList.length === 0) {
      tableContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--color-text-light);">
          <div style="font-size: 3rem; margin-bottom: 10px; opacity: 0.3;">📦</div>
          <p>${termino ? `No se encontraron activos para "${termino}"` : 'No hay activos registrados'}</p>
        </div>
      `
      return
    }

    const fragment = document.createDocumentFragment()
    
    // Diccionario de iconos por categoría
    const icons = {
      'ELECTRONICA': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg>',
      'VEHICULOS': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
      'JOYERIA': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l3 12 3-12-3-6z"/><path d="M2 9h20"/></svg>',
      'MAQUINARIA': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>',
      'INMUEBLES': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      'OTRO': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    }

    filteredList.forEach(activo => {
      const card = document.createElement('div')
      card.className = 'card'
      card.dataset.id = activo.id
      
      const categoryIcon = icons[activo.categoria] || icons['OTRO']
      const costoFmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(activo.costo_compra)
      
      card.innerHTML = `
        <div class="card-avatar" style="background: var(--color-surface-hover); color: var(--color-primary);">
          ${categoryIcon}
        </div>
        <div class="card-body">
          <div class="card-title">${activo.nombre}</div>
          <div class="card-subtitle">${costoFmt}</div>
          <div class="card-meta">
             <span class="card-subtitle" style="font-size: 0.75rem;">
               ${activo.categoria.toLowerCase()} ${activo.numero_serie ? `• SN: ${activo.numero_serie}` : ''}
             </span>
          </div>
        </div>
        <div class="card-right">
          <span class="badge ${activo.estado === 'DISPONIBLE' ? 'badge--success' : 'badge--primary'}">
            ${(activo.estado || 'INVENTARIO').replace('_', ' ')}
          </span>
          <div style="display: flex; gap: 8px; margin-top: auto;">
             <button class="btn-icon btn-archive" title="Archivar" style="color: var(--color-text-lighter);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
             </button>
          </div>
        </div>
      `

      // Click en la tarjeta muestra detalle
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-archive')) {
          window.abrirDetalleActivo(activo.id)
        }
      })

      // Botón Archivar
      const btnArchive = card.querySelector('.btn-archive')
      if (btnArchive) {
        btnArchive.onclick = async (e) => {
          e.stopPropagation()
          if (confirm('¿Seguro que deseas archivar este activo?')) {
            try {
              store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true })
              await activosDataAdapter.update(activo.id, { estado: 'DESCARTADO' })
              store.dispatch({ type: ACTION_TYPES.ARCHIVE_ACTIVO, payload: activo.id })
            } catch (err) {
              console.error('Error archivando', err)
            } finally {
              store.dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false })
            }
          }
        }
      }

      fragment.appendChild(card)
    })

    tableContainer.innerHTML = ''
    tableContainer.appendChild(fragment)
  }

  // Suscribirse a los cambios en el estado
  store.subscribe((newState, oldState) => {
    // Renderear si cambió activos o vista actual
    if (newState.activos !== oldState.activos || newState.ui.currentView === 'activos') {
      render()
    }
  })

  // Escuchar búsqueda directamente aquí para reactividad local inmediata si se prefiere,
  // aunque el subscribe ya lo maneja si el input gatilla un re-render o si usamos input listener.
  const searchInput = document.getElementById(DOM_IDS.ACTIVOS_SEARCH)
  if (searchInput) {
    searchInput.addEventListener('input', () => render())
  }

  // Función asíncrona para cargar la data inicial
  const loadInitialData = async () => {
    try {
      const data = await activosDataAdapter.load()
      store.dispatch({
        type: ACTION_TYPES.LOAD_ACTIVOS,
        payload: data
      })
    } catch (err) {
      console.error('Error cargando activos:', err)
      store.dispatch({
        type: ACTION_TYPES.SHOW_TOAST,
        payload: { message: 'Error cargando los activos', type: 'error' }
      })
    }
  }

  // Disparar carga inicial y renderizado inicial
  const state = store.getState()
  if (state.session.isAuthenticated) {
    loadInitialData()
  }

  // En caso haya login posterior, es bueno tener un subscribe del state de Auth
  // para cargar los datos en cuanto exista sesión. En una arquitectura robusta
  // esto puede ser manejado por un initController global tras loginSuccess.
  let wasAuthenticated = state.session.isAuthenticated;
  store.subscribe(() => {
    const isAuth = store.getState().session.isAuthenticated;
    if (isAuth && !wasAuthenticated) {
      wasAuthenticated = true;
      loadInitialData()
    } else if (!isAuth && wasAuthenticated) {
      wasAuthenticated = false;
    }
  })
}
