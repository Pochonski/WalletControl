# 🎯 CHEATSHEET DE DESARROLLO
## Hoja de Trucos Rápida para Codificación Diaria

---

## 🚀 SETUP INICIAL (Uno solo)

### 1. Instalar Supabase client
```bash
npm install @supabase/supabase-js
```

### 2. Variables de entorno (.env.local)
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_ENVIRONMENT=production
```

### 3. Archivo: adapters/supabaseClient.js
```js
import { createClient } from '@supabase/supabase-js'

export const supabaseClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

---

## 🔐 PATRON: Data Adapter (COPIAR Y ADAPTAR)

```js
// adapters/dataAdapters/NOMBREAAPTER.js

import { supabaseClient } from '../supabaseClient.js'
import { encryptionAdapter } from '../encryptionAdapter.js'

export const NOMBREADAPTER = {
  // CARGAR datos
  load: async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const { data, error } = await supabaseClient
        .from('TABLA_NOMBRE')
        .select('*')
        .eq('user_id', user.id)

      if (error) throw error

      // Desencriptar sensibles
      return data.map(item => 
        encryptionAdapter.decryptItem(item)
      )
    } catch (err) {
      console.error('[NOMBREADAPTER] Error loading:', err.message)
      // Fallback a localStorage
      return loadFromLocalStorage('TABLA_NOMBRE') || []
    }
  },

  // CREAR
  save: async (item) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()

      // Validar
      if (!item.nombre) throw new Error('Nombre requerido')

      // Encriptar sensibles
      const encrypted = encryptionAdapter.encryptItem({
        ...item,
        user_id: user.id
      })

      const { data, error } = await supabaseClient
        .from('TABLA_NOMBRE')
        .insert([encrypted])
        .select()

      if (error) throw error

      // Persistir local
      saveToLocalStorage('TABLA_NOMBRE', data[0])
      
      return data[0]
    } catch (err) {
      console.error('[NOMBREADAPTER] Error saving:', err.message)
      throw err
    }
  },

  // ACTUALIZAR
  update: async (id, cambios) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()

      const encrypted = encryptionAdapter.encryptItem(cambios)

      const { data, error } = await supabaseClient
        .from('TABLA_NOMBRE')
        .update(encrypted)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()

      if (error) throw error

      updateLocalStorage('TABLA_NOMBRE', id, data[0])
      return data[0]
    } catch (err) {
      console.error('[NOMBREADAPTER] Error updating:', err.message)
      throw err
    }
  }
}
```

---

## 🎮 PATRON: Controller (COPIAR Y ADAPTAR)

```js
// feature/ui/XXXController.js

export const initXXXController = (dom, store, i18n) => {
  const labels = i18n.getLabels()
  const form = dom.xxx.form
  const tabla = dom.xxx.tabla

  // 1. BIND: eventos
  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    const data = new FormData(form)
    const nuevoItem = Object.fromEntries(data)

    // Validar (domain)
    const { valid, errors } = validateXXX(nuevoItem)
    if (!valid) {
      showErrors(errors)
      return
    }

    // Dispatch local (feedback inmediato)
    store.dispatch({
      type: ACTIONS.ADD_XXX,
      payload: nuevoItem
    })

    // Sincronizar background
    try {
      const saved = await xxxDataAdapter.save(nuevoItem)
      
      store.dispatch({
        type: ACTIONS.SYNC_XXX_REMOTO,
        payload: { remoteId: saved.id }
      })

      showSuccess(labels.xxx_guardado)
      form.reset()
    } catch (err) {
      store.dispatch({
        type: ACTIONS.SYNC_ERROR,
        payload: { error: err.message }
      })

      showError(labels.error_guardar)
    }
  })

  // 2. RENDER: actualiza UI
  const render = () => {
    const { xxx } = store.getState()
    
    tabla.innerHTML = ''
    const fragment = document.createDocumentFragment()

    xxx.forEach(item => {
      const row = document.createElement('tr')
      row.innerHTML = `<td>${item.nombre}</td>...`
      fragment.appendChild(row)
    })

    tabla.appendChild(fragment)
  }

  // 3. SUBSCRIBE: re-render cuando estado cambia
  store.subscribe(render)

  // 4. RENDER inicial
  render()
}
```

