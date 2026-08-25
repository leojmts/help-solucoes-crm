-- Preferências individuais do dashboard e avisos internos da equipe.

create table if not exists public.dashboard_preferencias (
  user_id uuid primary key references auth.users(id) on delete cascade,
  widgets jsonb not null default '[]'::jsonb check (jsonb_typeof(widgets) = 'array'),
  periodo text not null default 'hoje' check (periodo in ('hoje','semana','mes','todos')),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.avisos_internos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  mensagem text not null check (char_length(btrim(mensagem)) between 1 and 1000),
  criado_por uuid not null references auth.users(id),
  criado_por_nome text not null,
  expira_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists avisos_internos_expira_idx on public.avisos_internos(expira_em);
create index if not exists avisos_internos_criado_por_idx on public.avisos_internos(criado_por);

alter table public.dashboard_preferencias enable row level security;
alter table public.avisos_internos enable row level security;
revoke all on table public.dashboard_preferencias from anon;
revoke all on table public.avisos_internos from anon;
grant select, insert, update, delete on table public.dashboard_preferencias to authenticated;
grant select, insert, delete on table public.avisos_internos to authenticated;

drop policy if exists "Usuario gerencia seu dashboard" on public.dashboard_preferencias;
create policy "Usuario gerencia seu dashboard" on public.dashboard_preferencias
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Equipe ativa visualiza avisos" on public.avisos_internos;
create policy "Equipe ativa visualiza avisos" on public.avisos_internos
for select to authenticated
using (exists (
  select 1 from public.perfis_usuarios p
  where p.user_id = (select auth.uid()) and p.ativo
));

drop policy if exists "Administradores criam avisos" on public.avisos_internos;
create policy "Administradores criam avisos" on public.avisos_internos
for insert to authenticated
with check (
  criado_por = (select auth.uid()) and exists (
    select 1 from public.perfis_usuarios p
    where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin'
  )
);

drop policy if exists "Autor ou admin exclui avisos" on public.avisos_internos;
create policy "Autor ou admin exclui avisos" on public.avisos_internos
for delete to authenticated
using (
  criado_por = (select auth.uid()) or exists (
    select 1 from public.perfis_usuarios p
    where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin'
  )
);
