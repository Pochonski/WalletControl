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
import { initCobranzasListController } from './cobranzas/ui/cobranzasListController.js'
import { initCobranzaDetailController } from './cobranzas/ui/cobranzaDetailController.js'
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
  },
  cobranzas: {
    lista: getEl(DOM_IDS.COBRANZAS_LIST),
    filtros: getEl(DOM_IDS.COBRANZAS_FILTER_BAR),
    btnRefresh: getEl(DOM_IDS.COBRANZAS_BTN_REFRESH),
    searchInput: getEl(DOM_IDS.COBRANZAS_SEARCH)
  },
  'cobranza-detail': {
    info: getEl(DOM_IDS.COBRANZA_DETAIL_INFO),
    actions: getEl(DOM_IDS.COBRANZA_DETAIL_ACTIONS),
    actionsList: getEl(DOM_IDS.COBRANZA_ACTIONS_LIST),
    actionForm: getEl(DOM_IDS.COBRANZA_ACTION_FORM)
  }
}

// Inicializar controladores de dominio
initClientesController(domContext, store, appCtrl)
initCobranzasListController(domContext, store, appCtrl)
initCobranzaDetailController(domContext, store, appCtrl)