---

## 🔑 AUTENTICACIÓN

### Login
```js
const { data, error } = await supabaseClient.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
})

if (error) {
  showError('Email o contraseña incorrectos')
  return
}

// User está logueado
const { user } = data
```

### Register
```js
const { data, error } = await supabaseClient.auth.signUp({
  email: 'user@example.com',
  password: 'password123'
})

if (error) {
  showError(error.message)
  return
}

// Enviar confirmación de email (automático)
```

### Logout
```js
await supabaseClient.auth.signOut()

// Limpiar Redux
store.dispatch({ type: ACTIONS.CLEAR_STATE })

// Limpiar storage
localStorage.clear()
sessionStorage.clear()

// Redirect a login
location.href = '/login.html'
```

### Obtener usuario actual
```js
const { data: { user } } = await supabaseClient.auth.getUser()

if (!user) {
  // Redirigir a login
  location.href = '/login.html'
}

// Usar user.id en RLS
```

---

## 📊 QUERIES BÁSICAS

### SELECT con RLS (automático)
```js
const { data, error } = await supabaseClient
  .from('clientes')
  .select('id, nombre, email')
  .eq('estado', 'ACTIVO')

// RLS automáticamente agrega:
// WHERE user_id = (tu usuario actual)
```

### INSERT
```js
const { data, error } = await supabaseClient
  .from('clientes')
  .insert([{
    nombre: 'Juan',
    cedula: 'encriptado...',
    user_id: user.id // RLS depende de esto
  }])
  .select()

if (error) console.error(error)
else console.log(data[0].id) // UUID creado
```

### UPDATE
```js
const { data, error } = await supabaseClient
  .from('clientes')
  .update({ nombre: 'Juan Actualizado' })
  .eq('id', clienteId)
  .eq('user_id', user.id) // Validación extra
  .select()
```

### SEARCH (case-insensitive)
```js
const { data, error } = await supabaseClient
  .from('clientes')
  .select('*')
  .ilike('nombre', `%${term}%`) // case-insensitive

// O usar función PL/pgSQL:
const { data } = await supabaseClient
  .rpc('buscar_clientes', {
    p_user_id: user.id,
    p_termino: searchTerm
  })
```

### RANGO DE FECHAS
```js
const { data, error } = await supabaseClient
  .from('pagos')
  .select('*')
  .gte('fecha_pago', '2024-01-01')
  .lte('fecha_pago', '2024-12-31')
```

---

## 📸 UPLOAD DE FOTOS

### Subir archivo
```js
// adapters/fileAdapters/clientesPhotosAdapter.js

export const clientesPhotosAdapter = {
  upload: async (clienteId, file, fieldName) => {
    const { data: { user } } = await supabaseClient.auth.getUser()
    const folder = `clientes/${user.id}/${clienteId}`
    const filePath = `${folder}/${fieldName}.jpg`

    // Validar
    if (file.size > 5_000_000) throw new Error('Muy grande (max 5MB)')
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      throw new Error('Solo JPG o PNG')
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
```

### Descargar con URL firmada
```js
const { data, error } = await supabaseClient
  .storage
  .from('fotos')
  .createSignedUrl('path/to/file.jpg', 3600) // 1 hora

if (error) throw error

// data.signedUrl es la URL segura
// Úsala como <img src={data.signedUrl}>
// Expira en 3600 segundos
```

---

## 🔒 ENCRIPTACIÓN (libsodium.js)

### Setup
```bash
npm install libsodium.js
```

