-- Gestão de Contratos integrada ao Financeiro - Help Soluções Tecnológicas
-- Estrutura normalizada, RLS por ação e geração segura de parcelas.

create schema if not exists private;
create sequence if not exists public.contratos_numero_seq;

alter table public.clientes add column if not exists endereco text not null default '';
alter table public.clientes add column if not exists cidade text not null default '';
alter table public.clientes add column if not exists uf text not null default 'MS';
alter table public.clientes add column if not exists cep text not null default '';
alter table public.clientes add column if not exists representante text not null default '';
alter table public.clientes add column if not exists representante_cpf text not null default '';

alter table public.financeiro_fornecedores add column if not exists endereco text not null default '';
alter table public.financeiro_fornecedores add column if not exists cidade text not null default '';
alter table public.financeiro_fornecedores add column if not exists uf text not null default 'MS';
alter table public.financeiro_fornecedores add column if not exists cep text not null default '';
alter table public.financeiro_fornecedores add column if not exists telefone text not null default '';
alter table public.financeiro_fornecedores add column if not exists email text not null default '';
alter table public.financeiro_fornecedores add column if not exists representante text not null default '';
alter table public.financeiro_fornecedores add column if not exists representante_cpf text not null default '';

create table if not exists public.configuracoes_empresa (
  id boolean primary key default true check (id),
  razao_social text not null,
  nome_fantasia text not null default '',
  cnpj text not null,
  inscricao_estadual text not null default '',
  endereco text not null,
  cidade text not null,
  uf text not null,
  cep text not null default '',
  telefone text not null default '',
  email text not null default '',
  representante_legal text not null default '',
  representante_cpf text not null default '',
  foro_cidade text not null default 'Jardim',
  foro_uf text not null default 'MS',
  pix text not null default '',
  atualizado_por uuid references auth.users(id),
  atualizado_em timestamptz not null default now()
);

insert into public.configuracoes_empresa (
  id, razao_social, nome_fantasia, cnpj, inscricao_estadual, endereco,
  cidade, uf, telefone, email, foro_cidade, foro_uf
) values (
  true, 'HELP SOLUÇÕES TECNOLÓGICAS LTDA', 'Help Soluções Tecnológicas',
  '44.237.471/0001-93', '284.723.169', 'Av. Duque de Caxias, 536, Sala A, Centro',
  'Jardim', 'MS', '(67) 99891-0924', 'financeiro@helpsolucoestecnologicas.com.br',
  'Jardim', 'MS'
) on conflict (id) do nothing;

create table if not exists public.contrato_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  titulo text not null,
  clausulas jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

insert into public.contrato_modelos (nome, titulo, clausulas)
values (
  'Locação de software - padrão Help',
  'CONTRATO DE LOCAÇÃO DE SOFTWARE',
  jsonb_build_object(
    'objeto', jsonb_build_array(
      'Pelo presente contrato, a CONTRATADA compromete-se a fornecer à CONTRATANTE a locação das licenças de uso dos sistemas descritos neste instrumento, incluindo os serviços expressamente contratados, manutenção corretiva e suporte técnico nos limites aqui estabelecidos.'
    ),
    'pagamentos', jsonb_build_array(
      'O pagamento somente será considerado válido após a compensação por meio autorizado e em conta de titularidade da CONTRATADA.',
      'Caso a CONTRATANTE não receba o documento de cobrança até cinco dias antes do vencimento, deverá solicitar nova via à CONTRATADA.',
      'As obrigações financeiras permanecem devidas durante a vigência do contrato, independentemente do uso efetivo dos sistemas.'
    ),
    'obrigacoes', jsonb_build_array(
      'Prestar suporte aos usuários indicados pela CONTRATANTE, em horário comercial, por acesso remoto ou pelas ferramentas disponibilizadas pela CONTRATADA.',
      'Realizar as manutenções e atualizações dos sistemas que julgar necessárias para sua continuidade e segurança.',
      'Informar previamente quando serviços solicitados não estiverem abrangidos pelo objeto contratado e dependerem de orçamento adicional.',
      'A CONTRATANTE é responsável por manter cópias de segurança de seus dados, salvo quando houver serviço de backup expressamente incluído no objeto deste contrato.'
    ),
    'condicoes_gerais', jsonb_build_array(
      'A CONTRATADA não responderá por danos decorrentes do uso indevido dos sistemas, falhas de equipamentos, rede, energia, serviços de terceiros ou descumprimento das orientações técnicas.',
      'A eventual tolerância de uma parte quanto ao descumprimento de obrigação não importará novação, renúncia ou alteração contratual.',
      'Alterações deste instrumento somente terão validade quando registradas por escrito e aceitas pelas partes.'
    ),
    'perdas_danos', jsonb_build_array(
      'A parte que infringir as cláusulas deste contrato ou direitos autorais e de propriedade intelectual responderá pelas perdas e danos comprovadamente causados, sem prejuízo das demais medidas cabíveis.'
    ),
    'declaracao_final', 'As partes declaram ter lido e compreendido todas as condições deste instrumento e, por estarem de pleno acordo, assinam o presente contrato em vias de igual teor, juntamente com as testemunhas, quando aplicável.'
  )
) on conflict (nome) do nothing;

