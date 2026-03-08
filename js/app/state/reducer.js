import { ACTION_TYPES } from './actions.js'

/**
 * Estado inicial de la aplicación.
 * Object.freeze hace inmutable el nivel raíz (shallow).
 */
export const initialState = Object.freeze({
  session: {
    user: null,
    isAuthenticated: false,
  },

  ui: {
    loading: false,
    error: null,
    currentView: 'login',
    toast: null,          // { message, type: 'success'|'error'|'warning'|'info' }
  },

  clientes: {
    list: [],             // [CLIENTE]
    loaded: false,
  },

  prestamos: {
    list: [],             // [PRESTAMO]
    loaded: false,
  },

  cuotas: {
    byPrestamoId: {},     // { [prestamoId]: [CUOTA] }
    loaded: false,
  },

  pagos: {
    list: [],             // [PAGO]
    loaded: false,
  },

  activos: {
    list: [],             // [ACTIVO]
    loaded: false,
  },

  cobranzas: {
    list: [],             // [COBRANZA]
    selectedId: null,     // ID de cobranza seleccionada
    detail: null,         // Detalle de cobranza actual
    actions: [],          // Acciones de cobranza
    loaded: false,
  },

  pendingSync: [],        // [{ id, entityType, entityId, action, payload, timestamp }]
})

/**
 * Reducer puro.
 * - Nunca muta el estado: usa spread operator.
 * - No tiene side effects ni accede al DOM.
 * - Validaciones vienen del domain/ ANTES de dispatch.
 *
 * @param {object} state  - Estado actual
 * @param {{ type: string, payload: any }} action
 * @returns {object}      - Nuevo estado
 */