### Adapter de encriptación
```js
// adapters/encryptionAdapter.js

import * as sodium from 'libsodium.js'

// Derivar clave de password del usuario
const deriveKey = async (password, email) => {
  // PBKDF2: derivar clave de password
  // email = salt (public, no problem)
  
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)
  const saltBuffer = encoder.encode(email)

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
  // Encriptar ANTES de enviar a Supabase
  encryptData: async (data, password, email) => {
    const key = await deriveKey(password, email)
    const encoder = new TextEncoder()
    const plaintext = encoder.encode(JSON.stringify(data))
    
    const iv = crypto.getRandomValues(new Uint8Array(12))
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext
    )

    // Retornar base64
    return {
      encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv))
    }
  },

  // Desencriptar DESPUÉS de recibir de Supabase
  decryptData: async (encryptedData, password, email) => {
    const key = await deriveKey(password, email)
    
    const encrypted = Uint8Array.from(
      atob(encryptedData.encrypted),
      c => c.charCodeAt(0)
    )
    
    const iv = Uint8Array.from(
      atob(encryptedData.iv),
      c => c.charCodeAt(0)
    )

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    )

    const decoder = new TextDecoder()
    return JSON.parse(decoder.decode(decrypted))
  }
}
```

---

## 📋 LOGGING DE AUDITORÍA

### Registrar acción
```js
// adapters/auditAdapter.js

export const auditAdapter = {
  log: async (action, entity, entityId, details = {}) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()

      await supabaseClient
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action, // 'INSERT', 'UPDATE', 'DELETE'
          entity, // 'cliente', 'prestamo', etc
          entity_id: entityId,
          details: {
            ...details,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          }
        })
    } catch (err) {
      console.warn('Audit logging failed:', err)
      // No falla si falla el log
    }
  }
}
```

### Usar en adapters
```js
// Cuando creas cliente
await auditAdapter.log('INSERT', 'cliente', nuevoCliente.id, {
  nombre: nuevoCliente.nombre
})

// Cuando modificas
await auditAdapter.log('UPDATE', 'cliente', clienteId, {
  cambios: { telefono: { antes: '1234', después: '5678' } }
})

// Cuando descargas foto
await auditAdapter.log('DOWNLOAD', 'foto', fotoId, {
  archivo: 'cedula_frente.jpg'
})
```

---

## 🔄 OFFLINE-FIRST

### Detectar conexión
```js
const isOnline = navigator.onLine

window.addEventListener('online', () => {
  console.log('Volvió la conexión')
  syncManager.syncPending()
})

window.addEventListener('offline', () => {
  console.log('Perdió la conexión')
})
```

### Marcar como pendiente
```js
// Cuando adapter.save() falla
store.dispatch({
  type: ACTIONS.MARK_PENDING_SYNC,
  payload: { entityType: 'cliente', id: cliente.id, data: cliente }
})

// Redux almacena en estado
```

### Sincronizar cuando vuelve conexión
```js
export const createSyncManager = (store) => {
  return {
    syncPending: async () => {
      const { pendingSync } = store.getState()

      for (const { entityType, data } of pendingSync) {
        try {
          const adapter = getAdapterForEntity(entityType)
          const saved = await adapter.save(data)

          store.dispatch({
            type: ACTIONS.MARK_SYNCED,
            payload: { id: data.id }
          })
        } catch (err) {
          console.error('Sync error:', err)
          // Reintenta después
        }
      }
    }
  }
}

// En main.js
window.addEventListener('online', () => syncManager.syncPending())
```

---

## 🧪 TESTING RÁPIDO

### Probar RLS (usuario A no ve datos de usuario B)
```js
// Usuario A
const clienteA = await clientesDataAdapter.save({ nombre: 'Cliente A' })

// Logout A, Login B
await supabaseClient.auth.signOut()
const usuarioB = await supabaseClient.auth.signInWithPassword(...)

// Intentar ver cliente de A
const { data } = await supabaseClient
  .from('clientes')
  .select('*')
  .eq('id', clienteA.id)

console.assert(data.length === 0, 'RLS FALLÓ')
console.log('✅ RLS funciona: usuario B no ve cliente de A')
```

