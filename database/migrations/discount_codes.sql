-- ─────────────────────────────────────────────────────────────────────────────
-- Discount Codes for Store
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discount_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,
  discount_type   text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  numeric NOT NULL CHECK (discount_value > 0),
  product_id      uuid REFERENCES store_products(id) ON DELETE CASCADE,
  usage_limit     integer CHECK (usage_limit IS NULL OR usage_limit >= 1),
  usage_count     integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  expires_at      timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active) WHERE is_active = true;

-- Track applied discount on each order
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS discount_code      text;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS discount_code_id   uuid REFERENCES discount_codes(id) ON DELETE SET NULL;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS original_amount    numeric;

-- Atomic decrement helper (used when a checkout reservation is rolled back)
CREATE OR REPLACE FUNCTION decrement_discount_usage(code_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE discount_codes
     SET usage_count = usage_count - 1
   WHERE id = code_id
     AND usage_count > 0;
END;
$$ LANGUAGE plpgsql;

-- RLS: only service role manages this table
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages discount codes" ON discount_codes;
CREATE POLICY "service role manages discount codes"
  ON discount_codes FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
