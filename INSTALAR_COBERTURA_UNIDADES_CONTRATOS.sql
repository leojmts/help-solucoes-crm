begin;

create table if not exists public.contrato_unidades (
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  unidade_id bigint not null references public.cliente_unidades(id) on delete restrict,
  criado_por uuid not null references auth.users(id) on delete restrict default auth.uid(),
  criado_em timestamptz not null default now(),
  primary key (contrato_id, unidade_id)
);

create index if not exists contrato_unidades_unidade_idx on public.contrato_unidades(unidade_id);
alter table public.contrato_unidades enable row level security;
revoke all on public.contrato_unidades from anon;
grant select,insert,delete on public.contrato_unidades to authenticated;

drop policy if exists "Equipe visualiza cobertura contratual" on public.contrato_unidades;
create policy "Equipe visualiza cobertura contratual" on public.contrato_unidades
for select to authenticated using ((select private.crm_tem_permissao('contratosVisualizar')));
drop policy if exists "Equipe inclui cobertura contratual" on public.contrato_unidades;
create policy "Equipe inclui cobertura contratual" on public.contrato_unidades
for insert to authenticated with check (
  ((select private.crm_tem_permissao('contratosCriar')) or (select private.crm_tem_permissao('contratosEditar')))
  and criado_por=(select auth.uid())
);
drop policy if exists "Equipe remove cobertura contratual" on public.contrato_unidades;
create policy "Equipe remove cobertura contratual" on public.contrato_unidades
for delete to authenticated using (
  (select private.crm_tem_permissao('contratosCriar')) or (select private.crm_tem_permissao('contratosEditar'))
);

create or replace function public.salvar_contrato_unidades(p_contrato_id uuid,p_unidades bigint[])
returns integer language plpgsql security invoker set search_path='' as $$
declare v_cliente bigint; v_total integer;
begin
  if (select auth.uid()) is null or not (
    private.crm_tem_permissao('contratosCriar') or private.crm_tem_permissao('contratosEditar')
  ) then raise exception 'Sem permissão para alterar a cobertura do contrato' using errcode='42501'; end if;
  select cliente_id into v_cliente from public.contratos
  where id=p_contrato_id and parte_tipo='Cliente' for update;
  if not found then raise exception 'Contrato de cliente não encontrado'; end if;
  if coalesce(cardinality(p_unidades),0)=0 then raise exception 'Selecione ao menos uma unidade atendida'; end if;
  if exists(
    select 1 from unnest(p_unidades) x(id)
    left join public.cliente_unidades u on u.id=x.id and u.cliente_id=v_cliente and u.ativo
    where u.id is null
  ) then raise exception 'Uma das unidades não pertence ao cliente do contrato'; end if;
  delete from public.contrato_unidades where contrato_id=p_contrato_id;
  insert into public.contrato_unidades(contrato_id,unidade_id,criado_por)
  select p_contrato_id,x.id,(select auth.uid()) from (select distinct unnest(p_unidades) id) x;
  get diagnostics v_total=row_count;
  return v_total;
end $$;

revoke execute on function public.salvar_contrato_unidades(uuid,bigint[]) from public,anon;
grant execute on function public.salvar_contrato_unidades(uuid,bigint[]) to authenticated;

insert into public.contrato_unidades(contrato_id,unidade_id,criado_por)
select c.id,u.id,c.criado_por from public.contratos c
join public.cliente_unidades u on u.cliente_id=c.cliente_id and u.ativo
where c.parte_tipo='Cliente'
on conflict do nothing;

update public.cliente_unidades u set principal=false,atualizado_em=now()
where u.cliente_id in (select id from public.clientes where lower(nome) like '%rancho%');

insert into public.cliente_unidades(cliente_id,nome,cidade,uf,endereco,principal,ativo,criado_por)
select c.id,v.nome,v.cidade,'MS','',v.principal,true,
       coalesce((select p.user_id from public.perfis_usuarios p where p.ativo order by (p.perfil='admin') desc,p.criado_em limit 1),(select id from auth.users order by created_at limit 1))
from public.clientes c
cross join (values ('Matriz - Jardim','Jardim',true),('Miranda','Miranda',false),('Bela Vista','Bela Vista',false),('Bonito','Bonito',false)) v(nome,cidade,principal)
where lower(c.nome) like '%rancho%'
on conflict do nothing;

update public.cliente_unidades u set cidade=v.cidade,uf='MS',principal=v.principal,ativo=true,atualizado_em=now()
from public.clientes c
cross join (values ('Matriz - Jardim','Jardim',true),('Miranda','Miranda',false),('Bela Vista','Bela Vista',false),('Bonito','Bonito',false)) v(nome,cidade,principal)
where u.cliente_id=c.id and lower(c.nome) like '%rancho%' and lower(btrim(u.nome))=lower(v.nome);

commit;
