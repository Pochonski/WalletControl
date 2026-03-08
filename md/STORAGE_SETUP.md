# File Storage Implementation Guide

This document describes the file storage infrastructure for WalletControl, including setup instructions and usage examples.

## Overview

The storage system manages file uploads, downloads, and retrieval for:
- **Client Photos**: Profile photos of loan clients
- **Client IDs**: Identity documents (cédulas, passports)
- **Payment Vouchers**: Proof of payment documents
- **Asset Photos**: Photos of assets held as collateral

All files are stored in Supabase Storage with Row Level Security (RLS) policies enforcing per-user access control.

## Architecture

### Core Modules

1. **`js/adapters/supabaseStorage.js`** - Low-level storage adapter
   - Direct Supabase Storage API calls
   - Bucket configuration and validation
   - File upload/download/delete operations
   - Signed URL generation

2. **`js/storage/storageService.js`** - High-level service layer
   - Business logic for each entity type (clients, assets, payments)
   - Metadata handling
   - Cleanup functions
   - Utility functions (file size formatting, etc.)

3. **`js/storage/fileUploadManager.js`** - Upload state management
   - Upload progress tracking
   - Status monitoring
   - Error handling

4. **`js/storage/fileManager.js`** - Central file management
   - Signed URL caching (45-minute cache)
   - Batch operations
   - File deletion with cache invalidation

## Setup Instructions

### Step 1: Create Storage Buckets

1. Open Supabase Dashboard
2. Navigate to **Storage** section
3. Create these four buckets (all public read, authenticated write):
   - `client-photos`
   - `client-ids`
   - `payment-vouchers`
   - `asset-photos`

**Bucket Configuration:**
- **Visibility**: Private (enforced by RLS)
- **File size limit**: 50 MB (adjust as needed)

### Step 2: Enable RLS and Create Policies

1. In SQL Editor, run the script: `supabase/storage-policies.sql`
2. This creates policies for each bucket ensuring:
   - Users can only upload to their own directory (`userId/`)
   - Users can only access their own files
   - Users can delete their own files

**Policy Structure:**
- INSERT: Users can upload to `{userId}/{filename}`
- SELECT: Users can view their own files
- UPDATE: Users can update their own files
- DELETE: Users can delete their own files

### Step 3: Verify Setup

Test in browser console:
```javascript
import { initializeStorageBuckets } from './js/adapters/supabaseStorage.js'
await initializeStorageBuckets()
```

Should see console messages confirming bucket initialization.

## Usage Examples

### Uploading Client Photo

```javascript
import { uploadClientPhoto } from './js/storage/storageService.js'
import { fileUploadManager } from './js/storage/fileUploadManager.js'

// Get file from input
const fileInput = document.getElementById('photoInput')
const file = fileInput.files[0]

// Upload
const result = await fileUploadManager.uploadClientPhoto(
  file,
  clientId,
  currentUserId
)

if (result.success) {
  console.log('Photo uploaded:', result.path)
  // Save result.path to database (clientes.foto_rostro_path)
} else {
  console.error('Upload failed:', result.error)
}
```

### Uploading Multiple Asset Photos

```javascript
import { fileUploadManager } from './js/storage/fileUploadManager.js'

const fileInput = document.getElementById('assetPhotosInput')
const files = Array.from(fileInput.files)

const result = await fileUploadManager.uploadAssetPhotos(
  files,
  assetId,
  currentUserId
)

if (result.success) {
  console.log('Photos uploaded:', result.paths)
  // Save result.paths to database (activos.fotos_paths)
} else {
  console.error('Upload failed:', result.error)
}
```

### Displaying Uploaded Photos

```javascript
import { fileManager } from './js/storage/fileManager.js'
import { STORAGE_BUCKETS } from './js/adapters/supabaseStorage.js'

// Get signed URL for displaying image
const result = await fileManager.getFileUrl(
  STORAGE_BUCKETS.CLIENT_PHOTOS,
  photoPath
)

if (result.success) {
  imgElement.src = result.url
  console.log('From cache:', result.fromCache)
}
```

### Displaying Multiple Asset Photos

```javascript
const photoPaths = ['user-id/1234567-abc123.jpg', 'user-id/1234568-def456.jpg']

const result = await fileManager.getFileUrls(
  STORAGE_BUCKETS.ASSET_PHOTOS,
  photoPaths
)

if (result.success) {
  result.urls.forEach((url, path) => {
    const img = document.createElement('img')
    img.src = url
    gallery.appendChild(img)
  })
}
```

### Uploading Payment Voucher

```javascript
import { fileUploadManager } from './js/storage/fileUploadManager.js'

const voucherFile = document.getElementById('voucherInput').files[0]

const result = await fileUploadManager.uploadPaymentVoucher(
  voucherFile,
  paymentId,
  currentUserId
)

if (result.success) {
  // Save result.path to database (pagos.comprobante_path)
  console.log('Voucher path:', result.path)
}
```

### Deleting a File

```javascript
import { fileManager } from './js/storage/fileManager.js'
import { STORAGE_BUCKETS } from './js/adapters/supabaseStorage.js'

const result = await fileManager.deleteFile(
  STORAGE_BUCKETS.CLIENT_PHOTOS,
  photoPath
)

if (result.success) {
  console.log('File deleted successfully')
}
```

