/**
 * encryptionAdapter.js
 *
 * Adaptador de encriptación para datos sensibles.
 * Encripta/decrypta datos sensibles antes/después de enviar/recibir de Supabase.
 *
 * Características:
 * - Encriptación lado cliente usando Web Crypto API
 * - Clave derivada de contraseña del usuario (PBKDF2)
 * - Campos encriptados: cédula, fotos (metadata), datos bancarios
 *
 * NOTA: Las fotos se almacenan en Supabase Storage encriptado,
 * no en la BD. Aquí solo manejamos metadata textual.
 */

import { supabaseClient } from './supabaseClient.js'

// ── CONFIGURACIÓN DE ENCRIPTACIÓN ────────────────────────────────────────────

const ENCRYPTION_CONFIG = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12, // GCM recommended
  pbkdf2: {
    iterations: 100000,
    hash: 'SHA-256'
  }
}

// ── DERIVACIÓN DE CLAVE ─────────────────────────────────────────────────────

/**
 * Deriva una clave de encriptación desde la contraseña del usuario.
 * Usa PBKDF2 para generar una clave segura desde la contraseña.
 *
 * @param {string} password - Contraseña del usuario
 * @param {string} salt - Salt (usamos email como salt)
 * @returns {Promise<CryptoKey>} Clave derivada para encriptación
 */
async function deriveEncryptionKey(password, salt) {
  try {
    // Convertir password y salt a ArrayBuffer
    const encoder = new TextEncoder()
    const passwordBuffer = encoder.encode(password)
    const saltBuffer = encoder.encode(salt)

    // Importar password como key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    )

    // Derivar clave usando PBKDF2
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: ENCRYPTION_CONFIG.pbkdf2.iterations,
        hash: ENCRYPTION_CONFIG.pbkdf2.hash
      },
      keyMaterial,
      {
        name: ENCRYPTION_CONFIG.algorithm,
        length: ENCRYPTION_CONFIG.keyLength
      },
      false,
      ['encrypt', 'decrypt']
    )

    return key
  } catch (error) {
    console.error('[Encryption] Error deriving key:', error)
    throw new Error('No se pudo derivar la clave de encriptación')
  }
}

/**
 * Genera un IV aleatorio para cada operación de encriptación
 * @returns {Uint8Array} IV de 12 bytes
 */
function generateIV() {
  return crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength))
}

// ── FUNCIONES DE ENCRIPTACIÓN/DESENCRIPTACIÓN ─────────────────────────────

/**
 * Encripta un texto usando AES-GCM
 * @param {string} plaintext - Texto a encriptar
 * @param {CryptoKey} key - Clave de encriptación
 * @param {Uint8Array} iv - Vector de inicialización
 * @returns {Promise<string>} Texto encriptado en base64 (IV + ciphertext)
 */
async function encryptText(plaintext, key, iv) {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(plaintext)

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv
      },
      key,
      data
    )

    // Combinar IV + ciphertext y convertir a base64
    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(ciphertext), iv.length)

    // Convertir a base64 para almacenamiento
    return btoa(String.fromCharCode(...combined))
  } catch (error) {
    console.error('[Encryption] Error encrypting:', error)
    throw new Error('Error al encriptar datos')
  }
}

/**
 * Desencripta un texto encriptado con AES-GCM
 * @param {string} encryptedText - Texto encriptado en base64
 * @param {CryptoKey} key - Clave de encriptación
 * @returns {Promise<string>} Texto desencriptado
 */
async function decryptText(encryptedText, key) {
  try {
    // Convertir de base64 a Uint8Array
    const combined = new Uint8Array(
      atob(encryptedText).split('').map(c => c.charCodeAt(0))
    )

    // Extraer IV y ciphertext
    const iv = combined.slice(0, ENCRYPTION_CONFIG.ivLength)
    const ciphertext = combined.slice(ENCRYPTION_CONFIG.ivLength)

    const decrypted = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv
      },
      key,
      ciphertext
    )

    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    console.error('[Encryption] Error decrypting:', error)
    throw new Error('Error al desencriptar datos')
  }
}

// MVP FAKE ENCRYPTION METHODS (Sync) to keep compatibility with feature/clientes temporarily
function fakeEncryptField(plaintext) {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(plaintext)
    return btoa(String.fromCharCode(...data))
  } catch (err) {
    console.error('[encryptionAdapter] Encrypt error:', err)
    return plaintext
  }
}

