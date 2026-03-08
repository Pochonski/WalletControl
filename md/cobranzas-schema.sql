-- =====================================================
-- TABLAS PARA MÓDULO DE COBRANZAS
-- Ejecutar en Supabase Dashboard → SQL Editor
-- =====================================================

-- ── Tabla principal de cobranzas ─────────────────────
CREATE TABLE cobranzas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Referencia a la cuota que se está cobrando
  payment_id UUID REFERENCES cuotas(id) ON DELETE SET NULL,

  -- Estado del proceso de cobranza
  -- pending → in_progress → contacted → negotiated → resolved / failed
  status VARCHAR(30) DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','contacted','negotiated','resolved','failed')),

  -- Montos
  amount_due DECIMAL(15, 2),

  -- Notas generales
  notes TEXT,

  -- Fecha en que se resolvió
  resolved_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX cobranzas_user_id_idx   ON cobranzas(user_id);
CREATE INDEX cobranzas_status_idx    ON cobranzas(status);
CREATE INDEX cobranzas_payment_id_idx ON cobranzas(payment_id);
CREATE INDEX cobranzas_created_at_idx ON cobranzas(created_at DESC);

-- ── Tabla de acciones por cobranza ───────────────────
CREATE TABLE cobranza_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES cobranzas(id) ON DELETE CASCADE,

  -- Tipo de acción realizada
  action_type VARCHAR(50) NOT NULL
    CHECK (action_type IN ('call','email','whatsapp','visit','letter','negotiation','other')),

  -- Resultado del contacto
  outcome VARCHAR(50),  -- 'answered','no_answer','promised_payment','refused','other'

  -- Notas de la acción
  notes TEXT,

  -- Cuándo ocurrió
  action_date TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX cobranza_actions_user_id_idx       ON cobranza_actions(user_id);
CREATE INDEX cobranza_actions_collection_id_idx ON cobranza_actions(collection_id);
CREATE INDEX cobranza_actions_action_date_idx   ON cobranza_actions(action_date DESC);

-- ── Tabla de planes de pago ──────────────────────────
CREATE TABLE payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES cobranzas(id) ON DELETE CASCADE,

  -- Detalles del plan
  total_amount DECIMAL(15, 2) NOT NULL,
  installments JSONB,  -- array de { date, amount }

  -- Estado
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active','completed','cancelled')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX payment_plans_user_id_idx       ON payment_plans(user_id);
CREATE INDEX payment_plans_collection_id_idx ON payment_plans(collection_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE cobranzas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobranza_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans    ENABLE ROW LEVEL SECURITY;

-- Policies: cobranzas
CREATE POLICY "cobranzas_select" ON cobranzas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cobranzas_insert" ON cobranzas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cobranzas_update" ON cobranzas FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cobranzas_delete" ON cobranzas FOR DELETE USING (FALSE);

-- Policies: cobranza_actions
CREATE POLICY "cobranza_actions_select" ON cobranza_actions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cobranza_actions_insert" ON cobranza_actions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cobranza_actions_update" ON cobranza_actions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cobranza_actions_delete" ON cobranza_actions FOR DELETE USING (FALSE);

-- Policies: payment_plans
CREATE POLICY "payment_plans_select" ON payment_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "payment_plans_insert" ON payment_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payment_plans_update" ON payment_plans FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payment_plans_delete" ON payment_plans FOR DELETE USING (FALSE);

-- =====================================================
-- TRIGGER: auto-update de updated_at
-- =====================================================

CREATE TRIGGER trigger_cobranzas_updated
BEFORE UPDATE ON cobranzas
FOR EACH ROW EXECUTE FUNCTION update_fecha_actualizado();

CREATE TRIGGER trigger_payment_plans_updated
BEFORE UPDATE ON payment_plans
FOR EACH ROW EXECUTE FUNCTION update_fecha_actualizado();
