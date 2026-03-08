# 🔒 RESUMEN EJECUTIVO: SUPABASE + REDUX
## Cómo Integrar Seguridad sin Romper la Arquitectura

---

## 🎯 EL PROBLEMA

Necesitas:
- ✅ Datos seguros (PII - Fotos de cédula, números)
- ✅ Multiusuario (prestamista + asistentes)
- ✅ Trazabilidad completa (auditoría)
- ✅ Funciona offline
- ✅ Pero **Redux sigue siendo la fuente de verdad** en memoria

---

## 💡 LA SOLUCIÓN EN 3 CAPAS

### Capa 1: Autenticación (Supabase Auth)
```
Usuario → email + password
    ↓
Supabase Auth → valida, genera JWT
    ↓
JWT en memory (nunca localStorage)
    ↓
Cada request lleva JWT en header
    ↓
Supabase valida JWT antes de ejecutar
```

**Ventaja:** Aunque alguien tenga XSS, no pueden robarse el token (está en memory).

---

### Capa 2: Base de Datos (Supabase + RLS)
```
Redux (en memoria)
    ↓
store.dispatch() → controller
    ↓
adapter llama a Supabase
    ↓
Supabase RLS filtra automáticamente
    ↓
Solo los datos del usuario actual se retornan
```

**Ventaja:** Incluso si alguien intenta SQL injection, RLS los detiene a nivel BD.

---

### Capa 3: Encriptación (Lado Cliente)
```
Datos sensibles (cédula) 
    ↓
Encriptar en cliente (antes de enviar)
    ↓
Guardar cifrados en Supabase
    ↓
Desencriptar en cliente (después de recibir)
    ↓
Redux tiene datos en claro (para funcionar)
```

**Ventaja:** Incluso si alguien roba la BD, los datos sensibles están inutilizables.

---

## 🏗️ ARQUITECTURA (SAGRADA)

```
┌─────────────────────────────────────────────────┐
│   APLICACIÓN (Redux + Controllers)              │
│   - store.js (estado en memoria)                │
│   - domain/ (lógica pura, sin DOM)              │
│   - controllers (bind events + dispatch)        │
└────────────┬────────────────────────────────────┘
             │
             ▼ (solo despues de local dispatch)
┌─────────────────────────────────────────────────┐
│   ADAPTERS (Data Layer - NUEVA CAPA)            │
│   - clientesDataAdapter                         │
│   - prestamosDataAdapter                        │
│   - pagosDataAdapter                            │
│   - encryptionAdapter                           │
│   - auditAdapter                                │
│   - fileAdapters                                │
│   Responsabilidad ÚNICA: conectar a Supabase   │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│   SUPABASE (Backend + Seguridad)                │
│   - Auth (JWT, sesiones)                        │
│   - PostgreSQL (datos + RLS)                    │
│   - Storage (fotos encriptadas)                 │
│   - Audit (logging automático)                  │
└─────────────────────────────────────────────────┘
```

**Regla de Oro:** Redux y Adapters son capas completamente separadas. Controllers hablan con ambas.

---

## 🔄 FLUJO REAL: Crear Cliente

### Paso 1: Usuario interactúa
```
FormularioCliente (HTML)
    ↓ user rellena + clickea "Guardar"
ClienteFormController
```

### Paso 2: Validar y Despachar Localmente
```js
// domain/validateClienteData.js (puro)
const { valid, errors } = validateClienteData(formData)

if (!valid) {
  showErrors(errors)
  return
}

// DISPATCH: feedback INMEDIATO
store.dispatch({
  type: ACTIONS.ADD_CLIENTE,
  payload: { id: uuid(), nombre, cedula, ... }
})

// reducer actualiza state
// suscriptores re-render
// Usuario ve el cliente en la tabla AL INSTANTE ✨
```

### Paso 3: Sincronizar a Supabase (Background)
```js
// adapter/dataAdapters/clientesDataAdapter.js
try {
  const saved = await clientesDataAdapter.save(cliente)
  
  // Success: marcar como sincronizado
  store.dispatch({
    type: ACTIONS.SYNC_CLIENTE_REMOTO,
    payload: { remoteId: saved.id }
  })
  
  showSuccess('✅ Cliente guardado en servidor')
} catch (err) {
  // Error: marcar como "pendiente"
  store.dispatch({
    type: ACTIONS.SYNC_ERROR,
    payload: { clienteId: cliente.id, error: err.message }
  })
  
  showWarning('⚠️ Cliente pendiente de sincronizar (se sincronizará cuando haya conexión)')
}

// **La clave:** El cliente NUNCA desaparece de la UI
// Funciona offline-first
```

