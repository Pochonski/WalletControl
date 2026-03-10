/**
 * syncManager.js - Gestor de sincronización offline-first
 *
 * Responsabilidades:
 * 1. Detectar cambios de conectividad (online / offline)
 * 2. Al crear/actualizar datos sin conexión: encolar en pendingSync
 * 3. Al reconectar: procesar la cola y enviar cambios a Supabase
 * 4. Actualizar el Redux store con los IDs remotos recibidos
 * 5. Mostrar/ocultar el indicador de sync en la UI
 *
 * Uso:
 *   import { syncManager } from './sync/syncManager.js'
 *   syncManager.init(store)                    // en main.js
 *   syncManager.enqueue('clientes', 'CREATE', payload) // desde adapters
 */

import { ACTION_TYPES } from '../app/state/actions.js'
import { localStorageAdapter } from '../adapters/localStorageAdapter.js'
import { supabaseClient } from '../adapters/supabaseClient.js'
import { resolveConflict } from './conflictResolver.js'

const PENDING_KEY = 'pendingSync'
const RETRY_DELAY_MS = 3000
const MAX_RETRIES = 3

// Tabla a entityType para SYNC_REMOTE_ID
const TABLE_TO_ENTITY = {
  clientes: 'cliente',
  prestamos: 'prestamo',
  pagos: 'pago',
  activos: 'activo'
}

let _store = null
let _isSyncing = false
let _isOnline = navigator.onLine

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inicializar el sync manager. Llamar una sola vez desde main.js.
 * @param {object} store - Redux store
 */
