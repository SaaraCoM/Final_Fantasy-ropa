-- Ejecutar en el editor SQL de Supabase.
-- El cliente anónimo no recibe acceso directo a la tabla: solo a funciones RPC controladas.

create table if not exists public.outfit_reservations (
  outfit_id text primary key,
  alias text not null check (char_length(alias) between 1 and 60),
  release_code text not null check (char_length(release_code) = 10),
  reserved_at timestamptz not null default now()
);

alter table public.outfit_reservations enable row level security;
revoke all on table public.outfit_reservations from anon, authenticated;

create or replace function public.list_outfit_reservations()
returns table (outfit_id text, alias text, reserved_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select r.outfit_id, r.alias, r.reserved_at
  from public.outfit_reservations r
  order by r.reserved_at desc;
$$;

create or replace function public.reserve_outfit(
  p_outfit_id text,
  p_alias text,
  p_release_code text
)
returns table (release_code text, reserved_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_at timestamptz;
begin
  if p_outfit_id is null or char_length(trim(p_outfit_id)) = 0 then
    raise exception 'outfit_id requerido';
  end if;
  if p_alias is null or char_length(trim(p_alias)) not between 1 and 60 then
    raise exception 'alias inválido';
  end if;
  if p_release_code is null or char_length(upper(trim(p_release_code))) <> 10 then
    raise exception 'código inválido';
  end if;

  insert into public.outfit_reservations(outfit_id, alias, release_code)
  values (trim(p_outfit_id), trim(p_alias), upper(trim(p_release_code)))
  returning outfit_reservations.reserved_at into created_at;

  return query select upper(trim(p_release_code)), created_at;
end;
$$;

create or replace function public.release_outfit(p_outfit_id text, p_release_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.outfit_reservations
  where outfit_id = trim(p_outfit_id)
    and release_code = upper(trim(p_release_code));
  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke all on function public.list_outfit_reservations() from public;
revoke all on function public.reserve_outfit(text, text, text) from public;
revoke all on function public.release_outfit(text, text) from public;

grant execute on function public.list_outfit_reservations() to anon;
grant execute on function public.reserve_outfit(text, text, text) to anon;
grant execute on function public.release_outfit(text, text) to anon;
