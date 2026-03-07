# 📚 ÍNDICE MAESTRO
## Guía de Lectura y Orden de Implementación

**Tienes 6 documentos. Lee en este orden:**

---

## 📖 CÓMO USAR ESTOS DOCUMENTOS

### Para Contexto General
👉 **Lee primero:**
1. **memoria-agente-app-prestamos.md** (31 KB)
   - **Qué es:** Tu "prompt de memoria" - contexto completo del proyecto
   - **Para qué:** Entiende el problema, arquitectura Redux, cada feature
   - **Cuándo:** Antes de empezar cualquier feature
   - **Tiempo:** 30 minutos

2. **features-app-prestamos.md** (17 KB)
   - **Qué es:** Especificación detallada de cada feature
   - **Para qué:** Saber exactamente qué construir (no solo cómo)
   - **Cuándo:** Cuando vas a trabajar en una feature específica
   - **Tiempo:** 15 minutos por feature

### Para Seguridad + Backend
👉 **Lee segundo:**
3. **resumen-supabase-redux.md** (17 KB)
   - **Qué es:** Resumen ejecutivo de cómo integrar Supabase SIN romper Redux
   - **Para qué:** Entender la arquitectura de 3 capas (Auth → RLS → Encriptación)
   - **Cuándo:** Antes de crear el primer adapter
   - **Tiempo:** 20 minutos

4. **arquitectura-seguridad-supabase.md** (39 KB)
   - **Qué es:** Guía profunda y completa de seguridad
   - **Para qué:** Implementar adapters, RLS, encriptación, offline-first
   - **Cuándo:** Mientras codificas adapters
   - **Tiempo:** 1 hora (consultarlo mientras codificas)

5. **supabase-schema.sql** (26 KB)
   - **Qué es:** Script SQL completo para Base de Datos
   - **Para qué:** Setup de Supabase
   - **Cuándo:** Día 1, después de crear proyecto Supabase
   - **Tiempo:** 1 hora (ejecutar sección por sección)

### Para Codificación Diaria
👉 **Usa durante desarrollo:**
6. **cheatsheet-desarrollo.md** (17 KB)
   - **Qué es:** Hoja de trucos - patrones, ejemplos, comandos
   - **Para qué:** Copiar-pegar código, recordar sintaxis
   - **Cuándo:** Cada vez que codifiques un adapter o controller
   - **Tiempo:** 5 minutos por consulta

---

## 🗺️ MAPA MENTAL

```
┌─────────────────────────────────────────────────────────┐
│                 INICIO: LEE PRIMERO                      │
│                                                          │
│  1. memoria-agente-app-prestamos.md (contexto)         │
│     ↓ "Entiendo el problema y la arquitectura Redux"   │
│                                                          │
│  2. features-app-prestamos.md (qué construir)          │
│     ↓ "Sé exactamente qué debe hacer cada feature"     │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│              SEGURIDAD: LEE SEGUNDO                      │
│                                                          │
│  3. resumen-supabase-redux.md (resumen ejecu)          │
│     ↓ "Entiendo cómo integrar Supabase sin romper Redux" │
│                                                          │
│  4. arquitectura-seguridad-supabase.md (guía profunda)  │
│     ↓ "Sé cómo implementar cada parte segura"           │
│                                                          │
│  5. supabase-schema.sql (SQL para BD)                   │
│     ↓ "Ejecuté el setup de Supabase correctamente"     │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│           IMPLEMENTACIÓN: USA MIENTRAS CODIFICAS        │
│                                                          │
│  6. cheatsheet-desarrollo.md (hoja de trucos)           │
│     • Copiar patrón de adapter                           │
│     • Copiar patrón de controller                        │
│     • Ejemplos de queries Supabase                       │
│     • Testing rápido                                     │
│     • Debugging                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📅 TIMELINE RECOMENDADO

### Día 1: Setup (4-6 horas)
```
09:00 - 10:00  → Lee memoria-agente (contexto completo)
10:00 - 10:30  → Lee features (especificaciones)
10:30 - 11:30  → Lee resumen-supabase (entender integración)
11:30 - 12:00  → Crear proyecto Supabase
12:00 - 14:00  → Ejecutar schema.sql sección por sección
14:00 - 14:30  → Verificar que todo está correcto (ver checklist final en arquitectura-seguridad)
```

✅ **Resultado:** Base de datos setup, usuario puede loguearse

### Días 2-3: Primer Adapter (8-10 horas)
```
Mañana → Leer arquitectura-seguridad (sección "Patrón de Integración")
         Crear adapters/supabaseAuth.js
         Testing: login, logout, getCurrentUser

Tarde  → Crear adapters/dataAdapters/clientesDataAdapter.js
         Testing: crear cliente, ver en Supabase, verificar RLS

