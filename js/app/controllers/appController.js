import { DOM_IDS } from '../ui/domIds.js'
import { CSS_CLASSES } from '../ui/cssClasses.js'
import { getEl, getEls, show, hide, toggle, setText, showToast } from '../ui/domAdapter.js'
import { bindEvent, bindEventEl } from '../ui/domEvents.js'
import { ACTION_TYPES } from '../state/actions.js'
import { onAuthStateChange, logout } from '../../adapters/supabaseAuth.js'
import { initSessionManager, clearSession as clearSessionManager } from '../../adapters/sessionManager.js'
import * as auditLogger from '../../adapters/auditLogger.js'

/**
 * Vistas disponibles y su vista "padre" en el nav.
 * Las sub-vistas (detalle, form) activan el tab de su padre.
 */
const VIEW_NAV_MAP = Object.freeze({
  dashboard:         DOM_IDS.NAV_DASHBOARD,
  clientes:          DOM_IDS.NAV_CLIENTES,
  'cliente-detail':  DOM_IDS.NAV_CLIENTES,
  'cliente-form':    DOM_IDS.NAV_CLIENTES,
  prestamos:         DOM_IDS.NAV_PRESTAMOS,
  'prestamo-detail': DOM_IDS.NAV_PRESTAMOS,
  'prestamo-form':   DOM_IDS.NAV_PRESTAMOS,
  pagos:             DOM_IDS.NAV_CLIENTES,
  'pago-form':       DOM_IDS.NAV_CLIENTES,
  activos:           DOM_IDS.NAV_ACTIVOS,
  'activo-detail':   DOM_IDS.NAV_ACTIVOS,
  'activo-form':     DOM_IDS.NAV_ACTIVOS,
  cobranza:          DOM_IDS.NAV_COBRANZA,
  'cobranza-detail': DOM_IDS.NAV_COBRANZA,
  creditos:          DOM_IDS.NAV_CREDITOS,
  'acreedor-form':   DOM_IDS.NAV_CREDITOS,
  'credito-form':    DOM_IDS.NAV_CREDITOS,
  'credito-detail':  DOM_IDS.NAV_CREDITOS,
  'pago-credito-form': DOM_IDS.NAV_CREDITOS,
  reportes:          DOM_IDS.NAV_REPORTES,
})

const VIEW_ID_MAP = Object.freeze({
  dashboard:         DOM_IDS.VIEW_DASHBOARD,
  clientes:          DOM_IDS.VIEW_CLIENTES,
  'cliente-detail':  DOM_IDS.VIEW_CLIENTE_DETAIL,
  'cliente-form':    DOM_IDS.VIEW_CLIENTE_FORM,
  prestamos:         DOM_IDS.VIEW_PRESTAMOS,
  'prestamo-detail': DOM_IDS.VIEW_PRESTAMO_DETAIL,
  'prestamo-form':   DOM_IDS.VIEW_PRESTAMO_FORM,
  pagos:             DOM_IDS.VIEW_PAGOS,
  'pago-form':       DOM_IDS.VIEW_PAGO_FORM,
  activos:           DOM_IDS.VIEW_ACTIVOS,
  'activo-detail':   DOM_IDS.VIEW_ACTIVO_DETAIL,
  'activo-form':     DOM_IDS.VIEW_ACTIVO_FORM,
  cobranza:          DOM_IDS.VIEW_COBRANZA,
  'cobranza-detail': DOM_IDS.VIEW_COBRANZA_DETAIL,
  creditos:          DOM_IDS.VIEW_CREDITOS,
  'acreedor-form':   DOM_IDS.VIEW_ACREEDOR_FORM,
  'credito-form':    DOM_IDS.VIEW_CREDITO_FORM,
  'credito-detail':  DOM_IDS.VIEW_CREDITO_DETAIL,
  'pago-credito-form': DOM_IDS.VIEW_PAGO_CREDITO_FORM,
  reportes:          DOM_IDS.VIEW_REPORTES,
})

/**
 * appController — Orquestador principal de la SPA.
 * Gestiona: auth state → routing → navegación.
 *
 * @param {object} store - El store Redux
 */
export function initAppController(store) {
  let unsubscribeAuth = null
  let currentView = null

  // ── Auth state listener ────────────────────────────────────────────────
  unsubscribeAuth = onAuthStateChange(({ event, session }) => {
    const user = session?.user ?? null

    store.dispatch({
      type: ACTION_TYPES.SET_SESSION,
      payload: { user },
    })

    if (user) {
      _showAppShell()
      if (!currentView || currentView === 'login') {
        showView('dashboard', store)
      }
    } else {
      _showLoginView()
    }
  })

  // ── Logout ────────────────────────────────────────────────────────────
  bindEvent(DOM_IDS.BTN_LOGOUT, 'click', async () => {
    try {
      await logout()
      store.dispatch({ type: ACTION_TYPES.CLEAR_STATE })
      localStorage.clear()
      sessionStorage.clear()
      _showLoginView()
    } catch (err) {
      showToast('Error al cerrar sesión. Intenta de nuevo.', 'error')
    }
  })

  // ── Botón Back ────────────────────────────────────────────────────────
  bindEvent(DOM_IDS.BTN_BACK, 'click', () => {
    // Retroceder a la vista padre según el mapa
    const parent = _getParentView(currentView)
    if (parent) showView(parent, store)
  })

  // ── Navegación inferior ───────────────────────────────────────────────
  _bindNavigation(store)

  // Función interna expuesta via closure
  function showView(viewName, storeRef = store) {
    _showView(viewName, storeRef)
    currentView = viewName
  }

  return { showView }
}

