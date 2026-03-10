# 🗄️ ESQUEMA SUPABASE (SQL)
## Script SQL Completo para Base de Datos

**Cómo usar:** 
1. Ve a Supabase Dashboard → SQL Editor
2. Crea una nueva query
3. Copia y pega cada sección abajo
4. Ejecuta sección por sección (no todo junto)
5. Verifica que no haya errores

---

## SECCIÓN 1: TABLAS CORE

### Tabla: clientes
```sql
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Datos personales
  nombre VARCHAR(255) NOT NULL,
  cedula VARCHAR(50) NOT NULL,
  telefono VARCHAR(20),
  email VARCHAR(255),
  direccion TEXT,
  fecha_nacimiento DATE,
  
  -- Fotos (referencias a Storage)
  foto_rostro_path VARCHAR(500), -- ruta en Storage
  cedula_frente_path VARCHAR(500),
  cedula_reverso_path VARCHAR(500),
  
  -- Contacto alternativo
  contacto_emergencia VARCHAR(255),
  telefono_emergencia VARCHAR(20),
  direccion_trabajo VARCHAR(255),
  telefono_trabajo VARCHAR(20),
  
  -- Metadata
  nivel_riesgo VARCHAR(20) DEFAULT 'BAJO', -- BAJO, MEDIO, ALTO
  estado VARCHAR(20) DEFAULT 'ACTIVO', -- ACTIVO, INACTIVO, ARCHIVADO
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizado TIMESTAMPTZ DEFAULT NOW(),
  fecha_archivado TIMESTAMPTZ,
  archivado BOOLEAN DEFAULT FALSE,
  notas TEXT,
  
  -- Índices para búsqueda
  CONSTRAINT cedula_unique UNIQUE(user_id, cedula),
  CONSTRAINT email_valid CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX clientes_user_id_idx ON clientes(user_id);
CREATE INDEX clientes_cedula_idx ON clientes(cedula);
CREATE INDEX clientes_estado_idx ON clientes(estado);
CREATE INDEX clientes_nivel_riesgo_idx ON clientes(nivel_riesgo);
```

### Tabla: prestamos
```sql
CREATE TABLE prestamos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  
  -- Información del préstamo
  monto_original DECIMAL(15, 2) NOT NULL CHECK (monto_original > 0),
  tasa_interes DECIMAL(5, 2) NOT NULL CHECK (tasa_interes >= 0), -- % mensual o anual
  tipo_interes VARCHAR(20) NOT NULL CHECK (tipo_interes IN ('CUOTA_FIJA', 'DISMINUIR_CUOTA', 'INTERES_FIJO', 'CAPITAL_AL_FINAL')),
  
  -- Períodos
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  frecuencia_pago VARCHAR(20) NOT NULL CHECK (frecuencia_pago IN ('DIARIO', 'INTERDIARIO', 'SEMANAL', 'BISEMANAL', 'QUINCENAL', '15_Y_FIN_MES', 'MENSUAL', 'ANUAL')),
  
  -- Estado
  estado VARCHAR(20) DEFAULT 'ACTIVO', -- ACTIVO, COMPLETADO, ARCHIVADO
  
  -- Totales (precalculados para performance)
  total_con_interes DECIMAL(15, 2),
  monto_pagado DECIMAL(15, 2) DEFAULT 0,
  saldo_pendiente DECIMAL(15, 2),
  interes_pendiente DECIMAL(15, 2),
  
  -- Método de pago aceptado
  metodos_pago VARCHAR(100), -- EFECTIVO,TRANSFERENCIA,CHEQUE
  
  -- Metadata
  fecha_creado TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizado TIMESTAMPTZ DEFAULT NOW(),
  fecha_completado TIMESTAMPTZ,
  notas TEXT,
  
  CONSTRAINT fecha_valida CHECK (fecha_fin > fecha_inicio)
);

CREATE INDEX prestamos_user_id_idx ON prestamos(user_id);
CREATE INDEX prestamos_cliente_id_idx ON prestamos(cliente_id);
CREATE INDEX prestamos_estado_idx ON prestamos(estado);
CREATE INDEX prestamos_fecha_fin_idx ON prestamos(fecha_fin);
```

### Tabla: cuotas
```sql
CREATE TABLE cuotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestamo_id UUID NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
  
  -- Número y fechas
  numero_cuota INTEGER NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  
  -- Montos
  monto_original DECIMAL(15, 2) NOT NULL,
  interes_aplicable DECIMAL(15, 2) NOT NULL DEFAULT 0,
  monto_total DECIMAL(15, 2) NOT NULL,
  
  -- Estado de pago
  monto_pagado DECIMAL(15, 2) DEFAULT 0,
  saldo_pendiente DECIMAL(15, 2),
  estado VARCHAR(20) DEFAULT 'PENDIENTE', -- PENDIENTE, PAGADA, VENCIDA, PARCIALMENTE_PAGADA, CONTACTED, NEGOTIATED, LEGAL
  
  -- Metadata
  fecha_creado TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizado TIMESTAMPTZ DEFAULT NOW(),
  fecha_pagada TIMESTAMPTZ,
  notas TEXT,
  
  CONSTRAINT unica_cuota_por_prestamo UNIQUE(prestamo_id, numero_cuota)
);

CREATE INDEX cuotas_prestamo_id_idx ON cuotas(prestamo_id);
CREATE INDEX cuotas_fecha_vencimiento_idx ON cuotas(fecha_vencimiento);
CREATE INDEX cuotas_estado_idx ON cuotas(estado);
```

