# 🔐 ARQUITECTURA DE SEGURIDAD + SUPABASE
## Integración Segura sin Romper Redux

**Principio Core:** Supabase es una capa de datos, Redux sigue siendo la única fuente de verdad en memoria. La seguridad se implementa en 3 niveles: Auth, Encryption, RLS (Row Level Security).

---

## 📊 DIAGRAMA DE FLUJO DE DATOS

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USUARIO                                     │
│                    (Prestamista + Asistentes)                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
         ┌────────────────────────────────────────┐
         │   CAPA DE AUTENTICACIÓN                 │
         │   ┌──────────────────────────────────┐  │
         │   │ Supabase Auth (UUID del usuario) │  │
         │   │ Token JWT (almacenado seguro)    │  │
         │   │ Session validada por RLS         │  │
         │   └──────────────────────────────────┘  │
         └────────────────────────────────────────┘
                             │
                             ▼
         ┌────────────────────────────────────────┐
         │   CAPA DE APLICACIÓN (Redux)           │
         │   ┌──────────────────────────────────┐  │
         │   │ store.js (estado en memoria)     │  │
         │   │ controllers (vinculan eventos)   │  │
         │   │ domain/ (lógica pura)            │  │
         │   └──────────────────────────────────┘  │
         └────────────────────────────────────────┘
                             │
                             ▼
    ┌─────────────────────────────────────────────────┐
    │  CAPA DE INTEGRACIÓN SUPABASE (Adapters)       │
    │  ┌─────────────────────────────────────────────┤
    │  │ supabaseAuth.js      → login, logout, register │
    │  │ supabaseClientAdapter.js → cliente Supabase │
    │  │ clientesDataAdapter.js   → CRUD clientes   │
    │  │ prestamosDataAdapter.js  → CRUD préstamos  │
    │  │ pagosDataAdapter.js      → CRUD pagos      │
    │  │ activosDataAdapter.js    → CRUD activos    │
    │  │ encryptionAdapter.js     → cifra/descifra  │
    │  └─────────────────────────────────────────────┤
    │  Cada adapter sigue patrón:                    │
    │  { load(), save(), update(), delete() }        │
    │  + manejo de tokens + validaciones             │
    └─────────────────────────────────────────────────┘
                             │
                             ▼
    ┌─────────────────────────────────────────────────┐
    │         SUPABASE (Backend + Database)           │
    │  ┌─────────────────────────────────────────────┤
    │  │ Auth (JWT, session management)              │
    │  │ PostgreSQL (datos + RLS policies)           │
    │  │ Storage (fotos de cédulas, avatares)        │
    │  │ Realtime (sync opcional para futuro)        │
    │  └─────────────────────────────────────────────┤
    │  SEGURIDAD:                                     │
    │  • RLS: Solo los datos del usuario actual      │
    │  • JWT: Valida cada request                    │
    │  • Encrypted: Campos sensibles cifrados        │
    │  • Audit: Log de quién accedió cuándo          │
    │  • Backup: Automático + encriptado             │
    └─────────────────────────────────────────────────┘
```

---

## 🔐 NIVELES DE SEGURIDAD

### NIVEL 1: AUTENTICACIÓN (Supabase Auth)

**Responsabilidad:** Verificar que eres quien dices ser.

#### Flujo de Login
```
1. Usuario ingresa email + password
2. supabaseAuth.login(email, password)
   ↓
3. Supabase valida credenciales
   ↓
4. Retorna JWT token + user.id
   ↓
5. App almacena token de forma SEGURA (nunca localStorage simple)
   ↓
6. Cada request incluye JWT en header "Authorization"
   ↓
7. Supabase valida JWT antes de ejecutar cualquier query
```

#### Almacenamiento Seguro del Token
```js
// ❌ NUNCA HAGAS ESTO
localStorage.setItem('token', jwtToken) // Vulnerable a XSS

// ✅ HAZLO ASÍ (Memory + HttpOnly Cookie si es posible)
// En browser vanilla, la mejor opción es:
// 1. Token en memory (se borra al refresh)
// 2. Usar session/refreshToken en HttpOnly Cookie (Supabase lo hace automático)
// 3. Supabase maneja esto por ti automáticamente

// En la práctica, Supabase Client hace esto:
supabaseClient.auth.session() // Obtiene la sesión actual segura
```

#### Tipos de Usuarios
```
USUARIO ADMIN:
  - Prestamista principal (quien crea la cuenta)
  - Permisos: crear, editar, eliminar clientes/préstamos/pagos
  - Puede crear sub-usuarios (asistentes)

