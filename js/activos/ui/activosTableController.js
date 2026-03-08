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

    if (!loaded) return

    if (list.length === 0) {
      tableContainer.innerHTML = '<div class="empty-state">No hay activos registrados.</div>'
      return
    }

    // Usar document fragment para optimizar inserciones al DOM
    const fragment = document.createDocumentFragment()
    list.forEach(activo => {
      // Ignorar los archivados si se quiere, o filtrarlos en render()
      if (activo.estado === 'DESCARTADO') return

      const card = document.createElement('div')
      card.className = 'card activo-card clickable'
      card.style.cursor = 'pointer'
      card.onclick = () => window.abrirDetalleActivo(activo.id)
      
      card.innerHTML = `
        <div class="activo-card-header">
          <h4>${activo.nombre}</h4>
          <span class="badge ${activo.estado ? activo.estado.toLowerCase() : ''}">${activo.estado ? activo.estado.replace('_', ' ') : 'No definido'}</span>
        </div>
        <div class="activo-card-body">
          <p><strong>Categoría:</strong> ${activo.categoria}</p>
          <p><strong>Costo:</strong> $${Number(activo.costo_compra).toFixed(2)}</p>
          <p><strong>Fecha Compra:</strong> ${new Date(activo.fecha_compra).toLocaleDateString()}</p>
          ${activo.proveedor ? `<p><strong>Proveedor:</strong> ${activo.proveedor}</p>` : ''}
        </div>
      `
      fragment.appendChild(card)
    })

    tableContainer.innerHTML = ''
    tableContainer.appendChild(fragment)
  }

  // Suscribirse a los cambios en el estado
  store.subscribe(() => {
    // Renderear solo si estamos en la vista de activos (optimización)
    const { currentView } = store.getState().ui
    if (currentView === 'activos' || currentView === 'activo-detail') {
      render()
    }
  })

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
