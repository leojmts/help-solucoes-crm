-- Vincula contas a receber diretamente ao cadastro unificado de clientes.
alter table public.financeiro_lancamentos
  add column if not exists cliente_id bigint references public.clientes(id) on delete set null;

alter table public.financeiro_recorrencias
  add column if not exists cliente_id bigint references public.clientes(id) on delete set null;

create index if not exists idx_financeiro_lancamentos_cliente
  on public.financeiro_lancamentos (cliente_id, vencimento);

create index if not exists idx_financeiro_recorrencias_cliente
  on public.financeiro_recorrencias (cliente_id)
  where cliente_id is not null;