USUARIO ASISTENTE:
  - Creado por el admin
  - Permisos: ver clientes, registrar pagos, ver reportes
  - NO puede: eliminar, modificar tasa de interés, crear préstamos (sin aprobación)
  - Auditoría completa: qué hizo, cuándo

USUARIO CLIENTE (Futuro - fase 2):
  - El deudor puede ver su propio estado
  - Solo lee sus propios préstamos y pagos
  - RLS: no ve clientes de otros, no ve tasa de otros
```

---

### NIVEL 2: ROW LEVEL SECURITY (RLS) en Supabase

**Responsabilidad:** Que usuario solo vea los datos que le corresponden.

#### Política de RLS para Clientes
```sql
-- Solo el dueño de los datos puede verlos
CREATE POLICY "Usuarios ven sus propios clientes"
ON clientes
FOR SELECT
USING (auth.uid() = user_id);

-- Solo el propietario puede actualizar
CREATE POLICY "Usuarios editan sus propios clientes"
ON clientes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Solo el propietario puede eliminar (marcar como archivado)
CREATE POLICY "Usuarios archivan sus propios clientes"
ON clientes
FOR DELETE
USING (auth.uid() = user_id);
```

#### Política para Préstamos (cascada)
```sql
-- Un préstamo solo es visible si el cliente pertenece al usuario
CREATE POLICY "Ver préstamos propios"
ON prestamos
FOR SELECT
USING (
  cliente_id IN (
    SELECT id FROM clientes 
    WHERE user_id = auth.uid()
  )
);
```

#### Política para Pagos
```sql
-- Un pago solo es visible si la cuota pertenece a un préstamo del usuario
CREATE POLICY "Ver pagos propios"
ON pagos
FOR SELECT
USING (
  cuota_id IN (
    SELECT id FROM cuotas WHERE prestamo_id IN (
      SELECT id FROM prestamos WHERE cliente_id IN (
        SELECT id FROM clientes WHERE user_id = auth.uid()
      )
    )
  )
);
```

**Ventaja:** Aunque alguien logre un SQL injection, Supabase automáticamente filtra por `auth.uid()`. No puede ver datos de otros usuarios.

---

### NIVEL 3: ENCRIPTACIÓN EN TRÁNSITO Y REPOSO

**Responsabilidad:** Los datos están cifrados desde el cliente hasta la BD y en la BD.

#### En Tránsito (Automático con HTTPS)
```
Cliente ━━━ HTTPS (TLS 1.3) ━━━> Supabase
Todos los datos encriptados en el cable
```

#### En Reposo (Selectivo)
```
Campos que SIEMPRE se cifran:
  ✅ Número de cédula
  ✅ Fotos de cédula (almacenadas en Storage encriptado)
  ✅ Fotos de persona
  ✅ Datos bancarios (si los guardas)
  ✅ Comprobantes de pago

Cómo: Encriptación lado cliente ANTES de enviar a Supabase
```

#### Patrón de Encriptación Lado Cliente
```js
// encryptionAdapter.js

import { encrypt, decrypt } from 'libsodium.js' // o tweetnacl

const ENCRYPTION_KEY = '...' // derivada de contraseña del usuario

