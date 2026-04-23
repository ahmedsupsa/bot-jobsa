-- 1) Secret/admin-only product flag
alter table store_products add column if not exists is_secret boolean not null default false;
create index if not exists idx_store_products_secret on store_products(is_secret);

-- 2) Refund workflow on orders
alter table store_orders add column if not exists refund_status text;
-- refund_status values: null | requested | approved | rejected | refunded
alter table store_orders add column if not exists refund_reason text;
alter table store_orders add column if not exists refund_admin_notes text;
alter table store_orders add column if not exists refund_requested_at timestamptz;
alter table store_orders add column if not exists refund_processed_at timestamptz;
alter table store_orders add column if not exists refund_method text;
-- refund_method: gateway_auto | manual | rejected

create index if not exists idx_store_orders_refund_status on store_orders(refund_status);
