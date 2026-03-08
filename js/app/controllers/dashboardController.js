/**
 * DashboardController - Gestión de la vista principal
 * 
 * Responsabilidades:
 * - Renderizar métricas generales
 * - Renderizar acciones rápidas
 */

import { DOM_IDS } from '../ui/domIds.js'
import { getEl } from '../ui/domAdapter.js'

export const initDashboardController = (store, appCtrl) => {
  const dashboardActions = getEl(DOM_IDS.DASHBOARD_QUICK_ACTIONS)

  const renderQuickActions = () => {
    if (!dashboardActions) return

    const actions = [
      { id: 'qa-nuevo-cliente', label: 'Nuevo Cliente', icon: '👤', view: 'cliente-form' },
      { id: 'qa-prestamos', label: 'Ver Préstamos', icon: '📄', view: 'prestamos' },
      { id: 'qa-nuevo-prestamo', label: 'Nuevo Préstamo', icon: '💰', view: 'prestamo-form' },
      { id: 'qa-reportes', label: 'Reportes', icon: '📊', view: 'reportes' }
    ]

    dashboardActions.innerHTML = actions.map(action => `
      <button id="${action.id}" class="quick-action-btn">
        <div class="quick-action-icon">${action.icon}</div>
        <span>${action.label}</span>
      </button>
    `).join('')

    // Bind events
    actions.forEach(action => {
      const btn = document.getElementById(action.id)
      if (btn) {
        btn.addEventListener('click', () => appCtrl.showView(action.view))
      }
    })
  }

  // Inicializar
  renderQuickActions()
}
