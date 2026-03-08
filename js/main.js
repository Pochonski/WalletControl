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
import { initActivosFormController } from './activos/ui/activosFormController.js'
import { initActivosTableController } from './activos/ui/activosTableController.js'
import { initActivosDetailController } from './activos/ui/activosDetailController.js'
import { initActivosSearchAndMetricsController } from './activos/ui/activosSearchMetricsController.js'

// Inicializar controladores en orden
initAppController(store)
initLoginController(store)

// Inicializar Activos
initActivosFormController(store)
initActivosTableController(store)
initActivosDetailController(store)
initActivosSearchAndMetricsController(store)
