import { supabaseClient } from '../supabaseClient.js'

export const assetPhotosAdapter = {
  upload: async (activoId, file, indexName = 'foto_1') => {
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('No autorizado')
    
    // Ruta: fotos/USER_ID/activos/ACTIVO_ID/indexName.jpg
    const folder = `${user.id}/activos/${activoId}`
    const filePath = `${folder}/${indexName}.jpg`

    // Validar
    if (file.size > 5_000_000) throw new Error('El archivo es muy grande (máximo 5MB)')
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      throw new Error('Solo se permiten imágenes JPG o PNG')
    }

    // Subir
    const { data, error } = await supabaseClient
      .storage
      .from('fotos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (error) throw error

    // Obtener URL firmada (expiración 1 hora)
    const { data: urlData } = await supabaseClient
      .storage
      .from('fotos')
      .createSignedUrl(filePath, 3600)

    return {
      path: filePath,
      url: urlData.signedUrl
    }
  }
}
