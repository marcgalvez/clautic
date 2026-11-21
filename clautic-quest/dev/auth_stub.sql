-- NOMÉS PER A DESENVOLUPAMENT LOCAL: emula el mínim de l'esquema auth de Supabase.
-- A Lovable Cloud / Supabase aquest esquema ja existeix.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create extension if not exists pgcrypto;
create schema if not exists extensions;
create schema if not exists auth;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;

create table if not exists auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text unique, encrypted_password text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz, confirmation_token text, recovery_token text,
  email_change_token_new text, email_change text, last_sign_in_at timestamptz
);
create table if not exists auth.identities (
  id uuid primary key, user_id uuid references auth.users(id) on delete cascade, provider_id text,
  identity_data jsonb, provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;
grant execute on function auth.uid(), auth.role() to anon, authenticated;

-- Privilegis per defecte com a Supabase (RLS fa la resta)
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
