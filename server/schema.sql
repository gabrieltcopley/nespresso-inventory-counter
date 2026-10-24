-- Applied automatically on server startup (idempotent)

create extension if not exists pgcrypto;

create table if not exists users (
  id             uuid        primary key default gen_random_uuid(),
  email          text        not null unique,
  full_name      text        not null default '',
  password_hash  text        not null,
  email_verified boolean     not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists auth_tokens (
  token_hash text        primary key,
  user_id    uuid        not null references users(id) on delete cascade,
  type       text        not null check (type in ('verify', 'reset')),
  expires_at timestamptz not null
);

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

drop trigger if exists products_updated_at on products;
create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();
