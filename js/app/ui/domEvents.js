import { getEl, getElSafe } from './domAdapter.js'

/**
 * domEvents — Utilidades para binding/unbinding de eventos del DOM.
 * Los controllers usan estas funciones en lugar de addEventListener directamente.
 */

/**
 * Vincula un evento a un elemento por ID.
 * @param {string}   id
 * @param {string}   event  - Nombre del evento ('click', 'submit', 'input', etc.)
 * @param {function} handler
 * @param {AddEventListenerOptions} [options]
 */
export function bindEvent(id, event, handler, options) {
  getEl(id).addEventListener(event, handler, options)
}

/**
 * Vincula un evento a un elemento por ID (no lanza error si no existe).
 * @param {string}   id
 * @param {string}   event
 * @param {function} handler
 */
export function bindEventSafe(id, event, handler) {
  const el = getElSafe(id)
  if (el) el.addEventListener(event, handler)
}

/**
 * Vincula un evento directamente a un HTMLElement.
 * @param {HTMLElement} el
 * @param {string}      event
 * @param {function}    handler
 * @param {AddEventListenerOptions} [options]
 */
export function bindEventEl(el, event, handler, options) {
  el.addEventListener(event, handler, options)
}

/**
 * Desvincula un evento de un elemento por ID.
 * @param {string}   id
 * @param {string}   event
 * @param {function} handler
 */
export function unbindEvent(id, event, handler) {
  getEl(id).removeEventListener(event, handler)
}

/**
 * Desvincula un evento directamente de un HTMLElement.
 * @param {HTMLElement} el
 * @param {string}      event
 * @param {function}    handler
 */
export function unbindEventEl(el, event, handler) {
  el.removeEventListener(event, handler)
}

/**
 * Vincula un evento de forma delegada (event delegation).
 * Útil para listas dinámicas.
 *
 * @param {string}   parentId   - ID del contenedor padre estático
 * @param {string}   childSel   - Selector CSS del elemento hijo
 * @param {string}   event      - Evento ('click', etc.)
 * @param {function} handler    - Recibe (event, matchedElement)
 */
export function bindDelegated(parentId, childSel, event, handler) {
  getEl(parentId).addEventListener(event, (e) => {
    const target = e.target.closest(childSel)
    if (target) handler(e, target)
  })
}

/**
 * Vincula el evento 'input' para debounce (útil en búsquedas).
 * @param {string}   id
 * @param {function} handler
 * @param {number}   [delay=300] ms
 * @returns {function} cancelar — llama para eliminar el listener
 */
export function bindDebounced(id, handler, delay = 300) {
  let timer
  const listener = (e) => {
    clearTimeout(timer)
    timer = setTimeout(() => handler(e), delay)
  }
  const el = getEl(id)
  el.addEventListener('input', listener)
  return () => el.removeEventListener('input', listener)
}

/**
 * Vincula 'Enter' en un input para ejecutar un handler.
 * @param {string}   id
 * @param {function} handler
 */
export function bindEnterKey(id, handler) {
  getEl(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handler(e)
  })
}