export const encryptionAdapter = {
  // Encripta ANTES de enviar a Supabase
  encryptClientData: (cliente) => ({
    ...cliente,
    numero_cedula: encrypt(cliente.numero_cedula, ENCRYPTION_KEY),
    // fotos se guardan en Supabase Storage encriptado, no en DB
  }),

  // Desencripta DESPUÉS de recibir de Supabase
  decryptClientData: (clienteEncriptado) => ({
    ...clienteEncriptado,
    numero_cedula: decrypt(clienteEncriptado.numero_cedula, ENCRYPTION_KEY),
  }),

  // Hash de cédula para búsqueda SIN ver datos (seguro)
  hashCedula: (cedula) => sha256(cedula),
}
```

#### Campos por Nivel de Sensibilidad

| Campo | Sensibilidad | Almacenamiento | Encriptación |
|-------|---|---|---|
| Nombre | Media | DB | No (búsqueda) |
| Cédula | **Alta** | DB | Sí (lado cliente) |
| Email | Media | DB | No |
| Teléfono | Media | DB | No (búsqueda) |
| Fotos | **Muy Alta** | Storage | Sí (Supabase Storage encriptado) |
| Comprobantes | **Muy Alta** | Storage | Sí |
| Datos bancarios | **Crítica** | Nunca guardar | N/A |
| Intereses | Baja | DB | No |
| Saldos | Baja | DB | No |

---

## 🏗️ NUEVA CARPETA: adapters/supabase/

**Ubicación en estructura:**
```
js/
├── ...
├── storage/                          ← LOCAL storage (IndexedDB)
├── adapters/
│   ├── supabaseAuth.js              ← login, logout, register
│   ├── supabaseClient.js            ← inicializa cliente Supabase
│   ├── dataAdapters/
│   │   ├── clientesDataAdapter.js   ← CRUD clientes
│   │   ├── prestamosDataAdapter.js  ← CRUD préstamos
│   │   ├── pagosDataAdapter.js      ← CRUD pagos
│   │   ├── activosDataAdapter.js    ← CRUD activos
│   │   └── cuotasDataAdapter.js     ← CRUD cuotas
│   ├── fileAdapters/
│   │   ├── clientesPhotosAdapter.js ← upload fotos cédula + rostro
│   │   ├── vouchersAdapter.js       ← upload comprobantes pagos
│   │   └── assetPhotosAdapter.js    ← upload fotos activos
│   ├── encryptionAdapter.js         ← cifra/descifra datos sensibles
│   └── auditAdapter.js              ← log de auditoría
└── ...
```

---

## 🔄 PATRÓN DE INTEGRACIÓN (Adapters)

**Regla de Oro:** Los adapters son la ÚNICA puerta a Supabase. Nunca importes supabaseClient directamente en controllers o domain.

### Estructura Base de un Data Adapter

```js
// adapters/dataAdapters/clientesDataAdapter.js

import { supabaseClient } from '../supabaseClient.js'
import { encryptionAdapter } from '../encryptionAdapter.js'

export const clientesDataAdapter = {
  // LOAD: obtener clientes del usuario actual
  load: async () => {
    try {
      const { data: { user }, error: authError } = 
        await supabaseClient.auth.getUser()
      
      if (authError || !user) throw new Error('No autorizado')

      // RLS automático: solo trae clientes donde user_id = user.id
      const { data, error } = await supabaseClient
        .from('clientes')
        .select('*')
        .eq('user_id', user.id)

      if (error) throw error

      // Desencriptar datos sensibles
      return data.map(cliente => 
        encryptionAdapter.decryptClientData(cliente)
      )
    } catch (err) {
      console.error('[Clientes] Error loading:', err.message)
      // Fallback a localStorage si falla Supabase
      return loadFromLocalStorage('clientes') || []
    }
  },

  // SAVE: crear nuevo cliente
  save: async (cliente) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      
      // Validaciones antes de enviar
      if (!cliente.nombre || !cliente.cedula) {
        throw new Error('Datos incompletos')
      }

      // Encriptar sensibles
      const clienteEncriptado = 
        encryptionAdapter.encryptClientData({
          ...cliente,
          user_id: user.id, // ← Supabase RLS depende de esto
        })

      const { data, error } = await supabaseClient
        .from('clientes')
        .insert([clienteEncriptado])
        .select()

      if (error) throw error

      // Persistir localmente también (offline-first)
      saveToLocalStorage('clientes', data[0])

      return data[0]
    } catch (err) {
      console.error('[Clientes] Error saving:', err.message)
      throw err
    }
  },

  // UPDATE: editar cliente existente
  update: async (id, cambios) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()

      const clienteEncriptado = 
        encryptionAdapter.encryptClientData(cambios)

      const { data, error } = await supabaseClient
        .from('clientes')
        .update(clienteEncriptado)
        .eq('id', id)
        .eq('user_id', user.id) // ← Validación extra
        .select()

      if (error) throw error

      updateLocalStorage('clientes', id, data[0])
      return data[0]
    } catch (err) {
      console.error('[Clientes] Error updating:', err.message)
      throw err
    }
  },

  // DELETE: archivar cliente (soft delete)
  delete: async (id) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()

      // Nunca eliminar, solo marcar como archivado
      const { data, error } = await supabaseClient
        .from('clientes')
        .update({ archivado: true, fechaArchivado: new Date() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()

      if (error) throw error

      deleteFromLocalStorage('clientes', id)
      return data[0]
    } catch (err) {
      console.error('[Clientes] Error deleting:', err.message)
      throw err
    }
  },

  // SYNC: sincronizar entre local y Supabase
  sync: async () => {
    try {
      // Cargar de Supabase
      const fromSupabase = await clientesDataAdapter.load()
      
      // Cargar de localStorage
      const fromLocal = loadFromLocalStorage('clientes') || []

      // Merge: Supabase es fuente de verdad
      // pero mantener datos nuevos sin sincronizar
      const merged = mergeClientesData(fromSupabase, fromLocal)

      return merged
    } catch (err) {
      console.error('[Clientes] Error syncing:', err.message)
      return fromLocal
    }
  }
}
```

---

## 🎮 INTEGRACIÓN CON REDUX

**Regla:** Los adapters NO modifican Redux directamente. Los controllers llaman a adapters, y los adapters retornan datos que el controller dispatcha.

### Flujo Completo: Crear Cliente

```
Usuario rellena form
    ↓
