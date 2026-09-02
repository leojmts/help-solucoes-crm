-- Restaura as receitas recorrentes importadas em setembro e impede duplicidade
-- por cliente, tipo e valor. O salvamento recorrente passa a ser transacional.

do $$
declare
  v record;
  v_cliente_id bigint;
  v_recorrencia_id bigint;
  v_lancamento_id bigint;
begin
  for v in
    select * from (values
      ('ROTA MS', 245.00::numeric, date '2026-09-05'),
      ('MERCADO SANTA TEREZINHA', 382.90::numeric, date '2026-09-10'),
      ('NELSON MOTOS', 300.00::numeric, date '2026-09-10'),
      ('Hp Eletrica Automotiva E Industrial', 150.00::numeric, date '2026-09-10'),
      ('JOTA BIKES', 240.00::numeric, date '2026-09-10'),
      ('Studio Films', 80.00::numeric, date '2026-09-10'),
      ('CONVENIENCIA BICHO BEBE', 240.00::numeric, date '2026-09-10'),
      ('GRANJA RANCHO DO VALE', 160.00::numeric, date '2026-09-10'),
      ('STEAK HOUSE', 240.00::numeric, date '2026-09-10'),
      ('AM RETIFICA SALAZAR', 182.90::numeric, date '2026-09-10'),
      ('O POINT CONVENIENCIA', 200.00::numeric, date '2026-09-10'),
      ('HOTEL BRASIL', 285.00::numeric, date '2026-09-10'),
      ('JI Transporte De Bovinos', 180.00::numeric, date '2026-09-10'),
      ('AUTO ELETRICA GF', 240.00::numeric, date '2026-09-10'),
      ('MZ TORNEARIA MECANICA', 245.00::numeric, date '2026-09-10'),
      ('LOJA ECONOMICA', 295.00::numeric, date '2026-09-10'),
      ('CORDIL CONVENIENCIAS', 220.00::numeric, date '2026-09-10'),
      ('CORDIL CENTRAL', 220.00::numeric, date '2026-09-10'),
      ('MERCEARIA SÃO FRANCISCO', 245.00::numeric, date '2026-09-10'),
      ('PERFUMARIA IARA IMPORTADOS', 245.00::numeric, date '2026-09-10')
    ) as receitas(nome, valor, vencimento)
  loop
    select c.id into v_cliente_id
      from public.clientes c
     where lower(btrim(c.nome)) = lower(btrim(v.nome))
     order by c.id
     limit 1;

    if v_cliente_id is null then
      raise exception 'Cliente não encontrado para a receita recorrente: %', v.nome;
    end if;

    select r.id into v_recorrencia_id
      from public.financeiro_recorrencias r
     where r.tipo = 'Receber'
       and r.ativa
       and r.cancelada_em is null
       and r.valor = v.valor
       and (r.cliente_id = v_cliente_id
            or (r.cliente_id is null and lower(btrim(r.descricao)) = lower(btrim(v.nome))))
     order by r.id
     limit 1
     for update;

    if v_recorrencia_id is null then
      insert into public.financeiro_recorrencias(
        tipo, descricao, categoria, cliente_id, valor, dia_vencimento,
        inicio, forma_pagamento, observacoes, ativa
      ) values (
        'Receber', v.nome, 'Serviços', v_cliente_id, v.valor,
        extract(day from v.vencimento)::integer, v.vencimento, 'PIX', '', true
      ) returning id into v_recorrencia_id;
    else
      update public.financeiro_recorrencias
         set cliente_id = v_cliente_id,
             descricao = v.nome,
             categoria = 'Serviços',
             valor = v.valor,
             dia_vencimento = extract(day from v.vencimento)::integer,
             inicio = v.vencimento,
             forma_pagamento = 'PIX',
             ativa = true,
             cancelada_em = null,
             cancelado_por = null,
             atualizado_em = now()
       where id = v_recorrencia_id;
    end if;

    select l.id into v_lancamento_id
      from public.financeiro_lancamentos l
     where lower(btrim(l.descricao)) = lower(btrim(v.nome))
       and l.vencimento = v.vencimento
       and l.status = 'Pendente'
       and l.valor_pago = 0
     order by l.id
     limit 1
     for update;

    if v_lancamento_id is null then
      insert into public.financeiro_lancamentos(
        tipo, descricao, categoria, cliente_id, valor, vencimento,
        status, forma_pagamento, observacoes, recorrencia_id
      ) values (
        'Receber', v.nome, 'Serviços', v_cliente_id, v.valor, v.vencimento,
        'Pendente', 'PIX', '', v_recorrencia_id
      ) returning id into v_lancamento_id;
    else
      update public.financeiro_lancamentos
         set tipo = 'Receber',
             descricao = v.nome,
             categoria = 'Serviços',
             cliente_id = v_cliente_id,
             valor = v.valor,
             forma_pagamento = 'PIX',
             recorrencia_id = v_recorrencia_id,
             atualizado_em = now()
       where id = v_lancamento_id;
    end if;

    update public.financeiro_lancamentos
       set cliente_id = v_cliente_id,
           descricao = v.nome,
           categoria = 'Serviços',
           valor = v.valor,
           forma_pagamento = 'PIX',
           atualizado_em = now()
     where recorrencia_id = v_recorrencia_id
       and status = 'Pendente'
       and valor_pago = 0;
  end loop;
