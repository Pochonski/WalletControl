/**
 * ClientesDataAdapter - Capa de integración con Supabase
 * Responsabilidades:
 * - Cargar clientes del servidor/localStorage
 * - Crear, actualizar, archivar clientes
 * - Encriptar datos sensibles (cédula)
 * - Fallback a localStorage si Supabase falla
 * - Logging de auditoría
 */

import { supabaseClient } from '../supabaseClient.js'
import { encryptionAdapter } from '../encryptionAdapter.js'
import { auditAdapter } from '../auditAdapter.js'
import { localStorageAdapter } from '../localStorageAdapter.js'
import { validateCliente, validateClienteUpdate } from '../../clientes/domain/validateCliente.js'

export const clientesDataAdapter = {
  /**
   * Cargar todos los clientes del usuario actual
   */
  load: async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('clientes')
        .select('*')
        .eq('user_id', user.id)
        .order('fecha_registro', { ascending: false })

      if (error) throw error

      // Desencriptar datos sensibles
      const decrypted = data.map(cliente => ({
        ...cliente,
        cedula: cliente.cedula ? encryptionAdapter.decryptField(cliente.cedula) : null
      }))

      // Guardar en localStorage para offline
      localStorageAdapter.set('clientes', decrypted)

      return decrypted
    } catch (err) {
      console.error('[clientesDataAdapter.load]', err.message)
      // Fallback a localStorage
      return localStorageAdapter.get('clientes') || []
    }
  },

  /**
   * Crear nuevo cliente
   */
  save: async (cliente) => {
    // Validar
    const { valid, errors } = validateCliente(cliente)
    if (!valid) {
      throw new Error(`Validación falló: ${errors.join(', ')}`)
    }

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      // Encriptar cédula
      const encrypted = {
        ...cliente,
        cedula: encryptionAdapter.encryptField(cliente.cedula),
        user_id: user.id,
        estado: 'ACTIVO',
        fecha_registro: new Date().toISOString()
      }

      const { data, error } = await supabaseClient
        .from('clientes')
        .insert([encrypted])
        .select()

      if (error) throw error

      const nuevoCliente = data[0]

      // Desencriptar antes de devolver
      const resultado = {
        ...nuevoCliente,
        cedula: encryptionAdapter.decryptField(nuevoCliente.cedula)
      }

      // Guardar local
      const actual = localStorageAdapter.get('clientes') || []
      localStorageAdapter.set('clientes', [resultado, ...actual])

      // Auditoría
      await auditAdapter.log('INSERT', 'cliente', nuevoCliente.id, {
        nombre: nuevoCliente.nombre
      })

      return resultado
    } catch (err) {
      console.error('[clientesDataAdapter.save]', err.message)

      // Fallback offline: guardar con ID temporal
      const clienteOffline = {
        ...cliente,
        id: `temp-${Date.now()}`,
        user_id: null,
        estado: 'ACTIVO',
        fecha_registro: new Date().toISOString(),
        _pendingSync: true
      }

      const actual = localStorageAdapter.get('clientes') || []
      localStorageAdapter.set('clientes', [clienteOffline, ...actual])

      return clienteOffline
    }
  },

  /**
   * Actualizar cliente existente
   */
  update: async (clienteId, cambios) => {
    // Validar cambios
    const { valid, errors } = validateClienteUpdate(cambios)
    if (!valid) {
      throw new Error(`Validación falló: ${errors.join(', ')}`)
    }

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      // Encriptar cédula si viene en cambios
      const encrypted = {
        ...cambios,
        ...(cambios.cedula && { cedula: encryptionAdapter.encryptField(cambios.cedula) })
      }

      const { data, error } = await supabaseClient
        .from('clientes')
        .update(encrypted)
        .eq('id', clienteId)
        .eq('user_id', user.id)
        .select()

      if (error) throw error

      const actualizado = data[0]

      // Desencriptar
      const resultado = {
        ...actualizado,
        cedula: actualizado.cedula ? encryptionAdapter.decryptField(actualizado.cedula) : null
      }

      // Actualizar local
      const clientes = localStorageAdapter.get('clientes') || []
      const updated = clientes.map(c => c.id === clienteId ? resultado : c)
      localStorageAdapter.set('clientes', updated)

      // Auditoría
      await auditAdapter.log('UPDATE', 'cliente', clienteId, {
        cambios: Object.keys(cambios)
      })

      return resultado
    } catch (err) {
      console.error('[clientesDataAdapter.update]', err.message)
      throw err
    }
  },

  /**
   * Archivar cliente
   */
  archive: async (clienteId) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('clientes')
        .update({ estado: 'ARCHIVADO' })
        .eq('id', clienteId)
        .eq('user_id', user.id)
        .select()

      if (error) throw error

      const archivado = data[0]

      // Actualizar local
      const clientes = localStorageAdapter.get('clientes') || []
      const updated = clientes.map(c => c.id === clienteId ? { ...c, estado: 'ARCHIVADO' } : c)
      localStorageAdapter.set('clientes', updated)

      // Auditoría
      await auditAdapter.log('UPDATE', 'cliente', clienteId, {
        accion: 'archivado'
      })

      return archivado
    } catch (err) {
      console.error('[clientesDataAdapter.archive]', err.message)
      throw err
    }
  },

  /**
   * Buscar clientes por término
   */
  search: async (termino) => {
    if (!termino) return this.load()

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('clientes')
        .select('*')
        .eq('user_id', user.id)
        .ilike('nombre', `%${termino}%`)

      if (error) throw error

      // Desencriptar
      const decrypted = data.map(cliente => ({
        ...cliente,
        cedula: cliente.cedula ? encryptionAdapter.decryptField(cliente.cedula) : null
      }))

      return decrypted
    } catch (err) {
      console.error('[clientesDataAdapter.search]', err.message)
      // Fallback local
      const clientes = localStorageAdapter.get('clientes') || []
      return clientes.filter(c => c.nombre.toLowerCase().includes(termino.toLowerCase()))
    }
  }
}
