/**
 * supabaseStorage.js — Storage adapter for Supabase file operations.
 *
 * Manages file uploads, downloads, and deletions across multiple buckets.
 * Provides security through signed URLs and RLS policies.
 */

import { supabaseClient } from './supabaseClient.js'

// ============================================================================
// BUCKET CONFIGURATION
// ============================================================================

export const STORAGE_BUCKETS = Object.freeze({
  CLIENT_PHOTOS: 'client-photos',      // Rostro de clientes
  CLIENT_IDS: 'client-ids',            // Cédulas y documentos de identidad
  PAYMENT_VOUCHERS: 'payment-vouchers', // Comprobantes de pago
  ASSET_PHOTOS: 'asset-photos',        // Fotos de activos
})

// File type and size validation
export const FILE_VALIDATION = Object.freeze({
  [STORAGE_BUCKETS.CLIENT_PHOTOS]: {
    maxSize: 5 * 1024 * 1024,           // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    description: 'Foto de perfil'
  },
  [STORAGE_BUCKETS.CLIENT_IDS]: {
    maxSize: 10 * 1024 * 1024,          // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    description: 'Documentos de identidad'
  },
  [STORAGE_BUCKETS.PAYMENT_VOUCHERS]: {
    maxSize: 10 * 1024 * 1024,          // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    description: 'Comprobante de pago'
  },
  [STORAGE_BUCKETS.ASSET_PHOTOS]: {
    maxSize: 8 * 1024 * 1024,           // 8MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    description: 'Foto de activo'
  },
})

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Ensures all required storage buckets exist and are properly configured.
 * Should be called once during app initialization.
 *
 * Note: Requires admin privileges via service role key to create buckets.
 * In production, buckets should be pre-created in Supabase dashboard.
 */
export async function initializeStorageBuckets() {
  const bucketNames = Object.values(STORAGE_BUCKETS)

  for (const bucketName of bucketNames) {
    try {
      // Check if bucket exists
      const { data: buckets } = await supabaseClient.storage.listBuckets()
      const exists = buckets?.some(b => b.name === bucketName)

      if (!exists) {
        console.warn(`Bucket "${bucketName}" does not exist. Create it in Supabase Dashboard.`)
      } else {
        console.log(`Bucket "${bucketName}" initialized successfully.`)
      }
    } catch (err) {
      console.error(`Error initializing bucket "${bucketName}":`, err.message)
    }
  }
}

// ============================================================================
// FILE UPLOAD
// ============================================================================

/**
 * Uploads a file to a Supabase Storage bucket.
 *
 * @param {string} bucket - Bucket name (use STORAGE_BUCKETS constant)
 * @param {File} file - File object from input
 * @param {string} userId - User ID for file organization
 * @param {object} options - Additional options
 * @param {Function} options.onProgress - Progress callback: (progress: number) => void
 * @returns {Promise<{success: boolean, path: string, error?: string}>}
 *
 * @example
 * const input = document.getElementById('fileInput')
 * const result = await uploadFile(STORAGE_BUCKETS.CLIENT_PHOTOS, input.files[0], userId)
 * if (result.success) {
 *   console.log('File uploaded at:', result.path)
 * }
 */
export async function uploadFile(bucket, file, userId, options = {}) {
  try {
    // Validate bucket exists
    if (!Object.values(STORAGE_BUCKETS).includes(bucket)) {
      throw new Error(`Invalid bucket: ${bucket}`)
    }

    // Validate file
    const validation = validateFile(file, bucket)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      }
    }

    // Generate unique file path
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop()
    const fileName = `${userId}/${timestamp}-${randomStr}.${extension}`

    // Upload file
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      throw error
    }

    return {
      success: true,
      path: data.path,
      name: file.name,
      size: file.size,
      bucket: bucket
    }
  } catch (err) {
    console.error('File upload error:', err)
    return {
      success: false,
      error: err.message || 'Error al subir archivo'
    }
  }
}

/**
 * Uploads multiple files in batch.
 *
 * @param {string} bucket - Bucket name
 * @param {File[]} files - Array of file objects
 * @param {string} userId - User ID
 * @param {object} options - Options (including onProgress)
 * @returns {Promise<{successful: array, failed: array}>}
 */
export async function uploadMultipleFiles(bucket, files, userId, options = {}) {
  const successful = []
  const failed = []

  for (let i = 0; i < files.length; i++) {
    const result = await uploadFile(bucket, files[i], userId, options)

    if (result.success) {
      successful.push(result)
    } else {
      failed.push({
        name: files[i].name,
        error: result.error
      })
    }

    // Call progress callback
    if (options.onProgress) {
      options.onProgress((i + 1) / files.length)
    }
  }

  return { successful, failed }
}

// ============================================================================
// FILE RETRIEVAL & SIGNED URLS
// ============================================================================

/**
 * Generates a signed URL for secure file access.
 * URLs expire after 1 hour by default.
 *
 * @param {string} bucket - Bucket name
 * @param {string} filePath - File path in bucket
 * @param {number} expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 *
 * @example
 * const result = await getSignedUrl(STORAGE_BUCKETS.CLIENT_PHOTOS, filePath)
 * if (result.success) {
 *   imgElement.src = result.url
 * }
 */
export async function getSignedUrl(bucket, filePath, expiresIn = 3600) {
  try {
    if (!filePath) {
      throw new Error('File path is required')
    }

    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn)

    if (error) {
      throw error
    }

    return {
      success: true,
      url: data.signedUrl,
      expiresIn: expiresIn
    }
  } catch (err) {
    console.error('Signed URL error:', err)
    return {
      success: false,
      error: err.message || 'Error al generar URL firmada'
    }
  }
}