### Tabla: pagos
```sql
CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cuota_id UUID NOT NULL REFERENCES cuotas(id) ON DELETE CASCADE,
  
  -- Información del pago
  monto DECIMAL(15, 2) NOT NULL CHECK (monto > 0),
  fecha_pago DATE NOT NULL,
  metodo_pago VARCHAR(50) NOT NULL, -- EFECTIVO, TRANSFERENCIA, CHEQUE, OTRO
  referencia_pago VARCHAR(255), -- número transferencia, número cheque, etc.
  
  -- Documentación
  comprobante_path VARCHAR(500), -- ruta en Storage
  
  -- Metadata
  registrado_por VARCHAR(255), -- usuario que registró
  estado VARCHAR(20) DEFAULT 'CONFIRMADO', -- CONFIRMADO, PENDIENTE, RECHAZADO
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  notas TEXT,
  
  -- Auditoría
  cambios_previos JSONB, -- historial de cambios
  usuario_actualizo VARCHAR(255),
  fecha_actualizado TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX pagos_user_id_idx ON pagos(user_id);
CREATE INDEX pagos_cuota_id_idx ON pagos(cuota_id);
CREATE INDEX pagos_fecha_pago_idx ON pagos(fecha_pago);
CREATE INDEX pagos_metodo_pago_idx ON pagos(metodo_pago);
```

### Tabla: activos
```sql
CREATE TABLE activos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Información del activo
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(50) NOT NULL, -- VEHICULOS, ELECTRONICA, JOYERIA, MAQUINARIA, INMUEBLES, OTRO
  numero_serie VARCHAR(255),
  proveedor VARCHAR(255),
  
  -- Costos
  costo_compra DECIMAL(15, 2) NOT NULL CHECK (costo_compra > 0),
  precio_venta_esperado DECIMAL(15, 2),
  cantidad INTEGER DEFAULT 1,
  
  -- Fechas
  fecha_compra DATE NOT NULL,
  fecha_venta DATE,
  
  -- Si fue vendido
  cliente_comprador VARCHAR(255),
  precio_venta_final DECIMAL(15, 2),
  ganancia DECIMAL(15, 2),
  margen_porcentaje DECIMAL(5, 2),
  
  -- Fotos (referencias a Storage)
  fotos_paths TEXT[], -- array de rutas en Storage
  
  -- Estado
  estado VARCHAR(20) DEFAULT 'EN_INVENTARIO', -- EN_INVENTARIO, EN_PROCESO, VENDIDO, DESCARTADO, DAÑADO
  
  -- Metadata
  fecha_creado TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizado TIMESTAMPTZ DEFAULT NOW(),
  notas TEXT
);

CREATE INDEX activos_user_id_idx ON activos(user_id);
CREATE INDEX activos_categoria_idx ON activos(categoria);
CREATE INDEX activos_estado_idx ON activos(estado);
CREATE INDEX activos_fecha_compra_idx ON activos(fecha_compra);
```

### Tabla: audit_logs
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Qué pasó
  action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE, VIEW, DOWNLOAD, LOGIN
  entity VARCHAR(50) NOT NULL, -- cliente, prestamo, pago, activo, foto
  entity_id UUID,
  
  -- Detalles
  details JSONB, -- { cambios: { campo_anterior, campo_nuevo }, ip, device, etc }
  
  -- Metadata
  fecha_creado TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity, entity_id);
CREATE INDEX audit_logs_action_idx ON audit_logs(action);
CREATE INDEX audit_logs_fecha_idx ON audit_logs(fecha_creado);
```

### Tabla: sync_state
```sql
-- Tabla para tracking de sincronización offline
CREATE TABLE sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Qué está pendiente
  entity_type VARCHAR(50) NOT NULL, -- cliente, prestamo, pago, etc
  entity_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
  
  -- Datos del cambio
  payload JSONB NOT NULL,
  
  -- Estado
  synced BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  
  -- Metadata
  fecha_creado TIMESTAMPTZ DEFAULT NOW(),
  fecha_sincronizado TIMESTAMPTZ,
  intento_numero INTEGER DEFAULT 0
);