clienteFormController
    ↓
Validaciones (domain/validateClienteData)
    ↓
✅ Válido: dispatch(ACTION.ADD_CLIENTE, { nombre, cedula, ... })
    ↓
reducer actualiza estado local (Redux)
    ↓
render() actualiza pantalla (feedback inmediato)
    ↓
PARALELO: controller llama clientesDataAdapter.save(cliente)
    ↓
adapter envía a Supabase (encriptado)
    ↓
✅ Supabase confirma → dispatch(ACTION.SYNC_CLIENTE_REMOTO, {id, ...})
❌ Falla → dispatch(ACTION.SYNC_ERROR, { clienteId, error })
    ↓
reducer maneja error (lo muestra al usuario)
    ↓
Si es grave: dispatch(ACTION.REVERT_CLIENTE, clienteId)
```

### Ejemplo en Controller

```js
// clientes/ui/clienteFormController.js

export const initClienteFormController = (dom, store, i18n) => {
  const form = dom.clientes.form

  // 1. BIND: cuando hace click en "Guardar"
  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    const formData = new FormData(form)
    const nuevoCliente = Object.fromEntries(formData)

    // 2. VALIDAR (domain)
    const { valid, errors } = validateClienteData(nuevoCliente)
    if (!valid) {
      showErrors(errors)
      return
    }

    // 3. DISPATCH LOCAL (feedback inmediato)
    store.dispatch({
      type: ACTIONS.ADD_CLIENTE,
      payload: nuevoCliente
    })

    // 4. SINCRONIZAR A SUPABASE (background)
    try {
      const saved = await clientesDataAdapter.save(nuevoCliente)

      // 5. CONFIRMAR SYNC
      store.dispatch({
        type: ACTIONS.SYNC_CLIENTE_REMOTO,
        payload: { localId: nuevoCliente.id, remoteId: saved.id }
      })

      showSuccess('Cliente guardado')
      form.reset()
    } catch (err) {
      // 6. MANEJAR ERROR
      store.dispatch({
        type: ACTIONS.SYNC_ERROR,
        payload: { clienteId: nuevoCliente.id, error: err.message }
      })

      showError('Error al guardar en servidor')
      // El cliente sigue en Redux (offline-first)
    }
  })

  // RENDER
  const render = () => {
    const { clientes } = store.getState()
    // renderiza tabla, etc
  }

  store.subscribe(render)
  render()
}
```

---

## 📸 GESTIÓN DE FOTOS (Storage Seguro)

**Problema:** No queremos guardar fotos en la BD (pesada), pero tampoco queremos que sea público.

### Arquitecto de Storage

```
Supabase Storage
├── clientes/
│   └── {user_id}/
│       └── {cliente_id}/
│           ├── cedula_frente.jpg
│           ├── cedula_reverso.jpg
│           └── foto_rostro.jpg
├── comprobantes/
│   └── {user_id}/
│       └── {pago_id}/
│           └── comprobante.jpg
└── activos/
    └── {user_id}/
        └── {activo_id}/
            ├── foto_1.jpg
            └── foto_2.jpg

RLS EN STORAGE:
  • Solo el propietario (user_id) puede listar/descargar sus archivos
  • No puede ver archivos de otros usuarios
  • URLs firmadas con expiración (1 hora por defecto)
```

### Patrón de Upload Seguro

```js
// adapters/fileAdapters/clientesPhotosAdapter.js