Noche  → Crear adapters/encryptionAdapter.js
         Verificar que cédula se guarda encriptada
```

✅ **Resultado:** Primer adapter funcional, datos seguros

### Días 4-7: Integración con Redux (12-15 horas)
```
Integrar clientesDataAdapter con controller + Redux:
  • Crear clientes/ui/clienteFormController.js
  • Dispatch local + sync a Supabase
  • Testing offline-first
  • Marcar como "pendiente" si falla Supabase

Usar cheatsheet-desarrollo.md:
  • Patrón de Controller
  • Testing rápido
  • Debugging
```

✅ **Resultado:** Feature "Gestión de Clientes" completa y funcional

### Semanas 2-3: Resto de Features (40-50 horas)
```
Seguir mismo patrón para cada feature:
  1. Crear domain/ (validaciones, cálculos)
  2. Crear adapter (CRUD + encriptación)
  3. Crear controller (form + tabla)
  4. Testing (local, Supabase, offline, RLS)
  5. Git commit
  
Features en orden:
  1. Clientes ✅
  2. Préstamos (incluye cálculos complejos)
  3. Pagos (más fácil, depende de prestamos)
  4. Activos (similar a clientes)
  5. Cobranzas (depende de préstamos + pagos)
  6. Dashboard (depende de todo)
  7. Reportes (depende de todo)
```

✅ **Resultado:** App completa y lista para producción

---

## 🎯 BUSCA EN CADA DOCUMENTO

### 1. memoria-agente-app-prestamos.md
| Busco... | Dónde está |
|---|---|
| Contexto del usuario | Sección "CONTEXTO DEL USUARIO (PROBLEMA A RESOLVER)" |
| Especificación de FEATURE X | Sección "ESPECIFICACIÓN DETALLADA DE FEATURES" → "FEATURE N: ..." |
| Estructura de carpetas | Sección "Estructura feature-based obligatoria" |
| Reglas de oro | Sección "REGLAS DE ORO (INVIOLABLES)" |
| Checklist pre-entrega | Sección "CHECKLIST ANTES DE ENTREGAR FEATURE" |
| Orden de desarrollo | Sección "INICIO RECOMENDADO" |

### 2. features-app-prestamos.md
| Busco... | Dónde está |
|---|---|
| Resumen de Feature DASHBOARD | Sección "MODULO 1: DASHBOARD (Core Central)" |
| Resumen de Feature CLIENTES | Sección "MODULO 2: GESTIÓN DE CLIENTES" |
| Resumen de Feature PRÉSTAMOS | Sección "MODULO 3: GESTIÓN DE PRÉSTAMOS" |
| Priorización MVP | Sección "🚀 PRIORIZACIÓN (MVP vs Futuro)" |
| Stack recomendado | Sección "📝 NOTAS TÉCNICAS" |

### 3. resumen-supabase-redux.md
| Busco... | Dónde está |
|---|---|
| Diagrama de flujo de datos | Sección "📊 DIAGRAMA DE FLUJO DE DATOS" |
| Flujo real de crear cliente | Sección "🔄 FLUJO REAL: Crear Cliente" |
| Niveles de seguridad | Sección "🔒 NIVELES DE SEGURIDAD IMPLEMENTADOS" |
| Estructura de carpetas | Sección "📁 ESTRUCTURA DE CARPETAS (Nueva)" |
| Flujo de desarrollo | Sección "🚀 FLUJO DE DESARROLLO: Paso a Paso" |
| Ventajas de la arquitectura | Sección "⚡ VENTAJAS DE ESTA ARQUITECTURA" |

### 4. arquitectura-seguridad-supabase.md
| Busco... | Dónde está |
|---|---|
| Cómo funciona RLS | Sección "NIVEL 2: ROW LEVEL SECURITY (RLS)" |
| Patrón de Data Adapter | Sección "🏗️ NUEVA CARPETA: adapters/supabase/" → "Estructura Base" |
| Cómo integrar con Redux | Sección "🎮 INTEGRACIÓN CON REDUX" |
| Cómo subir fotos | Sección "📸 GESTIÓN DE FOTOS (Storage Seguro)" |
| Cómo hacer offline-first | Sección "⚡ FLUJO DE OFFLINE-FIRST (Resilencia)" |
| Checklist de seguridad | Sección "🛡️ CHECKLIST DE SEGURIDAD IMPLEMENTAR" |
| Orden de implementación | Sección "📋 ORDEN DE IMPLEMENTACIÓN" |
| Errores a evitar | Sección "🚨 ERRORES CRÍTICOS A EVITAR" |
| Testing de seguridad | Sección "🧪 PRUEBAS DE SEGURIDAD (QA)" |

### 5. supabase-schema.sql
| Busco... | Dónde está |
|---|---|
| Crear tabla CLIENTES | Sección "SECCIÓN 1: TABLAS CORE" → "Tabla: clientes" |
| Habilitar RLS | Sección "SECCIÓN 2: ROW LEVEL SECURITY (RLS)" → inicio |
| RLS para clientes | Sección "Políticas RLS para clientes" |
| Triggers de auditoría | Sección "SECCIÓN 3: TRIGGERS Y FUNCIONES" → "Trigger: Auto-crear entradas de auditoría" |
| Storage buckets | Sección "SECCIÓN 4: STORAGE (Supabase Storage)" |
| Verificación | Sección "🧪 VERIFICACIÓN POST-SETUP" |

### 6. cheatsheet-desarrollo.md
| Busco... | Dónde está |
|---|---|
| Setup inicial | Sección "🚀 SETUP INICIAL (Uno solo)" |
| Patrón Data Adapter | Sección "🔐 PATRON: Data Adapter (COPIAR Y ADAPTAR)" |
| Patrón Controller | Sección "🎮 PATRON: Controller (COPIAR Y ADAPTAR)" |
| Autenticación | Sección "🔐 AUTENTICACIÓN" |
| Queries básicas | Sección "📊 QUERIES BÁSICAS" |
| Upload de fotos | Sección "📸 UPLOAD DE FOTOS" |
| Encriptación | Sección "🔒 ENCRIPTACIÓN (libsodium.js)" |
| Auditoría | Sección "📋 LOGGING DE AUDITORÍA" |
| Offline-first | Sección "🔄 OFFLINE-FIRST" |
| Testing | Sección "🧪 TESTING RÁPIDO" |
| Git commands | Sección "⚡ COMANDOS GIT" |
| Flujo típico de feature | Sección "🚀 FLUJO TÍPICO DE FEATURE" |

---

## 🔍 CASOS DE USO

### Caso 1: "Quiero empezar a codificar YA"
```
1. Lee resumen-supabase-redux.md (20 min) → entiende integración
2. Ejecuta supabase-schema.sql (1 hora)
3. Abre cheatsheet-desarrollo.md
4. Sigue "PATRON: Data Adapter" → copia código
5. Crea adapters/supabaseAuth.js
6. Prueba login/logout
```

### Caso 2: "No sé qué construir primero"
```
1. Lee memoria-agente (30 min)
2. Ve sección "INICIO RECOMENDADO"
3. Sigue orden: 
   → app/state/
   → app/ui/
   → clientes/
   → prestamos/
   → etc.
