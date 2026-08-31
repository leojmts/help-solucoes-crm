-- Correções de permissões de OS e cronômetros independentes por chamado.

-- Um técnico pode manter atendimentos em andamento em chamados diferentes.
drop index if exists public.chamado_tempos_usuario_aberto_idx;
create index if not exists chamado_tempos_usuario_abertos_idx
  on public.chamado_tempos(usuario_id, chamado_id)
  where finalizado_em is null;

-- Substitui a política ampla por permissões específicas.
drop policy if exists "Equipe OS gerencia ordens_servico" on public.ordens_servico;
drop policy if exists "Equipe OS visualiza ordens_servico" on public.ordens_servico;
drop policy if exists "Equipe OS cria ordens_servico" on public.ordens_servico;
drop policy if exists "Equipe OS altera ordens_servico" on public.ordens_servico;
drop policy if exists "Criador ou administrador exclui ordens_servico" on public.ordens_servico;

create policy "Equipe OS visualiza ordens_servico"
  on public.ordens_servico for select to authenticated
  using (private.crm_tem_permissao('osVisualizar') or private.crm_tem_permissao('os'));

create policy "Equipe OS cria ordens_servico"
  on public.ordens_servico for insert to authenticated
  with check (private.crm_tem_permissao('osCriar'));

create policy "Equipe OS altera ordens_servico"
  on public.ordens_servico for update to authenticated
  using (private.crm_tem_permissao('osEditar'))
  with check (private.crm_tem_permissao('osEditar'));

create policy "Criador ou administrador exclui ordens_servico"
  on public.ordens_servico for delete to authenticated
  using (
    exists (
      select 1 from public.perfis_usuarios p
      where p.user_id = (select auth.uid()) and p.ativo and p.perfil = 'admin'
    )
    or (
      criado_por = (select auth.uid())
      and private.crm_tem_permissao('osExcluir')
    )
  );

-- Os itens seguem a permissão da OS principal.
drop policy if exists "Equipe OS gerencia os_itens" on public.os_itens;
drop policy if exists "Equipe OS visualiza os_itens" on public.os_itens;
drop policy if exists "Equipe OS cria os_itens" on public.os_itens;
drop policy if exists "Equipe OS altera os_itens" on public.os_itens;
drop policy if exists "Equipe OS exclui os_itens" on public.os_itens;

create policy "Equipe OS visualiza os_itens"
  on public.os_itens for select to authenticated
  using (private.crm_tem_permissao('osVisualizar') or private.crm_tem_permissao('os'));

create policy "Equipe OS cria os_itens"
  on public.os_itens for insert to authenticated
  with check (private.crm_tem_permissao('osCriar') or private.crm_tem_permissao('osEditar'));

create policy "Equipe OS altera os_itens"
  on public.os_itens for update to authenticated
  using (private.crm_tem_permissao('osEditar'))
  with check (private.crm_tem_permissao('osEditar'));

create policy "Equipe OS exclui os_itens"
  on public.os_itens for delete to authenticated
  using (private.crm_tem_permissao('osEditar'));
