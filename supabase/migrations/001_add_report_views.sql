-- ============================================================
-- MIGRACIÓN 001: Vistas y funciones para el módulo de Reportes
-- Fecha: 2026-03-09
-- Ejecutar en: Supabase SQL Editor
-- ============================================================
--
-- INSTRUCCIONES:
--   1. Abrir Supabase Dashboard → SQL Editor
--   2. Copiar y pegar este archivo completo
--   3. Ejecutar
--   4. Verificar con las queries al final de este archivo
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- VISTA 1: vw_resumen_cartera
-- Resumen de cartera completa por usuario.
-- Incluye conteos y sumas de préstamos y cuotas.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_resumen_cartera AS
SELECT
  p.user_id,

  -- Conteo de préstamos por estado
  COUNT(p.id)                                             AS total_prestamos,
  COUNT(p.id) FILTER (WHERE p.estado = 'ACTIVO')         AS prestamos_activos,
  COUNT(p.id) FILTER (WHERE p.estado = 'COMPLETADO')     AS prestamos_completados,
  COUNT(p.id) FILTER (WHERE p.estado = 'ARCHIVADO')      AS prestamos_archivados,

  -- Montos
  COALESCE(SUM(p.monto_original), 0)                     AS total_prestado,
  COALESCE(SUM(p.monto_pagado), 0)                       AS total_cobrado,
  COALESCE(SUM(p.saldo_pendiente), 0)                    AS total_saldo_pendiente,
  COALESCE(SUM(p.total_con_interes - p.monto_original), 0) AS total_interes_generado,
  COALESCE(SUM(p.interes_pendiente), 0)                  AS total_interes_pendiente,

  -- Cuotas resumen (join a cuotas)
  COUNT(c.id)                                            AS total_cuotas,
  COUNT(c.id) FILTER (WHERE c.estado = 'PENDIENTE')     AS cuotas_pendientes,
  COUNT(c.id) FILTER (WHERE c.estado = 'PAGADA')        AS cuotas_pagadas,
  COUNT(c.id) FILTER (WHERE c.estado = 'VENCIDA')       AS cuotas_vencidas,

  -- Monto en mora (cuotas vencidas)
  COALESCE(SUM(c.saldo_pendiente) FILTER (WHERE c.estado = 'VENCIDA'), 0) AS monto_en_mora,

  -- Cuota más próxima a vencer (de préstamos activos)
  MIN(c.fecha_vencimiento) FILTER (
    WHERE c.estado = 'PENDIENTE' AND p.estado = 'ACTIVO'
  )                                                      AS proxima_cuota_vencimiento

FROM prestamos p
LEFT JOIN cuotas c ON c.prestamo_id = p.id
GROUP BY p.user_id;

-- RLS a nivel de vista: el usuario solo ve sus datos
-- (ya filtrado por user_id en la query del adapter via .eq('user_id', user.id))


-- ────────────────────────────────────────────────────────────
-- VISTA 2: vw_cobros_por_metodo
-- Cobros agrupados por método de pago.
-- Útil para el reporte "Cobros del Período".
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_cobros_por_metodo AS
SELECT
  pg.user_id,
  pg.metodo_pago,
  DATE_TRUNC('day', pg.fecha_pago::TIMESTAMP)           AS fecha,
  COUNT(pg.id)                                          AS cantidad_pagos,
  COALESCE(SUM(pg.monto), 0)                            AS total_cobrado
FROM pagos pg
WHERE pg.estado = 'CONFIRMADO'
GROUP BY pg.user_id, pg.metodo_pago, DATE_TRUNC('day', pg.fecha_pago::TIMESTAMP);


-- ────────────────────────────────────────────────────────────
-- VISTA 3: vw_morosidad_detalle
-- Cuotas vencidas con contexto de cliente y préstamo.
-- Extiende la vista existente vw_cuotas_vencidas.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_morosidad_detalle AS
SELECT
  c.id                                                   AS cuota_id,
  c.prestamo_id,
  c.numero_cuota,
  c.fecha_vencimiento,
  c.monto_total,
  c.saldo_pendiente,
  CURRENT_DATE - c.fecha_vencimiento                     AS dias_atraso,

  -- Segmentación de mora
  CASE
    WHEN CURRENT_DATE - c.fecha_vencimiento <= 7   THEN '1-7 días'
    WHEN CURRENT_DATE - c.fecha_vencimiento <= 30  THEN '8-30 días'
    WHEN CURRENT_DATE - c.fecha_vencimiento <= 90  THEN '31-90 días'
    ELSE 'Más de 90 días'
  END                                                    AS segmento_mora,

  -- Datos del cliente
  cl.nombre                                              AS cliente_nombre,
  cl.telefono                                            AS cliente_telefono,
  cl.nivel_riesgo,

  -- Datos del préstamo
  p.user_id,
  p.tasa_interes,
  p.frecuencia_pago,

  -- Estado de cobranza (si existe)
  co.status                                              AS cobranza_status

FROM cuotas c
JOIN prestamos p ON p.id = c.prestamo_id
JOIN clientes cl ON cl.id = p.cliente_id
LEFT JOIN cobranzas co ON co.payment_id = c.id
WHERE c.estado = 'VENCIDA'
  AND c.fecha_vencimiento < CURRENT_DATE;