create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default (
    'CT-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.contratos_numero_seq')::text, 5, '0')
  ),
  modelo_id uuid not null references public.contrato_modelos(id) on delete restrict,
  parte_tipo text not null check (parte_tipo in ('Cliente','Fornecedor')),
  cliente_id bigint references public.clientes(id) on delete restrict,
  fornecedor_id bigint references public.financeiro_fornecedores(id) on delete restrict,
  tipo_contrato text not null default 'Locação de software',
  objeto text not null,
  sistemas_contratados text not null default '',
  servicos_contratados text not null default '',
  implantacao_valor numeric(12,2) not null default 0 check (implantacao_valor >= 0),
  equipamentos_descricao text not null default '',
  equipamentos_valor numeric(12,2) not null default 0 check (equipamentos_valor >= 0),
  outros_valores_descricao text not null default '',
  outros_valores numeric(12,2) not null default 0 check (outros_valores >= 0),
  valor_inicial numeric(12,2) not null default 0 check (valor_inicial >= 0),
  gerar_cobranca_inicial boolean not null default true,
  vencimento_valor_inicial date,
  observacoes_comerciais text not null default '',
  valor_mensal numeric(12,2) not null check (valor_mensal >= 0),
  inicio date not null,
  data_instalacao date,
  duracao_meses integer not null check (duracao_meses between 1 and 120),
  quantidade_parcelas integer not null check (quantidade_parcelas between 1 and 240),
  primeira_mensalidade date not null,
  dia_vencimento integer not null check (dia_vencimento between 1 and 31),
  periodicidade text not null default 'Mensal' check (periodicidade in ('Mensal','Bimestral','Trimestral','Semestral','Anual')),
  forma_pagamento text not null,
  formas_validas_pagamento text not null default 'PIX ou boleto bancário',
  responsavel_id uuid not null references public.perfis_usuarios(user_id) on delete restrict,
  representante_comercial text not null default '',
  auto_renovacao boolean not null default true,
  aviso_previo_dias integer not null default 30 check (aviso_previo_dias between 0 and 365),
  multa_rescisoria_percentual numeric(6,3) not null default 30 check (multa_rescisoria_percentual between 0 and 100),
  multa_atraso_percentual numeric(6,3) not null default 2 check (multa_atraso_percentual between 0 and 100),
  juros_dia_percentual numeric(6,3) not null default 0.033 check (juros_dia_percentual between 0 and 100),
  bloqueio_dias integer not null default 3 check (bloqueio_dias between 0 and 365),
  rescisao_inadimplencia_dias integer not null default 30 check (rescisao_inadimplencia_dias between 1 and 730),
  taxa_reativacao numeric(12,2) not null default 0 check (taxa_reativacao >= 0),
  indice_reajuste text not null default 'IGP-M',
  observacoes text not null default '',
  cidade_assinatura text not null default 'Jardim',
  data_assinatura date not null default current_date,
  testemunha_1_nome text not null default '',
  testemunha_1_cpf text not null default '',
  testemunha_2_nome text not null default '',
  testemunha_2_cpf text not null default '',
  status text not null default 'Rascunho' check (status in ('Rascunho','Ativo','Vencendo','Vencido','Cancelado','Encerrado','Renovado')),
  renovado_de_id uuid references public.contratos(id) on delete set null,
  motivo_cancelamento text,
  cancelado_em timestamptz,
  cancelado_por uuid references auth.users(id),
  encerrado_em timestamptz,
  criado_por uuid not null default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint contratos_parte_exclusiva check (
    (parte_tipo = 'Cliente' and cliente_id is not null and fornecedor_id is null)
    or (parte_tipo = 'Fornecedor' and fornecedor_id is not null and cliente_id is null)
  )
);

