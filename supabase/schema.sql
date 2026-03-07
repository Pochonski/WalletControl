-- =============================================================================
-- APP DE GESTION DE PRESTAMOS - Supabase Schema
-- =============================================================================
-- Instrucciones:
--   1. Abre Supabase Dashboard -> SQL Editor
--   2. Ejecuta cada seccion por separado (selecciona y ejecuta)
--   3. Verifica que no haya errores antes de pasar a la siguiente
--   4. Al final ejecuta la Seccion 8 (Verificacion) para confirmar todo OK
-- =============================================================================


-- =============================================================================
-- SECCION 1: TABLAS
-- =============================================================================

CREATE TABLE clientes (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Datos personales
  nombre                VARCHAR(255)  NOT NULL,
  cedula                VARCHAR(500)  NOT NULL,  -- cifrada (AES-GCM, base64)
  telefono              VARCHAR(20),
  email                 VARCHAR(255),
  direccion             TEXT,
  fecha_nacimiento      DATE,

  -- Fotos (rutas en Supabase Storage, bucket 'fotos')
  foto_rostro_path      VARCHAR(500),
  cedula_frente_path    VARCHAR(500),
  cedula_reverso_path   VARCHAR(500),

  -- Contacto alternativo
  contacto_emergencia   VARCHAR(255),
  telefono_emergencia   VARCHAR(20),
  direccion_trabajo     VARCHAR(255),
  telefono_trabajo      VARCHAR(20),

  -- Clasificacion
  nivel_riesgo          VARCHAR(20)   NOT NULL DEFAULT 'BAJO'
                          CHECK (nivel_riesgo IN ('BAJO', 'MEDIO', 'ALTO')),
  estado                VARCHAR(20)   NOT NULL DEFAULT 'ACTIVO'
                          CHECK (estado IN ('ACTIVO', 'INACTIVO', 'ARCHIVADO')),
  archivado             BOOLEAN       NOT NULL DEFAULT FALSE,
  fecha_archivado       TIMESTAMPTZ,
  notas                 TEXT,

  -- Timestamps
  fecha_registro        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  fecha_actualizado     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT cedula_unica_por_usuario UNIQUE (user_id, cedula),
  CONSTRAINT email_valido CHECK (
    email IS NULL OR
    email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
  )
);

CREATE INDEX clientes_user_id_idx      ON clientes(user_id);
CREATE INDEX clientes_estado_idx       ON clientes(estado);
CREATE INDEX clientes_nivel_riesgo_idx ON clientes(nivel_riesgo);
CREATE INDEX clientes_archivado_idx    ON clientes(archivado);

-- -----------------------------------------------------------------------------

CREATE TABLE prestamos (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id            UUID          NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,

  -- Configuracion del prestamo
  monto_original        DECIMAL(15,2) NOT NULL CHECK (monto_original > 0),
  tasa_interes          DECIMAL(8,4)  NOT NULL CHECK (tasa_interes >= 0),
  tipo_interes          VARCHAR(20)   NOT NULL
                          CHECK (tipo_interes IN ('SIMPLE', 'COMPUESTO', 'MIXTO')),
  frecuencia_pago       VARCHAR(20)   NOT NULL
                          CHECK (frecuencia_pago IN ('DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL')),

  -- Fechas
  fecha_inicio          DATE          NOT NULL,
  fecha_fin             DATE          NOT NULL,

  -- Totales precalculados (actualizados por trigger/funcion)
  total_con_interes     DECIMAL(15,2),
  monto_pagado          DECIMAL(15,2) NOT NULL DEFAULT 0,
  saldo_pendiente       DECIMAL(15,2),

  -- Estado
  estado                VARCHAR(20)   NOT NULL DEFAULT 'ACTIVO'
                          CHECK (estado IN ('ACTIVO', 'COMPLETADO', 'ARCHIVADO')),
  fecha_completado      TIMESTAMPTZ,
  notas                 TEXT,
  metodos_pago          VARCHAR(100),  -- "EFECTIVO,TRANSFERENCIA"

  -- Timestamps
  fecha_creado          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  fecha_actualizado     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fecha_fin_posterior CHECK (fecha_fin > fecha_inicio)
);

