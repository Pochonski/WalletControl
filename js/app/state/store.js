import { reducer, initialState } from './reducer.js'

/**
 * Crea el store de Redux manual.
 * Patrón: getState() | dispatch(action) | subscribe(listener)
 *
 * @param {function} rootReducer - Función reductora pura
 * @param {object}   preloadedState - Estado inicial opcional
 * @returns {object} store
 */
function createStore(rootReducer, preloadedState = {}) {
  let state = { ...initialState, ...preloadedState }
  const listeners = new Set()

  function getState() {
    return state
  }

  function dispatch(action) {
    if (!action || typeof action.type !== 'string') {
      throw new Error(`[Store] Acción inválida: debe tener una propiedad "type" de tipo string. Recibido: ${JSON.stringify(action)}`)
    }

    const previousState = state
    state = rootReducer(state, action)

    // Solo notificar si el estado cambió (comparación por referencia)
    if (state !== previousState) {
      listeners.forEach(listener => listener(state, previousState))
    }

    return action
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('[Store] El listener debe ser una función.')
    }
    listeners.add(listener)

    // Retorna función para cancelar la suscripción
    return function unsubscribe() {
      listeners.delete(listener)
    }
  }

  // Despachar una acción inicial para poblar el estado con el reducer
  dispatch({ type: '@@INIT' })

  return Object.freeze({ getState, dispatch, subscribe })
}

export const store = createStore(reducer)
