# ⚡ QUICK START (5 MINUTOS)
## Empieza YA

No tienes tiempo? Aquí va todo lo que necesitas en 5 minutos.

---

## 📖 LEE ESTO AHORA (2 min)

**Tu proyecto:**
- App para prestamistas (gestionar clientes, préstamos, pagos)
- Segura (RLS, encriptación, auditoría)
- Funciona offline (sin internet)
- Redux manual + Supabase

**Arquitectura en 1 línea:**
```
User interactúa → Redux dispatch (feedback inmediato) 
  → Adapter sincroniza background (Supabase)
    → Supabase RLS asegura datos (solo usuario actual)
```

---

## 🎯 SIGUIENTES 3 PASOS (3 min)

### Paso 1: Leer
```
Abre INDICE-MAESTRO.md
Lee la sección "COMIENZA EN 3 PASOS"
(20 minutos)
```

### Paso 2: Setup Supabase
```
1. Ir a supabase.com → crear cuenta gratis
2. Nuevo proyecto
3. Copiar supabase-schema.sql
4. Pegar en SQL Editor de Supabase
5. Ejecutar sección por sección
(1-2 horas)
```

### Paso 3: Copiar Código
```
1. Abre cheatsheet-desarrollo.md
2. Ve a "PATRON: Data Adapter"
3. Copia el patrón
4. Cambia TABLA_NOMBRE y adapta
5. Bingo! Tu primer adapter
(1-2 horas)
```

---

## 🔑 CLAVE: ADAPTERS

**Un adapter = puerta a Supabase**

```js
// Patrón simple - COPIAR Y ADAPTAR
export const miAdapter = {
  load: async () => {
    // SELECT con RLS automático
    const { data } = await supabaseClient
      .from('mi_tabla')
      .select('*')
    return data
  },

  save: async (item) => {
    // Validar antes
    // Encriptar sensibles
    // INSERT
    const { data } = await supabaseClient
      .from('mi_tabla')
      .insert([item])
      .select()
    return data[0]
  }
}
```

---

## 🎮 CLAVE: CONTROLLER

**Un controller = bind eventos + render**

```js
// Patrón simple - COPIAR Y ADAPTAR
export const initMiController = (dom, store) => {
  // 1. BIND: cuando usuario hace algo
  dom.button.addEventListener('click', async () => {
    const data = { ... }
    
    // 2. DISPATCH LOCAL (feedback inmediato)
    store.dispatch({ type: ACTION.ADD, payload: data })
    
    // 3. SYNC BACKGROUND (no bloquea)
    try {
      await miAdapter.save(data)
      store.dispatch({ type: ACTION.SYNC_OK })
    } catch (err) {
      store.dispatch({ type: ACTION.SYNC_ERROR })
    }
  })

  // 4. RENDER: actualiza UI
  const render = () => {
    const { items } = store.getState()
    // renderizar items
  }

  // 5. SUBSCRIBE: re-render cuando cambia estado
  store.subscribe(render)
  render()
}
```

---

## 🔐 CLAVE: SEGURIDAD (3 NIVELES)

### Nivel 1: Autenticación
```js
// Supabase maneja esto automáticamente
const { data } = await supabaseClient.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
})
// JWT guardado en memory (seguro)
```

### Nivel 2: RLS (automático)
```sql
-- En Supabase BD:
CREATE POLICY "user sees own data"
ON mi_tabla
FOR SELECT
USING (auth.uid() = user_id);

-- Resultado: SELECT * retorna solo datos del usuario actual
-- Aunque queramos ver TODOS, RLS filtra automáticamente
```

### Nivel 3: Encriptación (lado cliente)
```js
// ANTES de enviar a Supabase
const encriptado = encryptionAdapter.encrypt(cedula, userPassword)

// INSERT encriptado
const { data } = await supabaseClient
  .from('clientes')
  .insert([{ cedula: encriptado, ... }])

// Resultado: DB tiene cédula cifrada
// Incluso si alguien roba la BD, datos inutilizables
```

---

## 🚀 INICIANDO HOY

**Mínimo viable para hoy:**

```bash
# 1. Crear proyecto Supabase
→ supabase.com

# 2. Ejecutar schema
→ copiar supabase-schema.sql
→ pegar en SQL Editor Supabase

# 3. Crear archivo:
→ js/adapters/supabaseAuth.js
→ copiar patrón de cheatsheet

# 4. Testing:
→ Abrir DevTools console
→ const result = await loginFunction(email, password)
→ Si funciona: ✅

# 5. Ya está. Siguiente feature.
```

---

## 📚 ARCHIVOS CLAVE

| Necesito... | Archivo |
|---|---|
| Entender qué construir | memoria-agente-app-prestamos.md |
| Navegar documentos | INDICE-MAESTRO.md |
| Código listo para copiar | cheatsheet-desarrollo.md |
| Setup BD | supabase-schema.sql |
| Entender seguridad | arquitectura-seguridad-supabase.md |

---

## 🎯 HÁBITOS DIARIOS

**Cada día cuando abres el editor:**

1. **Decide qué feature** (usa memoria-agente para specs)
2. **Lee patrón de adapter** (cheatsheet-desarrollo.md)
3. **Lee patrón de controller** (cheatsheet-desarrollo.md)
4. **Copia y adapta código**
5. **Testa (RLS, encriptación, offline)**
6. **Git commit con contexto**

---

## ✅ HOY MISMO

- [ ] Crea cuenta Supabase
- [ ] Lee INDICE-MAESTRO.md (20 min)
- [ ] Ejecuta schema.sql (1-2 horas)
- [ ] Crea primer adapter siguiendo patrón (1-2 horas)
- [ ] Prueba que funciona

**Resultado hoy: BD lista + primer adapter funcional**

---

## 💡 NO OLVIDES

1. **Nunca localStorage para tokens** → Supabase lo maneja
2. **Cada tabla necesita RLS** → Copiar políticas de schema.sql
3. **Adapters son puertas a Supabase** → Controllers no tocan supabaseClient
4. **Domain es puro** → Sin DOM, sin estado global
5. **Offline primero** → Dispatch local antes de Supabase

---

## 🆘 ATRAPADO?

| Problema | Busca en... |
|----------|---|
| "No sé qué construir" | memoria-agente (FEATURES) |
| "Quiero copiar código" | cheatsheet (PATRON) |
| "Error de RLS" | arquitectura-seguridad (NIVEL 2) |
| "Encriptación no funciona" | cheatsheet (ENCRIPTACIÓN) |
| "Offline no sincroniza" | arquitectura-seguridad (OFFLINE-FIRST) |

---

## 🚀 AHORA MISMO

```
Lee esto (5 min)
  ↓
Crea cuenta Supabase (5 min)
  ↓
Ejecuta schema.sql (2 horas)
  ↓
Copia patrón adapter (1 hora)
  ↓
Copia patrón controller (1 hora)
  ↓
Prueba que funciona (30 min)
  ↓
✅ Primer feature lista
```

**Total: ~5.5 horas para primer feature completo**

---

## 🎉 ¡VAMOS!

No más documentación.

Abre Supabase. Copia código. Hazlo.

El 80% de las respuestas están en los archivos que ya tienes.

**Éxito.** 🚀

---

**Keep it simple. Redux local dispatch. Supabase RLS. Offline-first. Done.**