### Probar encriptación
```js
const cliente = await clientesDataAdapter.save({
  nombre: 'Juan',
  cedula: '1234567890'
})

// Ver en DB sin desencriptar
const raw = await supabaseClient
  .from('clientes')
  .select('cedula')
  .eq('id', cliente.id)

console.assert(
  raw.data[0].cedula !== '1234567890',
  'NO ESTÁ ENCRIPTADO'
)
console.log('✅ Encriptación funciona: cédula está cifrada')
```

### Probar offline-first
```js
// Abrir DevTools → Network → Offline

const cliente = await clientesDataAdapter.save({
  nombre: 'Test Offline'
})

// Verificar localStorage
const local = loadFromLocalStorage('clientes')
const existe = local.some(c => c.nombre === 'Test Offline')

console.assert(existe, 'NO GUARDÓ EN LOCALSTORAGE')
console.log('✅ Offline-first funciona: guardó localmente')

// Activar conexión y sincronizar
// Verificar que aparece en Supabase
```

---

## 🐛 DEBUGGING

### Ver estado de Redux
```js
// En console
window.__STORE__.getState()
```

### Ver requests a Supabase
```js
// DevTools → Network → Filter: 'supabase'
// Verá todos los requests al backend
```

### Ver localStorage
```js
// DevTools → Application → Local Storage
// Buscar: 'pendingSync', 'clientes', etc
```

### Ver logs de auditoría
```js
const { data } = await supabaseClient
  .from('audit_logs')
  .select('*')
  .order('fecha_creado', { ascending: false })
  .limit(10)

console.table(data)
```

---

## ⚡ COMANDOS GIT

```bash
# Crear rama por feature
git checkout -b feature/clientes-adapter

# Commit with context
git commit -m "feat(adapters): agregar clientesDataAdapter.js

- Implementar load(), save(), update()
- Agregar encriptación de cédula
- Fallback a localStorage si falla Supabase
- Agregar logging de auditoría"

# Push
git push origin feature/clientes-adapter

# Mergear a main (después de revisar)
git checkout main
git merge feature/clientes-adapter
git push origin main
```

---

## 📚 REFERENCIAS RÁPIDAS

| Necesito... | Busco en... |
|---|---|
| Patrón de adapter | Sección "PATRON: Data Adapter" ↑ |
| Patrón de controller | Sección "PATRON: Controller" ↑ |
| RLS no funciona | Verificar que tabla tiene `ENABLE ROW LEVEL SECURITY` |
| Upload de foto falla | Verificar tamaño (max 5MB) y formato (JPG/PNG) |
| JWT expirado | Supabase lo renueva automáticamente |
| Quiero ver datos sin encriptar | Desencriptar en cliente ANTES de guardar en Redux |
| Offline sync falla | Verificar que navigator.onLine detecta conexión |
| Usuario no ve sus datos | Verificar RLS:  `WHERE user_id = auth.uid()` |

---

## 🚀 FLUJO TÍPICO DE FEATURE

1. **Leer especificación** en memoria-agente-app-prestamos.md
2. **Crear domain/** (funciones puras)
   ```js
   // feature/domain/validate.js
   export const validateCliente = (data) => {
     return { valid: true, errors: [] }
   }
   ```

3. **Crear adapter** (integración Supabase)
   ```js
   // adapters/dataAdapters/XXXDataAdapter.js
   // Copiar patrón de arriba
   ```

4. **Crear controller** (UI + Redux)
   ```js
   // feature/ui/XXXController.js
   // Copiar patrón de arriba
   ```

5. **Testing:**
   - Crear item → aparece en UI
   - Refresh → sigue ahí (localStorage)
   - Offline: crear → online: sincroniza
   - Otro usuario: no lo ve (RLS)

6. **Git commit**
   ```bash
   git commit -m "feat(FEATURE): implementar XXX completo"
   ```

---

**Imprime esto o guárdalo en Notion. Te salvará horas de coding.**

Éxito! 🎯
