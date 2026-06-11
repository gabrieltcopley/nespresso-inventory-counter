-- Run this in the Supabase SQL Editor

create table if not exists products (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  line                text        not null check (line in ('original', 'vertuo')),
  sku                 text        not null unique,
  capsules_per_sleeve integer     not null check (capsules_per_sleeve > 0),
  sleeves_per_case    integer     not null check (sleeves_per_case > 0),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();

alter table products enable row level security;

create policy allow_read on products for select
  using (auth.role() = 'authenticated');

create policy allow_insert on products for insert
  with check (auth.role() = 'authenticated');

create policy allow_update on products for update
  using (auth.role() = 'authenticated');

create policy allow_delete_admin on products for delete
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
