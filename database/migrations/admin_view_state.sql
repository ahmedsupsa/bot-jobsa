-- Per-admin lightweight view-state (last-seen timestamps for new-item badges)
CREATE TABLE IF NOT EXISTS admin_view_state (
  username                text PRIMARY KEY,
  last_orders_seen_at     timestamptz NOT NULL DEFAULT '1970-01-01'::timestamptz,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