```

### Caso 3: "Tengo error en RLS"
```
1. Lee arquitectura-seguridad-supabase.md
2. Sección "NIVEL 2: ROW LEVEL SECURITY (RLS)"
3. Sección "🧪 PRUEBAS DE SEGURIDAD" → "Probar RLS (usuario A no ve datos de usuario B)"
4. Ejecuta test
5. Si falla, verifica que tabla tiene:
   - ALTER TABLE xxx ENABLE ROW LEVEL SECURITY
   - CREATE POLICY para SELECT, INSERT, UPDATE
```

### Caso 4: "Quiero proteger un campo sensible"
```
1. Lee arquitectura-seguridad-supabase.md
2. Sección "NIVEL 3: ENCRIPTACIÓN EN TRÁNSITO Y REPOSO"
3. Abre cheatsheet-desarrollo.md
4. Sección "🔒 ENCRIPTACIÓN (libsodium.js)"
5. Usa patrón de encryptionAdapter
```

### Caso 5: "El usuario perdió cambios cuando se fue offline"
```
1. Lee arquitectura-seguridad-supabase.md
2. Sección "⚡ FLUJO DE OFFLINE-FIRST (Resilencia)"
3. Abre cheatsheet-desarrollo.md
4. Sección "🔄 OFFLINE-FIRST"
5. Implementa syncManager.js
6. Detecta navigator.onLine
7. Sincroniza pendientes cuando vuelve conexión
```

### Caso 6: "Quiero saber cómo hacer el upload de fotos"
```
1. Lee arquitectura-seguridad-supabase.md
2. Sección "📸 GESTIÓN DE FOTOS (Storage Seguro)"
3. Sección "Patrón de Upload Seguro"
4. Abre cheatsheet-desarrollo.md
5. Sección "📸 UPLOAD DE FOTOS"
6. Copia y adapta código
```

---

## ⏱️ TIEMPO TOTAL

| Actividad | Tiempo |
|---|---|
| Leer documentación (primer pass) | 3 horas |
| Setup Supabase | 2 horas |
| Primer adapter (Auth + Clientes) | 8 horas |
| Integración con Redux | 4 horas |
| 7 features restantes (avg 6h c/u) | 42 horas |
| Testing + hardening | 10 horas |
| **TOTAL** | **~70 horas** |

**En trabajo full-time:** 2 semanas  
**En hobby (10h/semana):** 7 semanas

---

## 🚨 NO COMETAS ESTOS ERRORES

### ❌ Error 1: Saltar documentación
```
"Voy directo a codificar sin leer"
→ Resultado: Rompiste Redux, expones datos, pierdes horas refactojeando
```

**✅ Correcto:** Lee memoria-agente primero (30 min ahorran 10 horas)

### ❌ Error 2: No entender RLS
```
"Supabase maneja la seguridad, no me importa entender RLS"
→ Resultado: Ahora otro usuario ve tus datos
```

**✅ Correcto:** Lee NIVEL 2 en arquitectura-seguridad, ejecuta test RLS

### ❌ Error 3: Guardar JWT en localStorage
```
"Voy a guardar el token en localStorage para persistencia"
→ Resultado: XSS → token robado → cuenta comprometida
```

**✅ Correcto:** Supabase lo maneja. Usa createClient() y listo.

### ❌ Error 4: No tener offline-first
```
"Si se corta internet, que pierda los cambios"
→ Resultado: Usuario furioso, datos perdidos
```

**✅ Correcto:** Dispatch local → localStorage → sync cuando vuelve conexión

### ❌ Error 5: Mezclar lógica en controllers
```
// ❌ MAL
export const initFormController = (dom, store, i18n) => {
  // Aquí valido, encripto, consulto BD, todo mezclado
}