export const clientesPhotosAdapter = {
  uploadClientPhotos: async (clienteId, files) => {
    // files = { cedula_frente, cedula_reverso, foto_rostro }

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      const folder = `clientes/${user.id}/${clienteId}`

      const uploads = {}

      for (const [fieldName, file] of Object.entries(files)) {
        // 1. Validar archivo
        if (!file || file.size > 5_000_000) { // 5MB max
          throw new Error(`${fieldName} muy grande`)
        }

        if (!['image/jpeg', 'image/png'].includes(file.type)) {
          throw new Error(`${fieldName} debe ser JPG o PNG`)
        }

        // 2. Subir a Storage
        const filePath = `${folder}/${fieldName}.jpg`
        
        const { data, error } = await supabaseClient
          .storage
          .from('fotos')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true // si ya existe, reemplaza
          })

        if (error) throw error

        // 3. Obtener URL firmada (segura, con expiración)
        const { data: urlData } = await supabaseClient
          .storage
          .from('fotos')
          .createSignedUrl(filePath, 3600) // 1 hora

        uploads[fieldName] = {
          path: filePath,
          url: urlData.signedUrl
        }
      }

      return uploads
    } catch (err) {
      console.error('[Fotos] Error uploading:', err.message)
      throw err
    }
  },

  // Obtener URL firmada de foto existente
  getPhotoUrl: async (filePath) => {
    try {
      const { data, error } = await supabaseClient
        .storage
        .from('fotos')
        .createSignedUrl(filePath, 3600)

      if (error) throw error
      return data.signedUrl
    } catch (err) {
      console.error('[Fotos] Error getting URL:', err.message)
      return null
    }
  },

  // Eliminar foto
  deletePhoto: async (filePath) => {
    try {
      const { error } = await supabaseClient
        .storage
        .from('fotos')
        .remove([filePath])

      if (error) throw error
    } catch (err) {
      console.error('[Fotos] Error deleting:', err.message)
      throw err
    }
  }
}
```

---

## 🔍 AUDITORÍA Y LOGGING

**Responsabilidad:** Registrar quién accedió a qué, cuándo, desde dónde.

### Tabla de Auditoría

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50), -- 'VIEW', 'INSERT', 'UPDATE', 'DELETE', 'DOWNLOAD'
  entity VARCHAR(50), -- 'cliente', 'prestamo', 'pago', 'foto'
  entity_id UUID,
  details JSONB, -- { campo_anterior, campo_nuevo, ip, device }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Solo el usuario puede ver sus propios logs
CREATE POLICY "Ver propios logs"
ON audit_logs
FOR SELECT
USING (auth.uid() = user_id);
```

### Logging en Adapter

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
          action,
          entity,
          entity_id: entityId,
          details: {
            ...details,
            ip: await getClientIP(),
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        })
    } catch (err) {
      // No fallar si falla el logging, pero reportar
      console.warn('[Audit] Error logging:', err.message)
    }
  }
}
```

### Uso en Adapters

```js
// Cuando alguien carga un cliente
await auditAdapter.log('VIEW', 'cliente', clienteId, {
  campos: ['nombre', 'telefono'] // qué campos se vieron
})

// Cuando alguien modifica
await auditAdapter.log('UPDATE', 'cliente', clienteId, {
  cambios: {
    telefono: { anterior: '1234', nuevo: '5678' }
  }
})

// Cuando alguien descarga foto
await auditAdapter.log('DOWNLOAD', 'foto', fotoId, {
  archivo: 'cedula_frente.jpg'
})
```

---

## 🔑 VARIABLES DE ENTORNO (NUNCA en Git)

**Crear archivo `.env.local` en raíz del proyecto (ignorado en .gitignore):**

```env
# .env.local (NUNCA COMMITEAR)
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc... (clave pública anónima)

# Encriptación
VITE_ENCRYPTION_KEY=tu-clave-maestra-derivada-de-password-usuario

# Ambiente
VITE_ENVIRONMENT=production|development

# Opcional: para testing
VITE_ENABLE_OFFLINE_MODE=true|false
```

**En `supabaseClient.js`:**
```js
import { createClient } from '@supabase/supabase-js'

export const supabaseClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

**En `.gitignore`:**
```
.env.local
.env.*.local
*.key
secrets/
```

---

## ⚡ FLUJO DE OFFLINE-FIRST (Resilencia)

**Problema:** El usuario abre la app en una zona sin internet. ¿Qué pasa?

### Patrón Offline-First

```
1. LOAD: Intenta cargar de Supabase
   - ✅ Éxito: carga datos + actualiza localStorage
   - ❌ Fallo (offline): carga de localStorage

2. SAVE: Usuario crea un cliente
   - Dispatch local a Redux (feedback inmediato)
   - Intenta enviar a Supabase
     - ✅ Éxito: marca como "sincronizado"
     - ❌ Fallo: marca como "pendiente de sincronizar" + almacena localmente

3. SYNC: Cuando vuelve la conexión
   - Detecta cambios pendientes (localStorage)
   - Envía a Supabase en batch
   - Resuelve conflictos (último write wins)
   - Limpia localStorage

4. CONFLICTOS: Si usuario editó offline y alguien lo hizo también online
   - Mostrar alerta: "Cambios en conflicto"
   - Opciones: Usar local, usar remoto, revisar diferencias
```