create table if not exists public.contrato_parcelas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete restrict,
  tipo text not null default 'Mensalidade' check (tipo in ('Inicial','Mensalidade')),
  numero integer not null check (numero between 0 and 240),
  vencimento date not null,
  valor numeric(12,2) not null check (valor > 0),
  status text not null default 'Pendente' check (status in ('Pendente','Pago','Cancelado')),
  valor_pago numeric(12,2) not null default 0 check (valor_pago >= 0),
  pago_em date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (contrato_id, tipo, numero)
);

alter table public.financeiro_lancamentos add column if not exists contrato_id uuid references public.contratos(id) on delete restrict;
alter table public.financeiro_lancamentos add column if not exists contrato_parcela_id uuid references public.contrato_parcelas(id) on delete restrict;
create unique index if not exists financeiro_lancamentos_contrato_parcela_uidx
  on public.financeiro_lancamentos (contrato_parcela_id) where contrato_parcela_id is not null;

create table if not exists public.contrato_documentos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  versao integer not null check (versao > 0),
  nome_arquivo text not null,
  caminho_storage text not null unique,
  tamanho_bytes bigint not null default 0 check (tamanho_bytes between 0 and 20971520),
  hash_sha256 text not null default '',
  dados_snapshot jsonb not null,
  gerado_por uuid not null default auth.uid() references auth.users(id),
  gerado_em timestamptz not null default now(),
  unique (contrato_id, versao)
);

create table if not exists public.contrato_anexos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  nome_arquivo text not null,
  caminho_storage text not null unique,
  tipo_mime text not null default 'application/octet-stream',
  tamanho_bytes bigint not null default 0 check (tamanho_bytes between 0 and 20971520),
  criado_por uuid not null default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now()
);

create table if not exists public.contrato_historico (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  acao text not null,
  descricao text not null default '',
  usuario_id uuid not null default auth.uid() references auth.users(id),
  usuario_nome text not null default '',
  criado_em timestamptz not null default now()
);

create index if not exists contratos_cliente_id_idx on public.contratos(cliente_id) where cliente_id is not null;
create index if not exists contratos_fornecedor_id_idx on public.contratos(fornecedor_id) where fornecedor_id is not null;
create index if not exists contratos_modelo_id_idx on public.contratos(modelo_id);
create index if not exists contratos_responsavel_id_idx on public.contratos(responsavel_id);
create index if not exists contratos_criado_por_idx on public.contratos(criado_por);
create index if not exists contratos_cancelado_por_idx on public.contratos(cancelado_por) where cancelado_por is not null;
create index if not exists contratos_renovado_de_id_idx on public.contratos(renovado_de_id) where renovado_de_id is not null;
create index if not exists contratos_status_inicio_idx on public.contratos(status, inicio);
create index if not exists contratos_ativos_vencimento_idx on public.contratos((inicio + make_interval(months => duracao_meses))) where status in ('Ativo','Vencendo');
create index if not exists contrato_parcelas_contrato_vencimento_idx on public.contrato_parcelas(contrato_id, vencimento);
create index if not exists contrato_parcelas_pendentes_idx on public.contrato_parcelas(vencimento) where status = 'Pendente';
create index if not exists financeiro_lancamentos_contrato_id_idx on public.financeiro_lancamentos(contrato_id) where contrato_id is not null;
create index if not exists contrato_documentos_contrato_idx on public.contrato_documentos(contrato_id, versao desc);
create index if not exists contrato_documentos_gerado_por_idx on public.contrato_documentos(gerado_por);
create index if not exists contrato_anexos_contrato_idx on public.contrato_anexos(contrato_id);
create index if not exists contrato_anexos_criado_por_idx on public.contrato_anexos(criado_por);
create index if not exists contrato_historico_contrato_idx on public.contrato_historico(contrato_id, criado_em desc);
create index if not exists contrato_historico_usuario_id_idx on public.contrato_historico(usuario_id);
create index if not exists contrato_modelos_criado_por_idx on public.contrato_modelos(criado_por) where criado_por is not null;
create index if not exists configuracoes_empresa_atualizado_por_idx on public.configuracoes_empresa(atualizado_por) where atualizado_por is not null;