CREATE INDEX prestamos_user_id_idx    ON prestamos(user_id);
CREATE INDEX prestamos_cliente_id_idx ON prestamos(cliente_id);
CREATE INDEX prestamos_estado_idx     ON prestamos(estado);
CREATE INDEX prestamos_fecha_fin_idx  ON prestamos(fecha_fin);

-- -----------------------------------------------------------------------------

CREATE TABLE cuotas (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  prestamo_id           UUID          NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,

  -- Numero y fecha
  numero_cuota          INTEGER       NOT NULL CHECK (numero_cuota > 0),
  fecha_vencimiento     DATE          NOT NULL,

  -- Montos
  monto_original        DECIMAL(15,2) NOT NULL CHECK (monto_original > 0),
  interes_aplicable     DECIMAL(15,2) NOT NULL DEFAULT 0,
  monto_total           DECIMAL(15,2) NOT NULL,

  -- Estado de pago
  monto_pagado          DECIMAL(15,2) NOT NULL DEFAULT 0,
  saldo_pendiente       DECIMAL(15,2),          -- calculado por trigger
  estado                VARCHAR(30)   NOT NULL DEFAULT 'PENDIENTE'
                          CHECK (estado IN ('PENDIENTE', 'PAGADA', 'VENCIDA', 'PARCIALMENTE_PAGADA')),

  -- Timestamps
  fecha_pagada          TIMESTAMPTZ,
  fecha_creado          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  fecha_actualizado     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  notas                 TEXT,

  CONSTRAINT cuota_unica_por_prestamo UNIQUE (prestamo_id, numero_cuota)
);

CREATE INDEX cuotas_prestamo_id_idx       ON cuotas(prestamo_id);
CREATE INDEX cuotas_fecha_vencimiento_idx ON cuotas(fecha_vencimiento);
CREATE INDEX cuotas_estado_idx            ON cuotas(estado);

-- -----------------------------------------------------------------------------

CREATE TABLE pagos (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cuota_id              UUID          NOT NULL REFERENCES cuotas(id) ON DELETE CASCADE,

  -- Informacion del pago
  monto                 DECIMAL(15,2) NOT NULL CHECK (monto > 0),
  fecha_pago            DATE          NOT NULL,
  metodo_pago           VARCHAR(50)   NOT NULL
                          CHECK (metodo_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'OTRO')),
  referencia_pago       VARCHAR(255),
  comprobante_path      VARCHAR(500),  -- ruta en Storage

  -- Estado y auditoria
  estado                VARCHAR(20)   NOT NULL DEFAULT 'CONFIRMADO'
                          CHECK (estado IN ('CONFIRMADO', 'PENDIENTE', 'RECHAZADO')),
  registrado_por        VARCHAR(255),
  notas                 TEXT,
  cambios_previos       JSONB,

  -- Timestamps
  fecha_registro        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  fecha_actualizado     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX pagos_user_id_idx    ON pagos(user_id);
CREATE INDEX pagos_cuota_id_idx   ON pagos(cuota_id);
CREATE INDEX pagos_fecha_pago_idx ON pagos(fecha_pago);
CREATE INDEX pagos_estado_idx     ON pagos(estado);

-- -----------------------------------------------------------------------------

CREATE TABLE activos (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Informacion del activo
  nombre                VARCHAR(255)  NOT NULL,
  descripcion           TEXT,
  categoria             VARCHAR(50)   NOT NULL
                          CHECK (categoria IN ('VEHICULOS', 'ELECTRONICA', 'JOYERIA', 'MAQUINARIA', 'INMUEBLES', 'OTRO')),
  numero_serie          VARCHAR(255),
  proveedor             VARCHAR(255),

  -- Compra
  costo_compra          DECIMAL(15,2) NOT NULL CHECK (costo_compra > 0),
  precio_venta_esperado DECIMAL(15,2),
  cantidad              INTEGER       NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  fecha_compra          DATE          NOT NULL,

  -- Venta (se llena al vender)
  fecha_venta           DATE,
  cliente_comprador     VARCHAR(255),
  precio_venta_final    DECIMAL(15,2),
  ganancia              DECIMAL(15,2)
                          GENERATED ALWAYS AS (precio_venta_final - costo_compra) STORED,
  margen_porcentaje     DECIMAL(8,4)
                          GENERATED ALWAYS AS (
                            CASE WHEN costo_compra > 0 AND precio_venta_final IS NOT NULL
                              THEN ((precio_venta_final - costo_compra) / costo_compra) * 100
                              ELSE NULL
                            END
                          ) STORED,

  -- Fotos
  fotos_paths           TEXT[],

  -- Estado
  estado                VARCHAR(20)   NOT NULL DEFAULT 'EN_INVENTARIO'
                          CHECK (estado IN ('EN_INVENTARIO', 'EN_PROCESO', 'VENDIDO', 'DESCARTADO', 'DAÑADO')),

  -- Timestamps
  fecha_creado          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  fecha_actualizado     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  notas                 TEXT
);