### Paso 4: En Supabase (Seguridad)
```
a) Validar JWT en header
   ↓
b) Encriptar cédula (lado cliente ya lo hizo, pero validamos)
   ↓
c) Agregar user_id = UUID del JWT
   ↓
d) INSERT a tabla clientes
   ↓
e) RLS filtra automáticamente:
   - Solo el propietario (user_id) puede verlo después
   - Otro usuario hace SELECT → Supabase retorna array vacío
   ↓
f) Trigger de auditoría registra:
   - Quién creó
   - Cuándo
   - Qué datos
   ↓
g) Retornar { id, ... } al cliente
```

---

## 🔒 NIVELES DE SEGURIDAD IMPLEMENTADOS

### Nivel 1: Autenticación
```
❌ Sin login → NO ve nada
✅ Con login + contraseña válida → JWT válido
  → Puede acceder a sus datos

RLS garantiza: aunque alguien se loguee, solo ve sus datos
```

### Nivel 2: Row Level Security (RLS)
```
Tabla clientes tiene política:

CREATE POLICY "usuarios_ven_sus_datos"
ON clientes
FOR SELECT
USING (auth.uid() = user_id);

↓ Traducción ↓

SELECT * FROM clientes
→ Supabase agrega automáticamente:
   WHERE auth.uid() = user_id

↓ Beneficio ↓

Aunque developer haga:
  const { data } = await supabase.from('clientes').select()
  // sin .eq('user_id', userId)
  
Supabase igual filtra por RLS
→ No puede ver datos de otros usuarios
```

### Nivel 3: Encriptación
```
Campos sensibles (cédula, fotos):

1. Cliente encripta ANTES de enviar
   cedula: "1234567890" → "abc123xyz..."

2. Guardado en DB ya cifrado
   SELECT cedula FROM clientes → "abc123xyz..."

3. Cliente desencripta DESPUÉS de recibir
   "abc123xyz..." → "1234567890"

4. Redux tiene datos en claro (para funcionar)
   Pero localStorage NO (se sincroniza cifrado)

5. Fotos en Storage Supabase:
   - Carpeta por usuario
   - RLS limita acceso
   - URLs firmadas con expiración (1 hora)
```

### Nivel 4: Auditoría
```
Cada acción se registra:

INSERT INTO audit_logs:
  - user_id: quién
  - action: INSERT/UPDATE/DELETE/VIEW
  - entity: cliente
  - entity_id: cual
  - details: { cambios, ip, device, timestamp }

Trigger automático en cada UPDATE:
  - Detecta qué campos cambiaron
  - Registra valores antes/después
  - Imposible negar/ocultar cambios
```

---

## 📁 ESTRUCTURA DE CARPETAS (Nueva)

```
js/
├── app/
│   ├── state/
│   │   ├── store.js              ← Redux manual (sagrado)
│   │   ├── reducer.js            ← Manejo estado
│   │   └── actions.js            ← Action types
│   └── ui/
│       ├── domIds.js
│       ├── domAdapter.js
│       └── ...
│
├── adapters/                     ← ⭐ NUEVA CAPA
│   ├── supabaseAuth.js           ← Login/logout
│   ├── supabaseClient.js         ← Client config
│   ├── encryptionAdapter.js      ← Cifra/descifra
│   ├── auditAdapter.js           ← Logging
│   ├── dataAdapters/
│   │   ├── clientesDataAdapter.js      ← CRUD clientes
│   │   ├── prestamosDataAdapter.js     ← CRUD préstamos
│   │   ├── pagosDataAdapter.js         ← CRUD pagos
│   │   ├── activosDataAdapter.js       ← CRUD activos
│   │   └── cuotasDataAdapter.js        ← CRUD cuotas
│   └── fileAdapters/
│       ├── clientesPhotosAdapter.js    ← Upload fotos
│       ├── vouchersAdapter.js          ← Upload comprobantes
│       └── assetPhotosAdapter.js       ← Upload activos
│
├── sync/                         ← Offline-first
│   ├── syncManager.js            ← Detecta conexión, sincroniza
│   └── conflictResolver.js       ← Resuelve conflictos
│
├── clientes/
│   ├── domain/
│   │   └── validateClienteData.js
│   └── ui/
│       ├── clienteFormController.js
│       └── clienteTableController.js
│
├── prestamos/
│   ├── domain/
│   │   ├── createLoanSchedule.js
│   │   └── calculateCuota.js
│   └── ui/
│       └── prestamoFormController.js
│
└── ... (resto igual)
```

---