### Deleting All Client Files

```javascript
const result = await fileManager.deleteClientFiles(clientId, userId)

if (result.success) {
  console.log('Deleted:', result.deletedCounts)
  // Output: { 'client-photos': 1, 'client-ids': 2 }
}
```

## File Validation

File uploads are validated for type and size:

| Bucket | Max Size | Allowed Types |
|--------|----------|---------------|
| `client-photos` | 5 MB | JPEG, PNG, WebP |
| `client-ids` | 10 MB | JPEG, PNG, WebP, PDF |
| `payment-vouchers` | 10 MB | JPEG, PNG, WebP, PDF |
| `asset-photos` | 8 MB | JPEG, PNG, WebP |

Validation errors are returned in upload responses:
```javascript
const result = await uploadFile(bucket, file, userId)
if (!result.success) {
  console.error(result.error) // "Archivo muy grande. Máximo permitido: 5MB"
}
```

## Signed URL Caching

To improve performance, signed URLs are cached for 45 minutes. The underlying URLs expire after 1 hour.

```javascript
const result = await fileManager.getFileUrl(bucket, filePath)
console.log(result.fromCache) // true if from cache, false if freshly generated

// Check cache statistics
const stats = fileManager.getCacheStats()
console.log(stats) // { total: 15, valid: 12, expired: 3 }

// Clear expired URLs periodically
fileManager.clearExpiredUrls()

// Clear entire cache if needed
fileManager.clearUrlCache()
```

## Database Integration

Update your database records to store file paths:

### Clients Table
```javascript
// Update clientes table with file paths
const { error } = await supabaseClient
  .from('clientes')
  .update({
    foto_rostro_path: result.path,
    cedula_frente_path: idResult.path,
    cedula_reverso_path: idReverseResult.path
  })
  .eq('id', clientId)
```

### Assets Table
```javascript
// Update activos table with photo paths
const { error } = await supabaseClient
  .from('activos')
  .update({
    fotos_paths: result.paths  // Array of paths
  })
  .eq('id', assetId)
```

### Payments Table
```javascript
// Update pagos table with voucher path
const { error } = await supabaseClient
  .from('pagos')
  .update({
    comprobante_path: result.path
  })
  .eq('id', paymentId)
```

## Error Handling

All storage operations return consistent result objects:

```javascript
{
  success: boolean,
  path?: string,        // For single file upload
  paths?: string[],     // For multiple file upload
  url?: string,         // For URL retrieval
  urls?: Map,          // For multiple URL retrieval
  error?: string       // Error message if failed
}
```

Example error handling:
```javascript
const result = await fileUploadManager.uploadClientPhoto(file, clientId, userId)

if (!result.success) {
  // Common errors:
  // - "Tipo de archivo no permitido..."
  // - "Archivo muy grande..."
  // - "Error al subir archivo"

  showToast(result.error, 'error')
  return
}

// File uploaded successfully
console.log('Saved at:', result.path)
```

## Cleanup and Maintenance

### Periodic Cache Cleanup

```javascript
// Call every 10 minutes or after batch operations
fileManager.clearExpiredUrls()
```

### Remove Old Uploads

```javascript
import { fileUploadManager } from './js/storage/fileUploadManager.js'

// Call periodically to remove old upload records
fileUploadManager.cleanupOldUploads(5 * 60 * 1000) // 5 minutes

// Or clear all
fileUploadManager.clearAll()
```

### Delete User Data on Account Deletion

```javascript
// When deleting a user account, also clean up all files
const result = await fileManager.deleteClientFiles(clientId, userId)

if (!result.success) {
  console.error('Failed to delete files:', result.error)
}
```

## Security Considerations

1. **RLS Policies**: All buckets enforce RLS. Users can only access files in their own directory.

2. **Signed URLs**: URLs are generated with 1-hour expiration. They cannot be regenerated after the signing key rotates.

3. **File Organization**: Files are stored as `{userId}/{timestamp}-{random}.{extension}` to ensure uniqueness and prevent directory traversal.

4. **No Public Access**: All buckets are private. Public sharing requires explicit signed URL generation.

5. **File Validation**: Type and size validation prevents malicious uploads.

## Troubleshooting

### "Bucket does not exist"
- Ensure all four buckets are created in Supabase Dashboard
- Check bucket names match exactly: `client-photos`, `client-ids`, `payment-vouchers`, `asset-photos`

### "Permission denied"
- Verify RLS policies are enabled and policies.sql was executed
- Check user is authenticated (valid session)
- Ensure file path follows pattern: `{userId}/{filename}`

### "File path is required"
- Ensure file path is stored in database before calling functions
- Don't pass null or empty strings

### "Signed URL generation failed"
- Check user has permission to access the file
- Verify file exists in storage (may have been deleted)
- Try clearing URL cache and regenerating

### Slow performance
- Cache statistics: `fileManager.getCacheStats()`
- Clear old cache entries: `fileManager.clearExpiredUrls()`
- Batch URL requests when possible

## Future Enhancements

- Image resizing/thumbnail generation
- Virus scanning for uploads
- Batch upload progress tracking
- Download tracking and analytics
- File versioning for ID documents