CREATE INDEX activos_user_id_idx    ON activos(user_id);
CREATE INDEX activos_categoria_idx  ON activos(categoria);
CREATE INDEX activos_estado_idx     ON activos(estado);
CREATE INDEX activos_fecha_compra_idx ON activos(fecha_compra);

-- -----------------------------------------------------------------------------

CREATE TABLE audit_logs (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  action                VARCHAR(50)   NOT NULL,  -- INSERT, UPDATE, DELETE, VIEW, LOGIN
  entity                VARCHAR(50)   NOT NULL,  -- clientes, prestamos, pagos, activos
  entity_id             UUID,
  details               JSONB,                   -- { cambios: {anterior, nuevo}, ip, device }

  fecha_creado          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ip_address            INET,
  user_agent            TEXT
);

CREATE INDEX audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX audit_logs_entity_idx  ON audit_logs(entity, entity_id);
CREATE INDEX audit_logs_action_idx  ON audit_logs(action);
CREATE INDEX audit_logs_fecha_idx   ON audit_logs(fecha_creado);

-- -----------------------------------------------------------------------------

CREATE TABLE sync_state (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  entity_type           VARCHAR(50)   NOT NULL,  -- clientes, prestamos, pagos, activos
  entity_id             UUID          NOT NULL,
  action                VARCHAR(20)   NOT NULL
                          CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  payload               JSONB         NOT NULL,

  synced                BOOLEAN       NOT NULL DEFAULT FALSE,
  error_message         TEXT,
  intento_numero        INTEGER       NOT NULL DEFAULT 0,

  fecha_creado          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  fecha_sincronizado    TIMESTAMPTZ
);

CREATE INDEX sync_state_user_id_idx ON sync_state(user_id);
CREATE INDEX sync_state_synced_idx  ON sync_state(synced);
CREATE INDEX sync_state_entity_idx  ON sync_state(entity_type, entity_id);


-- =============================================================================
-- SECCION 2: FUNCIONES Y TRIGGERS
-- =============================================================================

-- Trigger: actualiza fecha_actualizado automaticamente en cada UPDATE
CREATE OR REPLACE FUNCTION fn_update_fecha_actualizado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.fecha_actualizado = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clientes_fecha_actualizado
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fn_update_fecha_actualizado();

CREATE TRIGGER trg_prestamos_fecha_actualizado
  BEFORE UPDATE ON prestamos
  FOR EACH ROW EXECUTE FUNCTION fn_update_fecha_actualizado();

CREATE TRIGGER trg_cuotas_fecha_actualizado
  BEFORE UPDATE ON cuotas
  FOR EACH ROW EXECUTE FUNCTION fn_update_fecha_actualizado();

CREATE TRIGGER trg_pagos_fecha_actualizado
  BEFORE UPDATE ON pagos
  FOR EACH ROW EXECUTE FUNCTION fn_update_fecha_actualizado();

CREATE TRIGGER trg_activos_fecha_actualizado
  BEFORE UPDATE ON activos
  FOR EACH ROW EXECUTE FUNCTION fn_update_fecha_actualizado();

-- -----------------------------------------------------------------------------

-- Trigger: calcula saldo_pendiente de cuota automaticamente
CREATE OR REPLACE FUNCTION fn_calcular_saldo_cuota()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.saldo_pendiente = NEW.monto_total - NEW.monto_pagado;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cuotas_saldo
  BEFORE INSERT OR UPDATE ON cuotas
  FOR EACH ROW EXECUTE FUNCTION fn_calcular_saldo_cuota();

