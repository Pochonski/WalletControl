/**
 * storageExamples.js — Usage examples for the storage system.
 *
 * These are example functions showing how to use the storage API
 * in different parts of the application.
 *
 * Not imported in production - for reference only.
 */

import {
  uploadClientPhoto,
  uploadClientIdDocument,
  uploadPaymentVoucher,
  uploadAssetPhotos,
  getClientPhotoUrl,
  getAssetPhotoUrls,
  deleteStorageFile,
} from './storageService.js'

import { fileUploadManager } from './fileUploadManager.js'
import { fileManager, formatFileSize } from './fileManager.js'
import { STORAGE_BUCKETS } from '../adapters/supabaseStorage.js'

// ============================================================================
// EXAMPLE 1: Upload Client Profile Photo
// ============================================================================

export async function exampleUploadClientPhoto(fileInput, clientId, userId) {
  const file = fileInput.files[0]
  if (!file) {
    console.error('No file selected')
    return
  }

  console.log(`Uploading photo: ${file.name} (${formatFileSize(file.size)})`)

  const result = await fileUploadManager.uploadClientPhoto(file, clientId, userId)

  if (result.success) {
    console.log('Upload successful!')
    console.log('Stored at path:', result.path)

    // In real app, save this path to database:
    // await supabaseClient.from('clientes').update({
    //   foto_rostro_path: result.path
    // }).eq('id', clientId)

    return result.path
  } else {
    console.error('Upload failed:', result.error)
    return null
  }
}

// ============================================================================
// EXAMPLE 2: Upload Client ID Documents
// ============================================================================

export async function exampleUploadClientIdDocuments(
  frentInput,
  reversoInput,
  clientId,
  userId
) {
  const results = {
    frente: null,
    reverso: null
  }

  // Upload front side
  if (frentInput.files[0]) {
    const result = await fileUploadManager.uploadClientIdDocument(
      frentInput.files[0],
      clientId,
      userId,
      'cedula-frente'
    )

    if (result.success) {
      results.frente = result.path
      console.log('Front side uploaded:', result.path)
    } else {
      console.error('Front side upload failed:', result.error)
    }
  }

  // Upload reverse side
  if (reversoInput.files[0]) {
    const result = await fileUploadManager.uploadClientIdDocument(
      reversoInput.files[0],
      clientId,
      userId,
      'cedula-reverso'
    )

    if (result.success) {
      results.reverso = result.path
      console.log('Reverse side uploaded:', result.path)
    } else {
      console.error('Reverse side upload failed:', result.error)
    }
  }

  // Save to database
  if (results.frente || results.reverso) {
    // await supabaseClient.from('clientes').update({
    //   cedula_frente_path: results.frente,
    //   cedula_reverso_path: results.reverso
    // }).eq('id', clientId)
  }

  return results
}

// ============================================================================
// EXAMPLE 3: Display Client Photo
// ============================================================================

export async function exampleDisplayClientPhoto(photoPath, imgElement) {
  if (!photoPath) {
    console.log('No photo available')
    imgElement.style.display = 'none'
    return
  }

  const result = await fileManager.getFileUrl(
    STORAGE_BUCKETS.CLIENT_PHOTOS,
    photoPath
  )

  if (result.success) {
    imgElement.src = result.url
    imgElement.style.display = 'block'
    console.log('Photo loaded (from cache:', result.fromCache + ')')
  } else {
    console.error('Failed to load photo:', result.error)
    imgElement.style.display = 'none'
  }
}

// ============================================================================
// EXAMPLE 4: Upload Multiple Asset Photos
// ============================================================================

export async function exampleUploadAssetPhotos(fileInput, assetId, userId) {
  const files = Array.from(fileInput.files)

  if (files.length === 0) {
    console.error('No files selected')
    return
  }

  console.log(`Uploading ${files.length} asset photos`)

  const result = await fileUploadManager.uploadAssetPhotos(
    files,
    assetId,
    userId
  )

  if (result.success) {
    console.log('All photos uploaded successfully!')
    console.log('Paths:', result.paths)

    // Save to database
    // await supabaseClient.from('activos').update({
    //   fotos_paths: result.paths
    // }).eq('id', assetId)

    return result.paths
  } else {
    console.error('Upload failed:', result.error)
    return null
  }
}

// ============================================================================
// EXAMPLE 5: Display Asset Photo Gallery
// ============================================================================

export async function exampleDisplayAssetGallery(photoPaths, galleryElement) {
  if (!photoPaths || photoPaths.length === 0) {
    console.log('No photos available')
    galleryElement.innerHTML = '<p>No hay fotos disponibles</p>'
    return
  }

  // Clear existing images
  galleryElement.innerHTML = ''

  // Get all signed URLs
  const result = await fileManager.getFileUrls(
    STORAGE_BUCKETS.ASSET_PHOTOS,
    photoPaths
  )

  if (!result.success) {
    console.error('Failed to load photos:', result.error)
    return
  }

  // Display each photo
  result.urls.forEach((url, path) => {
    const container = document.createElement('div')
    container.className = 'asset-photo'

    const img = document.createElement('img')
    img.src = url
    img.alt = 'Asset photo'
    img.style.maxWidth = '100%'
    img.style.height = 'auto'

    const deleteBtn = document.createElement('button')
    deleteBtn.textContent = 'Eliminar'
    deleteBtn.onclick = () => exampleDeleteAssetPhoto(path, galleryElement)

    container.appendChild(img)
    container.appendChild(deleteBtn)
    galleryElement.appendChild(container)
  })

  console.log(`Displayed ${result.urls.size} photos`)
}