export const syncManager = {
  init(store) {
    _store = store

    window.addEventListener('online', _onOnline)
    window.addEventListener('offline', _onOffline)

    // Restaurar cola pendiente del localStorage (si la app se cerró offline)
    const saved = localStorageAdapter.get(PENDING_KEY)
    if (Array.isArray(saved) && saved.length > 0) {
      saved.forEach(item => {
        store.dispatch({ type: ACTION_TYPES.MARK_PENDING_SYNC, payload: item })
      })
    }

    // Si arrancamos online y hay pendientes, sincronizar
    if (_isOnline) {
      _processQueue()
    }

    _updateSyncIndicator()
    console.info('[syncManager] Initialized. Online:', _isOnline)
  },

  /**
   * Encolar una operación para sync posterior.
   * Llamar desde adapters cuando Supabase falla por conexión.
   *
   * @param {string} table    - Tabla Supabase (e.g. 'clientes')
   * @param {'CREATE'|'UPDATE'|'DELETE'} action
   * @param {object} payload  - Datos del item (debe tener .id)
   * @param {string} [localId] - ID temporal local (para CREATE offline)
   */
  enqueue(table, action, payload, localId = null) {
    const entry = {
      id: _uuid(),
      table,
      action,
      payload,
      localId: localId ?? payload.id,
      timestamp: new Date().toISOString(),
      retries: 0
    }

    if (_store) {
      _store.dispatch({ type: ACTION_TYPES.MARK_PENDING_SYNC, payload: entry })
    }

    // Persistir en localStorage para sobrevivir recargas
    const saved = localStorageAdapter.get(PENDING_KEY) || []
    localStorageAdapter.set(PENDING_KEY, [...saved, entry])

    _updateSyncIndicator()
    console.info(`[syncManager] Enqueued ${action} for ${table}:`, entry.id)
  },

  /**
   * Forzar sincronización manual (p.ej. al pulsar refresh).
   */
  forceSync() {
    if (_isOnline && !_isSyncing) {
      _processQueue()
    }
  },

  get isOnline() {
    return _isOnline
  },

  get hasPending() {
    const state = _store?.getState()
    return (state?.pendingSync?.length ?? 0) > 0
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTENERS
// ─────────────────────────────────────────────────────────────────────────────

function _onOnline() {
  _isOnline = true
  console.info('[syncManager] Back online. Processing queue...')
  _updateSyncIndicator()
  _processQueue()
}

function _onOffline() {
  _isOnline = false
  console.warn('[syncManager] Went offline.')
  _updateSyncIndicator()
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE PROCESSOR
// ─────────────────────────────────────────────────────────────────────────────

async function _processQueue() {
  if (_isSyncing || !_store) return

  const state = _store.getState()
  const queue = state.pendingSync ?? []

  if (queue.length === 0) return

  _isSyncing = true
  _updateSyncIndicator()
  console.info(`[syncManager] Processing ${queue.length} pending items...`)

  for (const entry of [...queue]) {
    await _processEntry(entry)
  }

  _isSyncing = false
  _updateSyncIndicator()
}

async function _processEntry(entry) {
  if (entry.retries >= MAX_RETRIES) {
    console.error('[syncManager] Max retries reached for entry:', entry.id)
    return
  }

  try {
    let remoteItem = null

    if (entry.action === 'CREATE') {
      remoteItem = await _syncCreate(entry)
    } else if (entry.action === 'UPDATE') {
      remoteItem = await _syncUpdate(entry)
    } else if (entry.action === 'DELETE') {
      await _syncDelete(entry)
    }

    // Marcar como sincronizado en Redux
    _store.dispatch({ type: ACTION_TYPES.SYNC_SUCCESS, payload: entry.id })

    // Si había ID temporal, actualizar con el ID remoto
    if (remoteItem && entry.localId && entry.localId !== remoteItem.id) {
      _store.dispatch({
        type: ACTION_TYPES.SYNC_REMOTE_ID,
        payload: {
          localId: entry.localId,
          remoteId: remoteItem.id,
          entityType: TABLE_TO_ENTITY[entry.table] ?? entry.table
        }
      })
    }

    // Eliminar del localStorage
    const saved = localStorageAdapter.get(PENDING_KEY) || []
    localStorageAdapter.set(PENDING_KEY, saved.filter(e => e.id !== entry.id))

    console.info(`[syncManager] Synced ${entry.action} ${entry.table}:`, entry.id)
  } catch (err) {
    console.error(`[syncManager] Error syncing entry ${entry.id}:`, err.message)

    // Incrementar retries
    const saved = localStorageAdapter.get(PENDING_KEY) || []
    localStorageAdapter.set(
      PENDING_KEY,
      saved.map(e => e.id === entry.id ? { ...e, retries: (e.retries || 0) + 1 } : e)
    )

    // Pequeña espera antes del próximo intento
    await _delay(RETRY_DELAY_MS)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIONES SUPABASE
// ─────────────────────────────────────────────────────────────────────────────

async function _syncCreate(entry) {
  const { data: { user } } = await supabaseClient.auth.getUser()
  if (!user) throw new Error('No autorizado')

  // Limpiar ID temporal antes de insertar
  const payload = { ...entry.payload }
  if (typeof payload.id === 'string' && payload.id.startsWith('temp-')) {
    delete payload.id
  }
  payload.user_id = user.id

  const { data, error } = await supabaseClient
    .from(entry.table)
    .insert([payload])
    .select()

  if (error) throw error
  return data[0]
}

async function _syncUpdate(entry) {
  // Verificar conflicto contra versión remota
  const { data: remoteData } = await supabaseClient
    .from(entry.table)
    .select('*')
    .eq('id', entry.payload.id)
    .single()

  if (remoteData) {
    const { winner } = resolveConflict(entry.payload, remoteData)
    if (winner === 'remote') {
      console.info('[syncManager] Remote wins conflict, skipping local update.')
      return remoteData
    }
  }

  const { data, error } = await supabaseClient
    .from(entry.table)
    .update(entry.payload)
    .eq('id', entry.payload.id)
    .select()

  if (error) throw error
  return data[0]
}

async function _syncDelete(entry) {
  const { error } = await supabaseClient
    .from(entry.table)
    .delete()
    .eq('id', entry.payload.id)

  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// UI: INDICADOR DE SYNC
// ─────────────────────────────────────────────────────────────────────────────

function _updateSyncIndicator() {
  const indicator = document.getElementById('sync-indicator')
  if (!indicator) return

  const hasPending = syncManager.hasPending
  const isOffline = !_isOnline

  if (isOffline || hasPending) {
    indicator.classList.remove('hidden')
    indicator.title = isOffline
      ? 'Sin conexión - cambios guardados localmente'
      : 'Sincronizando cambios pendientes...'
  } else {
    indicator.classList.add('hidden')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _uuid() {
  return 'sync-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
}

function _delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
