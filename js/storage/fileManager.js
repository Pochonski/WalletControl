/**
 * fileManager.js — Central file management utility.
 *
 * Coordinates file operations across the application.
 * Handles file metadata, caching of signed URLs, and cleanup.
 */

import {
  getClientPhotoUrl,
  getClientIdDocumentUrl,
  getPaymentVoucherUrl,
  getAssetPhotoUrls,
  deleteStorageFile,
  deleteClientFiles,
  deleteAssetPhotos,
  deletePaymentVoucher,
  formatFileSize,
  getFileDisplayName,
} from './storageService.js'

import { STORAGE_BUCKETS } from '../adapters/supabaseStorage.js'

// ============================================================================
// FILE MANAGER CLASS
// ============================================================================

export class FileManager {
  constructor() {
    // Cache for signed URLs with expiration
    this.urlCache = new Map() // "bucket:path" -> { url, expiresAt }
    this.URL_CACHE_DURATION = 45 * 60 * 1000 // 45 minutes (URLs expire in 1 hour)
  }

  /**
   * Gets a display URL for a file.
   * Uses cached signed URLs when available.
   *
   * @param {string} bucket - Bucket name
   * @param {string} filePath - File path
   * @returns {Promise<{success: boolean, url?: string, fromCache?: boolean, error?: string}>}
   */
  async getFileUrl(bucket, filePath) {
    if (!filePath) {
      return {
        success: false,
        error: 'File path is required'
      }
    }

    const cacheKey = `${bucket}:${filePath}`
    const cached = this.urlCache.get(cacheKey)

    // Return cached URL if still valid
    if (cached && cached.expiresAt > Date.now()) {
      return {
        success: true,
        url: cached.url,
        fromCache: true
      }
    }

    // Fetch new signed URL based on bucket
    let result

    switch (bucket) {
      case STORAGE_BUCKETS.CLIENT_PHOTOS:
        result = await getClientPhotoUrl(filePath)
        break
      case STORAGE_BUCKETS.CLIENT_IDS:
        result = await getClientIdDocumentUrl(filePath)
        break
      case STORAGE_BUCKETS.PAYMENT_VOUCHERS:
        result = await getPaymentVoucherUrl(filePath)
        break
      case STORAGE_BUCKETS.ASSET_PHOTOS:
        result = await getAssetPhotoUrls([filePath])
        if (result.success) {
          result.url = result.urls.get(filePath)
        }
        break
      default:
        return {
          success: false,
          error: `Unknown bucket: ${bucket}`
        }
    }

    if (!result.success) {
      return {
        success: false,
        error: result.error
      }
    }

    // Cache the URL
    const url = result.url || result.urls?.get(filePath)
    if (url) {
      this.urlCache.set(cacheKey, {
        url,
        expiresAt: Date.now() + this.URL_CACHE_DURATION
      })
    }

    return {
      success: true,
      url: url,
      fromCache: false
    }
  }

  /**
   * Gets URLs for multiple files.
   * Uses cached URLs when available.
   *
   * @param {string} bucket - Bucket name
   * @param {string[]} filePaths - Array of file paths
   * @returns {Promise<{success: boolean, urls?: Map, errors?: array}>}
   */
  async getFileUrls(bucket, filePaths) {
    if (!filePaths || filePaths.length === 0) {
      return {
        success: true,
        urls: new Map()
      }
    }

    const urls = new Map()
    const uncachedPaths = []

    // Check cache first
    for (const filePath of filePaths) {
      const cacheKey = `${bucket}:${filePath}`
      const cached = this.urlCache.get(cacheKey)

      if (cached && cached.expiresAt > Date.now()) {
        urls.set(filePath, cached.url)
      } else {
        uncachedPaths.push(filePath)
      }
    }

    // Fetch uncached URLs
    if (uncachedPaths.length > 0) {
      if (bucket === STORAGE_BUCKETS.ASSET_PHOTOS) {
        const result = await getAssetPhotoUrls(uncachedPaths)

        if (result.success && result.urls) {
          result.urls.forEach((url, path) => {
            urls.set(path, url)
            this.urlCache.set(`${bucket}:${path}`, {
              url,
              expiresAt: Date.now() + this.URL_CACHE_DURATION
            })
          })
        }
      } else {
        // Fetch one by one for other buckets
        for (const filePath of uncachedPaths) {
          const result = await this.getFileUrl(bucket, filePath)
          if (result.success) {
            urls.set(filePath, result.url)
          }
        }
      }
    }

    return {
      success: urls.size > 0 || filePaths.length === 0,
      urls: urls
    }
  }

  /**
   * Clears expired URLs from cache.
   * Call periodically to prevent memory leaks.
   */
  clearExpiredUrls() {
    const now = Date.now()

    for (const [key, cached] of this.urlCache.entries()) {
      if (cached.expiresAt <= now) {
        this.urlCache.delete(key)
      }
    }
  }

  /**
   * Clears entire URL cache.
   */
  clearUrlCache() {
    this.urlCache.clear()
  }

  /**
   * Gets URL cache statistics.
   * Useful for debugging.
   *
   * @returns {object} Cache stats
   */
  getCacheStats() {
    let expired = 0
    let valid = 0
    const now = Date.now()

    for (const cached of this.urlCache.values()) {
      if (cached.expiresAt <= now) {
        expired++
      } else {
        valid++
      }
    }

    return {
      total: this.urlCache.size,
      valid,
      expired
    }
  }

  /**
   * Deletes a file from storage.
   *
   * @param {string} bucket - Bucket name
   * @param {string} filePath - File path
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteFile(bucket, filePath) {
    try {
      const result = await deleteStorageFile(bucket, filePath)

      if (result.success) {
        // Clear from cache
        this.urlCache.delete(`${bucket}:${filePath}`)
      }

      return result
    } catch (err) {
      return {
        success: false,
        error: err.message
      }
    }
  }

  /**
   * Deletes all files associated with a client.
   *
   * @param {string} clientId - Client ID
   * @param {string} userId - User ID
   * @returns {Promise<{success: boolean, deletedCounts?: object, error?: string}>}
   */
  async deleteClientFiles(clientId, userId) {
    return deleteClientFiles(clientId, userId)
  }

  /**
   * Deletes asset photos.
   *
   * @param {string[]} assetPhotoPaths - Array of photo paths
   * @returns {Promise<{success: boolean, deletedCount?: number, error?: string}>}
   */
  async deleteAssetPhotos(assetPhotoPaths) {
    try {
      const result = await deleteAssetPhotos(assetPhotoPaths)

      if (result.success) {
        // Clear from cache
        assetPhotoPaths.forEach(path => {
          this.urlCache.delete(`${STORAGE_BUCKETS.ASSET_PHOTOS}:${path}`)
        })
      }

      return result
    } catch (err) {
      return {
        success: false,
        error: err.message
      }
    }
  }

  /**
   * Deletes a payment voucher.
   *
   * @param {string} voucherPath - Voucher file path
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deletePaymentVoucher(voucherPath) {
    try {
      const result = await deletePaymentVoucher(voucherPath)

      if (result.success) {
        this.urlCache.delete(`${STORAGE_BUCKETS.PAYMENT_VOUCHERS}:${voucherPath}`)
      }

      return result
    } catch (err) {
      return {
        success: false,
        error: err.message
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const fileManager = new FileManager()

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Re-export utility functions for convenience.
 */
export { formatFileSize, getFileDisplayName }