### Implementación

```js
// app/sync/syncManager.js

export const createSyncManager = (store) => {
  return {
    // Detectar si hay conexión
    isOnline: () => navigator.onLine,

    // Marcar cambios como "pending"
    markPending: (entityType, id) => {
      store.dispatch({
        type: ACTIONS.MARK_PENDING_SYNC,
        payload: { entityType, id }
      })
    },

    // Sincronizar cuando vuelve conexión
    syncPending: async () => {
      const pending = store.getState().pendingSync

      for (const { entityType, id, data } of pending) {
        try {
          await getAdapterForEntity(entityType).save(data)

          store.dispatch({
            type: ACTIONS.MARK_SYNCED,
            payload: { entityType, id }
          })
        } catch (err) {
          console.error('Error syncing:', err)
          // Reintenta después
        }
      }
    }
  }
}

// En main.js
window.addEventListener('online', () => syncManager.syncPending())
window.addEventListener('offline', () => {
  console.warn('Modo offline activado. Los cambios se sincronizarán luego.')
})
```

---

## 🛡️ CHECKLIST DE SEGURIDAD IMPLEMENTAR

**Antes de subir a producción:**

### Autenticación
- [ ] Supabase Auth configurado (email + password)
- [ ] Contraseñas > 10 caracteres, con validación en client
- [ ] Session storage seguro (sin localStorage plano)
- [ ] JWT refresh automático (Supabase lo hace)
- [ ] Logout limpia toda la memoria (tokens + datos)

### Base de Datos
- [ ] RLS habilitado en TODAS las tablas
- [ ] Cada tabla tiene políticas para SELECT, INSERT, UPDATE, DELETE
- [ ] user_id en cada tabla (para RLS)
- [ ] Soft delete (archivado) no hard delete
- [ ] Timestamps (created_at, updated_at) en cada tabla
- [ ] Índices en user_id (para performance de RLS)

### Encriptación
- [ ] Campos sensibles encriptados lado cliente
- [ ] Storage de Supabase encriptado
- [ ] URLs firmadas con expiración (< 1 hora)
- [ ] Claves de encriptación derivadas de password del usuario (nunca hardcoded)

### Storage de Archivos
- [ ] Carpetas organizadas por user_id
- [ ] RLS en Storage (igual que DB)
- [ ] Tipos de archivo validados (JPG, PNG)
- [ ] Tamaño máximo (5MB)
- [ ] Nombres de archivo sanitizados

### Adapters
- [ ] Nunca exponer credenciales en adapters
- [ ] Try/catch en todos los adapters
- [ ] Fallback a localStorage si falla Supabase
- [ ] Validaciones ANTES de enviar
- [ ] Rate limiting (máx 10 requests/min por usuario) [Supabase lo hace]

### Auditoría
- [ ] Tabla audit_logs con RLS
- [ ] Cada acción crítica se registra
- [ ] IP, User Agent, timestamp en logs
- [ ] Logs descargables por admin para análisis

### UX de Seguridad
- [ ] Mensajes de error genéricos (nunca "usuario no existe")
- [ ] Captura de cambios sensibles (mostrar "¿Estás seguro?")
- [ ] Confirmación por email para cambios críticos
- [ ] Opción de 2FA (two-factor auth) [Supabase lo soporta]

### Testing
- [ ] Prueba RLS: intenta acceder como otro usuario (debe fallar)
- [ ] Prueba SQL Injection: intenta `'; DROP TABLE --` (debe fallar)
- [ ] Prueba XSS: intenta inyectar `<script>alert()</script>` (debe sanitizarse)
- [ ] Prueba offline: abre DevTools, pasa a offline, intenta crear cliente
- [ ] Prueba sync: crea offline, vuelve online, verifica que sincronizó

---

## 📋 ORDEN DE IMPLEMENTACIÓN

**Fase 1: Core Seguridad + Supabase (Blocker)**
1. [ ] Setup Supabase project + base de datos
2. [ ] Implementar supabaseAuth (login, register, logout)
3. [ ] Implementar RLS en todas las tablas
4. [ ] Implementar clientesDataAdapter (CRUD)
5. [ ] Integrar con Redux (login → store llena datos usuario)
6. [ ] Prueba: login + ver solo mis datos

**Fase 2: Seguridad Avanzada**
7. [ ] Implementar encryptionAdapter
8. [ ] Encriptar números de cédula en clientes
9. [ ] Implementar Storage RLS para fotos
10. [ ] Implementar clientesPhotosAdapter (upload/download)
11. [ ] Prueba: sube foto, luego descárgala (debe funcionar)

