/**
 * storageService.js — High-level storage service layer.
 *
 * Manages file operations for different entities (clients, assets, payments).
 * Handles file metadata, validation, and cleanup.
 */

import {
  STORAGE_BUCKETS,
  uploadFile,
  uploadMultipleFiles,
  getSignedUrl,
  getSignedUrls,
  deleteFile,
  deleteMultipleFiles,
  deleteUserFiles,
  validateFile,
} from '../adapters/supabaseStorage.js'

// ============================================================================
// CLIENT PHOTOS
// ============================================================================

/**
 * Uploads a client profile photo.
 *
 * @param {File} file - Image file
 * @param {string} clientId - Client ID
 * @param {string} userId - Current user ID
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export async function uploadClientPhoto(file, clientId, userId) {
  // Organize files by user and client
  const bucket = STORAGE_BUCKETS.CLIENT_PHOTOS
  const originalUpload = await uploadFile(bucket, file, userId)

  if (!originalUpload.success) {
    return {
      success: false,
      error: originalUpload.error
    }
  }

  return {
    success: true,
    path: originalUpload.path,
    metadata: {
      bucket,
      clientId,
      userId,
      uploadedAt: new Date().toISOString()
    }
  }
}

/**
 * Gets a secure URL for viewing client photo.
 *
 * @param {string} photoPath - Path to photo file
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function getClientPhotoUrl(photoPath) {
  if (!photoPath) {
    return {
      success: false,
      error: 'Photo path is required'
    }
  }

  return getSignedUrl(STORAGE_BUCKETS.CLIENT_PHOTOS, photoPath)
}

// ============================================================================
// CLIENT ID DOCUMENTS
// ============================================================================

/**
 * Uploads a client ID document (cédula, pasaporte, etc).
 *
 * @param {File} file - Document file (image or PDF)
 * @param {string} clientId - Client ID
 * @param {string} userId - Current user ID
 * @param {string} documentType - 'cedula-frente', 'cedula-reverso', etc.
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export async function uploadClientIdDocument(file, clientId, userId, documentType) {
  const bucket = STORAGE_BUCKETS.CLIENT_IDS
  const originalUpload = await uploadFile(bucket, file, userId)

  if (!originalUpload.success) {
    return {
      success: false,
      error: originalUpload.error
    }
  }

  return {
    success: true,
    path: originalUpload.path,
    metadata: {
      bucket,
      clientId,
      userId,
      documentType,
      uploadedAt: new Date().toISOString()
    }
  }
}

/**
 * Gets a secure URL for viewing client ID document.
 *
 * @param {string} docPath - Path to document file
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function getClientIdDocumentUrl(docPath) {
  if (!docPath) {
    return {
      success: false,
      error: 'Document path is required'
    }
  }

  return getSignedUrl(STORAGE_BUCKETS.CLIENT_IDS, docPath)
}

// ============================================================================
// PAYMENT VOUCHERS
// ============================================================================

/**
 * Uploads a payment voucher/proof.
 *
 * @param {File} file - Voucher file (image or PDF)
 * @param {string} paymentId - Payment record ID
 * @param {string} userId - Current user ID
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export async function uploadPaymentVoucher(file, paymentId, userId) {
  const bucket = STORAGE_BUCKETS.PAYMENT_VOUCHERS
  const originalUpload = await uploadFile(bucket, file, userId)

  if (!originalUpload.success) {
    return {
      success: false,
      error: originalUpload.error
    }
  }

  return {
    success: true,
    path: originalUpload.path,
    metadata: {
      bucket,
      paymentId,
      userId,
      uploadedAt: new Date().toISOString()
    }
  }
}

/**
 * Gets a secure URL for viewing payment voucher.
 *
 * @param {string} voucherPath - Path to voucher file
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function getPaymentVoucherUrl(voucherPath) {
  if (!voucherPath) {
    return {
      success: false,
      error: 'Voucher path is required'
    }
  }

  return getSignedUrl(STORAGE_BUCKETS.PAYMENT_VOUCHERS, voucherPath)
}

// ============================================================================
// ASSET PHOTOS
// ============================================================================

/**
 * Uploads one or more asset photos.
 *
 * @param {File|File[]} files - Single file or array of files
 * @param {string} assetId - Asset ID
 * @param {string} userId - Current user ID
 * @returns {Promise<{success: boolean, paths?: string[], error?: string}>}
 */
