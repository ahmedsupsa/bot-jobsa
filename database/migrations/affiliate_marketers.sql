-- ============================================================
-- Affiliate Marketers — standalone external marketers system
-- Run once in Supabase SQL Editor
-- ============================================================

-- Table: standalone affiliate marketers (NOT tied to users table)
CREATE TABLE IF NOT EXISTS affiliate_marketers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  email           text,
  phone           text,
  code            text        UNIQUE NOT NULL,           -- referral code e.g. AHMED20
  commission_type text        NOT NULL DEFAULT 'percent' CHECK (commission_type IN ('percent', 'fixed')),
  commission_value numeric    NOT NULL DEFAULT 10,       -- % or SAR amount
  product_id      uuid        REFERENCES store_products(id) ON DELETE SET NULL,  -- NULL = all products
  is_active       boolean     NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Table: sales attributed to each marketer
CREATE TABLE IF NOT EXISTS affiliate_sales (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id     uuid        NOT NULL REFERENCES affiliate_marketers(id) ON DELETE CASCADE,
  order_id         uuid        REFERENCES store_orders(id) ON DELETE SET NULL,
  customer_name    text,
  customer_email   text,
  order_amount     numeric     NOT NULL DEFAULT 0,
  commission_earned numeric    NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  notes            text,
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Add affiliate tracking columns to store_orders
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS affiliate_code          text;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS affiliate_marketer_id   uuid REFERENCES affiliate_marketers(id) ON DELETE SET NULL;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS affiliate_commission    numeric;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_affiliate_id ON affiliate_sales(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_status        ON affiliate_sales(status);
CREATE INDEX IF NOT EXISTS idx_store_orders_affiliate_code   ON store_orders(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_marketers_code      ON affiliate_marketers(code);