## 🚀 FLUJO DE DESARROLLO: Paso a Paso

### Fase 1: Setup (3-4 horas)
```
1. [ ] Crear proyecto Supabase
2. [ ] Copiar schema.sql a Supabase SQL Editor
3. [ ] Ejecutar tablas + RLS + triggers
4. [ ] Crear Storage buckets (fotos)
5. [ ] Configurar RLS en Storage
6. [ ] Verificar que TODO funciona

Verificación: 
  SELECT * FROM clientes
  → debe estar vacío (no hay datos)
```

### Fase 2: Integración de Auth (2-3 horas)
```
7. [ ] Crear adapters/supabaseAuth.js
   - signUp(email, password)
   - signIn(email, password)
   - logout()
   - getCurrentUser()

8. [ ] Integrar con Redux
   - reducer con estado auth
   - actions: LOGIN, LOGOUT, AUTH_ERROR

9. [ ] Proteger rutas
   - Si no hay sesión → redirigir a login
   - Si hay sesión → cargar datos del usuario

10. [ ] Testing:
    - Sign up → debe crear usuario
    - Sign in → debe retornar JWT
    - Sign out → debe limpiar session
```

### Fase 3: Data Adapters (4-5 horas)
```
11. [ ] Crear clientesDataAdapter.js
    - load(): obtiene clientes (RLS automático)
    - save(): crea cliente (encripta sensibles)
    - update(): edita cliente
    - sync(): sincroniza offline

12. [ ] Integrar con Redux
    - Controller → dispatch → adapter.save()
    - adapter.save() → dispatch(SYNC_OK o SYNC_ERROR)
    - render() actualiza UI

13. [ ] Testing:
    - Crear cliente → debe aparecer en Supabase
    - Ver en DB → cédula debe estar encriptada
    - Ver otro usuario → no debe ver nada
    - Offline: crear cliente → debe quedar en localStorage
    - Online: debe sincronizarse

14. [ ] Repetir para prestamos, pagos, activos
    (cada uno sigue el mismo patrón)
```

### Fase 4: Fotos (File Upload) (2-3 horas)
```
15. [ ] Crear clientesPhotosAdapter.js
    - uploadClientPhotos(clienteId, files)
    - Validar tamaño y formato
    - Subir a Storage
    - Obtener signed URL
    - Guardar ruta en DB

16. [ ] Testing:
    - Subir foto → debe estar en Storage
    - Otro usuario → no puede verla
    - Descargar → debe funcionar via signed URL
    - URL expira en 1 hora → después no funciona
```

### Fase 5: Auditoría (1-2 horas)
```
17. [ ] Crear auditAdapter.js
    - log(action, entity, entityId, details)
    - Se llama después de cada acción importante

18. [ ] Testing:
    - Crear cliente → aparece en audit_logs
    - Editar → registra antes/después
    - Eliminar → registra
    - Ver logs → solo propios (RLS)
```

### Fase 6: Offline-First (2-3 horas)
```
19. [ ] Crear syncManager.js
    - Detecta navigator.onLine
    - Marcar cambios como "pending"
    - Cuando vuelve conexión, sincronizar batch

20. [ ] Testing:
    - Offline: crear cliente
    - Check localStorage → debe estar
    - Online: esperar sync
    - Verify Supabase → debe estar
    - Conflicts: editar offline + online
      → mostrar UI de conflicto
```

### Fase 7: Polish (1-2 horas)
```
21. [ ] Mensajes de error descriptivos
22. [ ] Indicators de sincronización visual
23. [ ] Manejo de timeouts (5s max)
24. [ ] Rate limiting en frontend (no spamear)
25. [ ] Testing en mobile
```

**Tiempo total:** ~18-22 horas de desarrollo

---

## ⚡ VENTAJAS DE ESTA ARQUITECTURA

### Para Seguridad
✅ **RLS:** Imposible que usuario A vea datos de usuario B  
✅ **Encriptación:** Datos sensibles inutilizables si se roba BD  
✅ **JWT:** Sin localStorage, token seguro  
✅ **Auditoría:** Todo registrado, imposible negar  
✅ **HTTPS:** Datos cifrados en tránsito  

### Para UX
✅ **Offline-first:** Funciona sin internet  
✅ **Feedback inmediato:** Redux local antes de Supabase  
✅ **Sin bloques:** Operaciones no-blocking  
✅ **Sync automático:** No requiere acción del usuario  
✅ **Conflict resolution:** Si hay cambios en conflicto, UI clara  

