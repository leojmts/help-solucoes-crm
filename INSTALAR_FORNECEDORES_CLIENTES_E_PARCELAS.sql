-- Unifica o cadastro de fornecedores com clientes, impede recorrências duplicadas
-- e permite limpar parcelas não pagas de contratos cancelados.

alter table public.clientes
  add column if not exists eh_cliente boolean not null default true;

alter table public.financeiro_fornecedores
  add column if not exists cliente_id bigint references public.clientes(id) on delete restrict;

create unique index if not exists financeiro_fornecedores_cliente_uidx
  on public.financeiro_fornecedores(cliente_id)
  where cliente_id is not null;

do $$
declare
  f record;
  v_cliente_id bigint;
begin
  for f in select * from public.financeiro_fornecedores where cliente_id is null loop
    select c.id into v_cliente_id
      from public.clientes c
     where (nullif(regexp_replace(c.documento, '\D', '', 'g'), '') is not null
            and regexp_replace(c.documento, '\D', '', 'g') = regexp_replace(f.documento, '\D', '', 'g'))
        or lower(btrim(c.nome)) = lower(btrim(f.nome))
     order by c.id
     limit 1;

    if v_cliente_id is null then
      insert into public.clientes(
        nome, unidade, documento, ie, regime, telefone, email,
        endereco, cidade, uf, cep, representante, representante_cpf,
        observacoes_tecnicas, eh_cliente
      ) values (
        f.nome, 'Fornecedor', nullif(f.documento, ''), '-', null,
        coalesce(nullif(f.telefone, ''), nullif(f.contato, ''), '-'),
        coalesce(nullif(f.email, ''), '-'), f.endereco, f.cidade, f.uf, f.cep,
        f.representante, f.representante_cpf, '', false
      ) returning id into v_cliente_id;
    end if;

    update public.financeiro_fornecedores
       set cliente_id = v_cliente_id
     where id = f.id;
  end loop;
end $$;

create or replace function public.sincronizar_dados_fornecedor_cliente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.financeiro_fornecedores
     set nome = new.nome,
         documento = coalesce(new.documento, ''),
         contato = coalesce(new.telefone, ''),
         telefone = coalesce(new.telefone, ''),
         email = coalesce(new.email, ''),
         endereco = new.endereco,
         cidade = new.cidade,
         uf = new.uf,
         cep = new.cep,
         representante = new.representante,
         representante_cpf = new.representante_cpf,
         atualizado_em = now()
   where cliente_id = new.id;
  return new;
end;
$$;

drop trigger if exists clientes_sincronizam_fornecedor on public.clientes;
create trigger clientes_sincronizam_fornecedor
after update of nome, documento, telefone, email, endereco, cidade, uf, cep, representante, representante_cpf
on public.clientes
for each row execute function public.sincronizar_dados_fornecedor_cliente();

revoke execute on function public.sincronizar_dados_fornecedor_cliente() from public, anon, authenticated;

