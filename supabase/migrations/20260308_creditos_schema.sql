-- ============================================================
-- MIGRACIÓN: Módulo de Créditos (lado pasivo del prestamista)
-- Fecha: 2026-03-08
-- Descripción: El prestamista recibe dinero de "acreedores"
--              (prestamistas mayores). Este módulo registra
--              esos créditos recibidos, sus cuotas a pagar
--              y los pagos realizados.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TABLA: acreedores
--    Personas que le prestan dinero al prestamista (usuario)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.acreedores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Datos del acreedor
  nombre      TEXT NOT NULL CHECK (char_length(nombre) >= 2),
  telefono    TEXT,
  email       TEXT,
  direccion   TEXT,
  notas       TEXT,

  -- Auditoría
  fecha_creado    TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_modificado TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_acreedores_user_id ON public.acreedores(user_id);
CREATE INDEX IF NOT EXISTS idx_acreedores_nombre  ON public.acreedores(nombre);

-- RLS
ALTER TABLE public.acreedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acreedores_select_own" ON public.acreedores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "acreedores_insert_own" ON public.acreedores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "acreedores_update_own" ON public.acreedores
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "acreedores_delete_own" ON public.acreedores
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger: actualizar fecha_modificado
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.fecha_modificado = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acreedores_updated_at ON public.acreedores;
CREATE TRIGGER trg_acreedores_updated_at
  BEFORE UPDATE ON public.acreedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 2. TABLA: creditos
--    Préstamos RECIBIDOS por el prestamista de sus acreedores
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creditos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acreedor_id     UUID NOT NULL REFERENCES public.acreedores(id) ON DELETE RESTRICT,

  -- Términos financieros
  monto_original      NUMERIC(15,2) NOT NULL CHECK (monto_original > 0),
  tasa_interes        NUMERIC(8,4)  NOT NULL DEFAULT 0 CHECK (tasa_interes >= 0),
  tipo_amortizacion   TEXT NOT NULL CHECK (tipo_amortizacion IN (
                        'CUOTA_FIJA', 'DISMINUIR_CUOTA', 'INTERES_FIJO', 'CAPITAL_AL_FINAL'
                      )),
  frecuencia_pago     TEXT NOT NULL CHECK (frecuencia_pago IN (
                        'DIARIO', 'INTERDIARIO', 'SEMANAL', 'BISEMANAL',
                        'QUINCENAL', '15_Y_FIN_MES', 'MENSUAL', 'ANUAL'
                      )),
  num_cuotas          INTEGER,           -- nulo = calculado al generar cuotas

  -- Fechas
  fecha_inicio        DATE NOT NULL,
  fecha_primer_pago   DATE NOT NULL,

  -- Estado y seguimiento
  estado              TEXT NOT NULL DEFAULT 'ACTIVO'
                        CHECK (estado IN ('ACTIVO', 'COMPLETADO', 'ARCHIVADO')),
  monto_pagado        NUMERIC(15,2) NOT NULL DEFAULT 0,
  saldo_pendiente     NUMERIC(15,2) GENERATED ALWAYS AS (monto_original - monto_pagado) STORED,

  -- Extras
  notas               TEXT,

  -- Auditoría
  fecha_creado        TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_modificado    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_creditos_user_id     ON public.creditos(user_id);
CREATE INDEX IF NOT EXISTS idx_creditos_acreedor_id ON public.creditos(acreedor_id);
CREATE INDEX IF NOT EXISTS idx_creditos_estado       ON public.creditos(estado);
CREATE INDEX IF NOT EXISTS idx_creditos_fecha_inicio ON public.creditos(fecha_inicio DESC);

-- RLS
ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creditos_select_own" ON public.creditos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "creditos_insert_own" ON public.creditos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "creditos_update_own" ON public.creditos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "creditos_delete_own" ON public.creditos
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_creditos_updated_at ON public.creditos;
CREATE TRIGGER trg_creditos_updated_at
  BEFORE UPDATE ON public.creditos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 3. TABLA: cuotas_credito