// ============================================================================
// EXAMPLE 6: Upload Payment Voucher
// ============================================================================

export async function exampleUploadPaymentVoucher(fileInput, paymentId, userId) {
  const file = fileInput.files[0]
  if (!file) {
    console.error('No file selected')
    return
  }

  console.log(`Uploading voucher: ${file.name}`)

  const result = await fileUploadManager.uploadPaymentVoucher(
    file,
    paymentId,
    userId
  )

  if (result.success) {
    console.log('Voucher uploaded:', result.path)

    // Save to database
    // await supabaseClient.from('pagos').update({
    //   comprobante_path: result.path
    // }).eq('id', paymentId)

    return result.path
  } else {
    console.error('Upload failed:', result.error)
    return null
  }
}

// ============================================================================
// EXAMPLE 7: View Payment Voucher
// ============================================================================

export async function exampleViewPaymentVoucher(voucherPath, linkElement) {
  if (!voucherPath) {
    console.log('No voucher available')
    linkElement.style.display = 'none'
    return
  }

  const result = await fileManager.getFileUrl(
    STORAGE_BUCKETS.PAYMENT_VOUCHERS,
    voucherPath
  )

  if (result.success) {
    linkElement.href = result.url
    linkElement.textContent = 'Ver comprobante'
    linkElement.style.display = 'inline-block'
    linkElement.target = '_blank'
  } else {
    console.error('Failed to load voucher:', result.error)
    linkElement.style.display = 'none'
  }
}

// ============================================================================
// EXAMPLE 8: Delete Asset Photo
// ============================================================================

export async function exampleDeleteAssetPhoto(photoPath, galleryElement) {
  if (!confirm('¿Eliminar esta foto?')) {
    return
  }

  console.log('Deleting photo:', photoPath)

  const result = await fileManager.deleteFile(
    STORAGE_BUCKETS.ASSET_PHOTOS,
    photoPath
  )

  if (result.success) {
    console.log('Photo deleted successfully')
    // Refresh gallery
    // exampleDisplayAssetGallery(remainingPaths, galleryElement)
  } else {
    console.error('Delete failed:', result.error)
  }
}

// ============================================================================
// EXAMPLE 9: Delete All Client Files
// ============================================================================

export async function exampleDeleteAllClientFiles(clientId, userId) {
  if (!confirm('¿Eliminar todos los archivos de este cliente?')) {
    return
  }

  console.log('Deleting all files for client:', clientId)

  const result = await fileManager.deleteClientFiles(clientId, userId)

  if (result.success) {
    console.log('Files deleted:', result.deletedCounts)
  } else {
    console.error('Delete failed:', result.error)
  }
}

// ============================================================================
// EXAMPLE 10: Cache Management
// ============================================================================

export function exampleManageCache() {
  // Check cache statistics
  const stats = fileManager.getCacheStats()
  console.log('Cache statistics:', stats)
  // Output: { total: 15, valid: 12, expired: 3 }

  // Clear expired URLs
  fileManager.clearExpiredUrls()
  console.log('Cleared expired URLs')

  // Check again
  const newStats = fileManager.getCacheStats()
  console.log('New cache statistics:', newStats)

  // Clear entire cache if needed
  // fileManager.clearUrlCache()
  // console.log('Cache cleared completely')
}

// ============================================================================
// EXAMPLE 11: Form Integration
// ============================================================================

export function exampleSetupPhotoUploadForm(formElement, clientId, userId) {
  const photoInput = formElement.querySelector('input[type="file"]')
  const photoImg = formElement.querySelector('img.preview')

  // Preview before upload
  photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Show preview
    const reader = new FileReader()
    reader.onload = (event) => {
      photoImg.src = event.target.result
      photoImg.style.display = 'block'
    }
    reader.readAsDataURL(file)

    // Show file info
    console.log(`Selected: ${file.name} (${formatFileSize(file.size)})`)
  })

  // Handle form submit
  formElement.addEventListener('submit', async (e) => {
    e.preventDefault()

    const file = photoInput.files[0]
    if (!file) {
      alert('Selecciona una foto')
      return
    }

    const path = await exampleUploadClientPhoto(photoInput, clientId, userId)
    if (path) {
      console.log('Photo saved to database')
      formElement.reset()
      photoImg.style.display = 'none'
    }
  })
}

// ============================================================================
// EXAMPLE 12: Batch Operations
// ============================================================================

export async function exampleBatchUploadAssets(assetsList, userId) {
  const results = []

  for (const asset of assetsList) {
    console.log(`Processing asset: ${asset.name}`)

    const photoPaths = await exampleUploadAssetPhotos(
      asset.photosInput,
      asset.id,
      userId
    )

    if (photoPaths) {
      results.push({
        assetId: asset.id,
        photoPaths: photoPaths
      })
    }
  }

  console.log('Batch upload complete:', results)
  return results
}
