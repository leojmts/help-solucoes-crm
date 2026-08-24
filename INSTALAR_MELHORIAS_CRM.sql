-- Melhorias do CRM: anexos privados, respostas prontas e base de conhecimento.
-- Script idempotente: pode ser executado novamente com segurança.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chamado-anexos',
  'chamado-anexos',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf','text/plain']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.chamado_interacao_anexos (
  id uuid primary key default gen_random_uuid(),
  interacao_id uuid not null references public.chamado_interacoes(id) on delete cascade,
  chamado_id bigint not null references public.chamados(id) on delete cascade,
  nome_arquivo text not null check (char_length(nome_arquivo) between 1 and 255),
  caminho_storage text not null unique,
  tipo_mime text,
  tamanho_bytes bigint not null default 0 check (tamanho_bytes between 0 and 10485760),
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now()
);
create index if not exists chamado_interacao_anexos_interacao_idx on public.chamado_interacao_anexos(interacao_id);
create index if not exists chamado_interacao_anexos_chamado_idx on public.chamado_interacao_anexos(chamado_id);
create index if not exists chamado_interacao_anexos_criado_por_idx on public.chamado_interacao_anexos(criado_por);

create table if not exists public.respostas_modelo (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  categoria text not null default 'Geral' check (char_length(btrim(categoria)) between 1 and 80),
  conteudo text not null check (char_length(btrim(conteudo)) between 1 and 4000),
  ativo boolean not null default true,
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists respostas_modelo_ativo_categoria_idx on public.respostas_modelo(ativo, categoria);
create index if not exists respostas_modelo_criado_por_idx on public.respostas_modelo(criado_por);

create table if not exists public.base_conhecimento (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 160),
  categoria text not null default 'Geral' check (char_length(btrim(categoria)) between 1 and 80),
  problema text not null check (char_length(btrim(problema)) between 1 and 4000),
  solucao text not null check (char_length(btrim(solucao)) between 1 and 8000),
  palavras_chave text not null default '',
  ativo boolean not null default true,
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists base_conhecimento_ativo_categoria_idx on public.base_conhecimento(ativo, categoria);
create index if not exists base_conhecimento_criado_por_idx on public.base_conhecimento(criado_por);

alter table public.chamado_interacao_anexos enable row level security;
alter table public.respostas_modelo enable row level security;
alter table public.base_conhecimento enable row level security;

grant select, insert, delete on public.chamado_interacao_anexos to authenticated;
grant select, insert, update, delete on public.respostas_modelo to authenticated;
grant select, insert, update, delete on public.base_conhecimento to authenticated;
revoke all on public.chamado_interacao_anexos, public.respostas_modelo, public.base_conhecimento from anon;

drop policy if exists "Equipe ativa visualiza anexos" on public.chamado_interacao_anexos;
create policy "Equipe ativa visualiza anexos" on public.chamado_interacao_anexos for select to authenticated
using (exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo));
drop policy if exists "Equipe ativa cria anexos" on public.chamado_interacao_anexos;
create policy "Equipe ativa cria anexos" on public.chamado_interacao_anexos for insert to authenticated
with check (criado_por = (select auth.uid()) and exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo));
drop policy if exists "Autor ou admin exclui anexos" on public.chamado_interacao_anexos;
create policy "Autor ou admin exclui anexos" on public.chamado_interacao_anexos for delete to authenticated
using (criado_por = (select auth.uid()) or exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin'));

drop policy if exists "Equipe ativa visualiza modelos" on public.respostas_modelo;
create policy "Equipe ativa visualiza modelos" on public.respostas_modelo for select to authenticated
using (exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo));
drop policy if exists "Equipe ativa cria modelos" on public.respostas_modelo;
create policy "Equipe ativa cria modelos" on public.respostas_modelo for insert to authenticated
with check (criado_por = (select auth.uid()) and exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo));
drop policy if exists "Autor ou admin altera modelos" on public.respostas_modelo;
create policy "Autor ou admin altera modelos" on public.respostas_modelo for update to authenticated
using (criado_por = (select auth.uid()) or exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin'))
with check (criado_por = (select auth.uid()) or exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin'));
drop policy if exists "Autor ou admin exclui modelos" on public.respostas_modelo;
create policy "Autor ou admin exclui modelos" on public.respostas_modelo for delete to authenticated
using (criado_por = (select auth.uid()) or exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin'));

drop policy if exists "Equipe ativa visualiza conhecimento" on public.base_conhecimento;
create policy "Equipe ativa visualiza conhecimento" on public.base_conhecimento for select to authenticated
using (exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo));
drop policy if exists "Equipe ativa cria conhecimento" on public.base_conhecimento;
create policy "Equipe ativa cria conhecimento" on public.base_conhecimento for insert to authenticated
with check (criado_por = (select auth.uid()) and exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo));
drop policy if exists "Autor ou admin altera conhecimento" on public.base_conhecimento;
create policy "Autor ou admin altera conhecimento" on public.base_conhecimento for update to authenticated
using (criado_por = (select auth.uid()) or exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin'))
with check (criado_por = (select auth.uid()) or exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin'));
drop policy if exists "Autor ou admin exclui conhecimento" on public.base_conhecimento;
create policy "Autor ou admin exclui conhecimento" on public.base_conhecimento for delete to authenticated
using (criado_por = (select auth.uid()) or exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin'));

drop policy if exists "Equipe ativa baixa anexos do CRM" on storage.objects;
create policy "Equipe ativa baixa anexos do CRM" on storage.objects for select to authenticated
using (bucket_id = 'chamado-anexos' and exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo));
drop policy if exists "Equipe ativa envia anexos do CRM" on storage.objects;
create policy "Equipe ativa envia anexos do CRM" on storage.objects for insert to authenticated
with check (bucket_id = 'chamado-anexos' and owner_id = (select auth.uid())::text and exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo));
drop policy if exists "Autor ou admin exclui arquivos do CRM" on storage.objects;
create policy "Autor ou admin exclui arquivos do CRM" on storage.objects for delete to authenticated
using (bucket_id = 'chamado-anexos' and (owner_id = (select auth.uid())::text or exists (select 1 from public.perfis_usuarios p where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin')));
