begin;

alter table public.financeiro_lancamentos
  drop constraint if exists financeiro_parcelas_check;

alter table public.financeiro_lancamentos
  add constraint financeiro_parcelas_check check (
    (grupo_parcelamento is null and parcela_numero is null and parcelas_total is null)
    or (
      parcela_numero >= 1
      and parcela_numero <= parcelas_total
      and parcelas_total between 2 and 240
    )
  );

create or replace function public.sincronizar_parcelas_contrato(p_contrato_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contratos%rowtype;
  p_id uuid;
  i integer;
  v_data date;
  v_tipo text;
  v_total integer := 0;
  v_passo integer;
  v_parte_nome text;
begin
  if (select auth.uid()) is null or not (
    (select private.crm_tem_permissao('contratosCriar'))
    or (select private.crm_tem_permissao('contratosEditar'))
  ) then raise exception 'Sem permissão para gerar parcelas do contrato'; end if;

  perform pg_advisory_xact_lock(hashtext(p_contrato_id::text));
  select * into c from public.contratos where id = p_contrato_id for update;
  if not found then raise exception 'Contrato não encontrado'; end if;
  if c.status in ('Rascunho','Cancelado','Encerrado','Renovado') then return 0; end if;

  if c.parte_tipo = 'Cliente' then
    select nome into v_parte_nome from public.clientes where id = c.cliente_id;
    v_tipo := 'Receber';
  else
    select nome into v_parte_nome from public.financeiro_fornecedores where id = c.fornecedor_id;
    v_tipo := 'Pagar';
  end if;

  if c.gerar_cobranca_inicial and c.valor_inicial > 0 then
    insert into public.contrato_parcelas(contrato_id,tipo,numero,vencimento,valor)
    values(c.id,'Inicial',0,coalesce(c.vencimento_valor_inicial,c.inicio),c.valor_inicial)
    on conflict(contrato_id,tipo,numero) do update set
      vencimento=excluded.vencimento, valor=excluded.valor, atualizado_em=now()
    where public.contrato_parcelas.valor_pago = 0 and public.contrato_parcelas.status = 'Pendente'
    returning id into p_id;

    if p_id is null then select id into p_id from public.contrato_parcelas where contrato_id=c.id and tipo='Inicial' and numero=0; end if;
    insert into public.financeiro_lancamentos(tipo,descricao,categoria,valor,vencimento,status,forma_pagamento,observacoes,criado_por,contrato_id,contrato_parcela_id)
    values(v_tipo,'Contrato '||c.numero||' - '||v_parte_nome||' - valores iniciais','Contratos',c.valor_inicial,coalesce(c.vencimento_valor_inicial,c.inicio),'Pendente',c.forma_pagamento,c.observacoes_comerciais,(select auth.uid()),c.id,p_id)
    on conflict(contrato_parcela_id) where contrato_parcela_id is not null do update set
      descricao=excluded.descricao, valor=excluded.valor, vencimento=excluded.vencimento,
      forma_pagamento=excluded.forma_pagamento, atualizado_em=now()
    where public.financeiro_lancamentos.valor_pago = 0 and public.financeiro_lancamentos.status = 'Pendente';
    v_total := v_total + 1;
  end if;

  v_passo := private.contrato_periodicidade_meses(c.periodicidade);
  for i in 1..c.quantidade_parcelas loop
    v_data := (c.primeira_mensalidade + make_interval(months => (i-1)*v_passo))::date;
    insert into public.contrato_parcelas(contrato_id,tipo,numero,vencimento,valor)
    values(c.id,'Mensalidade',i,v_data,c.valor_mensal)
    on conflict(contrato_id,tipo,numero) do update set
      vencimento=excluded.vencimento, valor=excluded.valor, atualizado_em=now()
    where public.contrato_parcelas.valor_pago = 0 and public.contrato_parcelas.status = 'Pendente'
    returning id into p_id;

    if p_id is null then select id into p_id from public.contrato_parcelas where contrato_id=c.id and tipo='Mensalidade' and numero=i; end if;
    insert into public.financeiro_lancamentos(tipo,descricao,categoria,valor,vencimento,status,forma_pagamento,observacoes,criado_por,contrato_id,contrato_parcela_id,parcela_numero,parcelas_total)
    values(v_tipo,'Contrato '||c.numero||' - '||v_parte_nome||case when c.quantidade_parcelas=1 then ' - cobrança única' else ' - mensalidade '||i||'/'||c.quantidade_parcelas end,'Contratos',c.valor_mensal,v_data,'Pendente',c.forma_pagamento,c.observacoes_comerciais,(select auth.uid()),c.id,p_id,case when c.quantidade_parcelas=1 then null else i end,case when c.quantidade_parcelas=1 then null else c.quantidade_parcelas end)
    on conflict(contrato_parcela_id) where contrato_parcela_id is not null do update set
      descricao=excluded.descricao, valor=excluded.valor, vencimento=excluded.vencimento,
      forma_pagamento=excluded.forma_pagamento, parcela_numero=excluded.parcela_numero,
      parcelas_total=excluded.parcelas_total, atualizado_em=now()
    where public.financeiro_lancamentos.valor_pago = 0 and public.financeiro_lancamentos.status = 'Pendente';
    v_total := v_total + 1;
  end loop;

  update public.financeiro_lancamentos l set status='Cancelado', atualizado_em=now()
  from public.contrato_parcelas p
  where l.contrato_parcela_id=p.id and p.contrato_id=c.id and p.tipo='Mensalidade'
    and p.numero>c.quantidade_parcelas and l.status='Pendente' and l.valor_pago=0;

  insert into public.contrato_historico(contrato_id,acao,descricao,usuario_id,usuario_nome)
  select c.id,'Parcelas sincronizadas',v_total||' cobrança(s) vinculada(s) ao Financeiro',p.user_id,coalesce(nullif(p.nome,''),split_part(p.email,'@',1),'Usuário')
  from public.perfis_usuarios p where p.user_id=(select auth.uid());
  return v_total;
end $$;

commit;