/**
 * Generates signed URLs for multiple files.
 * Useful for displaying galleries or lists of files.
 *
 * @param {string} bucket - Bucket name
 * @param {string[]} filePaths - Array of file paths
 * @param {number} expiresIn - Expiration time in seconds
 * @returns {Promise<{success: boolean, urls?: Map, errors?: array}>}
 */
export async function getSignedUrls(bucket, filePaths, expiresIn = 3600) {
  const urls = new Map()
  const errors = []

  for (const filePath of filePaths) {
    const result = await getSignedUrl(bucket, filePath, expiresIn)

    if (result.success) {
      urls.set(filePath, result.url)
    } else {
      errors.push({ filePath, error: result.error })
    }
  }

  return {
    success: errors.length === 0,
    urls: urls,
    errors: errors.length > 0 ? errors : undefined
  }
}

/**
 * Downloads a file directly from storage.
 * More efficient than signed URLs for direct downloads.
 *
 * @param {string} bucket - Bucket name
 * @param {string} filePath - File path
 * @returns {Promise<{success: boolean, data?: Blob, error?: string}>}
 */
export async function downloadFile(bucket, filePath) {
  try {
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .download(filePath)

    if (error) {
      throw error
    }

    return {
      success: true,
      data: data
    }
  } catch (err) {
    console.error('Download error:', err)
    return {
      success: false,
      error: err.message || 'Error al descargar archivo'
    }
  }
}

// ============================================================================
// FILE DELETION
// ============================================================================

/**
 * Deletes a file from storage.
 *
 * @param {string} bucket - Bucket name
 * @param {string} filePath - File path to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 *
 * @example
 * const result = await deleteFile(STORAGE_BUCKETS.CLIENT_PHOTOS, filePath)
 * if (result.success) {
 *   console.log('File deleted successfully')
 * }
 */
export async function deleteFile(bucket, filePath) {
  try {
    if (!filePath) {
      throw new Error('File path is required')
    }

    const { error } = await supabaseClient.storage
      .from(bucket)
      .remove([filePath])

    if (error) {
      throw error
    }

    return { success: true }
  } catch (err) {
    console.error('Delete error:', err)
    return {
      success: false,
      error: err.message || 'Error al eliminar archivo'
    }
  }
}

/**
 * Deletes multiple files.
 *
 * @param {string} bucket - Bucket name
 * @param {string[]} filePaths - Array of file paths to delete
 * @returns {Promise<{successful: array, failed: array}>}
 */
export async function deleteMultipleFiles(bucket, filePaths) {
  try {
    const { error } = await supabaseClient.storage
      .from(bucket)
      .remove(filePaths)

    if (error) {
      throw error
    }

    return {
      successful: filePaths,
      failed: []
    }
  } catch (err) {
    console.error('Batch delete error:', err)
    return {
      successful: [],
      failed: filePaths.map(path => ({
        path,
        error: err.message
      }))
    }
  }
}

/**
 * Deletes all files under a specific user directory in a bucket.
 * Useful for cleanup when deleting a user account.
 *
 * @param {string} bucket - Bucket name
 * @param {string} userId - User ID (directory prefix)
 * @returns {Promise<{success: boolean, deletedCount?: number, error?: string}>}
 */
export async function deleteUserFiles(bucket, userId) {
  try {
    // List all files for user
    const { data: files, error: listError } = await supabaseClient.storage
      .from(bucket)
      .list(userId)

    if (listError) {
      throw listError
    }

    if (!files || files.length === 0) {
      return { success: true, deletedCount: 0 }
    }

    // Build full paths
    const filePaths = files.map(file => `${userId}/${file.name}`)

    // Delete all files
    const { error: deleteError } = await supabaseClient.storage
      .from(bucket)
      .remove(filePaths)

    if (deleteError) {
      throw deleteError
    }

    return {
      success: true,
      deletedCount: filePaths.length
    }
  } catch (err) {
    console.error('User files deletion error:', err)
    return {
      success: false,
      error: err.message || 'Error al eliminar archivos del usuario'
    }
  }
}

// ============================================================================
// FILE VALIDATION
// ============================================================================

/**
 * Validates a file against bucket requirements.
 *
 * @param {File} file - File to validate
 * @param {string} bucket - Bucket name
 * @returns {{valid: boolean, error?: string}}
 */
export function validateFile(file, bucket) {
  const config = FILE_VALIDATION[bucket]

  if (!config) {
    return {
      valid: false,
      error: `Bucket desconocido: ${bucket}`
    }
  }

  // Check file type
  if (!config.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido. Formatos soportados: ${config.allowedTypes.join(', ')}`
    }
  }

  // Check file size
  if (file.size > config.maxSize) {
    const maxMB = Math.round(config.maxSize / 1024 / 1024)
    return {
      valid: false,
      error: `Archivo muy grande. Máximo permitido: ${maxMB}MB`
    }
  }

  return { valid: true }
}

/**
 * Gets validation requirements for a bucket.
 *
 * @param {string} bucket - Bucket name
 * @returns {object} Validation configuration
 */
export function getValidationConfig(bucket) {
  return FILE_VALIDATION[bucket] || null
}

// ============================================================================
// FILE LISTING
// ============================================================================

/**
 * Lists all files in a user's directory within a bucket.
 *
 * @param {string} bucket - Bucket name
 * @param {string} userId - User ID (directory)
 * @returns {Promise<{success: boolean, files?: array, error?: string}>}
 */
export async function listUserFiles(bucket, userId) {
  try {
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .list(userId, { limit: 100, offset: 0 })

    if (error) {
      throw error
    }

    return {
      success: true,
      files: data || []
    }
  } catch (err) {
    console.error('List files error:', err)
    return {
      success: false,
      error: err.message || 'Error al listar archivos'
    }
  }
}