-- -----------------------------------------------------------------------------

-- Trigger: crea entradas de auditoria automaticamente
-- Solo para tablas con user_id: clientes, prestamos, pagos, activos
CREATE OR REPLACE FUNCTION fn_crear_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- necesario para escribir en audit_logs sin restriccion RLS
AS $$
DECLARE
  v_user_id UUID;
  v_entity_id UUID;
  v_changes JSONB;
BEGIN
  v_user_id   := COALESCE(NEW.user_id, OLD.user_id);
  v_entity_id := COALESCE(NEW.id, OLD.id);

  IF TG_OP = 'INSERT' THEN
    v_changes := jsonb_build_object('datos_nuevos', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'anterior', to_jsonb(OLD),
      'nuevo',    to_jsonb(NEW)
    );
  ELSE -- DELETE (no deberia ocurrir, usamos soft delete)
    v_changes := jsonb_build_object('datos_eliminados', to_jsonb(OLD));
  END IF;

  INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
  VALUES (v_user_id, TG_OP, TG_TABLE_NAME, v_entity_id, v_changes);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_clientes
  AFTER INSERT OR UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fn_crear_audit_log();

CREATE TRIGGER trg_audit_prestamos
  AFTER INSERT OR UPDATE ON prestamos
  FOR EACH ROW EXECUTE FUNCTION fn_crear_audit_log();

CREATE TRIGGER trg_audit_pagos
  AFTER INSERT OR UPDATE ON pagos
  FOR EACH ROW EXECUTE FUNCTION fn_crear_audit_log();

CREATE TRIGGER trg_audit_activos
  AFTER INSERT OR UPDATE ON activos
  FOR EACH ROW EXECUTE FUNCTION fn_crear_audit_log();

-- -----------------------------------------------------------------------------