export async function uploadAssetPhotos(files, assetId, userId) {
  const bucket = STORAGE_BUCKETS.ASSET_PHOTOS
  const fileArray = Array.isArray(files) ? files : [files]

  if (fileArray.length === 0) {
    return {
      success: false,
      error: 'No files provided'
    }
  }

  // Validate each file
  for (const file of fileArray) {
    const validation = validateFile(file, bucket)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      }
    }
  }

  // Upload files
  const result = fileArray.length === 1
    ? await uploadFile(bucket, fileArray[0], userId)
    : await uploadMultipleFiles(bucket, fileArray, userId)

  if (!result.success && result.error) {
    return {
      success: false,
      error: result.error
    }
  }

  // Extract paths from result
  const paths = fileArray.length === 1
    ? [result.path]
    : result.successful.map(r => r.path)

  if (paths.length === 0) {
    return {
      success: false,
      error: 'No files were uploaded successfully'
    }
  }

  return {
    success: true,
    paths: paths,
    metadata: {
      bucket,
      assetId,
      userId,
      count: paths.length,
      uploadedAt: new Date().toISOString()
    }
  }
}

/**
 * Gets secure URLs for asset photos.
 *
 * @param {string[]} photoPaths - Array of photo file paths
 * @returns {Promise<{success: boolean, urls?: Map, error?: string}>}
 */
export async function getAssetPhotoUrls(photoPaths) {
  if (!photoPaths || photoPaths.length === 0) {
    return {
      success: false,
      error: 'Photo paths are required'
    }
  }

  const result = await getSignedUrls(STORAGE_BUCKETS.ASSET_PHOTOS, photoPaths)

  return {
    success: result.success,
    urls: result.urls,
    error: result.errors ? result.errors[0]?.error : undefined
  }
}

// ============================================================================
// FILE DELETION
// ============================================================================

/**
 * Deletes a file from storage and updates the entity.
 * Handles all bucket types.
 *
 * @param {string} bucket - Bucket name (use STORAGE_BUCKETS)
 * @param {string} filePath - File path to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteStorageFile(bucket, filePath) {
  if (!filePath) {
    return {
      success: false,
      error: 'File path is required'
    }
  }

  return deleteFile(bucket, filePath)
}

/**
 * Deletes multiple files in batch.
 *
 * @param {string} bucket - Bucket name
 * @param {string[]} filePaths - Array of file paths
 * @returns {Promise<{success: boolean, deletedCount?: number, error?: string}>}
 */
export async function deleteStorageFiles(bucket, filePaths) {
  if (!filePaths || filePaths.length === 0) {
    return {
      success: false,
      error: 'File paths are required'
    }
  }

  const result = await deleteMultipleFiles(bucket, filePaths)

  return {
    success: result.failed.length === 0,
    deletedCount: result.successful.length,
    error: result.failed.length > 0 ? result.failed[0].error : undefined
  }
}

/**
 * Deletes all files for a client when archiving/deleting account.
 * Removes all photos and documents associated with the client.
 *
 * @param {string} clientId - Client ID
 * @param {string} userId - User ID (used as directory prefix)
 * @returns {Promise<{success: boolean, deletedCounts?: object, error?: string}>}
 */
export async function deleteClientFiles(clientId, userId) {
  try {
    const buckets = [
      STORAGE_BUCKETS.CLIENT_PHOTOS,
      STORAGE_BUCKETS.CLIENT_IDS
    ]

    const deletedCounts = {}

    for (const bucket of buckets) {
      const result = await deleteUserFiles(bucket, userId)
      deletedCounts[bucket] = result.deletedCount || 0

      if (!result.success) {
        return {
          success: false,
          error: `Error deleting from ${bucket}: ${result.error}`
        }
      }
    }

    return {
      success: true,
      deletedCounts
    }
  } catch (err) {
    return {
      success: false,
      error: err.message
    }
  }
}

/**
 * Deletes all asset photos for an asset.
 *
 * @param {string[]} assetPhotoPaths - Array of photo paths
 * @returns {Promise<{success: boolean, deletedCount?: number, error?: string}>}
 */
export async function deleteAssetPhotos(assetPhotoPaths) {
  if (!assetPhotoPaths || assetPhotoPaths.length === 0) {
    return {
      success: true,
      deletedCount: 0
    }
  }

  return deleteStorageFiles(STORAGE_BUCKETS.ASSET_PHOTOS, assetPhotoPaths)
}

/**
 * Deletes a payment voucher.
 *
 * @param {string} voucherPath - Path to voucher file
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deletePaymentVoucher(voucherPath) {
  if (!voucherPath) {
    return {
      success: true
    }
  }

  return deleteStorageFile(STORAGE_BUCKETS.PAYMENT_VOUCHERS, voucherPath)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Formats file size for display.
 *
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Generates a display name for a file.
 * Extracts readable name from file path.
 *
 * @param {string} filePath - Full file path
 * @returns {string} Display name
 */
export function getFileDisplayName(filePath) {
  if (!filePath) return 'Unknown file'

  // Extract just the filename with extension
  const parts = filePath.split('/')
  const fileName = parts[parts.length - 1]

  // Remove timestamp prefix (assumes format: userId/timestamp-random.ext)
  const withoutPrefix = fileName.replace(/^\d+-[a-z0-9]+\./, '')

  return withoutPrefix || fileName
}
