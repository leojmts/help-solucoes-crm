-- Exclui atomicamente uma recorrência financeira e todos os lançamentos gerados por ela.
-- A função respeita o perfil/permissão do usuário autenticado e as políticas RLS existentes.

create or replace function public.excluir_financeiro_recorrencia_completa(p_recorrencia_id bigint)
returns table (recorrencia_excluida boolean, lancamentos_excluidos bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_permitido boolean := false;
  v_lancamentos bigint := 0;
  v_recorrencia bigint := 0;
begin
  select p.perfil = 'admin'
      or coalesce((p.permissoes ->> 'financeiroExcluir')::boolean, false)
    into v_permitido
    from public.perfis_usuarios p
   where p.user_id = (select auth.uid())
     and p.ativo = true;

  if not coalesce(v_permitido, false) then
    raise exception 'Você não possui permissão para excluir lançamentos financeiros.'
      using errcode = '42501';
  end if;

  delete from public.financeiro_lancamentos
   where recorrencia_id = p_recorrencia_id;
  get diagnostics v_lancamentos = row_count;

  delete from public.financeiro_recorrencias
   where id = p_recorrencia_id;
  get diagnostics v_recorrencia = row_count;

  return query select v_recorrencia = 1, v_lancamentos;
end;
$$;

revoke all on function public.excluir_financeiro_recorrencia_completa(bigint) from public, anon;
grant execute on function public.excluir_financeiro_recorrencia_completa(bigint) to authenticated;