-- ────────────────────────────────────────────────────────────
-- FUNCIÓN 1: fn_cobros_por_periodo
-- Retorna todos los pagos en un rango de fechas para un usuario.
-- Se invoca via RPC desde el adapter de reportes.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_cobros_por_periodo(
  p_user_id   UUID,
  p_desde     DATE,
  p_hasta     DATE
)
RETURNS TABLE (
  pago_id         UUID,
  cuota_id        UUID,
  monto           DECIMAL,
  fecha_pago      DATE,
  metodo_pago     VARCHAR,
  referencia_pago VARCHAR,
  estado          VARCHAR,
  cliente_nombre  VARCHAR,
  numero_cuota    INT,
  prestamo_id     UUID
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pg.id              AS pago_id,
    pg.cuota_id,
    pg.monto,
    pg.fecha_pago,
    pg.metodo_pago,
    pg.referencia_pago,
    pg.estado,
    cl.nombre          AS cliente_nombre,
    c.numero_cuota,
    p.id               AS prestamo_id
  FROM pagos pg
  JOIN cuotas c  ON c.id  = pg.cuota_id
  JOIN prestamos p ON p.id = c.prestamo_id
  JOIN clientes cl ON cl.id = p.cliente_id
  WHERE pg.user_id   = p_user_id
    AND pg.fecha_pago BETWEEN p_desde AND p_hasta
    AND pg.estado     = 'CONFIRMADO'
  ORDER BY pg.fecha_pago DESC;
$$;


-- ────────────────────────────────────────────────────────────
-- FUNCIÓN 2: fn_rentabilidad_mensual
-- Retorna rentabilidad agrupada por mes (últimos 12 meses).
-- Combina interés de préstamos + ganancia de activos.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_rentabilidad_mensual(
  p_user_id UUID,
  p_meses   INT DEFAULT 12
)
RETURNS TABLE (
  mes              TEXT,
  interes_cobrado  DECIMAL,
  ganancia_activos DECIMAL,
  total            DECIMAL
)
LANGUAGE sql
STABLE
AS $$
  WITH meses AS (
    SELECT generate_series(
      DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' * (p_meses - 1),
      DATE_TRUNC('month', CURRENT_DATE),
      '1 month'
    ) AS mes_inicio
  ),
  cobros_mes AS (
    SELECT
      DATE_TRUNC('month', pg.fecha_pago::TIMESTAMP) AS mes,
      -- Aproximar el interés cobrado como diferencia entre monto pago y capital
      -- (simplificado; en producción se podría calcular desde cuotas.interes_aplicable)
      COALESCE(SUM(c.interes_aplicable), 0)         AS interes
    FROM pagos pg
    JOIN cuotas c ON c.id = pg.cuota_id
    WHERE pg.user_id = p_user_id
      AND pg.estado  = 'CONFIRMADO'
      AND pg.fecha_pago >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' * (p_meses - 1)
    GROUP BY DATE_TRUNC('month', pg.fecha_pago::TIMESTAMP)
  ),
  activos_mes AS (
    SELECT
      DATE_TRUNC('month', a.fecha_venta::TIMESTAMP) AS mes,
      COALESCE(SUM(a.ganancia), 0)                  AS ganancia
    FROM activos a
    WHERE a.user_id = p_user_id
      AND a.estado  = 'VENDIDO'
      AND a.fecha_venta IS NOT NULL
      AND a.fecha_venta >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' * (p_meses - 1)
    GROUP BY DATE_TRUNC('month', a.fecha_venta::TIMESTAMP)
  )
  SELECT
    TO_CHAR(m.mes_inicio, 'YYYY-MM')              AS mes,
    COALESCE(cm.interes, 0)                        AS interes_cobrado,
    COALESCE(am.ganancia, 0)                       AS ganancia_activos,
    COALESCE(cm.interes, 0) + COALESCE(am.ganancia, 0) AS total
  FROM meses m
  LEFT JOIN cobros_mes   cm ON cm.mes = m.mes_inicio
  LEFT JOIN activos_mes  am ON am.mes = m.mes_inicio
  ORDER BY m.mes_inicio;
$$;


-- ────────────────────────────────────────────────────────────
-- PERMISOS
-- Dar acceso a usuarios autenticados
-- ────────────────────────────────────────────────────────────

GRANT SELECT ON vw_resumen_cartera     TO authenticated;
GRANT SELECT ON vw_cobros_por_metodo   TO authenticated;
GRANT SELECT ON vw_morosidad_detalle   TO authenticated;

GRANT EXECUTE ON FUNCTION fn_cobros_por_periodo   TO authenticated;
GRANT EXECUTE ON FUNCTION fn_rentabilidad_mensual TO authenticated;


-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-MIGRACIÓN
-- Ejecutar estas queries para confirmar que todo se creó bien:
-- ────────────────────────────────────────────────────────────

-- 1. Verificar vistas
-- SELECT * FROM vw_resumen_cartera WHERE user_id = auth.uid() LIMIT 1;
-- SELECT * FROM vw_cobros_por_metodo WHERE user_id = auth.uid() LIMIT 5;
-- SELECT * FROM vw_morosidad_detalle WHERE user_id = auth.uid() LIMIT 5;

-- 2. Verificar funciones
-- SELECT * FROM fn_cobros_por_periodo(auth.uid(), '2026-01-01', '2026-03-31');
-- SELECT * FROM fn_rentabilidad_mensual(auth.uid(), 6);