// ✅ BIEN
// domain/validate.js → función pura
// adapters/dataAdapter.js → consulta BD
// controllers/formController.js → bind + dispatch
```

---

## 🎓 JERARQUÍA DE AUTORIDAD

Si algo entra en conflicto, usa este orden:

1. **memoria-agente-app-prestamos.md**
   - Es la fuente de verdad sobre qué construir y cómo
   
2. **arquitectura-seguridad-supabase.md**
   - Es la fuente de verdad sobre seguridad y Supabase
   
3. **supabase-schema.sql**
   - Es la fuente de verdad sobre BD
   
4. **cheatsheet-desarrollo.md**
   - Es la fuente de verdad sobre sintaxis/patrones

---

## 📞 REFERENCIAS RÁPIDAS

**¿Dónde está...?**

| Necesito... | Archivo | Sección |
|---|---|---|
| Entender Redux manual | memoria-agente | "Patrón central: Redux manual + Controllers" |
| Crear un adapter | cheatsheet-desarrollo | "PATRON: Data Adapter" |
| Proteger datos | arquitectura-seguridad | "NIVEL 3: ENCRIPTACIÓN" |
| Hacer RLS | supabase-schema.sql | "SECCIÓN 2: RLS" |
| Uploadar foto | cheatsheet-desarrollo | "📸 UPLOAD DE FOTOS" |
| Testing RLS | arquitectura-seguridad | "🧪 Probar RLS" |
| Offline-first | arquitectura-seguridad | "⚡ FLUJO DE OFFLINE-FIRST" |
| Dashboard metrics | memoria-agente | "FEATURE 1: DASHBOARD" |
| Cronograma de pagos | arquitectura-seguridad | Función SQL "crear_cuotas_prestamo" |
| Git commands | cheatsheet-desarrollo | "⚡ COMANDOS GIT" |

---

## ✅ CHECKLIST PRE-PRODUCCIÓN

**Antes de lanzar:**

- [ ] Leí toda la documentación
- [ ] Supabase schema ejecutado correctamente
- [ ] RLS habilitado en TODAS las tablas
- [ ] Encriptación funciona (cédula cifrada en DB)
- [ ] Storage tiene RLS y URLs firmadas
- [ ] Offline-first funciona (crear → offline → online → sincroniza)
- [ ] Auditoría registra acciones
- [ ] Usuario A no ve datos de usuario B (RLS test)
- [ ] SQL injection intento rechazado (RLS test)
- [ ] Logout limpia todo
- [ ] Performance: <2s para cargar 1000 items
- [ ] Responsive: probé en mobile (375px)
- [ ] Backups Supabase habilitados

---

## 🎯 RESUMEN FINAL

**Tienes una guía completa:**

1. **Memoria** (contexto) → Entiende el problema
2. **Features** (specs) → Sabe qué construir
3. **Resumen** (overview) → Entiende la arquitectura
4. **Arquitectura** (profundidad) → Implementa bien
5. **Schema** (BD) → Setup Supabase
6. **Cheatsheet** (sintaxis) → Codifica rápido

**No estás solo. Cada documento responde una pregunta diferente.**

**Ahora a codificar.** 🚀

---

**Última actualización:** 2026  
**Status:** Guía de navegación completa