### Para Desarrollo
✅ **Separación clara:** Adapters ≠ Controllers ≠ Domain  
✅ **Testeable:** Domain sin DOM, Adapters sin lógica negocio  
✅ **Mantenible:** Cambiar Supabase por otro backend = cambiar adapters  
✅ **Escalable:** Agregar usuarios, datos, auditoría = agregar RLS  
✅ **Sin breaking changes:** Redux intacto, agrega adapters

---

## 🧪 CHECKLIST DE SEGURIDAD

Antes de producción:

**Autenticación**
- [ ] Login con email + password
- [ ] Logout limpia todo (Redux + memory)
- [ ] JWT no se guarda en localStorage
- [ ] Cambio de contraseña funciona
- [ ] Reset de contraseña funciona

**RLS**
- [ ] Crear cliente → solo el propietario lo ve
- [ ] Crear préstamo → RLS cascada funciona
- [ ] SQL injection intento → rechazado por RLS
- [ ] Query sin .eq('user_id') → igual se filtra por RLS

**Encriptación**
- [ ] Cédula en DB debe estar cifrada
- [ ] Fotos en Storage solo el owner puede descargar
- [ ] URLs firmadas expiran en 1 hora
- [ ] Descarga después de 1 hora → falla

**Auditoría**
- [ ] INSERT registra quién/cuándo/datos
- [ ] UPDATE registra cambios (antes/después)
- [ ] DELETE registra qué se eliminó
- [ ] Logs no se pueden editar (RLS)

**Offline**
- [ ] Crear cliente offline → quedó en localStorage
- [ ] Online → sincroniza a Supabase
- [ ] Conflicto: editar mismo cliente online + offline
  → UI muestra conflicto, usuario elige

**Performance**
- [ ] Cargar 1000 clientes < 2s
- [ ] Sync 50 cambios pendientes < 5s
- [ ] Search por nombre < 500ms
- [ ] Upload foto < 3s

---

## 🚨 ERRORES QUE EVITAR

```js
// ❌ NUNCA guardar JWT en localStorage plano
localStorage.setItem('token', jwt)

// ✅ Supabase Auth lo hace automáticamente
// No toques localStorage para tokens


// ❌ NUNCA encriptación hardcoded
const KEY = 'abc123'

// ✅ Derivar de password del usuario
const KEY = derivePBKDF2(userPassword, userEmail, iterations=100000)


// ❌ NUNCA confiar en frontend para seguridad
// "Solo paso user_id en el query"

// ✅ RLS en BD garantiza
CREATE POLICY ... USING (auth.uid() = user_id)
// Supabase valida antes de retornar datos


// ❌ NUNCA importar supabaseClient en controllers
import { supabaseClient } from '...'

// ✅ Usar adapters como intermediarios
import { clientesDataAdapter } from '...'


// ❌ NUNCA perder datos offline
// Crear cliente offline, pagina refresh → desaparece

// ✅ Guardar en localStorage mientras no sincronice
localStorage.setItem('pendingSync', JSON.stringify(cliente))
// Luego recuperar on boot


// ❌ NUNCA URL pública de fotos
// `https://storage.supabase.co/.../cedula.jpg` público

// ✅ Signed URL con expiración
const url = await storage.createSignedUrl(path, 3600) // 1h
```

---

## 📚 ARCHIVOS QUE TIENES

1. **memoria-agente-app-prestamos.md** ← Todo sobre features + arquitectura Redux
2. **arquitectura-seguridad-supabase.md** ← Este: cómo integrar Supabase sin romper Redux
3. **supabase-schema.sql** ← Script completo: tablas, RLS, triggers, storage
4. **features-app-prestamos.md** ← Especificación detallada de cada feature

---

## 📝 PRÓXIMOS PASOS

1. **Setup Supabase:**
   - Crear cuenta en supabase.com
   - Nuevo proyecto
   - Copiar URL + anon key

2. **Crear schema:**
   - Abrir Supabase SQL Editor
   - Copiar cada sección de schema.sql
   - Ejecutar en orden

3. **Crear primer adapter:**
   - Empezar con `supabaseAuth.js`
   - Luego `clientesDataAdapter.js`
   - Integrar con Redux existente

4. **Testing:**
   - Crear usuario
   - Login
   - Crear cliente
   - Verificar en Supabase
   - Verificar RLS (otro usuario no lo ve)

5. **Desarrollo de features:**
   - Usar memoria-agente para contexto
   - Usar arquitectura-seguridad para adapters
   - Seguir mismo patrón para cada adapter

---

**Esta arquitectura es segura, escalable, y NO rompe tu Redux. Adapters es simplemente una nueva capa de integración.**

Éxito! 🚀
