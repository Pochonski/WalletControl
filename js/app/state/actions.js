/**
 * ACTION_TYPES — Todas las acciones posibles del store.
 * Regla: un string único por acción, formato DOMINIO/VERBO.
 * Object.freeze garantiza inmutabilidad en runtime.
 */
export const ACTION_TYPES = Object.freeze({
  // ── Sesión ──────────────────────────────────────────────────────────────
  SET_SESSION:          'SESSION/SET',
  CLEAR_STATE:          'SESSION/CLEAR',

  // ── UI ──────────────────────────────────────────────────────────────────
  SET_LOADING:          'UI/SET_LOADING',
  SET_ERROR:            'UI/SET_ERROR',
  CLEAR_ERROR:          'UI/CLEAR_ERROR',
  SET_VIEW:             'UI/SET_VIEW',
  SHOW_TOAST:           'UI/SHOW_TOAST',
  CLEAR_TOAST:          'UI/CLEAR_TOAST',

  // ── Clientes ─────────────────────────────────────────────────────────────
  LOAD_CLIENTES:        'CLIENTES/LOAD',
  ADD_CLIENTE:          'CLIENTES/ADD',
  UPDATE_CLIENTE:       'CLIENTES/UPDATE',
  ARCHIVE_CLIENTE:      'CLIENTES/ARCHIVE',

  // ── Préstamos ────────────────────────────────────────────────────────────
  LOAD_PRESTAMOS:       'PRESTAMOS/LOAD',
  ADD_PRESTAMO:         'PRESTAMOS/ADD',
  UPDATE_PRESTAMO:      'PRESTAMOS/UPDATE',
  ARCHIVE_PRESTAMO:     'PRESTAMOS/ARCHIVE',

  // ── Cuotas ───────────────────────────────────────────────────────────────
  LOAD_CUOTAS:          'CUOTAS/LOAD',
  UPDATE_CUOTA:         'CUOTAS/UPDATE',

  // ── Pagos ────────────────────────────────────────────────────────────────
  LOAD_PAGOS:           'PAGOS/LOAD',
  ADD_PAGO:             'PAGOS/ADD',

  // ── Activos ──────────────────────────────────────────────────────────────
  LOAD_ACTIVOS:         'ACTIVOS/LOAD',
  ADD_ACTIVO:           'ACTIVOS/ADD',
  UPDATE_ACTIVO:        'ACTIVOS/UPDATE',
  ARCHIVE_ACTIVO:       'ACTIVOS/ARCHIVE',

  // ── Cobranzas ────────────────────────────────────────────────────────────
  LOAD_COBRANZAS:       'COBRANZAS/LOAD',
  LOAD_COBRANZA_DETAIL: 'COBRANZAS/LOAD_DETAIL',
  UPDATE_COBRANZA_DETAIL: 'COBRANZAS/UPDATE_DETAIL',
  UPDATE_COBRANZA_ACTIONS: 'COBRANZAS/UPDATE_ACTIONS',
  SET_SELECTED_COBRANZA: 'COBRANZAS/SET_SELECTED',
  UPDATE_COBRANZA_STATUS: 'COBRANZAS/UPDATE_STATUS',

  // ── Sync offline-first ───────────────────────────────────────────────────
  MARK_PENDING_SYNC:    'SYNC/MARK_PENDING',
  SYNC_SUCCESS:         'SYNC/SUCCESS',
  SYNC_ERROR:           'SYNC/ERROR',
  SYNC_REMOTE_ID:       'SYNC/REMOTE_ID',
})
