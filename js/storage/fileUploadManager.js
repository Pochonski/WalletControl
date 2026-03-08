/**
 * fileUploadManager.js — Manages file upload interactions and state.
 *
 * Provides UI-agnostic file upload management with progress tracking
 * and error handling.
 */

import {
  uploadClientPhoto,
  uploadClientIdDocument,
  uploadPaymentVoucher,
  uploadAssetPhotos,
} from './storageService.js'

// ============================================================================
// UPLOAD MANAGER CLASS
// ============================================================================

export class FileUploadManager {
  constructor() {
    this.uploads = new Map() // uploadId -> { file, status, progress, error }
  }

  /**
   * Starts a client photo upload.
   *
   * @param {File} file - File to upload
   * @param {string} clientId - Client ID
   * @param {string} userId - User ID
   * @returns {Promise<{success: boolean, uploadId?: string, path?: string, error?: string}>}
   */
  async uploadClientPhoto(file, clientId, userId) {
    const uploadId = this._generateUploadId('client-photo')
    this._setUploadStatus(uploadId, 'uploading', 0)

    try {
      const result = await uploadClientPhoto(file, clientId, userId)

      if (result.success) {
        this._setUploadStatus(uploadId, 'completed', 100)
        return {
          success: true,
          uploadId,
          path: result.path,
        }
      } else {
        this._setUploadStatus(uploadId, 'error', 0, result.error)
        return {
          success: false,
          uploadId,
          error: result.error,
        }
      }
    } catch (err) {
      const errorMsg = err.message || 'Error desconocido'
      this._setUploadStatus(uploadId, 'error', 0, errorMsg)
      return {
        success: false,
        uploadId,
        error: errorMsg,
      }
    }
  }

  /**
   * Starts a client ID document upload.
   *
   * @param {File} file - Document file
   * @param {string} clientId - Client ID
   * @param {string} userId - User ID
   * @param {string} documentType - Document type identifier
   * @returns {Promise<{success: boolean, uploadId?: string, path?: string, error?: string}>}
   */
  async uploadClientIdDocument(file, clientId, userId, documentType) {
    const uploadId = this._generateUploadId('id-document')
    this._setUploadStatus(uploadId, 'uploading', 0)

    try {
      const result = await uploadClientIdDocument(file, clientId, userId, documentType)

      if (result.success) {
        this._setUploadStatus(uploadId, 'completed', 100)
        return {
          success: true,
          uploadId,
          path: result.path,
        }
      } else {
        this._setUploadStatus(uploadId, 'error', 0, result.error)
        return {
          success: false,
          uploadId,
          error: result.error,
        }
      }
    } catch (err) {
      const errorMsg = err.message || 'Error desconocido'
      this._setUploadStatus(uploadId, 'error', 0, errorMsg)
      return {
        success: false,
        uploadId,
        error: errorMsg,
      }
    }
  }

  /**
   * Starts a payment voucher upload.
   *
   * @param {File} file - Voucher file
   * @param {string} paymentId - Payment ID
   * @param {string} userId - User ID
   * @returns {Promise<{success: boolean, uploadId?: string, path?: string, error?: string}>}
   */
  async uploadPaymentVoucher(file, paymentId, userId) {
    const uploadId = this._generateUploadId('payment-voucher')
    this._setUploadStatus(uploadId, 'uploading', 0)

    try {
      const result = await uploadPaymentVoucher(file, paymentId, userId)

      if (result.success) {
        this._setUploadStatus(uploadId, 'completed', 100)
        return {
          success: true,
          uploadId,
          path: result.path,
        }
      } else {
        this._setUploadStatus(uploadId, 'error', 0, result.error)
        return {
          success: false,
          uploadId,
          error: result.error,
        }
      }
    } catch (err) {
      const errorMsg = err.message || 'Error desconocido'
      this._setUploadStatus(uploadId, 'error', 0, errorMsg)
      return {
        success: false,
        uploadId,
        error: errorMsg,
      }
    }
  }

  /**
   * Starts asset photo upload(s).
   *
   * @param {File|File[]} files - Single file or array
   * @param {string} assetId - Asset ID
   * @param {string} userId - User ID
   * @returns {Promise<{success: boolean, uploadId?: string, paths?: string[], error?: string}>}
   */
  async uploadAssetPhotos(files, assetId, userId) {
    const uploadId = this._generateUploadId('asset-photos')
    this._setUploadStatus(uploadId, 'uploading', 0)

    try {
      const fileArray = Array.isArray(files) ? files : [files]
      const result = await uploadAssetPhotos(files, assetId, userId)

      if (result.success) {
        this._setUploadStatus(uploadId, 'completed', 100)
        return {
          success: true,
          uploadId,
          paths: result.paths,
        }
      } else {
        this._setUploadStatus(uploadId, 'error', 0, result.error)
        return {
          success: false,
          uploadId,
          error: result.error,
        }
      }
    } catch (err) {
      const errorMsg = err.message || 'Error desconocido'
      this._setUploadStatus(uploadId, 'error', 0, errorMsg)
      return {
        success: false,
        uploadId,
        error: errorMsg,
      }
    }
  }

  /**
   * Gets upload status.
   *
   * @param {string} uploadId - Upload identifier
   * @returns {object|null} Upload status object or null
   */
  getStatus(uploadId) {
    return this.uploads.get(uploadId) || null
  }

  /**
   * Clears old completed uploads (e.g., after 5 minutes).
   * Should be called periodically to clean up memory.
   */
  cleanupOldUploads(maxAgeMs = 5 * 60 * 1000) {
    const now = Date.now()

    for (const [id, upload] of this.uploads.entries()) {
      if (upload.status === 'completed' && now - upload.completedAt > maxAgeMs) {
        this.uploads.delete(id)
      }
    }
  }

  /**
   * Clears all uploads.
   */
  clearAll() {
    this.uploads.clear()
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  _generateUploadId(type) {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `${type}-${timestamp}-${random}`
  }

  _setUploadStatus(uploadId, status, progress, error = null) {
    const upload = this.uploads.get(uploadId) || { startedAt: Date.now() }

    upload.status = status
    upload.progress = progress
    upload.error = error

    if (status === 'completed') {
      upload.completedAt = Date.now()
    }

    this.uploads.set(uploadId, upload)
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const fileUploadManager = new FileUploadManager()
