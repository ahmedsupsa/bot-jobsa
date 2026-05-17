-- ══════════════════════════════════════════════════════════════════
-- نظام عجلة الحظ — Spin Wheel Rewards System
-- تاريخ: 2026-05-17
-- ══════════════════════════════════════════════════════════════════

-- عمودان جديدان في جدول users
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_spins    INT          NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reward_balance   NUMERIC(8,2) NOT NULL DEFAULT 0;

-- جدول سجل نتائج العجلة
CREATE TABLE IF NOT EXISTS spin_rewards (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id  UUID        REFERENCES applications(id) ON DELETE SET NULL,
  amount          NUMERIC(8,2) NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',  -- pending | withdrawn
  spun_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at    TIMESTAMPTZ,
  withdrawal_ref  TEXT
);

CREATE INDEX IF NOT EXISTS spin_rewards_user_idx   ON spin_rewards(user_id);
CREATE INDEX IF NOT EXISTS spin_rewards_status_idx ON spin_rewards(status);

-- جدول طلبات السحب
CREATE TABLE IF NOT EXISTS reward_withdrawals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       NUMERIC(8,2) NOT NULL,
  method       TEXT        NOT NULL,   -- bank | wallet | subscription_credit
  details      JSONB,
  status       TEXT        NOT NULL DEFAULT 'pending',   -- pending | paid | rejected
  admin_notes  TEXT,
  proof_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS reward_withdrawals_user_idx ON reward_withdrawals(user_id);

-- دالة RPC لزيادة pending_spins بأمان (يستخدمها Worker)
CREATE OR REPLACE FUNCTION increment_pending_spins(p_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE users
  SET pending_spins = COALESCE(pending_spins, 0) + 1
  WHERE id = p_user_id;
$$;
