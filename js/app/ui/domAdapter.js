import { DOM_IDS } from './domIds.js'
import { CSS_CLASSES } from './cssClasses.js'

/**
 * domAdapter — Centraliza TODA la manipulación del DOM.
 * Los controllers nunca usan document.getElementById directamente.
 * Fail-fast: lanza error descriptivo si el elemento no existe.
 */

/**
 * Obtiene un elemento por ID. Lanza error si no existe.
 * @param {string} id
 * @returns {HTMLElement}
 */
export function getEl(id) {
  const el = document.getElementById(id)
  if (!el) {
    throw new Error(`[domAdapter] Elemento no encontrado: #${id}`)
  }
  return el
}

/**
 * Obtiene un elemento por ID. Retorna null si no existe (no lanza error).
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function getElSafe(id) {
  return document.getElementById(id)
}

/**
 * Obtiene elementos por selector CSS.
 * @param {string} selector
 * @param {HTMLElement} [root=document]
 * @returns {NodeList}
 */
export function getEls(selector, root = document) {
  return root.querySelectorAll(selector)
}

/**
 * Muestra un elemento (remueve clase 'hidden').
 * @param {string} id
 */
export function show(id) {
  getEl(id).classList.remove(CSS_CLASSES.HIDDEN)
}

/**
 * Oculta un elemento (agrega clase 'hidden').
 * @param {string} id
 */
export function hide(id) {
  getEl(id).classList.add(CSS_CLASSES.HIDDEN)
}

/**
 * Muestra un elemento (opera sobre HTMLElement directamente).
 * @param {HTMLElement} el
 */
export function showEl(el) {
  el.classList.remove(CSS_CLASSES.HIDDEN)
}

/**
 * Oculta un elemento (opera sobre HTMLElement directamente).
 * @param {HTMLElement} el
 */
export function hideEl(el) {
  el.classList.add(CSS_CLASSES.HIDDEN)
}

/**
 * Alterna visibilidad según condición booleana.
 * @param {string} id
 * @param {boolean} visible
 */
export function toggle(id, visible) {
  visible ? show(id) : hide(id)
}

/**
 * Establece el texto (textContent) de un elemento.
 * @param {string} id
 * @param {string} text
 */
export function setText(id, text) {
  getEl(id).textContent = text
}

/**
 * Establece el HTML interno de un elemento.
 * ATENCIÓN: solo usar con contenido sanitizado o generado internamente.
 * @param {string} id
 * @param {string} html
 */
export function setHtml(id, html) {
  getEl(id).innerHTML = html
}

/**
 * Establece el HTML interno de un HTMLElement directamente.
 * @param {HTMLElement} el
 * @param {string} html
 */
export function setHtmlEl(el, html) {
  el.innerHTML = html
}

/**
 * Agrega HTML al final de un elemento.
 * @param {string} id
 * @param {string} html
 */
export function appendHtml(id, html) {
  getEl(id).insertAdjacentHTML('beforeend', html)
}

/**
 * Vacía el contenido de un elemento.
 * @param {string} id
 */
export function clear(id) {
  getEl(id).innerHTML = ''
}

/**
 * Establece el valor de un input/select/textarea.
 * @param {string} id
 * @param {string|number} value
 */
export function setValue(id, value) {
  getEl(id).value = value ?? ''
}

/**
 * Obtiene el valor de un input/select/textarea, con trim.
 * @param {string} id
 * @returns {string}
 */
export function getValue(id) {
  return getEl(id).value.trim()
}

/**
 * Agrega una clase CSS a un elemento.
 * @param {string} id
 * @param {string} cls
 */
export function addClass(id, cls) {
  getEl(id).classList.add(cls)
}

/**
 * Remueve una clase CSS de un elemento.
 * @param {string} id
 * @param {string} cls
 */
export function removeClass(id, cls) {
  getEl(id).classList.remove(cls)
}

/**
 * Alterna una clase CSS.
 * @param {string} id
 * @param {string} cls
 * @param {boolean} [force]
 */
export function toggleClass(id, cls, force) {
  getEl(id).classList.toggle(cls, force)
}

/**
 * Habilita un botón o input.
 * @param {string} id
 */
export function enable(id) {
  getEl(id).disabled = false
}

/**
 * Deshabilita un botón o input.
 * @param {string} id
 */
export function disable(id) {
  getEl(id).disabled = true
}

/**
 * Marca un botón como en estado loading.
 * @param {string} id
 */
export function setButtonLoading(id) {
  const el = getEl(id)
  el.disabled = true
  el.classList.add(CSS_CLASSES.LOADING)
}

/**
 * Remueve el estado loading de un botón.
 * @param {string} id
 */
export function clearButtonLoading(id) {
  const el = getEl(id)
  el.disabled = false
  el.classList.remove(CSS_CLASSES.LOADING)
}

/**
 * Crea un elemento HTML con atributos opcionales.
 * @param {string} tag
 * @param {object} [attrs={}]
 * @param {string} [innerHTML='']
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, innerHTML = '') {
  const el = document.createElement(tag)
  Object.entries(attrs).forEach(([key, val]) => {
    if (key === 'class') el.className = val
    else if (key === 'dataset') Object.entries(val).forEach(([k, v]) => (el.dataset[k] = v))
    else el.setAttribute(key, val)
  })
  if (innerHTML) el.innerHTML = innerHTML
  return el
}

/**
 * Muestra el overlay de carga global.
 */
export function showLoading() {
  show(DOM_IDS.LOADING_OVERLAY)
}

/**
 * Oculta el overlay de carga global.
 */
export function hideLoading() {
  hide(DOM_IDS.LOADING_OVERLAY)
}

/**
 * Muestra un mensaje de error en un elemento específico.
 * @param {string} errorId - ID del contenedor de error
 * @param {string} message
 */
export function showError(errorId, message) {
  const el = getEl(errorId)
  el.textContent = message
  el.classList.remove(CSS_CLASSES.HIDDEN)
}

/**
 * Oculta y limpia un mensaje de error.
 * @param {string} errorId
 */
export function clearError(errorId) {
  const el = getEl(errorId)
  el.textContent = ''
  el.classList.add(CSS_CLASSES.HIDDEN)
}

/**
 * Muestra un toast de notificación temporal.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 * @param {number} [duration=3000] ms
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = getEl(DOM_IDS.TOAST_CONTAINER)
  const toast = createElement('div', { class: `toast toast--${type}` }, message)
  container.appendChild(toast)
  setTimeout(() => toast.remove(), duration)
}
