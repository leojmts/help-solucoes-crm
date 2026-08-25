-- Fluxo operacional: cronômetro, notificações, menções e encerramento seguro.

alter table public.chamados add column if not exists contato_confirmado boolean not null default false;
alter table public.tecnicos add column if not exists user_id uuid unique references auth.users(id) on delete set null;

-- Vincula os cadastros atuais aos respectivos acessos. Novos técnicos podem ser
-- vinculados pelo mesmo campo sem depender de comparação de nomes.
update public.tecnicos t set user_id=p.user_id
from public.perfis_usuarios p
where t.user_id is null and (
  (lower(t.nome) like '%leonardo%' and lower(p.nome) like 'leonardo%') or
  (lower(t.nome) like '%jonailton%' and lower(p.email) like 'helpsolucoestecnologicas@%')
);

create table if not exists public.chamado_tempos (
  id uuid primary key default gen_random_uuid(),
  chamado_id bigint not null references public.chamados(id) on delete cascade,
  usuario_id uuid not null references auth.users(id),
  usuario_nome text not null,
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  minutos integer check (minutos is null or minutos >= 0),
  observacao text not null default '',
  criado_em timestamptz not null default now(),
  check (finalizado_em is null or finalizado_em >= iniciado_em)
);

create unique index if not exists chamado_tempos_usuario_aberto_idx
  on public.chamado_tempos(usuario_id) where finalizado_em is null;
create index if not exists chamado_tempos_chamado_idx on public.chamado_tempos(chamado_id, iniciado_em desc);

create table if not exists public.notificacoes_usuarios (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references auth.users(id) on delete cascade,
  remetente_id uuid references auth.users(id) on delete set null,
  tipo text not null check (tipo in ('atribuicao','mencao','sla','retorno','processo','sistema')),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 140),
  mensagem text not null check (char_length(btrim(mensagem)) between 1 and 1000),
  chamado_id bigint references public.chamados(id) on delete cascade,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists notificacoes_destinatario_idx
  on public.notificacoes_usuarios(destinatario_id, lida, criado_em desc);
create index if not exists notificacoes_chamado_idx on public.notificacoes_usuarios(chamado_id);
create index if not exists notificacoes_remetente_idx on public.notificacoes_usuarios(remetente_id);

alter table public.chamado_tempos enable row level security;
alter table public.notificacoes_usuarios enable row level security;
revoke all on public.chamado_tempos, public.notificacoes_usuarios from anon;
grant select, insert, update on public.chamado_tempos to authenticated;
grant select, insert, update, delete on public.notificacoes_usuarios to authenticated;

drop policy if exists "Equipe ativa visualiza tempos" on public.chamado_tempos;
create policy "Equipe ativa visualiza tempos" on public.chamado_tempos for select to authenticated
using (exists (select 1 from public.perfis_usuarios p where p.user_id=(select auth.uid()) and p.ativo));
drop policy if exists "Usuario inicia seu tempo" on public.chamado_tempos;
create policy "Usuario inicia seu tempo" on public.chamado_tempos for insert to authenticated
with check (usuario_id=(select auth.uid()));
drop policy if exists "Usuario finaliza seu tempo" on public.chamado_tempos;
create policy "Usuario finaliza seu tempo" on public.chamado_tempos for update to authenticated
using (usuario_id=(select auth.uid())) with check (usuario_id=(select auth.uid()));

drop policy if exists "Usuario visualiza suas notificacoes" on public.notificacoes_usuarios;
create policy "Usuario visualiza suas notificacoes" on public.notificacoes_usuarios for select to authenticated
using (destinatario_id=(select auth.uid()));
drop policy if exists "Equipe cria notificacoes" on public.notificacoes_usuarios;
create policy "Equipe cria notificacoes" on public.notificacoes_usuarios for insert to authenticated
with check (remetente_id=(select auth.uid()) and exists (
  select 1 from public.perfis_usuarios p where p.user_id=(select auth.uid()) and p.ativo
));
drop policy if exists "Usuario gerencia suas notificacoes" on public.notificacoes_usuarios;
create policy "Usuario gerencia suas notificacoes" on public.notificacoes_usuarios for update to authenticated
using (destinatario_id=(select auth.uid())) with check (destinatario_id=(select auth.uid()));
drop policy if exists "Usuario exclui suas notificacoes" on public.notificacoes_usuarios;
create policy "Usuario exclui suas notificacoes" on public.notificacoes_usuarios for delete to authenticated
using (destinatario_id=(select auth.uid()));

do $$ begin
  alter publication supabase_realtime add table public.notificacoes_usuarios;
exception when duplicate_object then null;
end $$;
