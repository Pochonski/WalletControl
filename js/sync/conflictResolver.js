/**
 * conflictResolver.js
 * Estrategia: Last-Write-Wins basada en timestamps.
 *
 * Comparamos el updated_at / fecha_actualizado del item local
 * contra el remoto. Si el remoto es más nuevo, lo usamos.
 * Si el local es más nuevo, lo subimos.
 */

/**
 * Resuelve el conflicto entre un item local (pendiente de sync)
 * y el item remoto que acaba de llegar de Supabase.
 *
 * @param {object} localItem  - Item con cambios locales
 * @param {object} remoteItem - Item ya guardado en el servidor
 * @returns {{ winner: 'local' | 'remote', resolved: object }}
 */
export const resolveConflict = (localItem, remoteItem) => {
  const localTs = _toMs(localItem?.updated_at ?? localItem?.fecha_actualizado)
  const remoteTs = _toMs(remoteItem?.updated_at ?? remoteItem?.fecha_actualizado)

  if (remoteTs > localTs) {
    return { winner: 'remote', resolved: remoteItem }
  }
  return { winner: 'local', resolved: localItem }
}

/**
 * Merge seguro para campos escalares: usa el campo del winner,
 * pero preserva campos locales que el servidor no conoce (p.ej. fotos aún no subidas).
 *
 * @param {object} local
 * @param {object} remote
 * @param {'local'|'remote'} winner
 * @param {string[]} localOnlyFields - campos que el server no tiene
 * @returns {object}
 */
export const mergeItems = (local, remote, winner, localOnlyFields = []) => {
  const base = winner === 'local' ? remote : local
  const override = winner === 'local' ? local : remote
  const merged = { ...base, ...override }

  // Preservar siempre los campos local-only (como rutas de fotos pendientes de subir)
  localOnlyFields.forEach(field => {
    if (local[field] !== undefined) {
      merged[field] = local[field]
    }
  })

  return merged
}

// ────────────────────────────────────────────────────────────────
// HELPERS PRIVADOS
// ────────────────────────────────────────────────────────────────

function _toMs(timestamp) {
  if (!timestamp) return 0
  const ms = new Date(timestamp).getTime()
  return isNaN(ms) ? 0 : ms
}
