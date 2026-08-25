-- Processos internos e histórico de execuções.
-- Pode ser executado novamente com segurança no SQL Editor do Supabase.

create table if not exists public.processos_internos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 160),
  descricao text not null default '',
  responsavel_nome text not null,
  frequencia text not null default 'Única'
    check (frequencia in ('Única','Diária','Semanal','Quinzenal','Mensal','Personalizada')),
  dias_semana smallint[] not null default '{}',
  intervalo_dias integer,
  proxima_execucao timestamptz not null,
  ultima_execucao timestamptz,
  prioridade text not null default 'Normal' check (prioridade in ('Baixa','Normal','Alta')),
  status text not null default 'Pendente' check (status in ('Pendente','Em andamento','Concluída','Pausada')),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  observacoes text not null default '',
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (intervalo_dias is null or intervalo_dias between 1 and 365),
  check (dias_semana <@ array[0,1,2,3,4,5,6]::smallint[])
);

create table if not exists public.processo_execucoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos_internos(id) on delete cascade,
  executado_por uuid not null references auth.users(id),
  executado_por_nome text not null,
  observacao text not null default '',
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  concluido_em timestamptz not null default now()
);

create index if not exists processos_status_proxima_idx on public.processos_internos(status, proxima_execucao);
create index if not exists processos_responsavel_idx on public.processos_internos(responsavel_nome);
create index if not exists processos_criado_por_idx on public.processos_internos(criado_por);
create index if not exists processo_execucoes_processo_data_idx on public.processo_execucoes(processo_id, concluido_em desc);
create index if not exists processo_execucoes_executado_por_idx on public.processo_execucoes(executado_por);

alter table public.processos_internos enable row level security;
alter table public.processo_execucoes enable row level security;

revoke all on table public.processos_internos from anon;
revoke all on table public.processo_execucoes from anon;
grant select, insert, delete on table public.processos_internos to authenticated;
grant update (titulo, descricao, responsavel_nome, frequencia, dias_semana, intervalo_dias,
  proxima_execucao, ultima_execucao, prioridade, status, checklist, observacoes, atualizado_em)
  on table public.processos_internos to authenticated;
grant select, insert, delete on table public.processo_execucoes to authenticated;

drop policy if exists "Equipe ativa visualiza processos" on public.processos_internos;
create policy "Equipe ativa visualiza processos" on public.processos_internos for select to authenticated
using (exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo));

drop policy if exists "Equipe ativa cria processos" on public.processos_internos;
create policy "Equipe ativa cria processos" on public.processos_internos for insert to authenticated
with check (criado_por = (select auth.uid()) and exists (
  select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo
));

drop policy if exists "Equipe ativa atualiza processos" on public.processos_internos;
create policy "Equipe ativa atualiza processos" on public.processos_internos for update to authenticated
using (exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo))
with check (exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo));

drop policy if exists "Criador ou admin exclui processos" on public.processos_internos;
create policy "Criador ou admin exclui processos" on public.processos_internos for delete to authenticated
using (criado_por = (select auth.uid()) or exists (
  select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin'
));

drop policy if exists "Equipe ativa visualiza execucoes" on public.processo_execucoes;
create policy "Equipe ativa visualiza execucoes" on public.processo_execucoes for select to authenticated
using (exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo));

drop policy if exists "Equipe ativa registra execucoes" on public.processo_execucoes;
create policy "Equipe ativa registra execucoes" on public.processo_execucoes for insert to authenticated
with check (executado_por = (select auth.uid()) and exists (
  select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo
));

drop policy if exists "Autor ou admin exclui execucoes" on public.processo_execucoes;
create policy "Autor ou admin exclui execucoes" on public.processo_execucoes for delete to authenticated
using (executado_por = (select auth.uid()) or exists (
  select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin'
));
