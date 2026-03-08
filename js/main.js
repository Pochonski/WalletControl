/**
 * main.js — Punto de entrada único de la aplicación.
 *
 * Orden de inicialización:
 *   1. Store Redux (estado global)
 *   2. appController (auth listener + navegación)
 *   3. loginController (formulario de login/registro)
 *
 * Regla: los controllers reciben el store como argumento,
 * nunca lo importan directamente.
 */

import { store } from './app/state/store.js'
import { initAppController } from './app/controllers/appController.js'
import { initLoginController } from './auth/ui/loginController.js'
import { initClientesController } from './clientes/ui/clientesController.js'
import { DOM_IDS } from './app/ui/domIds.js'
import { getEl } from './app/ui/domAdapter.js'

// Inicializar orquestadores principales
const appCtrl = initAppController(store)
initLoginController(store)

// Construir objeto DOM para inyectar dependencias UI
const domContext = {
  clientes: {
    section: getEl(DOM_IDS.VIEW_CLIENTES),
    form: getEl(DOM_IDS.CLIENTE_FORM),
    tabla: getEl(DOM_IDS.CLIENTES_LIST),
    inputBuscar: getEl(DOM_IDS.CLIENTES_SEARCH),
    btnNuevo: getEl(DOM_IDS.BTN_NUEVO_CLIENTE)
  }
}

// Inicializar controladores de dominio
initClientesController(domContext, store, appCtrl)