CREATE INDEX sync_state_user_id_idx ON sync_state(user_id);
CREATE INDEX sync_state_synced_idx ON sync_state(synced);
CREATE INDEX sync_state_entity_idx ON sync_state(entity_type, entity_id);
```

---

## SECCIÓN 2: ROW LEVEL SECURITY (RLS)

**Habilitar RLS en todas las tablas:**
```sql
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE activos ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;
```

### Políticas RLS para `clientes`

```sql
-- SELECT: Usuario solo ve sus propios clientes
CREATE POLICY "clientes_select"
ON clientes
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Usuario puede crear clientes
CREATE POLICY "clientes_insert"
ON clientes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Usuario solo edita sus propios clientes
CREATE POLICY "clientes_update"
ON clientes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Nunca permitir hard delete (solo soft delete via UPDATE)
CREATE POLICY "clientes_delete_disabled"
ON clientes
FOR DELETE
USING (FALSE); -- Rechaza todos los deletes
```

### Políticas RLS para `prestamos`

```sql
-- SELECT: Usuario solo ve sus propios préstamos
CREATE POLICY "prestamos_select"
ON prestamos
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Usuario puede crear préstamos para sus clientes
CREATE POLICY "prestamos_insert"
ON prestamos
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  cliente_id IN (
    SELECT id FROM clientes 
    WHERE user_id = auth.uid()
  )
);

-- UPDATE: Usuario edita sus propios préstamos
CREATE POLICY "prestamos_update"
ON prestamos
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Disabled
CREATE POLICY "prestamos_delete_disabled"
ON prestamos
FOR DELETE
USING (FALSE);
```

### Políticas RLS para `cuotas`

```sql
-- SELECT: Usuario solo ve cuotas de sus préstamos
CREATE POLICY "cuotas_select"
ON cuotas
FOR SELECT
USING (
  prestamo_id IN (
    SELECT id FROM prestamos 
    WHERE user_id = auth.uid()
  )
);

-- INSERT: Permitir solo a través de funciones (no directamente)
CREATE POLICY "cuotas_insert_disabled"
ON cuotas
FOR INSERT
WITH CHECK (FALSE);

