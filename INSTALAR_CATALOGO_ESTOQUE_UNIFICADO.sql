begin;

alter table public.catalogo_itens
  add column if not exists controla_estoque boolean not null default false;

alter table public.estoque_itens
  add column if not exists catalogo_item_id bigint;

-- Todo item que já existia somente no estoque passa a existir no cadastro único.
insert into public.catalogo_itens
  (tipo, codigo, descricao, categoria, unidade, custo, preco_venda, observacoes, ativo, criado_por, criado_em, atualizado_em, controla_estoque)
select
  'Produto', e.codigo, e.descricao, e.categoria, e.unidade,
  e.custo_medio, e.preco_venda, '', e.ativo, e.criado_por, e.criado_em, e.atualizado_em, true
from public.estoque_itens e
where not exists (
  select 1 from public.catalogo_itens c where upper(trim(c.codigo)) = upper(trim(e.codigo))
);

-- Se havia um código tanto no catálogo quanto no estoque, ele representa um produto físico.
update public.catalogo_itens c
set tipo = 'Produto', controla_estoque = true, atualizado_em = now()
where exists (
  select 1 from public.estoque_itens e where upper(trim(e.codigo)) = upper(trim(c.codigo))
);

update public.estoque_itens e
set catalogo_item_id = c.id
from public.catalogo_itens c
where e.catalogo_item_id is null
  and upper(trim(e.codigo)) = upper(trim(c.codigo));

do $$ begin
  alter table public.estoque_itens
    add constraint estoque_itens_catalogo_item_id_fkey
    foreign key (catalogo_item_id) references public.catalogo_itens(id) on delete restrict;
exception when duplicate_object then null; end $$;

create unique index if not exists estoque_itens_catalogo_item_id_uidx
  on public.estoque_itens(catalogo_item_id)
  where catalogo_item_id is not null;

create index if not exists estoque_itens_ativo_catalogo_idx
  on public.estoque_itens(ativo, catalogo_item_id);

create or replace function public.sincronizar_catalogo_no_estoque()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.estoque_itens
     set codigo = new.codigo,
         descricao = new.descricao,
         categoria = new.categoria,
         unidade = new.unidade,
         custo_medio = new.custo,
         preco_venda = new.preco_venda,
         ativo = new.ativo and new.tipo = 'Produto' and new.controla_estoque,
         atualizado_em = now()
   where catalogo_item_id = new.id;
  return new;
end;
$$;

drop trigger if exists catalogo_sincronizar_estoque on public.catalogo_itens;
create trigger catalogo_sincronizar_estoque
after update of codigo, descricao, categoria, unidade, custo, preco_venda, ativo, tipo, controla_estoque
on public.catalogo_itens
for each row execute function public.sincronizar_catalogo_no_estoque();

create or replace function public.salvar_catalogo_com_estoque(
  p_id bigint,
  p_tipo text,
  p_codigo text,
  p_descricao text,
  p_categoria text,
  p_unidade text,
  p_custo numeric,
  p_preco_venda numeric,
  p_observacoes text,
  p_ativo boolean,
  p_controla_estoque boolean,
  p_estoque_inicial numeric,
  p_estoque_minimo numeric
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
  v_estoque_id bigint;
  v_controla boolean := p_tipo = 'Produto' and coalesce(p_controla_estoque, false);
begin
  if (select auth.uid()) is null or not (
    private.crm_tem_permissao('crm') or
    private.crm_tem_permissao('osCriar') or
    private.crm_tem_permissao('osEditar')
  ) then
    raise exception 'Você não possui permissão para alterar produtos e estoque.' using errcode = '42501';
  end if;

  if p_tipo not in ('Produto', 'Serviço') then
    raise exception 'Tipo de cadastro inválido.';
  end if;
  if nullif(trim(p_codigo), '') is null or nullif(trim(p_descricao), '') is null then
    raise exception 'Informe o código e a descrição.';
  end if;
  if coalesce(p_custo, 0) < 0 or coalesce(p_preco_venda, 0) < 0 or
     coalesce(p_estoque_inicial, 0) < 0 or coalesce(p_estoque_minimo, 0) < 0 then
    raise exception 'Valores e quantidades não podem ser negativos.';
  end if;

  if p_id is null then
    insert into public.catalogo_itens
      (tipo, codigo, descricao, categoria, unidade, custo, preco_venda, observacoes, ativo, controla_estoque, criado_por)
    values
      (p_tipo, upper(trim(p_codigo)), trim(p_descricao), coalesce(trim(p_categoria), ''),
       coalesce(nullif(upper(trim(p_unidade)), ''), 'UN'), coalesce(p_custo, 0),
       coalesce(p_preco_venda, 0), coalesce(trim(p_observacoes), ''), coalesce(p_ativo, true),
       v_controla, (select auth.uid()))
    returning id into v_id;
  else
    update public.catalogo_itens
       set tipo = p_tipo,
           codigo = upper(trim(p_codigo)),
           descricao = trim(p_descricao),
           categoria = coalesce(trim(p_categoria), ''),
           unidade = coalesce(nullif(upper(trim(p_unidade)), ''), 'UN'),
           custo = coalesce(p_custo, 0),
           preco_venda = coalesce(p_preco_venda, 0),
           observacoes = coalesce(trim(p_observacoes), ''),
           ativo = coalesce(p_ativo, true),
           controla_estoque = v_controla,
           atualizado_em = now()
     where id = p_id
     returning id into v_id;
    if v_id is null then raise exception 'Cadastro não encontrado ou sem permissão.'; end if;
  end if;

  select id into v_estoque_id
  from public.estoque_itens
  where catalogo_item_id = v_id;

  if v_controla then
    if v_estoque_id is null then
      insert into public.estoque_itens
        (catalogo_item_id, codigo, descricao, categoria, unidade, quantidade, estoque_minimo,
         custo_medio, preco_venda, ativo, criado_por)
      select id, codigo, descricao, categoria, unidade, 0, coalesce(p_estoque_minimo, 0),
             custo, preco_venda, ativo, (select auth.uid())
      from public.catalogo_itens where id = v_id
      returning id into v_estoque_id;

      if coalesce(p_estoque_inicial, 0) > 0 then
        insert into public.estoque_movimentos
          (item_id, direcao, quantidade, custo_unitario, motivo, criado_por)
        values
          (v_estoque_id, 'Entrada', p_estoque_inicial, coalesce(p_custo, 0),
           'Saldo inicial do cadastro do produto', (select auth.uid()));
      end if;
    else
      update public.estoque_itens
         set estoque_minimo = coalesce(p_estoque_minimo, 0),
             ativo = coalesce(p_ativo, true),
             atualizado_em = now()
       where id = v_estoque_id;
    end if;
  elsif v_estoque_id is not null then
    update public.estoque_itens set ativo = false, atualizado_em = now() where id = v_estoque_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.salvar_catalogo_com_estoque(bigint,text,text,text,text,text,numeric,numeric,text,boolean,boolean,numeric,numeric) from public, anon;
grant execute on function public.salvar_catalogo_com_estoque(bigint,text,text,text,text,text,numeric,numeric,text,boolean,boolean,numeric,numeric) to authenticated;
revoke execute on function public.sincronizar_catalogo_no_estoque() from public, anon, authenticated;

grant select, insert, update on public.estoque_itens, public.estoque_movimentos to authenticated;

commit;