end $$;

create unique index if not exists financeiro_recorrencia_cliente_tipo_valor_uidx
  on public.financeiro_recorrencias(cliente_id, tipo, valor)
  where cliente_id is not null and ativa and cancelada_em is null;

create or replace function public.salvar_financeiro_recorrente(
  p_tipo text,
  p_descricao text,
  p_categoria text,
  p_cliente_id bigint,
  p_fornecedor_id bigint,
  p_valor numeric,
  p_vencimento date,
  p_forma_pagamento text,
  p_observacoes text,
  p_dia_vencimento integer,
  p_fim date default null
)
returns table(recorrencia_id bigint, lancamento_id bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_recorrencia_id bigint;
  v_lancamento_id bigint;
  v_existente bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'É necessário entrar no sistema para criar recorrências.' using errcode = '42501';
  end if;

  if btrim(coalesce(p_descricao, '')) = '' or p_valor <= 0 or p_vencimento is null then
    raise exception 'Preencha descrição, valor e vencimento.' using errcode = '22023';
  end if;

  if p_tipo not in ('Receber', 'Pagar') then
    raise exception 'Tipo financeiro inválido.' using errcode = '22023';
  end if;

  if p_cliente_id is not null then
    select r.id into v_existente
      from public.financeiro_recorrencias r
     where r.cliente_id = p_cliente_id
       and r.tipo = p_tipo
       and r.valor = p_valor
       and r.ativa
       and r.cancelada_em is null
     limit 1;
  else
    select r.id into v_existente
      from public.financeiro_recorrencias r
     where r.cliente_id is null
       and r.fornecedor_id is not distinct from p_fornecedor_id
       and r.tipo = p_tipo
       and r.valor = p_valor
       and lower(btrim(r.descricao)) = lower(btrim(p_descricao))
       and r.ativa
       and r.cancelada_em is null
     limit 1;
  end if;

  if v_existente is not null then
    raise exception 'Já existe uma recorrência ativa para esta pessoa, tipo e valor.' using errcode = '23505';
  end if;

  insert into public.financeiro_recorrencias(
    tipo, descricao, categoria, cliente_id, fornecedor_id, valor,
    dia_vencimento, inicio, fim, forma_pagamento, observacoes, criado_por
  ) values (
    p_tipo, btrim(p_descricao), coalesce(nullif(btrim(p_categoria), ''), 'Outros'),
    p_cliente_id, p_fornecedor_id, p_valor,
    least(28, greatest(1, p_dia_vencimento)), p_vencimento, p_fim,
    coalesce(p_forma_pagamento, ''), coalesce(p_observacoes, ''), (select auth.uid())
  ) returning id into v_recorrencia_id;

  insert into public.financeiro_lancamentos(
    tipo, descricao, categoria, cliente_id, fornecedor_id, valor,
    vencimento, status, forma_pagamento, observacoes, recorrencia_id, criado_por
  ) values (
    p_tipo, btrim(p_descricao), coalesce(nullif(btrim(p_categoria), ''), 'Outros'),
    p_cliente_id, p_fornecedor_id, p_valor,
    p_vencimento, 'Pendente', coalesce(p_forma_pagamento, ''),
    coalesce(p_observacoes, ''), v_recorrencia_id, (select auth.uid())
  ) returning id into v_lancamento_id;

  return query select v_recorrencia_id, v_lancamento_id;
end;
$$;

revoke all on function public.salvar_financeiro_recorrente(text,text,text,bigint,bigint,numeric,date,text,text,integer,date) from public, anon;
grant execute on function public.salvar_financeiro_recorrente(text,text,text,bigint,bigint,numeric,date,text,text,integer,date) to authenticated;