/**
 * Muestra una vista por nombre, ocultando todas las demás.
 * Actualiza el tab activo en el nav.
 *
 * @param {string} viewName - Clave del VIEW_ID_MAP
 * @param {object} store
 */
export function showView(viewName, store) {
  const targetId = VIEW_ID_MAP[viewName]
  if (!targetId) {
    console.error(`[appController] Vista desconocida: ${viewName}`)
    return
  }

  // Ocultar todas las vistas
  Object.values(VIEW_ID_MAP).forEach(id => {
    const el = document.getElementById(id)
    if (el) {
      el.classList.remove(CSS_CLASSES.ACTIVE)
      el.classList.add(CSS_CLASSES.HIDDEN)
    }
  })

  // Mostrar la vista solicitada
  const targetEl = document.getElementById(targetId)
  if (targetEl) {
    targetEl.classList.add(CSS_CLASSES.ACTIVE)
    targetEl.classList.remove(CSS_CLASSES.HIDDEN)
  }

  // Actualizar nav activo
  _updateNavActive(viewName)

  // Mostrar/ocultar botón Back
  const isSubView = viewName.includes('-detail') || viewName.includes('-form')
  toggle(DOM_IDS.BTN_BACK, isSubView)

  // Actualizar título del header
  _updateHeaderTitle(viewName)

  // Dispatch a Redux
  store.dispatch({ type: ACTION_TYPES.SET_VIEW, payload: viewName })
}

// ── Internos ───────────────────────────────────────────────────────────────

function _showAppShell() {
  hide(DOM_IDS.VIEW_LOGIN)
  show(DOM_IDS.APP_SHELL)
}

function _showLoginView() {
  hide(DOM_IDS.APP_SHELL)
  show(DOM_IDS.VIEW_LOGIN)
}

function _bindNavigation(store) {
  const navItems = document.querySelectorAll(`#${DOM_IDS.BOTTOM_NAV} [data-view]`)
  navItems.forEach(btn => {
    bindEventEl(btn, 'click', () => {
      const viewName = btn.dataset.view
      showView(viewName, store)
    })
  })
}

function _updateNavActive(viewName) {
  // Remover active de todos los nav items
  const navItems = document.querySelectorAll(`#${DOM_IDS.BOTTOM_NAV} .${CSS_CLASSES.NAV_ITEM}`)
  navItems.forEach(el => el.classList.remove(CSS_CLASSES.ACTIVE))

  // Activar el correspondiente
  const activeNavId = VIEW_NAV_MAP[viewName]
  if (activeNavId) {
    const activeEl = document.getElementById(activeNavId)
    if (activeEl) activeEl.classList.add(CSS_CLASSES.ACTIVE)
  }
}

function _updateHeaderTitle(viewName) {
  const titles = {
    dashboard:         'Prestamistas',
    clientes:          'Clientes',
    'cliente-detail':  'Detalle cliente',
    'cliente-form':    'Nuevo cliente',
    prestamos:         'Préstamos',
    'prestamo-detail': 'Detalle préstamo',
    'prestamo-form':   'Nuevo préstamo',
    pagos:             'Pagos',
    'pago-form':       'Registrar pago',
    activos:           'Activos',
    'activo-detail':   'Detalle activo',
    'activo-form':     'Nuevo activo',
    cobranza:          'Cobranza',
    'cobranza-detail': 'Detalle cobranza',
    creditos:          'Créditos',
    'acreedor-form':   'Nuevo acreedor',
    'credito-form':    'Nuevo crédito',
    'credito-detail':  'Detalle crédito',
    'pago-credito-form': 'Registrar pago',
    reportes:          'Reportes',
  }
  setText(DOM_IDS.APP_TITLE, titles[viewName] ?? 'Prestamistas')
}

function _getParentView(viewName) {
  if (!viewName) return null
  if (viewName.includes('cliente')) return 'clientes'
  if (viewName.includes('prestamo')) return 'prestamos'
  if (viewName.includes('pago-credito')) return 'credito-detail'
  if (viewName.includes('pago')) return 'pagos'
  if (viewName.includes('activo')) return 'activos'
  if (viewName.includes('cobranza')) return 'cobranza'
  if (viewName === 'credito-detail') return 'creditos'
  if (viewName === 'acreedor-form') return 'creditos'
  if (viewName === 'credito-form') return 'creditos'
  return null
}

function _showView(viewName, store) {
  showView(viewName, store)
}
