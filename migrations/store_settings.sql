-- Single-row table for store-page top banner (image + text).
create table if not exists public.store_settings (
  id int primary key default 1,
  banner_enabled boolean not null default false,
  banner_text text,
  banner_image_url text,
  updated_at timestamptz not null default now(),
  constraint store_settings_singleton check (id = 1)
);

insert into public.store_settings (id) values (1)
on conflict (id) do nothing;
