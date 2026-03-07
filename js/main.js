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

// Inicializar controladores en orden
initAppController(store)
initLoginController(store)