-- UPDATE: Usuario puede marcar cuotas como pagadas
CREATE POLICY "cuotas_update"
ON cuotas
FOR UPDATE
USING (
  prestamo_id IN (
    SELECT id FROM prestamos 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  prestamo_id IN (
    SELECT id FROM prestamos 
    WHERE user_id = auth.uid()
  )
);

-- DELETE: Disabled
CREATE POLICY "cuotas_delete_disabled"
ON cuotas
FOR DELETE
USING (FALSE);
```

### Políticas RLS para `pagos`

```sql
-- SELECT: Usuario solo ve sus propios pagos
CREATE POLICY "pagos_select"
ON pagos
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Usuario puede registrar pagos
CREATE POLICY "pagos_insert"
ON pagos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Usuario puede editar sus propios pagos
CREATE POLICY "pagos_update"
ON pagos
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Disabled (soft delete)
CREATE POLICY "pagos_delete_disabled"
ON pagos
FOR DELETE
USING (FALSE);
```

### Políticas RLS para `activos`

```sql
-- SELECT: Usuario solo ve sus propios activos
CREATE POLICY "activos_select"
ON activos
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Usuario puede crear activos
CREATE POLICY "activos_insert"
ON activos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Usuario edita sus propios activos
CREATE POLICY "activos_update"
ON activos
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Disabled
CREATE POLICY "activos_delete_disabled"
ON activos
FOR DELETE
USING (FALSE);
```

### Políticas RLS para `audit_logs`

```sql
-- SELECT: Usuario solo ve sus propios logs
CREATE POLICY "audit_logs_select"
ON audit_logs
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Sistema log automáticamente
CREATE POLICY "audit_logs_insert"
ON audit_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: No permitir editar logs (auditoría)
CREATE POLICY "audit_logs_update_disabled"
ON audit_logs
FOR UPDATE
USING (FALSE);

-- DELETE: No permitir eliminar logs
CREATE POLICY "audit_logs_delete_disabled"
ON audit_logs
FOR DELETE
USING (FALSE);
```

### Políticas RLS para `sync_state`

```sql
-- SELECT: Usuario solo ve su estado de sincronización
CREATE POLICY "sync_state_select"
ON sync_state
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Usuario registra cambios pendientes
CREATE POLICY "sync_state_insert"
ON sync_state
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Usuario marca como sincronizado
CREATE POLICY "sync_state_update"
ON sync_state
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Usuario limpia después de sincronizar
CREATE POLICY "sync_state_delete"
ON sync_state
FOR DELETE
USING (auth.uid() = user_id);
```

---

## SECCIÓN 3: TRIGGERS Y FUNCIONES

### Trigger: Actualizar fecha_actualizado en cada cambio

```sql
CREATE OR REPLACE FUNCTION update_fecha_actualizado()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizado = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- En clientes
CREATE TRIGGER trigger_clientes_updated
BEFORE UPDATE ON clientes
FOR EACH ROW
EXECUTE FUNCTION update_fecha_actualizado();

-- En prestamos
CREATE TRIGGER trigger_prestamos_updated
BEFORE UPDATE ON prestamos
FOR EACH ROW
EXECUTE FUNCTION update_fecha_actualizado();

-- En activos
CREATE TRIGGER trigger_activos_updated
BEFORE UPDATE ON activos
FOR EACH ROW
EXECUTE FUNCTION update_fecha_actualizado();

-- Etc. en todas las tablas importantes
```

### Trigger: Auto-calcular saldo_pendiente de cuota

```sql
CREATE OR REPLACE FUNCTION calcular_saldo_cuota()
RETURNS TRIGGER AS $$
BEGIN
  NEW.saldo_pendiente = NEW.monto_total - NEW.monto_pagado;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cuotas_saldo
BEFORE INSERT OR UPDATE ON cuotas
FOR EACH ROW
EXECUTE FUNCTION calcular_saldo_cuota();
```

### Trigger: Crear entradas de auditoría automáticamente

```sql
CREATE OR REPLACE FUNCTION crear_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_action VARCHAR;
  v_entity VARCHAR;
  v_changes JSONB;
BEGIN
  -- Determinar acción
  v_action := CASE
    WHEN TG_OP = 'INSERT' THEN 'INSERT'
    WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
    WHEN TG_OP = 'DELETE' THEN 'DELETE'
  END;

  -- Determinar entidad
  v_entity := TG_TABLE_NAME;

  -- Calcular cambios
  IF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'cambios', row_to_json(NEW) - row_to_json(OLD)
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := jsonb_build_object('datos_nuevos', row_to_json(NEW));
  ELSE
    v_changes := jsonb_build_object('datos_deletados', row_to_json(OLD));
  END IF;

  -- Insertar en audit_logs
  INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
  VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    v_action,
    v_entity,
    COALESCE(NEW.id, OLD.id),
    v_changes
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas importantes
CREATE TRIGGER trigger_audit_clientes
AFTER INSERT OR UPDATE OR DELETE ON clientes
FOR EACH ROW
EXECUTE FUNCTION crear_audit_log();

CREATE TRIGGER trigger_audit_prestamos
AFTER INSERT OR UPDATE OR DELETE ON prestamos
FOR EACH ROW
EXECUTE FUNCTION crear_audit_log();

-- Etc. en todas las tablas
```

### Función: Recalcular totales de préstamo

```sql
CREATE OR REPLACE FUNCTION recalcular_prestamo_totales(p_prestamo_id UUID)
RETURNS VOID AS $$
DECLARE
  v_monto_pagado DECIMAL;
  v_saldo_pendiente DECIMAL;
  v_interes_pendiente DECIMAL;
BEGIN
  -- Calcular monto pagado (suma de todos los pagos)
  SELECT COALESCE(SUM(p.monto), 0)
  INTO v_monto_pagado
  FROM pagos p
  JOIN cuotas c ON p.cuota_id = c.id
  WHERE c.prestamo_id = p_prestamo_id AND p.estado = 'CONFIRMADO';

  -- Saldo pendiente (total - pagado)
  SELECT (total_con_interes - v_monto_pagado)
  INTO v_saldo_pendiente
  FROM prestamos
  WHERE id = p_prestamo_id;

  -- Actualizar préstamo
  UPDATE prestamos
  SET 
    monto_pagado = v_monto_pagado,
    saldo_pendiente = v_saldo_pendiente,
    interes_pendiente = CASE 
      WHEN saldo_pendiente <= 0 THEN 0
      ELSE (total_con_interes - monto_original) * (saldo_pendiente / total_con_interes)
    END
  WHERE id = p_prestamo_id;
END;
$$ LANGUAGE plpgsql;
```

### Función: Crear cuotas automáticamente al crear préstamo

```sql
CREATE OR REPLACE FUNCTION crear_cuotas_prestamo(
  p_prestamo_id       UUID,
  p_monto_original    DECIMAL,
  p_tasa_interes      DECIMAL,
  p_tipo_interes      VARCHAR,
  p_fecha_inicio      DATE,
  p_fecha_fin         DATE,
  p_frecuencia_pago   VARCHAR,
  p_fecha_primer_pago DATE DEFAULT NULL   -- ← nuevo parámetro
)
RETURNS VOID AS $$
DECLARE
  v_fecha_cuota     DATE;
  v_numero_cuota    INTEGER := 1;
  v_monto_cuota     DECIMAL;
  v_interes_cuota   DECIMAL;
  v_amortizacion    DECIMAL;
  v_dias_intervalo  INTEGER;
  v_meses_intervalo INTEGER;
  v_saldo_insoluto  DECIMAL;
  v_tasa_periodo    DECIMAL;
  v_num_cuotas      INTEGER;
BEGIN
  -- ── Intervalo según frecuencia ──────────────────────────────────────
  v_dias_intervalo := CASE p_frecuencia_pago
    WHEN 'DIARIO'       THEN 1
    WHEN 'INTERDIARIO'  THEN 2
    WHEN 'SEMANAL'      THEN 7
    WHEN 'BISEMANAL'    THEN 14
    WHEN 'QUINCENAL'    THEN 15
    WHEN '15_Y_FIN_MES' THEN 15
    WHEN 'MENSUAL'      THEN NULL   -- usar meses reales
    WHEN 'ANUAL'        THEN NULL
    ELSE 30
  END;

  v_meses_intervalo := CASE p_frecuencia_pago
    WHEN 'MENSUAL' THEN 1
    WHEN 'ANUAL'   THEN 12
    ELSE NULL
  END;

  -- ── Tasa por período ────────────────────────────────────────────────
  -- Tasa mensual como decimal (ej: 10% → 0.10)
  v_tasa_periodo := (p_tasa_interes / 100.0) * COALESCE(
    v_meses_intervalo,
    CAST(v_dias_intervalo AS DECIMAL) / 30.0
  );

  -- ── Número de cuotas (para DISMINUIR_CUOTA y CUOTA_FIJA) ───────────
  IF v_meses_intervalo IS NOT NULL THEN
    v_num_cuotas := EXTRACT(YEAR FROM AGE(p_fecha_fin, COALESCE(p_fecha_primer_pago, p_fecha_inicio)))
                  * 12 / v_meses_intervalo
                  + EXTRACT(MONTH FROM AGE(p_fecha_fin, COALESCE(p_fecha_primer_pago, p_fecha_inicio)))
                  / v_meses_intervalo
                  + 1;
  ELSE
    v_num_cuotas := FLOOR(EXTRACT(DAY FROM (p_fecha_fin - COALESCE(p_fecha_primer_pago, p_fecha_inicio)))
                    / v_dias_intervalo) + 1;
  END IF;

  IF v_num_cuotas <= 0 THEN v_num_cuotas := 1; END IF;

  -- ── Punto de arranque: fecha_primer_pago si viene, si no fecha_inicio
  v_fecha_cuota    := COALESCE(p_fecha_primer_pago, p_fecha_inicio);
  v_saldo_insoluto := p_monto_original;

  WHILE v_fecha_cuota <= p_fecha_fin LOOP

    -- ── Interés de esta cuota según tipo ─────────────────────────────
    v_interes_cuota := v_saldo_insoluto * v_tasa_periodo;

    CASE p_tipo_interes

      WHEN 'CUOTA_FIJA' THEN
        -- PMT real: C = P * r / (1 - (1+r)^-n)
        IF v_tasa_periodo = 0 THEN
          v_monto_cuota := p_monto_original / v_num_cuotas;
          v_interes_cuota := 0;
        ELSE
          v_monto_cuota := p_monto_original * v_tasa_periodo
                         / (1 - POWER(1 + v_tasa_periodo, -v_num_cuotas));
          -- Recalcular interés sobre saldo actual (amortización creciente)
          v_interes_cuota := v_saldo_insoluto * v_tasa_periodo;
        END IF;
        -- Reducir saldo insoluto (amortización = cuota - interés)
        v_saldo_insoluto := v_saldo_insoluto - (v_monto_cuota - v_interes_cuota);

      WHEN 'DISMINUIR_CUOTA' THEN
        -- Amortización fija + interés sobre saldo decreciente
        v_amortizacion  := p_monto_original / v_num_cuotas;
        v_interes_cuota := v_saldo_insoluto * v_tasa_periodo;
        v_monto_cuota   := v_amortizacion + v_interes_cuota;
        v_saldo_insoluto := v_saldo_insoluto - v_amortizacion;

      WHEN 'INTERES_FIJO' THEN
        -- Solo interés; capital al final de cada período
        v_monto_cuota := v_interes_cuota;

      WHEN 'CAPITAL_AL_FINAL' THEN
        -- Interés en cada cuota; última cuota incluye capital
        IF v_fecha_cuota = p_fecha_fin THEN
          v_monto_cuota := p_monto_original + v_interes_cuota;
        ELSE
          v_monto_cuota := v_interes_cuota;
        END IF;

      ELSE
        v_monto_cuota := (p_monto_original / v_num_cuotas) + v_interes_cuota;

    END CASE;

    -- ── Insertar cuota ────────────────────────────────────────────────
    INSERT INTO cuotas (
      prestamo_id,
      numero_cuota,
      fecha_vencimiento,
      monto_original,
      interes_aplicable,
      monto_total,
      saldo_pendiente
    ) VALUES (
      p_prestamo_id,
      v_numero_cuota,
      v_fecha_cuota,
      CASE WHEN p_tipo_interes IN ('CUOTA_FIJA', 'DISMINUIR_CUOTA')
           THEN v_monto_cuota - v_interes_cuota
           ELSE 0
      END,
      v_interes_cuota,
      v_monto_cuota,
      v_monto_cuota
    );

    -- ── Avanzar fecha ─────────────────────────────────────────────────
    IF v_meses_intervalo IS NOT NULL THEN
      v_fecha_cuota := v_fecha_cuota + (v_meses_intervalo || ' months')::INTERVAL;
    ELSE
      v_fecha_cuota := v_fecha_cuota + v_dias_intervalo::INTEGER;
    END IF;

    v_numero_cuota := v_numero_cuota + 1;

    -- Protección anti-loop infinito
    IF v_numero_cuota > 1000 THEN EXIT; END IF;

  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## SECCIÓN 4: STORAGE (Supabase Storage)

**En Supabase Dashboard → Storage, crea estos buckets:**

### Bucket: fotos
```
Visibilidad: PRIVATE (solo autenticados)
RLS habilitado

Carpetas estructura:
fotos/
├── {user_id}/
│   ├── clientes/
│   │   └── {cliente_id}/
│   │       ├── cedula_frente
│   │       ├── cedula_reverso
│   │       └── foto_rostro
│   ├── comprobantes/
│   │   └── {pago_id}/
│   │       └── comprobante
│   └── activos/
│       └── {activo_id}/
│           ├── foto_1
│           └── foto_2
```

### Política RLS para Storage (fotos)

```sql
-- Solo el owner puede listar sus fotos
CREATE POLICY "fotos_select"
ON storage.objects
FOR SELECT
USING (bucket_id = 'fotos' AND auth.uid()::text = owner);

-- Solo el owner puede subir fotos
CREATE POLICY "fotos_insert"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'fotos' AND auth.uid()::text = owner);

-- Solo el owner puede eliminar sus fotos
CREATE POLICY "fotos_delete"
ON storage.objects
FOR DELETE
USING (bucket_id = 'fotos' AND auth.uid()::text = owner);
```

---

## SECCIÓN 5: DATOS INICIALES (Opcional)

### Insertar usuario de prueba (solo para testing)

```sql
-- ⚠️ SOLO PARA TESTING - Eliminar después
-- En Supabase, el usuario se crea via auth.signUp()
-- Esto es solo para referencia

-- Obtener el UUID del usuario creado (después de sign up real):
-- SELECT auth.users.id FROM auth.users WHERE email = 'test@example.com';
```

---

## SECCIÓN 6: VIEWS ÚTILES (Queries Preconstruidas)

### View: Resumen de deudas por cliente

```sql
CREATE VIEW vw_deudas_cliente AS
SELECT 
  c.id,
  c.nombre,
  c.email,
  COUNT(p.id) as num_prestamos,
  SUM(CASE WHEN p.estado = 'ACTIVO' THEN 1 ELSE 0 END) as prestamos_activos,
  SUM(CASE WHEN p.estado = 'ACTIVO' THEN p.saldo_pendiente ELSE 0 END) as saldo_total,
  MAX(cu.fecha_vencimiento) as proximo_vencimiento,
  c.nivel_riesgo
FROM clientes c
LEFT JOIN prestamos p ON c.id = p.cliente_id
LEFT JOIN cuotas cu ON p.id = cu.prestamo_id
GROUP BY c.id, c.nombre, c.email, c.nivel_riesgo;

-- RLS para view
CREATE POLICY "vw_deudas_cliente_select"
ON vw_deudas_cliente
FOR SELECT
USING (TRUE); -- View hereda RLS de tabla base
```

### View: Cuotas vencidas

```sql
CREATE VIEW vw_cuotas_vencidas AS
SELECT 
  cu.id,
  c.nombre as cliente,
  p.id as prestamo_id,
  cu.numero_cuota,
  cu.fecha_vencimiento,
  cu.monto_total,
  cu.monto_pagado,
  cu.saldo_pendiente,
  CURRENT_DATE - cu.fecha_vencimiento as dias_atraso
FROM cuotas cu
JOIN prestamos p ON cu.prestamo_id = p.id
JOIN clientes c ON p.cliente_id = c.id
WHERE cu.estado IN ('PENDIENTE', 'PARCIALMENTE_PAGADA', 'VENCIDA')
  AND cu.fecha_vencimiento < CURRENT_DATE;

-- RLS vía join con prestamos/clientes
```

### View: Rentabilidad acumulada

```sql
CREATE VIEW vw_rentabilidad_acumulada AS
SELECT 
  p.user_id,
  SUM(CASE 
    WHEN p.total_con_interes IS NOT NULL 
    THEN (p.total_con_interes - p.monto_original)
    ELSE 0
  END) as interes_ganado,
  SUM(CASE 
    WHEN a.estado = 'VENDIDO' 
    THEN COALESCE(a.ganancia, 0)
    ELSE 0
  END) as ganancia_activos,
  SUM(CASE 
    WHEN p.total_con_interes IS NOT NULL 
    THEN (p.total_con_interes - p.monto_original)
    ELSE 0
  END) + 
  SUM(CASE 
    WHEN a.estado = 'VENDIDO' 
    THEN COALESCE(a.ganancia, 0)
    ELSE 0
  END) as rentabilidad_total
FROM prestamos p
FULL OUTER JOIN activos a ON p.user_id = a.user_id
GROUP BY p.user_id;
```

---

## SECCIÓN 7: FUNCIONES DE BÚSQUEDA

### Función: Buscar clientes (case-insensitive)

```sql
CREATE OR REPLACE FUNCTION buscar_clientes(
  p_user_id UUID,
  p_termino VARCHAR
)
RETURNS TABLE (
  id UUID,
  nombre VARCHAR,
  cedula VARCHAR,
  telefono VARCHAR,
  email VARCHAR,
  nivel_riesgo VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id, c.nombre, c.cedula, c.telefono, c.email, c.nivel_riesgo
  FROM clientes c
  WHERE c.user_id = p_user_id
    AND c.archivado = FALSE
    AND (
      c.nombre ILIKE '%' || p_termino || '%'
      OR c.cedula ILIKE '%' || p_termino || '%'
      OR c.telefono ILIKE '%' || p_termino || '%'
    );
END;
$$ LANGUAGE plpgsql;
```

### Función: Obtener cuotas vencidas para una fecha

```sql
CREATE OR REPLACE FUNCTION obtener_cuotas_vencidas(
  p_user_id UUID,
  p_fecha DATE
)
RETURNS TABLE (
  cliente_nombre VARCHAR,
  numero_cuota INTEGER,
  monto_total DECIMAL,
  saldo_pendiente DECIMAL,
  dias_atraso INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.nombre,
    cu.numero_cuota,
    cu.monto_total,
    cu.saldo_pendiente,
    (p_fecha - cu.fecha_vencimiento)::INTEGER
  FROM cuotas cu
  JOIN prestamos p ON cu.prestamo_id = p.id
  JOIN clientes c ON p.cliente_id = c.id
  WHERE p.user_id = p_user_id
    AND cu.fecha_vencimiento = p_fecha
    AND cu.estado IN ('PENDIENTE', 'VENCIDA', 'PARCIALMENTE_PAGADA');
END;
$$ LANGUAGE plpgsql;
```

---

## 🧪 VERIFICACIÓN POST-SETUP

**Ejecuta esto para verificar que todo está correcto:**

```sql
-- 1. Verificar RLS habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Resultado esperado: rowsecurity = true para todas las tablas

-- 2. Verificar políticas
SELECT tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- Resultado esperado: 5+ políticas por tabla

-- 3. Verificar triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Resultado esperado: triggers para audit, fecha_actualizado, etc.

-- 4. Verificar índices
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;

-- Resultado esperado: índices en user_id, estado, fecha, etc.

-- 5. Contar tablas
SELECT COUNT(*) as num_tablas
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';

-- Resultado esperado: 7 tablas (clientes, prestamos, cuotas, pagos, activos, audit_logs, sync_state)
```

---

## SECCIÓN 5: COBRANZAS
## Gestión de cobranzas y acciones de seguimiento

### Tabla: cobranzas
```sql
-- Registro principal de cobranzas
CREATE TABLE cobranzas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Referencias
  payment_id UUID NOT NULL,  -- ID de la cuota en cuotas table
  prestamo_id UUID NOT NULL,
  client_id UUID NOT NULL,

  -- Información financiera
  amount_due DECIMAL(12,2) NOT NULL CHECK (amount_due > 0),
  due_date DATE NOT NULL,

  -- Estado y prioridad
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'contacted', 'negotiated', 'resolved', 'cancelled', 'legal')),
  priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 200),

  -- Información adicional
  notes TEXT,
  last_contact_date TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id), -- Para futuro multi-usuario

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_cobranzas_user_id ON cobranzas(user_id);
CREATE INDEX idx_cobranzas_status ON cobranzas(status);
CREATE INDEX idx_cobranzas_payment_id ON cobranzas(payment_id);
CREATE INDEX idx_cobranzas_priority ON cobranzas(priority DESC);
CREATE INDEX idx_cobranzas_due_date ON cobranzas(due_date);

-- RLS
ALTER TABLE cobranzas ENABLE ROW LEVEL SECURITY;
```

### Tabla: cobranza_actions
```sql
-- Historial de acciones de cobranza
CREATE TABLE cobranza_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES cobranzas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tipo de acción
  action_type TEXT NOT NULL CHECK (action_type IN (
    'phone_call', 'email', 'sms', 'letter', 'visit',
    'payment_plan', 'settlement', 'legal_notice', 'other'
  )),

  -- Detalles de la acción
  description TEXT NOT NULL,
  action_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contact_result TEXT,
  follow_up_date DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_cobranza_actions_collection_id ON cobranza_actions(collection_id);
CREATE INDEX idx_cobranza_actions_user_id ON cobranza_actions(user_id);
CREATE INDEX idx_cobranza_actions_action_date ON cobranza_actions(action_date DESC);

-- RLS
ALTER TABLE cobranza_actions ENABLE ROW LEVEL SECURITY;
```

### Tabla: payment_plans
```sql
-- Planes de pago negociados
CREATE TABLE payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES cobranzas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Detalles del plan
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount > 0),
  installments JSONB NOT NULL, -- Array de cuotas: [{amount, due_date, status}]

  -- Estado
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_payment_plans_collection_id ON payment_plans(collection_id);
CREATE INDEX idx_payment_plans_user_id ON payment_plans(user_id);
CREATE INDEX idx_payment_plans_status ON payment_plans(status);

-- RLS
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
```

---

## POLÍTICAS RLS PARA COBRANZAS

### Políticas para cobranzas table
```sql
-- SELECT: Solo el propietario ve sus cobranzas
CREATE POLICY "Users can view own cobranzas" ON cobranzas
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: Solo el propietario puede crear cobranzas
CREATE POLICY "Users can create own cobranzas" ON cobranzas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: Solo el propietario puede actualizar sus cobranzas
CREATE POLICY "Users can update own cobranzas" ON cobranzas
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- DELETE: Solo el propietario puede eliminar (soft delete recomendado)
CREATE POLICY "Users can delete own cobranzas" ON cobranzas
  FOR DELETE USING (auth.uid() = user_id);
```

### Políticas para cobranza_actions table
```sql
-- SELECT: Solo el propietario ve sus acciones de cobranza
CREATE POLICY "Users can view own cobranza_actions" ON cobranza_actions
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: Solo el propietario puede crear acciones
CREATE POLICY "Users can create own cobranza_actions" ON cobranza_actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: Solo el propietario puede actualizar (poco común)
CREATE POLICY "Users can update own cobranza_actions" ON cobranza_actions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- DELETE: No permitir eliminación de historial (auditoría)
-- CREATE POLICY "No delete cobranza_actions" ON cobranza_actions FOR DELETE USING (false);
```

### Políticas para payment_plans table
```sql
-- SELECT: Solo el propietario ve sus planes de pago
CREATE POLICY "Users can view own payment_plans" ON payment_plans
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: Solo el propietario puede crear planes
CREATE POLICY "Users can create own payment_plans" ON payment_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: Solo el propietario puede actualizar
CREATE POLICY "Users can update own payment_plans" ON payment_plans
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- DELETE: Solo el propietario puede eliminar planes cancelados
CREATE POLICY "Users can delete own payment_plans" ON payment_plans
  FOR DELETE USING (auth.uid() = user_id);
```

---

## TRIGGERS PARA COBRANZAS

### Trigger: Actualizar updated_at en cobranzas
```sql
CREATE OR REPLACE FUNCTION update_cobranzas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cobranzas_updated_at
  BEFORE UPDATE ON cobranzas
  FOR EACH ROW EXECUTE FUNCTION update_cobranzas_updated_at();
```

### Trigger: Actualizar updated_at en payment_plans
```sql
CREATE OR REPLACE FUNCTION update_payment_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_plans_updated_at
  BEFORE UPDATE ON payment_plans
  FOR EACH ROW EXECUTE FUNCTION update_payment_plans_updated_at();
```

### Trigger: Auto-crear entradas de auditoría para cobranzas
```sql
CREATE OR REPLACE FUNCTION audit_cobranzas_changes()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  changes JSONB;
BEGIN
  -- Preparar datos para auditoría
  old_data = to_jsonb(OLD);
  new_data = to_jsonb(NEW);

  -- Calcular cambios
  changes = jsonb_object_agg(
    key,
    jsonb_build_object('old', old_data->key, 'new', new_data->key)
  ) FROM jsonb_object_keys(COALESCE(old_data, '{}'::jsonb) || new_data) AS key
  WHERE old_data->key IS DISTINCT FROM new_data->key;

  -- Insertar en audit_logs
  INSERT INTO audit_logs (user_id, table_name, record_id, action, old_data, new_data, changes)
  VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    'cobranzas',
    COALESCE(NEW.id, OLD.id),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'INSERT'
      WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
      WHEN TG_OP = 'DELETE' THEN 'DELETE'
    END,
    CASE WHEN TG_OP != 'INSERT' THEN old_data ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN new_data ELSE NULL END,
    changes
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_cobranzas
  AFTER INSERT OR UPDATE OR DELETE ON cobranzas
  FOR EACH ROW EXECUTE FUNCTION audit_cobranzas_changes();
```

---

## VERIFICACIÓN POST-SETUP COBRANZAS

### Query de verificación
```sql
-- Verificar que las tablas existen y tienen RLS habilitado
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('cobranzas', 'cobranza_actions', 'payment_plans')
AND schemaname = 'public'
ORDER BY tablename;

-- Verificar políticas RLS
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('cobranzas', 'cobranza_actions', 'payment_plans')
ORDER BY tablename, policyname;

-- Resultado esperado: 3 tablas con rowsecurity=true, 9 políticas RLS
```

---

## 📝 NOTAS IMPORTANTES

1. **Ejecutar sección por sección** — Si ejecutas todo junto puede haber errores de dependencias
2. **RLS debe estar HABILITADO** — sin esto no funciona la seguridad
3. **Políticas RLS deben ser restrictivas** — empezar con `DENY` y agregar excepciones
4. **Índices en user_id** — CRÍTICO para performance con RLS
5. **Backups automáticos** — Supabase lo hace, pero verifica en settings
6. **Storage RLS** — igual de importante que DB RLS
7. **Triggers de auditoría** — no deben fallar, sino la transacción completa falla

---

**Última actualización:** 2026  
**Status:** Script SQL producción-ready