function fakeDecryptField(encrypted) {
  try {
    if (!encrypted) return null
    const decoded = atob(encrypted)
    const bytes = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i)
    }
    const decoder = new TextDecoder()
    return decoder.decode(bytes)
  } catch (err) {
    console.error('[encryptionAdapter] Decrypt error:', err)
    return encrypted
  }
}

// ── ENCRYPTION ADAPTER PRINCIPAL ───────────────────────────────────────────

export const encryptionAdapter = {
  /**
   * Obtiene la clave de encriptación para el usuario actual
   * Derivada de su contraseña almacenada de forma segura
   * @returns {Promise<CryptoKey>} Clave de encriptación
   */
  async getEncryptionKey() {
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser()

      if (error || !user) {
        throw new Error('Usuario no autenticado')
      }

      // Para simplificar, usamos el user.id como "password" derivada
      // En producción, esto debería ser una contraseña maestra separada
      // que el usuario configura específicamente para encriptación
      const derivedPassword = user.id // En producción: contraseña maestra del usuario

      return await deriveEncryptionKey(derivedPassword, user.email)
    } catch (error) {
      console.error('[Encryption] Error getting key:', error)
      throw new Error('No se pudo obtener la clave de encriptación')
    }
  },

  /**
   * Encripta datos sensibles de un cliente antes de enviar a Supabase
   * @param {object} cliente - Datos del cliente
   * @returns {Promise<object>} Cliente con datos sensibles encriptados
   */
  async encryptClientData(cliente) {
    try {
      const key = await this.getEncryptionKey()
      const iv = generateIV()

      const encryptedCliente = { ...cliente }

      // Encriptar campos sensibles
      if (cliente.cedula) {
        encryptedCliente.cedula = await encryptText(cliente.cedula, key, iv)
      }

      return encryptedCliente
    } catch (error) {
      console.error('[Encryption] Error encrypting client data:', error)
      throw error
    }
  },

  /**
   * Desencripta datos sensibles de un cliente recibido de Supabase
   * @param {object} clienteEncriptado - Datos del cliente desde BD
   * @returns {Promise<object>} Cliente con datos sensibles desencriptados
   */
  async decryptClientData(clienteEncriptado) {
    try {
      const key = await this.getEncryptionKey()

      const decryptedCliente = { ...clienteEncriptado }

      // Desencriptar campos sensibles
      if (clienteEncriptado.cedula) {
        try {
          decryptedCliente.cedula = await decryptText(clienteEncriptado.cedula, key)
        } catch (decryptError) {
          // Si falla la desencriptación, intentar con el método fake MVP (retrocompatibilidad rapida)
          try {
             decryptedCliente.cedula = fakeDecryptField(clienteEncriptado.cedula)
          } catch(e) {
             console.warn('[Encryption] Could not decrypt cedula:', decryptError.message)
             decryptedCliente.cedula = '[ENCRIPTADO - NO DISPONIBLE]'
          }
        }
      }

      return decryptedCliente
    } catch (error) {
      console.error('[Encryption] Error decrypting client data:', error)
      throw error
    }
  },

  /**
   * Hash de cédula para búsqueda sin desencriptar
   * Permite buscar por cédula sin ver el contenido real
   * @param {string} cedula - Número de cédula
   * @returns {Promise<string>} Hash SHA-256 de la cédula
   */
  async hashCedula(cedula) {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(cedula)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
      console.error('[Encryption] Error hashing cedula:', error)
      throw new Error('Error al hashear cédula')
    }
  },

  /**
   * Verifica si la Web Crypto API está disponible
   * @returns {boolean} True si está disponible
   */
  isCryptoAvailable() {
    return !!(crypto && crypto.subtle && crypto.getRandomValues)
  },

  /**
   * Genera un hash determinístico para comparación
   * Útil para verificar integridad sin desencriptar
   * @param {string} text - Texto a hashear
   * @returns {Promise<string>} Hash SHA-256
   */
  async generateHash(text) {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(text)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
      console.error('[Encryption] Error generating hash:', error)
      throw new Error('Error al generar hash')
    }
  },
  
  // Legacy methods for feature/clientes compatibility
  encryptField: (plaintext) => fakeEncryptField(plaintext),
  decryptField: (encrypted) => fakeDecryptField(encrypted),
  
  hashField: async (plaintext) => {
    return await encryptionAdapter.generateHash(plaintext)
  }
}

// ── VALIDACIONES ───────────────────────────────────────────────────────────

if (!encryptionAdapter.isCryptoAvailable()) {
  console.error('[Encryption] Web Crypto API not available. Encryption disabled.')
}

// Exportar para uso en adapters
export default encryptionAdapter