-- Funcion: genera las cuotas de un prestamo automaticamente
-- SECURITY DEFINER porque la politica RLS de cuotas bloquea INSERTs directos
CREATE OR REPLACE FUNCTION crear_cuotas_prestamo(
  p_prestamo_id     UUID,
  p_monto_original  DECIMAL,
  p_tasa_interes    DECIMAL,
  p_tipo_interes    VARCHAR,
  p_fecha_inicio    DATE,
  p_fecha_fin       DATE,
  p_frecuencia_pago VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_intervalo       INTERVAL;
  v_fecha_cuota     DATE;
  v_numero_cuota    INTEGER := 1;
  v_monto_cuota     DECIMAL;
  v_interes_cuota   DECIMAL;
  v_n_cuotas        INTEGER;
  v_tasa_por_cuota  DECIMAL;
BEGIN
  -- Determinar intervalo segun frecuencia
  IF p_frecuencia_pago = 'DIARIA' THEN
    v_intervalo := INTERVAL '1 day';
  ELSIF p_frecuencia_pago = 'SEMANAL' THEN
    v_intervalo := INTERVAL '7 days';
  ELSIF p_frecuencia_pago = 'QUINCENAL' THEN
    v_intervalo := INTERVAL '15 days';
  ELSIF p_frecuencia_pago = 'MENSUAL' THEN
    v_intervalo := INTERVAL '1 month';
  ELSE
    RAISE EXCEPTION 'Frecuencia no valida: %', p_frecuencia_pago;
  END IF;

  -- Contar cuotas aproximadas para dividir el monto
  v_n_cuotas := 0;
  v_fecha_cuota := p_fecha_inicio + v_intervalo;
  WHILE v_fecha_cuota <= p_fecha_fin LOOP
    v_n_cuotas := v_n_cuotas + 1;
    v_fecha_cuota := v_fecha_cuota + v_intervalo;
  END LOOP;

  IF v_n_cuotas = 0 THEN
    RAISE EXCEPTION 'No se pueden generar cuotas: rango de fechas demasiado corto';
  END IF;

  -- Tasa por cuota segun frecuencia (tasa_interes es mensual)
  IF p_frecuencia_pago = 'DIARIA' THEN
    v_tasa_por_cuota := p_tasa_interes / 30;
  ELSIF p_frecuencia_pago = 'SEMANAL' THEN
    v_tasa_por_cuota := p_tasa_interes / 4.33;
  ELSIF p_frecuencia_pago = 'QUINCENAL' THEN
    v_tasa_por_cuota := p_tasa_interes / 2;
  ELSE -- MENSUAL
    v_tasa_por_cuota := p_tasa_interes;
  END IF;
  v_tasa_por_cuota := v_tasa_por_cuota / 100;

  -- Generar cuotas
  v_fecha_cuota := p_fecha_inicio + v_intervalo;

  WHILE v_fecha_cuota <= p_fecha_fin LOOP

    -- Calculo segun tipo de interes
    CASE p_tipo_interes
      WHEN 'SIMPLE' THEN
        -- Interes fijo sobre el capital original
        v_interes_cuota := p_monto_original * v_tasa_por_cuota;
        v_monto_cuota   := (p_monto_original / v_n_cuotas) + v_interes_cuota;

      WHEN 'COMPUESTO' THEN
        -- Formula de anualidad: cuota = P * [r(1+r)^n] / [(1+r)^n - 1]
        v_monto_cuota := p_monto_original
          * (v_tasa_por_cuota * POWER(1 + v_tasa_por_cuota, v_n_cuotas))
          / (POWER(1 + v_tasa_por_cuota, v_n_cuotas) - 1);
        v_interes_cuota := v_monto_cuota - (p_monto_original / v_n_cuotas);

      WHEN 'MIXTO' THEN
        -- Interes simple sobre saldo insoluto restante
        v_interes_cuota := (p_monto_original - (p_monto_original / v_n_cuotas * (v_numero_cuota - 1)))
          * v_tasa_por_cuota;
        v_monto_cuota   := (p_monto_original / v_n_cuotas) + v_interes_cuota;

      ELSE
        RAISE EXCEPTION 'Tipo de interes no valido: %', p_tipo_interes;
    END CASE;

    INSERT INTO cuotas (
      prestamo_id,
      numero_cuota,
      fecha_vencimiento,
      monto_original,
      interes_aplicable,
      monto_total
    ) VALUES (
      p_prestamo_id,
      v_numero_cuota,
      v_fecha_cuota,
      ROUND(p_monto_original / v_n_cuotas, 2),
      ROUND(v_interes_cuota, 2),
      ROUND(v_monto_cuota, 2)
    );

    v_fecha_cuota  := v_fecha_cuota + v_intervalo;
    v_numero_cuota := v_numero_cuota + 1;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------

-- Funcion: recalcula monto_pagado y saldo_pendiente del prestamo
-- Llamar desde el adapter despues de cada pago registrado
CREATE OR REPLACE FUNCTION recalcular_prestamo_totales(p_prestamo_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_monto_pagado    DECIMAL;
  v_total           DECIMAL;
BEGIN
  -- Suma de todos los pagos confirmados asociados a cuotas de este prestamo
  SELECT COALESCE(SUM(pg.monto), 0)
  INTO v_monto_pagado
  FROM pagos pg
  JOIN cuotas cu ON pg.cuota_id = cu.id
  WHERE cu.prestamo_id = p_prestamo_id
    AND pg.estado = 'CONFIRMADO';

  SELECT total_con_interes
  INTO v_total
  FROM prestamos
  WHERE id = p_prestamo_id;

  UPDATE prestamos
  SET
    monto_pagado    = v_monto_pagado,
    saldo_pendiente = GREATEST(v_total - v_monto_pagado, 0),
    estado = CASE
      WHEN v_monto_pagado >= v_total THEN 'COMPLETADO'
      ELSE estado
    END,
    fecha_completado = CASE
      WHEN v_monto_pagado >= v_total AND fecha_completado IS NULL THEN NOW()
      ELSE fecha_completado
    END
  WHERE id = p_prestamo_id;
END;
$$;

-- -----------------------------------------------------------------------------

-- Funcion: buscar clientes por nombre, cedula o telefono
CREATE OR REPLACE FUNCTION buscar_clientes(
  p_user_id UUID,
  p_termino  VARCHAR
)
RETURNS TABLE (
  id           UUID,
  nombre       VARCHAR,
  cedula       VARCHAR,
  telefono     VARCHAR,
  email        VARCHAR,
  nivel_riesgo VARCHAR,
  estado       VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.nombre, c.cedula, c.telefono, c.email, c.nivel_riesgo, c.estado
  FROM clientes c
  WHERE c.user_id = p_user_id
    AND c.archivado = FALSE
    AND (
      c.nombre   ILIKE '%' || p_termino || '%'
      OR c.telefono ILIKE '%' || p_termino || '%'
      -- cedula esta cifrada, no se puede buscar por ILIKE directamente
      -- la busqueda por cedula se hace en el cliente tras descifrar
    );
END;
$$;

-- -----------------------------------------------------------------------------

-- Funcion: obtener cuotas para una fecha (cobros del dia)
CREATE OR REPLACE FUNCTION obtener_cuotas_para_fecha(
  p_user_id UUID,
  p_fecha   DATE
)
RETURNS TABLE (
  cuota_id        UUID,
  prestamo_id     UUID,
  cliente_nombre  VARCHAR,
  numero_cuota    INTEGER,
  fecha_vencimiento DATE,
  monto_total     DECIMAL,
  saldo_pendiente DECIMAL,
  estado          VARCHAR,
  dias_atraso     INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cu.id,
    cu.prestamo_id,
    cl.nombre,
    cu.numero_cuota,
    cu.fecha_vencimiento,
    cu.monto_total,
    cu.saldo_pendiente,
    cu.estado,
    (p_fecha - cu.fecha_vencimiento)::INTEGER AS dias_atraso
  FROM cuotas cu
  JOIN prestamos pr ON cu.prestamo_id = pr.id
  JOIN clientes  cl ON pr.cliente_id  = cl.id
  WHERE pr.user_id = p_user_id
    AND cu.estado IN ('PENDIENTE', 'VENCIDA', 'PARCIALMENTE_PAGADA')
    AND cu.fecha_vencimiento <= p_fecha
  ORDER BY cu.fecha_vencimiento ASC, cl.nombre ASC;
END;
$$;


-- =============================================================================
-- SECCION 3: ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE clientes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE activos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state  ENABLE ROW LEVEL SECURITY;

-- --- CLIENTES ----------------------------------------------------------------

CREATE POLICY clientes_select ON clientes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY clientes_insert ON clientes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY clientes_update ON clientes
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Hard delete deshabilitado: usar UPDATE SET archivado = TRUE
CREATE POLICY clientes_delete_disabled ON clientes
  FOR DELETE USING (FALSE);

-- --- PRESTAMOS ---------------------------------------------------------------

CREATE POLICY prestamos_select ON prestamos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY prestamos_insert ON prestamos
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND cliente_id IN (
      SELECT id FROM clientes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY prestamos_update ON prestamos
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY prestamos_delete_disabled ON prestamos
  FOR DELETE USING (FALSE);

-- --- CUOTAS ------------------------------------------------------------------
-- Las cuotas se crean SOLO via crear_cuotas_prestamo() (SECURITY DEFINER)
-- Los usuarios pueden leer y actualizar sus cuotas, pero no insertar directamente

CREATE POLICY cuotas_select ON cuotas
  FOR SELECT USING (
    prestamo_id IN (
      SELECT id FROM prestamos WHERE user_id = auth.uid()
    )
  );

CREATE POLICY cuotas_insert_bloqueado ON cuotas
  FOR INSERT WITH CHECK (FALSE);  -- Solo via funcion SECURITY DEFINER

CREATE POLICY cuotas_update ON cuotas
  FOR UPDATE USING (
    prestamo_id IN (
      SELECT id FROM prestamos WHERE user_id = auth.uid()
    )
  );

CREATE POLICY cuotas_delete_disabled ON cuotas
  FOR DELETE USING (FALSE);

-- --- PAGOS -------------------------------------------------------------------

CREATE POLICY pagos_select ON pagos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY pagos_insert ON pagos
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND cuota_id IN (
      SELECT cu.id FROM cuotas cu
      JOIN prestamos pr ON cu.prestamo_id = pr.id
      WHERE pr.user_id = auth.uid()
    )
  );

CREATE POLICY pagos_update ON pagos
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Pagos no se eliminan (soft: cambiar estado a RECHAZADO)
CREATE POLICY pagos_delete_disabled ON pagos
  FOR DELETE USING (FALSE);

-- --- ACTIVOS -----------------------------------------------------------------

CREATE POLICY activos_select ON activos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY activos_insert ON activos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY activos_update ON activos
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY activos_delete_disabled ON activos
  FOR DELETE USING (FALSE);

-- --- AUDIT_LOGS --------------------------------------------------------------

CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT via trigger SECURITY DEFINER (fn_crear_audit_log)
-- No se necesita politica INSERT para usuarios directos
CREATE POLICY audit_logs_insert_bloqueado ON audit_logs
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY audit_logs_update_disabled ON audit_logs
  FOR UPDATE USING (FALSE);

CREATE POLICY audit_logs_delete_disabled ON audit_logs
  FOR DELETE USING (FALSE);

-- --- SYNC_STATE --------------------------------------------------------------

CREATE POLICY sync_state_select ON sync_state
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY sync_state_insert ON sync_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY sync_state_update ON sync_state
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- sync_state SI permite DELETE (limpiar despues de sincronizar)
CREATE POLICY sync_state_delete ON sync_state
  FOR DELETE USING (auth.uid() = user_id);


-- =============================================================================
-- SECCION 4: VIEWS
-- =============================================================================

-- Vista: resumen de deudas por cliente (hereda RLS de tablas base)
CREATE VIEW vw_deudas_por_cliente AS
SELECT
  cl.id                                                       AS cliente_id,
  cl.user_id,
  cl.nombre,
  cl.email,
  cl.nivel_riesgo,
  COUNT(pr.id)                                                AS num_prestamos,
  COUNT(pr.id) FILTER (WHERE pr.estado = 'ACTIVO')           AS prestamos_activos,
  COALESCE(SUM(pr.saldo_pendiente) FILTER (WHERE pr.estado = 'ACTIVO'), 0) AS saldo_total_pendiente,
  MIN(cu.fecha_vencimiento) FILTER (
    WHERE cu.estado IN ('PENDIENTE', 'PARCIALMENTE_PAGADA', 'VENCIDA')
  )                                                           AS proxima_cuota
FROM clientes cl
LEFT JOIN prestamos pr ON cl.id = pr.cliente_id
LEFT JOIN cuotas    cu ON pr.id = cu.prestamo_id
WHERE cl.archivado = FALSE
GROUP BY cl.id, cl.user_id, cl.nombre, cl.email, cl.nivel_riesgo;

-- Vista: cuotas vencidas con info de contacto
CREATE VIEW vw_cuotas_vencidas AS
SELECT
  cu.id                                                AS cuota_id,
  cu.prestamo_id,
  cl.id                                                AS cliente_id,
  cl.nombre                                            AS cliente_nombre,
  cl.telefono                                          AS cliente_telefono,
  cu.numero_cuota,
  cu.fecha_vencimiento,
  cu.monto_total,
  cu.monto_pagado,
  cu.saldo_pendiente,
  (CURRENT_DATE - cu.fecha_vencimiento)::INTEGER       AS dias_atraso
FROM cuotas cu
JOIN prestamos pr ON cu.prestamo_id = pr.id
JOIN clientes  cl ON pr.cliente_id  = cl.id
WHERE cu.estado IN ('PENDIENTE', 'PARCIALMENTE_PAGADA', 'VENCIDA')
  AND cu.fecha_vencimiento < CURRENT_DATE
  AND pr.estado = 'ACTIVO';

-- Vista: rentabilidad acumulada por usuario
CREATE VIEW vw_rentabilidad AS
SELECT
  COALESCE(sub.user_id, act.user_id)        AS user_id,
  COALESCE(sub.interes_prestamos, 0)         AS interes_ganado_prestamos,
  COALESCE(act.ganancia_activos, 0)          AS ganancia_activos,
  COALESCE(sub.interes_prestamos, 0)
    + COALESCE(act.ganancia_activos, 0)      AS rentabilidad_total
FROM (
  SELECT
    user_id,
    SUM(total_con_interes - monto_original) AS interes_prestamos
  FROM prestamos
  WHERE total_con_interes IS NOT NULL
  GROUP BY user_id
) sub
FULL OUTER JOIN (
  SELECT
    user_id,
    SUM(ganancia) AS ganancia_activos
  FROM activos
  WHERE estado = 'VENDIDO' AND ganancia IS NOT NULL
  GROUP BY user_id
) act ON sub.user_id = act.user_id;


-- =============================================================================
-- SECCION 5: STORAGE - Ejecutar en SQL Editor tras crear el bucket 'fotos'
-- =============================================================================
-- PASOS MANUALES (hacer en Supabase Dashboard -> Storage):
--   1. Crear bucket llamado exactamente: fotos
--   2. Visibilidad: PRIVATE
--   3. Tamano maximo por archivo: 5 MB
--   4. Tipos MIME permitidos: image/jpeg, image/png, application/pdf
-- Luego ejecutar las politicas de abajo:

-- Estructura de rutas en el bucket:
--   {user_id}/clientes/{cliente_id}/cedula_frente.jpg
--   {user_id}/clientes/{cliente_id}/cedula_reverso.jpg
--   {user_id}/clientes/{cliente_id}/foto_rostro.jpg
--   {user_id}/comprobantes/{pago_id}/comprobante.jpg
--   {user_id}/activos/{activo_id}/foto_1.jpg

CREATE POLICY fotos_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY fotos_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY fotos_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY fotos_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- =============================================================================
-- SECCION 6: DATOS INICIALES (solo para testing local)
-- =============================================================================
-- Los usuarios se crean via supabaseAuth.register() en el frontend.
-- Descomentar para insertar datos de prueba SOLO en entorno de desarrollo.

/*
-- Requiere haber creado un usuario via Auth primero.
-- Sustituir 'TU_USER_ID_AQUI' con el UUID real del usuario creado.

DO $$
DECLARE
  v_user_id UUID := 'TU_USER_ID_AQUI';
  v_cliente_id UUID;
  v_prestamo_id UUID;
BEGIN
  -- Cliente de prueba
  INSERT INTO clientes (user_id, nombre, cedula, telefono, nivel_riesgo)
  VALUES (v_user_id, 'Juan Perez (TEST)', 'CIFRADO_TEST', '809-555-0001', 'BAJO')
  RETURNING id INTO v_cliente_id;

  -- Prestamo de prueba (10000 a 10% mensual, 3 meses)
  INSERT INTO prestamos (
    user_id, cliente_id, monto_original, tasa_interes, tipo_interes,
    frecuencia_pago, fecha_inicio, fecha_fin, total_con_interes, saldo_pendiente
  ) VALUES (
    v_user_id, v_cliente_id, 10000, 10, 'SIMPLE',
    'MENSUAL', CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months',
    13000, 13000
  ) RETURNING id INTO v_prestamo_id;

  -- Generar cuotas del prestamo
  PERFORM crear_cuotas_prestamo(
    v_prestamo_id, 10000, 10, 'SIMPLE',
    CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months', 'MENSUAL'
  );

  RAISE NOTICE 'Datos de prueba creados. Cliente: %, Prestamo: %', v_cliente_id, v_prestamo_id;
END;
$$;
*/


-- =============================================================================
-- SECCION 7: VERIFICACION (ejecutar al final para confirmar todo OK)
-- =============================================================================

-- 1. Verificar tablas y RLS habilitado
SELECT
  tablename,
  rowsecurity AS rls_habilitado
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- Resultado esperado: 7 tablas, rowsecurity = true en todas

-- 2. Contar politicas por tabla
SELECT
  tablename,
  COUNT(*) AS num_politicas
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
-- Resultado esperado: 4 politicas por tabla (SELECT, INSERT, UPDATE, DELETE)

-- 3. Verificar triggers
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 4. Verificar funciones creadas
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
-- Debe incluir: crear_cuotas_prestamo, recalcular_prestamo_totales,
--               buscar_clientes, obtener_cuotas_para_fecha,
--               fn_update_fecha_actualizado, fn_calcular_saldo_cuota,
--               fn_crear_audit_log

-- 5. Verificar indices
SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 6. Test rapido de RLS: debe retornar 0 filas si no hay sesion activa
SELECT COUNT(*) AS debe_ser_cero FROM clientes;
SELECT COUNT(*) AS debe_ser_cero FROM prestamos;