export function reducer(state = initialState, action) {
  switch (action.type) {

    // ── Sesión ──────────────────────────────────────────────────────────
    case ACTION_TYPES.SET_SESSION:
      return {
        ...state,
        session: {
          user: action.payload.user,
          isAuthenticated: !!action.payload.user,
        },
      }

    case ACTION_TYPES.CLEAR_STATE:
      return { ...initialState }

    // ── UI ──────────────────────────────────────────────────────────────
    case ACTION_TYPES.SET_LOADING:
      return { ...state, ui: { ...state.ui, loading: action.payload } }

    case ACTION_TYPES.SET_ERROR:
      return { ...state, ui: { ...state.ui, error: action.payload } }

    case ACTION_TYPES.CLEAR_ERROR:
      return { ...state, ui: { ...state.ui, error: null } }

    case ACTION_TYPES.SET_VIEW:
      return { ...state, ui: { ...state.ui, currentView: action.payload } }

    case ACTION_TYPES.SHOW_TOAST:
      return { ...state, ui: { ...state.ui, toast: action.payload } }

    case ACTION_TYPES.CLEAR_TOAST:
      return { ...state, ui: { ...state.ui, toast: null } }

    // ── Clientes ─────────────────────────────────────────────────────────
    case ACTION_TYPES.LOAD_CLIENTES:
      return {
        ...state,
        clientes: { list: action.payload, loaded: true },
      }

    case ACTION_TYPES.ADD_CLIENTE:
      return {
        ...state,
        clientes: {
          ...state.clientes,
          list: [action.payload, ...state.clientes.list],
        },
      }

    case ACTION_TYPES.UPDATE_CLIENTE:
      return {
        ...state,
        clientes: {
          ...state.clientes,
          list: state.clientes.list.map(c =>
            c.id === action.payload.id ? { ...c, ...action.payload } : c
          ),
        },
      }

    case ACTION_TYPES.ARCHIVE_CLIENTE:
      return {
        ...state,
        clientes: {
          ...state.clientes,
          list: state.clientes.list.map(c =>
            c.id === action.payload
              ? { ...c, archivado: true, estado: 'ARCHIVADO' }
              : c
          ),
        },
      }

    // ── Préstamos ────────────────────────────────────────────────────────
    case ACTION_TYPES.LOAD_PRESTAMOS:
      return {
        ...state,
        prestamos: { list: action.payload, loaded: true },
      }

    case ACTION_TYPES.ADD_PRESTAMO:
      return {
        ...state,
        prestamos: {
          ...state.prestamos,
          list: [action.payload, ...state.prestamos.list],
        },
      }

    case ACTION_TYPES.UPDATE_PRESTAMO:
      return {
        ...state,
        prestamos: {
          ...state.prestamos,
          list: state.prestamos.list.map(p =>
            p.id === action.payload.id ? { ...p, ...action.payload } : p
          ),
        },
      }

    case ACTION_TYPES.ARCHIVE_PRESTAMO:
      return {
        ...state,
        prestamos: {
          ...state.prestamos,
          list: state.prestamos.list.map(p =>
            p.id === action.payload
              ? { ...p, estado: 'ARCHIVADO' }
              : p
          ),
        },
      }

    // ── Cuotas ───────────────────────────────────────────────────────────
    case ACTION_TYPES.LOAD_CUOTAS: {
      // payload: { prestamoId, cuotas: [CUOTA] }
      const { prestamoId, cuotas } = action.payload
      return {
        ...state,
        cuotas: {
          ...state.cuotas,
          byPrestamoId: {
            ...state.cuotas.byPrestamoId,
            [prestamoId]: cuotas,
          },
          loaded: true,
        },
      }
    }

    case ACTION_TYPES.UPDATE_CUOTA: {
      // payload: CUOTA actualizada
      const cuota = action.payload
      const existentes = state.cuotas.byPrestamoId[cuota.prestamo_id] ?? []
      return {
        ...state,
        cuotas: {
          ...state.cuotas,
          byPrestamoId: {
            ...state.cuotas.byPrestamoId,
            [cuota.prestamo_id]: existentes.map(c =>
              c.id === cuota.id ? { ...c, ...cuota } : c
            ),
          },
        },
      }
    }

    // ── Pagos ────────────────────────────────────────────────────────────
    case ACTION_TYPES.LOAD_PAGOS:
      return {
        ...state,
        pagos: { list: action.payload, loaded: true },
      }

    case ACTION_TYPES.ADD_PAGO:
      return {
        ...state,
        pagos: {
          ...state.pagos,
          list: [action.payload, ...state.pagos.list],
        },
      }

    // ── Activos ──────────────────────────────────────────────────────────
    case ACTION_TYPES.LOAD_ACTIVOS:
      return {
        ...state,
        activos: { list: action.payload, loaded: true },
      }

    case ACTION_TYPES.ADD_ACTIVO:
      return {
        ...state,
        activos: {
          ...state.activos,
          list: [action.payload, ...state.activos.list],
        },
      }

    case ACTION_TYPES.UPDATE_ACTIVO:
      return {
        ...state,
        activos: {
          ...state.activos,
          list: state.activos.list.map(a =>
            a.id === action.payload.id ? { ...a, ...action.payload } : a
          ),
        },
      }

    case ACTION_TYPES.ARCHIVE_ACTIVO:
      return {
        ...state,
        activos: {
          ...state.activos,
          list: state.activos.list.map(a =>
            a.id === action.payload
              ? { ...a, estado: 'DESCARTADO' }
              : a
          ),
        },
      }

    // ── Cobranzas ───────────────────────────────────────────────────────────
    case ACTION_TYPES.LOAD_COBRANZAS:
      return {
        ...state,
        cobranzas: {
          ...state.cobranzas,
          list: action.payload,
          loaded: true,
        },
      }

    case ACTION_TYPES.LOAD_COBRANZA_DETAIL:
      return {
        ...state,
        cobranzas: {
          ...state.cobranzas,
          detail: action.payload.collection,
          actions: action.payload.actions,
        },
      }

    case ACTION_TYPES.UPDATE_COBRANZA_DETAIL:
      return {
        ...state,
        cobranzas: {
          ...state.cobranzas,
          detail: action.payload,
          // Actualizar también en la lista si existe
          list: state.cobranzas.list.map(c =>
            c.id === action.payload.id || c.payment_id === action.payload.payment_id
              ? { ...c, ...action.payload }
              : c
          ),
        },
      }

    case ACTION_TYPES.UPDATE_COBRANZA_ACTIONS:
      return {
        ...state,
        cobranzas: {
          ...state.cobranzas,
          actions: action.payload,
        },
      }

    case ACTION_TYPES.SET_SELECTED_COBRANZA:
      return {
        ...state,
        cobranzas: {
          ...state.cobranzas,
          selectedId: action.payload,
        },
      }

    case ACTION_TYPES.UPDATE_COBRANZA_STATUS:
      return {
        ...state,
        cobranzas: {
          ...state.cobranzas,
          // Actualizar en la lista si existe
          list: state.cobranzas.list.map(c =>
            c.id === action.payload.id || c.payment_id === action.payload.payment_id
              ? { ...c, ...action.payload }
              : c
          ),
          // Actualizar detail si es la misma cobranza
          detail: state.cobranzas.detail?.id === action.payload.id ||
                  state.cobranzas.detail?.payment_id === action.payload.payment_id
            ? { ...state.cobranzas.detail, ...action.payload }
            : state.cobranzas.detail,
        },
      }

    // ── Sync ─────────────────────────────────────────────────────────────
    case ACTION_TYPES.MARK_PENDING_SYNC:
    case ACTION_TYPES.MARK_PENDING_SYNC:
      return {
        ...state,
        pendingSync: [...state.pendingSync, action.payload],
      }

    case ACTION_TYPES.SYNC_SUCCESS: {
      // payload: id del pending a eliminar
      return {
        ...state,
        pendingSync: state.pendingSync.filter(p => p.id !== action.payload),
      }
    }

    case ACTION_TYPES.SYNC_REMOTE_ID: {
      // payload: { localId, remoteId, entityType }
      // Actualiza el id local con el remoto en la entidad correspondiente
      const { localId, remoteId, entityType } = action.payload
      const listKey = entityType === 'cliente' ? 'clientes'
        : entityType === 'prestamo' ? 'prestamos'
        : entityType === 'pago' ? 'pagos'
        : entityType === 'activo' ? 'activos'
        : null

      if (!listKey) return state

      return {
        ...state,
        [listKey]: {
          ...state[listKey],
          list: state[listKey].list.map(item =>
            item.id === localId ? { ...item, id: remoteId } : item
          ),
        },
      }
    }

    default:
      return state
  }
}