create or replace function private.contratos_touch_atualizado()
returns trigger language plpgsql set search_path = '' as $$
begin new.atualizado_em = now(); return new; end $$;

drop trigger if exists contratos_touch_atualizado on public.contratos;
create trigger contratos_touch_atualizado before update on public.contratos
for each row execute function private.contratos_touch_atualizado();

drop trigger if exists contrato_modelos_touch_atualizado on public.contrato_modelos;
create trigger contrato_modelos_touch_atualizado before update on public.contrato_modelos
for each row execute function private.contratos_touch_atualizado();

create or replace function private.contrato_periodicidade_meses(p_periodicidade text)
returns integer language sql immutable set search_path = '' as $$
  select case p_periodicidade when 'Bimestral' then 2 when 'Trimestral' then 3 when 'Semestral' then 6 when 'Anual' then 12 else 1 end
$$;

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
    values(v_tipo,'Contrato '||c.numero||' - '||v_parte_nome||' - mensalidade '||i||'/'||c.quantidade_parcelas,'Contratos',c.valor_mensal,v_data,'Pendente',c.forma_pagamento,c.observacoes_comerciais,(select auth.uid()),c.id,p_id,i,c.quantidade_parcelas)
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
  select c.id,'Parcelas sincronizadas',v_total||' cobrança(s) vinculada(s) ao Financeiro',p.user_id,coalesce(p.nome,p.email)
  from public.perfis_usuarios p where p.user_id=(select auth.uid());
  return v_total;
end $$;

