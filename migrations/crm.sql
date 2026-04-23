-- CRM (علاقات العملاء) — customers + interactions
create table if not exists crm_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  source text,                       -- مصدر العميل: instagram, whatsapp, referral, ...
  status text not null default 'lead',  -- lead | contacted | negotiating | won | lost
  notes text,
  next_followup_at timestamptz,      -- تذكير المتابعة القادم
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_customers_status on crm_customers(status);
create index if not exists idx_crm_customers_followup on crm_customers(next_followup_at);
create index if not exists idx_crm_customers_created on crm_customers(created_at desc);

create table if not exists crm_interactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm_customers(id) on delete cascade,
  channel text not null,             -- whatsapp | phone | email | instagram | twitter | in_person | other
  direction text not null default 'out',  -- out | in
  summary text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_interactions_customer on crm_interactions(customer_id, occurred_at desc);

-- auto-update updated_at on customer changes
create or replace function crm_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_crm_customers_touch on crm_customers;
create trigger trg_crm_customers_touch before update on crm_customers
  for each row execute function crm_touch_updated_at();