**Fase 3: Resilencia**
12. [ ] Implementar syncManager (offline-first)
13. [ ] Prueba: crea cliente offline, enciende wifi, verifica sync
14. [ ] Implementar auditAdapter (logging de acciones)
15. [ ] Prueba: cada acción queda registrada en audit_logs

**Fase 4: Otros Adapters** (seguir mismo patrón)
16. [ ] prestamosDataAdapter
17. [ ] pagosDataAdapter
18. [ ] activosDataAdapter
19. [ ] vouchersAdapter

**Fase 5: Testing + Hardening**
20. [ ] Prueba seguridad RLS (intenta ver datos de otro)
21. [ ] Prueba encriptación (cédula debe estar cifrada en DB)
22. [ ] Prueba SQL injection en search
23. [ ] Audit log completo para todas las acciones

---

## 🚨 ERRORES CRÍTICOS A EVITAR

```js
// ❌ NUNCA: Guardar token en localStorage plano
localStorage.setItem('token', jwtToken)

// ✅ SÍ: Supabase lo maneja automáticamente
const { data } = await supabaseClient.auth.signIn({ email, password })
// Token está seguro internamente

---

// ❌ NUNCA: Encriptación hardcodeada
const KEY = 'abc123'

// ✅ SÍ: Derivada de contraseña del usuario
const KEY = derivePBKDF2(userPassword, userEmail, 100000)

---

// ❌ NUNCA: SQL dinámico en frontend
const { data } = await supabase.rpc('custom_query', { sql: userInput })

// ✅ SÍ: Queries parametrizadas
const { data } = await supabase
  .from('clientes')
  .select('*')
  .eq('nombre', userInput) // RLS + Parameterized

---

// ❌ NUNCA: Importar supabaseClient en controllers
import { supabaseClient } from '../../supabaseClient.js'

// ✅ SÍ: Usar adapters
import { clientesDataAdapter } from '../../adapters/dataAdapters/clientesDataAdapter.js'

---

// ❌ NUNCA: User data en memory sin limpiar en logout
let currentUser = { id, name, email, ... }

// ✅ SÍ: Limpiar completamente
const logout = async () => {
  await supabaseClient.auth.signOut()
  store.dispatch({ type: ACTIONS.CLEAR_STATE })
  sessionStorage.clear()
  location.reload() // clean slate
}

---

// ❌ NUNCA: Confiar en frontend para RLS
// "Voy a hacer .eq('user_id', user.id) en el frontend"

// ✅ SÍ: Supabase RLS en DB garantiza
CREATE POLICY "..." USING (auth.uid() = user_id)
// Aunque alguien cambie el .eq(), la BD lo filtra

---

// ❌ NUNCA: URLs públicas de fotos
const url = `https://supabase.storage/.../cédula.jpg`

// ✅ SÍ: URLs firmadas con expiración
const { data } = await supabase.storage
  .from('fotos')
  .createSignedUrl('path/to/file.jpg', 3600) // 1 hora

---

// ❌ NUNCA: Guardar contraseña en DB
INSERT INTO usuarios (email, password) VALUES (...)

// ✅ SÍ: Supabase Auth maneja hashes
// Contraseña se valida en auth.users, nunca la ves

---

// ❌ NUNCA: Sincronizar ciega sin resolver conflictos
if (offline && nowOnline) {
  syncAll() // ¿Y si cambió en los 2 lados?
}

// ✅ SÍ: Resolver conflictos
const local = loadFromStorage(id)
const remote = await fetch(id)