create or replace function public.ativar_contrato(p_contrato_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_total integer; v_nome text;
begin
  if (select auth.uid()) is null or not (select private.crm_tem_permissao('contratosEditar')) then raise exception 'Sem permissão para ativar contratos'; end if;
  update public.contratos set status='Ativo' where id=p_contrato_id and status='Rascunho';
  if not found then raise exception 'Somente contratos em rascunho podem ser ativados'; end if;
  select public.sincronizar_parcelas_contrato(p_contrato_id) into v_total;
  select coalesce(nome,email) into v_nome from public.perfis_usuarios where user_id=(select auth.uid());
  insert into public.contrato_historico(contrato_id,acao,descricao,usuario_id,usuario_nome)
  values(p_contrato_id,'Contrato ativado',v_total||' cobrança(s) gerada(s)',(select auth.uid()),coalesce(v_nome,'Usuário'));
  return v_total;
end $$;

create or replace function private.contrato_refletir_lancamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.contrato_parcela_id is not null then
    update public.contrato_parcelas set
      status=new.status, valor_pago=new.valor_pago, pago_em=new.pago_em, atualizado_em=now()
    where id=new.contrato_parcela_id;
  end if;
  return new;
end $$;

drop trigger if exists contrato_refletir_lancamento on public.financeiro_lancamentos;
create trigger contrato_refletir_lancamento after insert or update of status,valor_pago,pago_em
on public.financeiro_lancamentos for each row execute function private.contrato_refletir_lancamento();

create or replace function public.cancelar_contrato(p_contrato_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  if (select auth.uid()) is null or not (select private.crm_tem_permissao('contratosCancelar')) then
    raise exception 'Sem permissão para cancelar contratos';
  end if;
  if nullif(btrim(p_motivo),'') is null then raise exception 'Informe o motivo do cancelamento'; end if;
  perform pg_advisory_xact_lock(hashtext(p_contrato_id::text));
  update public.contratos set status='Cancelado',motivo_cancelamento=btrim(p_motivo),cancelado_em=now(),cancelado_por=(select auth.uid())
  where id=p_contrato_id and status not in ('Cancelado','Encerrado','Renovado');
  if not found then raise exception 'Contrato não encontrado ou já encerrado'; end if;
  update public.financeiro_lancamentos set status='Cancelado',atualizado_em=now()
  where contrato_id=p_contrato_id and status='Pendente' and valor_pago=0 and vencimento>current_date;
  select coalesce(nome,email) into v_nome from public.perfis_usuarios where user_id=(select auth.uid());
  insert into public.contrato_historico(contrato_id,acao,descricao,usuario_id,usuario_nome)
  values(p_contrato_id,'Contrato cancelado',btrim(p_motivo),(select auth.uid()),coalesce(v_nome,'Usuário'));
end $$;

create or replace function public.encerrar_contrato(p_contrato_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  if (select auth.uid()) is null or not (select private.crm_tem_permissao('contratosEditar')) then raise exception 'Sem permissão'; end if;
  update public.contratos set status='Encerrado',encerrado_em=now() where id=p_contrato_id and status not in ('Cancelado','Encerrado','Renovado');
  if not found then raise exception 'Contrato não encontrado ou já encerrado'; end if;
  update public.financeiro_lancamentos set status='Cancelado',atualizado_em=now()
  where contrato_id=p_contrato_id and status='Pendente' and valor_pago=0 and vencimento>current_date;
  select coalesce(nome,email) into v_nome from public.perfis_usuarios where user_id=(select auth.uid());
  insert into public.contrato_historico(contrato_id,acao,descricao,usuario_id,usuario_nome)
  values(p_contrato_id,'Contrato encerrado','Encerramento manual do contrato',(select auth.uid()),coalesce(v_nome,'Usuário'));
end $$;

create or replace function public.marcar_contrato_renovado(p_anterior_id uuid, p_novo_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_novo_inicio date;
begin
  if (select auth.uid()) is null or not (select private.crm_tem_permissao('contratosCriar')) then raise exception 'Sem permissão'; end if;
  if not exists(select 1 from public.contratos where id=p_novo_id and renovado_de_id=p_anterior_id) then raise exception 'Renovação inválida'; end if;
  select inicio into v_novo_inicio from public.contratos where id=p_novo_id;
  update public.contratos set status='Renovado' where id=p_anterior_id and status not in ('Cancelado','Encerrado');
  update public.financeiro_lancamentos set status='Cancelado',atualizado_em=now()
  where contrato_id=p_anterior_id and status='Pendente' and valor_pago=0 and vencimento>=v_novo_inicio;
end $$;

alter table public.configuracoes_empresa enable row level security;
alter table public.contrato_modelos enable row level security;
alter table public.contratos enable row level security;
alter table public.contrato_parcelas enable row level security;
alter table public.contrato_documentos enable row level security;
alter table public.contrato_anexos enable row level security;
alter table public.contrato_historico enable row level security;

create policy "Contratos visualizam dados da empresa" on public.configuracoes_empresa for select to authenticated using ((select private.crm_tem_permissao('contratosVisualizar')));
create policy "Administradores alteram dados da empresa" on public.configuracoes_empresa for update to authenticated using ((select private.crm_tem_permissao('configuracoes'))) with check ((select private.crm_tem_permissao('configuracoes')));
create policy "Contratos visualizam modelos" on public.contrato_modelos for select to authenticated using ((select private.crm_tem_permissao('contratosVisualizar')));
create policy "Administradores gerenciam modelos" on public.contrato_modelos for all to authenticated using ((select private.crm_tem_permissao('configuracoes'))) with check ((select private.crm_tem_permissao('configuracoes')));

create policy "Equipe autorizada visualiza contratos" on public.contratos for select to authenticated using ((select private.crm_tem_permissao('contratosVisualizar')));
create policy "Equipe autorizada cria contratos" on public.contratos for insert to authenticated with check ((select private.crm_tem_permissao('contratosCriar')) and criado_por=(select auth.uid()));
create policy "Equipe autorizada edita contratos" on public.contratos for update to authenticated using ((select private.crm_tem_permissao('contratosEditar'))) with check ((select private.crm_tem_permissao('contratosEditar')));
create policy "Equipe autorizada exclui contratos" on public.contratos for delete to authenticated using ((select private.crm_tem_permissao('contratosExcluir')));

create policy "Contratos visualizam clientes vinculados" on public.clientes for select to authenticated
using ((select private.crm_tem_permissao('contratosVisualizar')) and exists (select 1 from public.contratos c where c.cliente_id=clientes.id));
create policy "Contratos atualizam clientes vinculados" on public.clientes for update to authenticated
using ((select private.crm_tem_permissao('contratosCriar')) or (select private.crm_tem_permissao('contratosEditar')))
with check ((select private.crm_tem_permissao('contratosCriar')) or (select private.crm_tem_permissao('contratosEditar')));
create policy "Contratos visualizam fornecedores vinculados" on public.financeiro_fornecedores for select to authenticated
using ((select private.crm_tem_permissao('contratosVisualizar')) and exists (select 1 from public.contratos c where c.fornecedor_id=financeiro_fornecedores.id));
create policy "Contratos atualizam fornecedores vinculados" on public.financeiro_fornecedores for update to authenticated
using ((select private.crm_tem_permissao('contratosCriar')) or (select private.crm_tem_permissao('contratosEditar')))
with check ((select private.crm_tem_permissao('contratosCriar')) or (select private.crm_tem_permissao('contratosEditar')));

create policy "Equipe visualiza parcelas de contratos" on public.contrato_parcelas for select to authenticated using ((select private.crm_tem_permissao('contratosVisualizar')));
create policy "Equipe visualiza documentos de contratos" on public.contrato_documentos for select to authenticated using ((select private.crm_tem_permissao('contratosVisualizar')));
create policy "Equipe gera documentos de contratos" on public.contrato_documentos for insert to authenticated with check ((select private.crm_tem_permissao('contratosGerarDocumentos')) and gerado_por=(select auth.uid()));
create policy "Equipe exclui documentos próprios" on public.contrato_documentos for delete to authenticated using ((select private.crm_tem_permissao('contratosGerarDocumentos')));
create policy "Equipe visualiza anexos de contratos" on public.contrato_anexos for select to authenticated using ((select private.crm_tem_permissao('contratosVisualizar')));
create policy "Equipe edita anexos de contratos" on public.contrato_anexos for insert to authenticated with check ((select private.crm_tem_permissao('contratosEditar')) and criado_por=(select auth.uid()));
create policy "Equipe exclui anexos de contratos" on public.contrato_anexos for delete to authenticated using ((select private.crm_tem_permissao('contratosEditar')));
create policy "Equipe visualiza histórico de contratos" on public.contrato_historico for select to authenticated using ((select private.crm_tem_permissao('contratosVisualizar')));
create policy "Equipe registra histórico de contratos" on public.contrato_historico for insert to authenticated with check ((select private.crm_tem_permissao('contratosEditar')) and usuario_id=(select auth.uid()));

create policy "Contratos visualizam lançamentos vinculados" on public.financeiro_lancamentos for select to authenticated
using ((select private.crm_tem_permissao('contratosFinanceiro')) and contrato_id is not null);
create policy "Contratos visualizam pagamentos vinculados" on public.financeiro_pagamentos for select to authenticated
using ((select private.crm_tem_permissao('contratosFinanceiro')) and exists (
  select 1 from public.financeiro_lancamentos l where l.id=lancamento_id and l.contrato_id is not null
));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('contratos-documentos','contratos-documentos',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "Equipe baixa arquivos de contratos" on storage.objects for select to authenticated
using (bucket_id='contratos-documentos' and (select private.crm_tem_permissao('contratosVisualizar')));
create policy "Equipe envia arquivos de contratos" on storage.objects for insert to authenticated
with check (bucket_id='contratos-documentos' and owner_id=(select auth.uid())::text and (
  (select private.crm_tem_permissao('contratosEditar')) or (select private.crm_tem_permissao('contratosGerarDocumentos'))
));
create policy "Equipe atualiza arquivos de contratos" on storage.objects for update to authenticated
using (bucket_id='contratos-documentos' and owner_id=(select auth.uid())::text)
with check (bucket_id='contratos-documentos' and owner_id=(select auth.uid())::text);
create policy "Equipe exclui arquivos de contratos" on storage.objects for delete to authenticated
using (bucket_id='contratos-documentos' and owner_id=(select auth.uid())::text and (
  (select private.crm_tem_permissao('contratosEditar')) or (select private.crm_tem_permissao('contratosGerarDocumentos'))
));

grant usage on sequence public.contratos_numero_seq to authenticated;
grant select,insert,delete on public.contratos to authenticated;
grant update (
  modelo_id,parte_tipo,cliente_id,fornecedor_id,tipo_contrato,objeto,sistemas_contratados,
  servicos_contratados,implantacao_valor,equipamentos_descricao,equipamentos_valor,
  outros_valores_descricao,outros_valores,valor_inicial,gerar_cobranca_inicial,
  vencimento_valor_inicial,observacoes_comerciais,valor_mensal,inicio,data_instalacao,
  duracao_meses,quantidade_parcelas,primeira_mensalidade,dia_vencimento,periodicidade,
  forma_pagamento,formas_validas_pagamento,responsavel_id,representante_comercial,
  auto_renovacao,aviso_previo_dias,multa_rescisoria_percentual,multa_atraso_percentual,
  juros_dia_percentual,bloqueio_dias,rescisao_inadimplencia_dias,taxa_reativacao,
  indice_reajuste,observacoes,cidade_assinatura,data_assinatura,testemunha_1_nome,
  testemunha_1_cpf,testemunha_2_nome,testemunha_2_cpf,atualizado_em
) on public.contratos to authenticated;
grant select on public.configuracoes_empresa,public.contrato_modelos,public.contrato_parcelas,public.contrato_historico to authenticated;
grant update on public.configuracoes_empresa to authenticated;
grant select,insert,delete on public.contrato_documentos,public.contrato_anexos to authenticated;
grant insert on public.contrato_historico to authenticated;
revoke all on function public.sincronizar_parcelas_contrato(uuid) from public,anon;
revoke all on function public.ativar_contrato(uuid) from public,anon;
revoke all on function public.cancelar_contrato(uuid,text) from public,anon;
revoke all on function public.encerrar_contrato(uuid) from public,anon;
revoke all on function public.marcar_contrato_renovado(uuid,uuid) from public,anon;
grant execute on function public.sincronizar_parcelas_contrato(uuid) to authenticated;
grant execute on function public.ativar_contrato(uuid) to authenticated;
grant execute on function public.cancelar_contrato(uuid,text) to authenticated;
grant execute on function public.encerrar_contrato(uuid) to authenticated;
grant execute on function public.marcar_contrato_renovado(uuid,uuid) to authenticated;

revoke all on function private.contrato_periodicidade_meses(text) from public,anon,authenticated;
revoke all on function private.contrato_refletir_lancamento() from public,anon,authenticated;
revoke all on function private.contratos_touch_atualizado() from public,anon,authenticated;

update public.perfis_usuarios set permissoes = permissoes || jsonb_build_object(
  'contratos', true,
  'contratosVisualizar', true,
  'contratosCriar', true,
  'contratosEditar', true,
  'contratosGerarDocumentos', true,
  'contratosCancelar', true,
  'contratosExcluir', true,
  'contratosFinanceiro', true
) where perfil='admin';

update public.convites_usuarios set permissoes = permissoes || jsonb_build_object(
  'contratos', true,
  'contratosVisualizar', true,
  'contratosCriar', true,
  'contratosEditar', true,
  'contratosGerarDocumentos', true,
  'contratosCancelar', true,
  'contratosExcluir', true,
  'contratosFinanceiro', true
) where perfil='admin';
