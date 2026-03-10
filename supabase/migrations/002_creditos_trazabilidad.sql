-- ============================================================
-- Migración 002: Trazabilidad de Créditos
-- Fecha: 2026-03-09
-- Descripción:
--   Añade campos opcionales al módulo de créditos:
--   1. fecha_termino en creditos  → créditos con fecha de vencimiento definida
--   2. credito_origen_id en prestamos → trazabilidad: préstamo fondeado por un crédito
--   3. GRANT faltante en v_resumen_creditos
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. Campo opcional: fecha de término del crédito
--    NULL = crédito indefinido / sin fecha de vencimiento pactada
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.creditos
  ADD COLUMN IF NOT EXISTS fecha_termino DATE NULL;

COMMENT ON COLUMN public.creditos.fecha_termino IS
  'Fecha de vencimiento pactada del crédito. NULL = crédito indefinido.';


-- ──────────────────────────────────────────────────────────
-- 2. Trazabilidad: un préstamo puede estar fondeado por un crédito
--    NULL = préstamo fondeado con capital propio (comportamiento por defecto)
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.prestamos
  ADD COLUMN IF NOT EXISTS credito_origen_id UUID NULL
    REFERENCES public.creditos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.prestamos.credito_origen_id IS
  'FK opcional hacia el crédito que financió este préstamo. NULL = capital propio.';

CREATE INDEX IF NOT EXISTS idx_prestamos_credito_origen
  ON public.prestamos (credito_origen_id)
  WHERE credito_origen_id IS NOT NULL;


-- ──────────────────────────────────────────────────────────
-- 3. GRANT faltante en v_resumen_creditos
--    (la vista se creó en 20260308_creditos_schema.sql sin GRANT)
-- ──────────────────────────────────────────────────────────
GRANT SELECT ON public.v_resumen_creditos TO authenticated;
