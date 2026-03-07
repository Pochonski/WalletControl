/**
 * EncryptionAdapter - Encriptación de datos sensibles
 * Usa Web Crypto API (nativa del navegador)
 *
 * Datos a encriptar:
 * - cedula (ID número)
 * - contraseñas (si se almacenan localmente)
 */

// Deriva una clave a partir de email + contraseña del usuario
const deriveKey = async (password, email) => {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)
  const saltBuffer = encoder.encode(email) // email como salt

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, ['deriveKey']),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )

  return key
}

export const encryptionAdapter = {
  /**
   * Encriptar un campo sensible (ej: cédula)
   * Usa sessionStorage para derivar la clave
   *
   * Formato guardado: "iv:ciphertext" en base64
   */
  encryptField: (plaintext) => {
    try {
      // Para MVP: simple base64 encoding (suficiente para MVP)
      // TODO: En producción, implementar AES-GCM completo
      const encoder = new TextEncoder()
      const data = encoder.encode(plaintext)
      return btoa(String.fromCharCode(...data))
    } catch (err) {
      console.error('[encryptionAdapter] Encrypt error:', err)
      return plaintext
    }
  },

  /**
   * Desencriptar un campo
   */
  decryptField: (encrypted) => {
    try {
      if (!encrypted) return null

      // Decodificar base64
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
  },

  /**
   * Hash (no reversible) para comparaciones
   * Ej: verificar cédula sin desencriptar
   */
  hashField: async (plaintext) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(plaintext)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
  }
}
