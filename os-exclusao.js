/* Exclusão segura de Ordem de Serviço. */
(function () {
  function instalarBotaoExcluirOS() {
    const actions = document.querySelector('#modalOS .os-actions');
    if (!actions || document.getElementById('btnExcluirOS')) return;

    const botao = document.createElement('button');
    botao.id = 'btnExcluirOS';
    botao.type = 'button';
    botao.className = 'btn os-btn-excluir';
    botao.innerHTML = '<i data-lucide="trash-2"></i>Excluir OS';
    botao.addEventListener('click', excluirOSAtual);
    actions.insertBefore(botao, actions.firstChild);

    const modal = document.getElementById('modalOS');
    if (modal) {
      new MutationObserver(sincronizarBotaoExcluirOS).observe(modal, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
    sincronizarBotaoExcluirOS();
    if (window.lucide) lucide.createIcons();
  }

  function sincronizarBotaoExcluirOS() {
    const botao = document.getElementById('btnExcluirOS');
    if (!botao) return;
    const id = Number(document.getElementById('osId')?.value || 0);
    const criador = String(osAtual?.criado_por || '');
    const administrador = usuarioLogado?.perfil === 'admin';
    const propria = criador && criador === String(usuarioLogado?.id || '');
    const permitido = administrador || (usuarioLogado?.permissoes?.osExcluir === true && propria);
    botao.style.display = id && permitido ? 'inline-flex' : 'none';
  }

  async function excluirOSAtual() {
    const id = Number(osAtual?.id || document.getElementById('osId')?.value || 0);
    if (!id) return avisarModulo('Abra uma ordem de serviço salva antes de excluir.');
    const administrador = usuarioLogado?.perfil === 'admin';
    const propria = String(osAtual?.criado_por || '') === String(usuarioLogado?.id || '');
    if (!administrador && !(usuarioLogado?.permissoes?.osExcluir === true && propria)) {
      return avisarModulo('Você só pode excluir ordens de serviço criadas pelo seu próprio usuário.');
    }

    const numero = osAtual?.numero || document.getElementById('osModalTitulo')?.textContent || `OS #${id}`;
    const botao = document.getElementById('btnExcluirOS');
    if (botao) botao.disabled = true;

    const { data: lancamentos, error: erroFinanceiro } = await supabaseClient
      .from('financeiro_lancamentos')
      .select('id,tipo,status,descricao')
      .eq('os_id', id)
      .limit(1);

    if (erroFinanceiro) {
      if (botao) botao.disabled = false;
      return avisarModulo('Não foi possível conferir o Financeiro: ' + erroFinanceiro.message);
    }

    if (lancamentos?.length) {
      if (botao) botao.disabled = false;
      return avisarModulo('Esta OS possui lançamento financeiro vinculado e não pode ser excluída. Cancele a OS se precisar mantê-la fora da operação.');
    }

    const confirmado = window.confirm(
      `Excluir definitivamente ${numero}?\n\n` +
      'Os serviços e peças desta OS também serão apagados. Esta ação não pode ser desfeita.'
    );
    if (!confirmado) {
      if (botao) botao.disabled = false;
      return;
    }

    const { data: excluida, error } = await supabaseClient
      .from('ordens_servico')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      if (botao) botao.disabled = false;
      return avisarModulo('Não foi possível excluir a OS: ' + error.message);
    }

    if (!excluida) {
      if (botao) botao.disabled = false;
      return avisarModulo('A OS não foi excluída. Verifique se seu usuário possui permissão para essa ação.');
    }

    osAtual = null;
    osItensEdicao = [];
    fecharModalOS();
    await renderizarOrdensServico();
    avisarModulo(`${numero} excluída com sucesso.`);
  }

  window.excluirOSAtual = excluirOSAtual;

  const estilo = document.createElement('style');
  estilo.textContent = `
    #btnExcluirOS.os-btn-excluir{background:#dc2626!important;border-color:#dc2626!important;color:#fff!important;margin-right:auto}
    #btnExcluirOS.os-btn-excluir:hover{background:#b91c1c!important;border-color:#b91c1c!important}
    #btnExcluirOS.os-btn-excluir:disabled{opacity:.55;cursor:not-allowed}
  `;
  document.head.appendChild(estilo);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalarBotaoExcluirOS);
  else instalarBotaoExcluirOS();

  new MutationObserver(instalarBotaoExcluirOS).observe(document.documentElement, { childList: true, subtree: true });
})();
