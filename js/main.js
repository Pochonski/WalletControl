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
import { initPrestamosController } from './prestamos/ui/prestamosController.js'
import { initDashboardController } from './app/controllers/dashboardController.js'
import { DOM_IDS } from './app/ui/domIds.js'
import { getEl } from './app/ui/domAdapter.js'

// Inicializar orquestador de vistas y autenticación
const appCtrl = initAppController(store)

// Inicializar vista de login
initLoginController(store, appCtrl)

// Recopilar elementos DOM para inicializar controladores de dominio
const domContext = {
  clientes: {
    section: getEl(DOM_IDS.VIEW_CLIENTES),
    form: getEl(DOM_IDS.CLIENTE_FORM),
    tabla: getEl(DOM_IDS.CLIENTES_LIST),
    inputBuscar: getEl(DOM_IDS.CLIENTES_SEARCH),
    btnNuevo: getEl(DOM_IDS.BTN_NUEVO_CLIENTE),
    detalle: getEl(DOM_IDS.VIEW_CLIENTE_DETAIL)
  },
  prestamos: {
    form: getEl(DOM_IDS.PRESTAMO_FORM),
    tabla: getEl(DOM_IDS.PRESTAMOS_LIST),
    selectCliente: getEl(DOM_IDS.PRESTAMO_CLIENTE_ID),
    btnNuevo: getEl(DOM_IDS.BTN_NUEVO_PRESTAMO)
  }
}

// Inicializar controladores de dominio
initClientesController(domContext, store, appCtrl)
initPrestamosController(domContext, store, appCtrl)
initDashboardController(store, appCtrl)
