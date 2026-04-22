-- ─────────────────────────────────────────────────────────────────────────────
-- Discount Codes v2 — multi-product, multi-gateway, real-sales-only usage
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- Make legacy product_id optional (we keep it for back-compat as a single hint
-- but the junction table is now the source of truth)
ALTER TABLE discount_codes ALTER COLUMN product_id DROP NOT NULL;

-- Scope flags. NULL means "applies everywhere"
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS applies_to_all_products boolean NOT NULL DEFAULT true;
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS applies_to_all_gateways boolean NOT NULL DEFAULT true;

-- ─── Junction: discount ↔ product ───
CREATE TABLE IF NOT EXISTS discount_code_products (
  discount_code_id uuid NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  product_id       uuid NOT NULL REFERENCES store_products(id)  ON DELETE CASCADE,
  PRIMARY KEY (discount_code_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_dcp_code    ON discount_code_products(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_dcp_product ON discount_code_products(product_id);

-- ─── Junction: discount ↔ payment gateway ───
-- gateway is one of: tamara, streampay, bank_transfer
CREATE TABLE IF NOT EXISTS discount_code_gateways (
  discount_code_id uuid NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  gateway          text NOT NULL CHECK (gateway IN ('tamara','streampay','bank_transfer')),
  PRIMARY KEY (discount_code_id, gateway)
);
CREATE INDEX IF NOT EXISTS idx_dcg_code ON discount_code_gateways(discount_code_id);

-- ─── Usage count maintained from REAL paid orders only ───
-- Trigger keeps discount_codes.usage_count == count(store_orders WHERE status='paid' AND discount_code_id=X).
-- This enforces the rule "no order = no usage; failed/cancelled doesn't count".

CREATE OR REPLACE FUNCTION recompute_discount_usage(code_id uuid)
RETURNS void AS $$
BEGIN
  IF code_id IS NULL THEN RETURN; END IF;
  UPDATE discount_codes dc
     SET usage_count = COALESCE((
        SELECT count(*) FROM store_orders so
         WHERE so.discount_code_id = code_id
           AND so.status = 'paid'
       ), 0)
   WHERE dc.id = code_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_store_orders_discount_usage()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM recompute_discount_usage(NEW.discount_code_id);
  ELSIF TG_OP = 'UPDATE' THEN
    -- recompute for both old & new code if they differ, or status changed
    IF NEW.discount_code_id IS DISTINCT FROM OLD.discount_code_id THEN
      PERFORM recompute_discount_usage(OLD.discount_code_id);
      PERFORM recompute_discount_usage(NEW.discount_code_id);
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM recompute_discount_usage(NEW.discount_code_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM recompute_discount_usage(OLD.discount_code_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS store_orders_discount_usage ON store_orders;
CREATE TRIGGER store_orders_discount_usage
AFTER INSERT OR UPDATE OF status, discount_code_id OR DELETE ON store_orders
FOR EACH ROW EXECUTE FUNCTION trg_store_orders_discount_usage();

-- One-shot backfill: rebuild usage_count from real data
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT id FROM discount_codes LOOP
    PERFORM recompute_discount_usage(c.id);
  END LOOP;
END $$;

-- Backfill: copy legacy single product_id → junction (so existing codes keep working)
INSERT INTO discount_code_products(discount_code_id, product_id)
SELECT id, product_id
  FROM discount_codes
 WHERE product_id IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE discount_codes
   SET applies_to_all_products = false
 WHERE EXISTS (SELECT 1 FROM discount_code_products dcp WHERE dcp.discount_code_id = discount_codes.id);

-- RLS for new tables
ALTER TABLE discount_code_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_code_gateways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages dcp" ON discount_code_products;
CREATE POLICY "service role manages dcp" ON discount_code_products
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service role manages dcg" ON discount_code_gateways;
CREATE POLICY "service role manages dcg" ON discount_code_gateways
  FOR ALL TO service_role USING (true) WITH CHECK (true);