if (local.version !== remote.version) {
  // Mostrar UI: "Conflicto detectado, ¿cuál versión usar?"
  await resolveConflict(local, remote)
}
```

---

## 📊 DIAGRAMA DE FLUJO: Crear + Sincronizar Cliente

```
┌─ Usuario llena formulario ─────────────────────────┐
│                                                     │
│  nombre: "Juan"                                   │
│  cedula: "1234567890"                             │
│  telefono: "555-1234"                             │
└──────────┬──────────────────────────────────────┘
           │
           ▼
    ┌─ Validación (domain/) ─────────┐
    │ validateClienteData()           │
    │ • cedula válida?                │
    │ • nombre no vacío?              │
    │ • teléfono formato correcto?    │
    │                                 │
    │ ✅ VÁLIDO                       │
    └──────────┬──────────────────────┘
               │
               ▼
    ┌─ Dispatch Local a Redux ─────────────────────────────┐
    │ store.dispatch({                                     │
    │   type: ACTIONS.ADD_CLIENTE,                         │
    │   payload: { id: uuid(), nombre, cedula, ... }       │
    │ })                                                   │
    │                                                      │
    │ ↓ reducer actualiza estado                           │
    │ ↓ subscriptores notificados                          │
    │ ↓ UI renderiza cliente en tabla (INSTANT FEEDBACK)   │
    └──────────┬───────────────────────────────────────────┘
               │
               ▼
    ┌─ Sincronizar a Supabase (Background) ────────────────┐
    │ clientesDataAdapter.save(cliente)                    │
    │                                                      │
    │ 1. Encriptar sensibles                              │
    │    cedula: "1234567890" → cifrado_abc123xyz        │
    │                                                      │
    │ 2. Agregar user_id (para RLS)                      │
    │    user_id: "uuid-del-usuario-actual"              │
    │                                                      │
    │ 3. INSERT a Supabase                                │
    │    await supabase.from('clientes').insert([...])   │
    │                                                      │
    │ 4a. ✅ ÉXITO                                         │
    │     ▼                                                │
    │     Guardar localmente (localStorage)               │
    │     dispatch(ACTION.SYNC_CLIENTE_REMOTO, {          │
    │       localId, remoteId                             │
    │     })                                               │
    │     Mostrar toast: "✅ Cliente guardado"             │
    │                                                      │
    │ 4b. ❌ FALLO                                         │
    │     ▼                                                │
    │     dispatch(ACTION.SYNC_ERROR, {                   │
    │       clienteId, error                              │
    │     })                                               │
    │     Mostrar toast: "⚠️ Pendiente de sincronizar"     │
    │     Cliente sigue en localStorage para luego        │
    └──────────┬───────────────────────────────────────────┘
               │
               ▼
    ┌─ Auditoría ─────────────────────────────────────────┐
    │ auditAdapter.log('INSERT', 'cliente', clienteId, {  │
    │   campos_ingresados: ['nombre', 'cedula', 'telefono'] │
    │   timestamp,                                         │
    │   ip,                                                │
    │   userAgent                                          │
    │ })                                                   │
    │                                                      │
    │ INSERT to audit_logs                                │
    │ (RLS: solo el usuario ve sus propios logs)          │
    └──────────┬───────────────────────────────────────────┘
               │
               ▼
         ┌─ FIN ─┐
         │ ✅    │
         └───────┘
```

---

## 🧪 PRUEBAS DE SEGURIDAD (QA)

### Prueba 1: RLS Funciona
```js
// Conectar como usuario A
const usuarioA = await supabase.auth.signInWithEmail(...)

// Crear cliente de A
const clienteA = await clientesDataAdapter.save({ nombre: "Cliente A" })

// Conectar como usuario B
await supabase.auth.signOut()
const usuarioB = await supabase.auth.signInWithEmail(...)

// Intentar ver cliente de A
const resultado = await supabase
  .from('clientes')
  .select('*')
  .eq('id', clienteA.id)

// RESULTADO: array vacío (no puede verlo)
console.assert(resultado.data.length === 0, 'RLS fallido')
```

### Prueba 2: Encriptación Funciona
```js
// Crear cliente con cédula sensible
const cliente = await clientesDataAdapter.save({
  nombre: "Juan",
  cedula: "1234567890"
})

// Conectar a DB directamente y ver raw data
const { data } = await supabase
  .from('clientes')
  .select('cedula')
  .eq('id', cliente.id)

// RESULTADO: cedula debe estar cifrada (no "1234567890")
console.assert(
  data[0].cedula !== "1234567890",
  'Encriptación falló'
)
console.assert(
  data[0].cedula.startsWith('encrypted:'), // o similar
  'Formato de encriptación incorrecto'
)
```

### Prueba 3: Offline-First Funciona
```js
// Desactivar red
DevTools > Network > Offline

// Crear cliente
const cliente = await clientesDataAdapter.save({
  nombre: "Test Offline"
})

// Debe estar en localStorage
const local = loadFromLocalStorage('clientes')
console.assert(
  local.some(c => c.nombre === "Test Offline"),
  'No guardó en localStorage'
)

// Activar red
DevTools > Network > Online

// Sincronizar
await syncManager.syncPending()

// Verificar que está en Supabase
const { data } = await supabase
  .from('clientes')
  .select('*')
  .eq('nombre', 'Test Offline')

console.assert(data.length > 0, 'No sincronizó a Supabase')
```

---

## 📚 REFERENCIAS

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [OWASP: Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP: Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP: Encryption Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

---

**Última actualización:** 2026
**Estado:** Documento de arquitectura segura final