--    Calendario de pagos que el prestamista debe hacer
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cuotas_credito (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_id        UUID NOT NULL REFERENCES public.creditos(id) ON DELETE CASCADE,

  numero_cuota      INTEGER NOT NULL,
  fecha_vencimiento DATE    NOT NULL,

  -- Descomposición de la cuota
  monto_principal   NUMERIC(15,2) NOT NULL DEFAULT 0,
  monto_interes     NUMERIC(15,2) NOT NULL DEFAULT 0,
  monto_total       NUMERIC(15,2) NOT NULL,
  saldo_restante    NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Estado
  estado            TEXT NOT NULL DEFAULT 'PENDIENTE'
                      CHECK (estado IN ('PENDIENTE', 'PAGADA', 'VENCIDA', 'PARCIAL')),
  monto_pagado      NUMERIC(15,2) DEFAULT 0,
  fecha_pago_real   DATE,

  -- Auditoría
  fecha_creado      TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_modificado  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (credito_id, numero_cuota)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cuotas_credito_credito_id   ON public.cuotas_credito(credito_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_credito_vencimiento  ON public.cuotas_credito(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cuotas_credito_estado       ON public.cuotas_credito(estado);

-- RLS (heredar seguridad a través del credito_id)
ALTER TABLE public.cuotas_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cuotas_credito_select_own" ON public.cuotas_credito
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.creditos c
      WHERE c.id = credito_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "cuotas_credito_insert_own" ON public.cuotas_credito
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.creditos c
      WHERE c.id = credito_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "cuotas_credito_update_own" ON public.cuotas_credito
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.creditos c
      WHERE c.id = credito_id AND c.user_id = auth.uid()
    )
  );

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_cuotas_credito_updated_at ON public.cuotas_credito;
CREATE TRIGGER trg_cuotas_credito_updated_at
  BEFORE UPDATE ON public.cuotas_credito
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 4. TABLA: pagos_credito
--    Pagos realizados por el prestamista a su acreedor
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pagos_credito (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credito_id        UUID NOT NULL REFERENCES public.creditos(id) ON DELETE RESTRICT,
  cuota_credito_id  UUID REFERENCES public.cuotas_credito(id), -- puede ser nulo si es pago libre

  -- Monto
  monto             NUMERIC(15,2) NOT NULL CHECK (monto > 0),

  -- Fechas
  fecha_pago        DATE NOT NULL,
  fecha_registro    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Método
  metodo_pago       TEXT NOT NULL DEFAULT 'EFECTIVO'
                      CHECK (metodo_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'OTRO')),
  referencia        TEXT,
  notas             TEXT,

  -- Auditoría
  fecha_creado      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pagos_credito_user_id    ON public.pagos_credito(user_id);
CREATE INDEX IF NOT EXISTS idx_pagos_credito_credito_id ON public.pagos_credito(credito_id);
CREATE INDEX IF NOT EXISTS idx_pagos_credito_fecha_pago ON public.pagos_credito(fecha_pago DESC);

-- RLS
ALTER TABLE public.pagos_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagos_credito_select_own" ON public.pagos_credito
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "pagos_credito_insert_own" ON public.pagos_credito
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pagos_credito_update_own" ON public.pagos_credito
  FOR UPDATE USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 5. FUNCIÓN RPC: crear_cuotas_credito
--    Genera las cuotas de un crédito recién creado.
--    Llamada desde el adapter JS tras insertar el crédito.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crear_cuotas_credito(
  p_credito_id        UUID,
  p_monto_original    NUMERIC,
  p_tasa_interes      NUMERIC,
  p_tipo_amortizacion TEXT,
  p_frecuencia_pago   TEXT,
  p_fecha_inicio      DATE,
  p_fecha_primer_pago DATE,
  p_num_cuotas        INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo         NUMERIC := p_monto_original;
  v_tasa          NUMERIC := p_tasa_interes / 100.0;
  v_n             INTEGER;
  v_pmt           NUMERIC;
  v_principal     NUMERIC;
  v_interes       NUMERIC;
  v_cuota_total   NUMERIC;
  v_fecha         DATE    := p_fecha_primer_pago;
  i               INTEGER;

  -- Calcular intervalo de días según frecuencia
  v_dias_intervalo INTEGER := CASE p_frecuencia_pago
    WHEN 'DIARIO'       THEN 1
    WHEN 'INTERDIARIO'  THEN 2
    WHEN 'SEMANAL'      THEN 7
    WHEN 'BISEMANAL'    THEN 14
    WHEN 'QUINCENAL'    THEN 15
    ELSE 30 -- MENSUAL, ANUAL se manejarán con funciones de fecha nativas
  END;
BEGIN
  -- Determinar número de cuotas
  IF p_num_cuotas IS NOT NULL THEN
    v_n := p_num_cuotas;
  ELSE
    -- Estimar número de cuotas según frecuencia
    v_n := CASE p_frecuencia_pago
      WHEN 'DIARIO'       THEN (p_fecha_primer_pago - p_fecha_inicio)
      WHEN 'INTERDIARIO'  THEN (p_fecha_primer_pago - p_fecha_inicio) / 2
      WHEN 'SEMANAL'      THEN (p_fecha_primer_pago - p_fecha_inicio) / 7
      WHEN 'BISEMANAL'    THEN (p_fecha_primer_pago - p_fecha_inicio) / 14
      WHEN 'QUINCENAL'    THEN (p_fecha_primer_pago - p_fecha_inicio) / 15
      WHEN '15_Y_FIN_MES' THEN (p_fecha_primer_pago - p_fecha_inicio) / 15
      WHEN 'MENSUAL'      THEN EXTRACT(YEAR FROM age(p_fecha_primer_pago, p_fecha_inicio))::INTEGER * 12
                             + EXTRACT(MONTH FROM age(p_fecha_primer_pago, p_fecha_inicio))::INTEGER
      WHEN 'ANUAL'        THEN EXTRACT(YEAR FROM age(p_fecha_primer_pago, p_fecha_inicio))::INTEGER
      ELSE 12
    END;
    v_n := GREATEST(v_n, 1);
  END IF;

  -- Calcular cuota fija PMT (solo para CUOTA_FIJA)
  IF p_tipo_amortizacion = 'CUOTA_FIJA' AND v_tasa > 0 THEN
    v_pmt := p_monto_original * (v_tasa * POWER(1 + v_tasa, v_n)) / (POWER(1 + v_tasa, v_n) - 1);
  ELSIF p_tipo_amortizacion = 'CUOTA_FIJA' THEN
    v_pmt := p_monto_original / v_n;
  END IF;

  FOR i IN 1..v_n LOOP

    -- Calcular principal e interés según tipo de amortización
    CASE p_tipo_amortizacion
      WHEN 'CUOTA_FIJA' THEN
        v_interes     := v_saldo * v_tasa;
        v_principal   := LEAST(v_pmt - v_interes, v_saldo);
        v_cuota_total := v_interes + v_principal;

      WHEN 'DISMINUIR_CUOTA' THEN
        v_principal   := p_monto_original / v_n;
        v_interes     := v_saldo * v_tasa;
        v_cuota_total := v_principal + v_interes;

      WHEN 'INTERES_FIJO' THEN
        v_interes     := p_monto_original * v_tasa;
        v_principal   := CASE WHEN i = v_n THEN v_saldo ELSE 0 END;
        v_cuota_total := v_interes + v_principal;

      WHEN 'CAPITAL_AL_FINAL' THEN
        v_interes     := p_monto_original * v_tasa;
        v_principal   := CASE WHEN i = v_n THEN v_saldo ELSE 0 END;
        v_cuota_total := v_interes + v_principal;

      ELSE
        RAISE EXCEPTION 'Tipo de amortización no soportado: %', p_tipo_amortizacion;
    END CASE;

    v_saldo := GREATEST(0, v_saldo - v_principal);

    INSERT INTO public.cuotas_credito (
      credito_id,
      numero_cuota,
      fecha_vencimiento,
      monto_principal,
      monto_interes,
      monto_total,
      saldo_restante,
      estado
    ) VALUES (
      p_credito_id,
      i,
      v_fecha,
      ROUND(GREATEST(0, v_principal), 2),
      ROUND(GREATEST(0, v_interes), 2),
      ROUND(GREATEST(0, v_cuota_total), 2),
      ROUND(GREATEST(0, v_saldo), 2),
      'PENDIENTE'
    );

    -- Avanzar fecha según frecuencia
    v_fecha := CASE p_frecuencia_pago
      WHEN 'MENSUAL'       THEN v_fecha + INTERVAL '1 month'
      WHEN 'ANUAL'         THEN v_fecha + INTERVAL '1 year'
      WHEN '15_Y_FIN_MES'  THEN
        CASE
          WHEN EXTRACT(DAY FROM v_fecha) < 15 THEN
            DATE_TRUNC('month', v_fecha) + INTERVAL '14 days'
          ELSE
            (DATE_TRUNC('month', v_fecha) + INTERVAL '1 month' + INTERVAL '1 month - 1 day')::DATE
        END
      ELSE
        v_fecha + (v_dias_intervalo || ' days')::INTERVAL
    END;

  END LOOP;

END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 6. TRIGGER: actualizar monto_pagado y estado en creditos
--    Se ejecuta cuando se registra un pago_credito
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_sync_monto_pagado_credito()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total_pagado NUMERIC;
  v_monto_original NUMERIC;
BEGIN
  -- Sumar todos los pagos del crédito
  SELECT COALESCE(SUM(monto), 0)
    INTO v_total_pagado
    FROM public.pagos_credito
   WHERE credito_id = NEW.credito_id;

  -- Obtener monto original
  SELECT monto_original
    INTO v_monto_original
    FROM public.creditos
   WHERE id = NEW.credito_id;

  -- Actualizar crédito
  UPDATE public.creditos
     SET monto_pagado = v_total_pagado,
         estado = CASE
           WHEN v_total_pagado >= v_monto_original THEN 'COMPLETADO'
           ELSE estado
         END,
         fecha_modificado = now()
   WHERE id = NEW.credito_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pagos_credito_sync ON public.pagos_credito;
CREATE TRIGGER trg_pagos_credito_sync
  AFTER INSERT OR UPDATE ON public.pagos_credito
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_monto_pagado_credito();


-- ─────────────────────────────────────────────────────────────
-- 7. TRIGGER: marcar cuotas vencidas automáticamente
--    (Se puede ejecutar periódicamente o al hacer SELECT)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marcar_cuotas_credito_vencidas()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.cuotas_credito
     SET estado           = 'VENCIDA',
         fecha_modificado = now()
   WHERE estado           = 'PENDIENTE'
     AND fecha_vencimiento < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. VISTA: resumen_creditos_por_usuario
--    Útil para el dashboard de créditos
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_resumen_creditos AS
SELECT
  c.user_id,
  COUNT(*)                                           AS total_creditos,
  COUNT(*) FILTER (WHERE c.estado = 'ACTIVO')        AS creditos_activos,
  COALESCE(SUM(c.monto_original), 0)                 AS total_recibido,
  COALESCE(SUM(c.monto_pagado), 0)                   AS total_pagado,
  COALESCE(SUM(c.saldo_pendiente), 0)                AS deuda_pendiente,
  COUNT(cc.id) FILTER (
    WHERE cc.estado = 'VENCIDA'
  )                                                  AS cuotas_vencidas,
  MIN(cc.fecha_vencimiento) FILTER (
    WHERE cc.estado = 'PENDIENTE'
  )                                                  AS proxima_cuota
FROM public.creditos c
LEFT JOIN public.cuotas_credito cc ON cc.credito_id = c.id
GROUP BY c.user_id;

-- RLS no aplica a vistas directas; se filtra en la aplicación por user_id


-- ─────────────────────────────────────────────────────────────
-- FIN DE LA MIGRACIÓN
-- Para ejecutar: pegar este script en el SQL Editor de Supabase
-- ─────────────────────────────────────────────────────────────