create or replace function public.definir_cliente_fornecedor(
  p_cliente_id bigint,
  p_ativo boolean default true,
  p_categoria text default 'Outros',
  p_observacoes text default ''
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clientes%rowtype;
  v_id bigint;
begin
  if (select auth.uid()) is null or not (
    (select private.crm_tem_permissao('novoCliente'))
    or (select private.crm_tem_permissao('financeiroCriar'))
  ) then
    raise exception 'Sem permissão para alterar fornecedores' using errcode = '42501';
  end if;

  select * into c from public.clientes where id = p_cliente_id;
  if not found then raise exception 'Cliente não encontrado'; end if;

  insert into public.financeiro_fornecedores(
    cliente_id, nome, documento, contato, categoria, observacoes, ativo,
    endereco, cidade, uf, cep, telefone, email, representante, representante_cpf,
    criado_por, atualizado_em
  ) values (
    c.id, c.nome, coalesce(c.documento, ''), coalesce(c.telefone, ''),
    coalesce(nullif(btrim(p_categoria), ''), 'Outros'), coalesce(p_observacoes, ''), p_ativo,
    c.endereco, c.cidade, c.uf, c.cep, coalesce(c.telefone, ''), coalesce(c.email, ''),
    c.representante, c.representante_cpf, (select auth.uid()), now()
  )
  on conflict (cliente_id) where cliente_id is not null do update set
    nome = excluded.nome, documento = excluded.documento, contato = excluded.contato,
    categoria = excluded.categoria, observacoes = excluded.observacoes, ativo = excluded.ativo,
    endereco = excluded.endereco, cidade = excluded.cidade, uf = excluded.uf,
    cep = excluded.cep, telefone = excluded.telefone, email = excluded.email,
    representante = excluded.representante, representante_cpf = excluded.representante_cpf,
    atualizado_em = now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.definir_cliente_fornecedor(bigint,boolean,text,text) from public, anon;
grant execute on function public.definir_cliente_fornecedor(bigint,boolean,text,text) to authenticated;

drop policy if exists "Financeiro visualiza financeiro_fornecedores" on public.financeiro_fornecedores;
create policy "Financeiro ou Cadastro visualiza financeiro_fornecedores"
on public.financeiro_fornecedores for select to authenticated
using ((select private.crm_tem_permissao('financeiroVisualizar')) or (select private.crm_tem_permissao('clientes')));

-- Reaproveita os lançamentos manuais equivalentes já existentes e remove somente
-- as cópias automáticas pendentes, sem pagamentos ou anexos.
with pares as (
  select manual.id as manter_id, automatico.id as remover_id, automatico.recorrencia_id
  from public.financeiro_lancamentos automatico
  join public.financeiro_lancamentos manual
    on manual.recorrencia_id is null
   and manual.tipo = automatico.tipo
   and lower(btrim(manual.descricao)) = lower(btrim(automatico.descricao))
   and manual.vencimento = automatico.vencimento
   and manual.valor = automatico.valor
   and manual.status = 'Pendente'
   and automatico.status = 'Pendente'
   and manual.valor_pago = 0 and automatico.valor_pago = 0
   and manual.fornecedor_id is not distinct from automatico.fornecedor_id
  where automatico.recorrencia_id is not null
    and not exists (select 1 from public.financeiro_pagamentos p where p.lancamento_id in (manual.id, automatico.id))
    and not exists (select 1 from public.financeiro_anexos a where a.lancamento_id in (manual.id, automatico.id))
), removidos as (
  delete from public.financeiro_lancamentos l
  using pares p
  where l.id = p.remover_id
  returning p.manter_id, p.recorrencia_id
)
update public.financeiro_lancamentos l
   set recorrencia_id = r.recorrencia_id,
       atualizado_em = now()
  from removidos r
 where l.id = r.manter_id;

create unique index if not exists financeiro_recorrencia_vencimento_uidx
  on public.financeiro_lancamentos(recorrencia_id, vencimento)
  where recorrencia_id is not null;

create or replace function public.excluir_parcelas_canceladas_contrato(p_contrato_id uuid)
returns table(lancamentos_excluidos bigint, parcelas_excluidas bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lancamentos bigint := 0;
  v_parcelas bigint := 0;
  v_numero text;
  v_usuario text;
begin
  if (select auth.uid()) is null
     or not (select private.crm_tem_permissao('contratosExcluir'))
     or not (select private.crm_tem_permissao('financeiroExcluir')) then
    raise exception 'É necessário ter permissão para excluir contratos e lançamentos financeiros' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_contrato_id::text));
  select numero into v_numero from public.contratos
   where id = p_contrato_id and status = 'Cancelado' for update;
  if not found then raise exception 'Somente contratos cancelados podem ter parcelas excluídas'; end if;

  if exists (
    select 1 from public.financeiro_lancamentos l
     where l.contrato_id = p_contrato_id
       and (l.valor_pago > 0 or l.status = 'Pago'
            or exists (select 1 from public.financeiro_pagamentos p where p.lancamento_id = l.id))
  ) then
    raise exception 'O contrato possui pagamento registrado. As parcelas pagas devem permanecer no histórico.';
  end if;

  delete from public.financeiro_lancamentos
   where contrato_id = p_contrato_id
     and valor_pago = 0
     and status in ('Pendente', 'Cancelado');
  get diagnostics v_lancamentos = row_count;

  delete from public.contrato_parcelas
   where contrato_id = p_contrato_id
     and valor_pago = 0
     and status in ('Pendente', 'Cancelado');
  get diagnostics v_parcelas = row_count;

  select coalesce(nome,email) into v_usuario
    from public.perfis_usuarios where user_id = (select auth.uid());
  insert into public.contrato_historico(contrato_id,acao,descricao,usuario_id,usuario_nome)
  values (p_contrato_id, 'Parcelas excluídas',
          v_lancamentos || ' lançamento(s) e ' || v_parcelas || ' parcela(s) sem pagamento removidos',
          (select auth.uid()), coalesce(v_usuario, 'Usuário'));

  return query select v_lancamentos, v_parcelas;
end;
$$;

revoke execute on function public.excluir_parcelas_canceladas_contrato(uuid) from public, anon;
grant execute on function public.excluir_parcelas_canceladas_contrato(uuid) to authenticated;
