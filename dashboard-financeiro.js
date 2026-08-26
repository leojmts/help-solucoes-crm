/* Widget financeiro opcional do Dashboard. */
(function () {
  if (typeof DASHBOARD_WIDGETS === 'undefined' || typeof normalizarDashboardConfig !== 'function') return;

  DASHBOARD_WIDGETS.financeiro = { titulo: 'Resumo financeiro', icone: 'wallet-cards', tamanho: 'medio' };
  dashboardConfig = normalizarDashboardConfig(dashboardConfig);

  const podeVerFinanceiro = () => !!(
    usuarioLogado && (
      usuarioLogado.perfil === 'admin' ||
      usuarioLogado.permissoes?.financeiro ||
      usuarioLogado.permissoes?.financeiroVisualizar
    )
  );

  const moedaDashboard = valor => Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL'
  });

  function htmlFinanceiroCarregando() {
    return `
      <div class="dashboard-widget-head">
        <div><i data-lucide="wallet-cards"></i><strong>Resumo financeiro</strong></div>
        <button class="dashboard-head-action" type="button" onclick="carregarResumoFinanceiroDashboard(true)" title="Atualizar"><i data-lucide="refresh-cw"></i></button>
      </div>
      <div class="dashboard-fin-loading"><span class="fin-spinner"></span><small>Carregando financeiro...</small></div>`;
  }

  function inserirWidgetFinanceiro() {
    const cfg = dashboardConfig.find(x => x.id === 'financeiro');
    if (!cfg?.visivel || !podeVerFinanceiro()) return;
    const alvo = document.getElementById('dashboardWidgets');
    if (!alvo || alvo.querySelector('[data-widget="financeiro"]')) return;

    const artigo = document.createElement('article');
    artigo.className = `dashboard-widget tamanho-${cfg.tamanho}`;
    artigo.dataset.widget = 'financeiro';
    artigo.innerHTML = htmlFinanceiroCarregando();

    const visiveis = dashboardConfig.filter(x => x.visivel);
    const pos = visiveis.findIndex(x => x.id === 'financeiro');
    let antes = null;
    for (let i = pos + 1; i < visiveis.length; i++) {
      antes = alvo.querySelector(`[data-widget="${visiveis[i].id}"]`);
      if (antes) break;
    }
    alvo.insertBefore(artigo, antes);
    renderizarIcones();
    carregarResumoFinanceiroDashboard();
  }

  let carregandoFinanceiro = false;
  window.carregarResumoFinanceiroDashboard = async function (forcar = false) {
    const artigo = document.querySelector('[data-widget="financeiro"]');
    if (!artigo || carregandoFinanceiro || !podeVerFinanceiro()) return;
    if (artigo.dataset.carregado === '1' && !forcar) return;
    carregandoFinanceiro = true;
    if (forcar) artigo.innerHTML = htmlFinanceiroCarregando();
    try {
      const [lancRes, pagRes] = await Promise.all([
        supabaseClient.from('financeiro_lancamentos').select('id,tipo,descricao,valor,vencimento,status'),
        supabaseClient.from('financeiro_pagamentos').select('lancamento_id,valor,pago_em')
      ]);
      if (lancRes.error) throw lancRes.error;
      if (pagRes.error) throw pagRes.error;

      const lancamentos = lancRes.data || [];
      const pagamentos = pagRes.data || [];
      const pagosPorLancamento = new Map();
      pagamentos.forEach(p => pagosPorLancamento.set(p.lancamento_id, (pagosPorLancamento.get(p.lancamento_id) || 0) + Number(p.valor || 0)));

      let aReceber = 0, aPagar = 0, recebido = 0, pago = 0;
      lancamentos.forEach(l => {
        if (String(l.status || '').toLowerCase() === 'cancelado') return;
        const restante = Math.max(0, Number(l.valor || 0) - (pagosPorLancamento.get(l.id) || 0));
        if (l.tipo === 'Receber') aReceber += restante;
        if (l.tipo === 'Pagar') aPagar += restante;
      });
      pagamentos.forEach(p => {
        if (!p.pago_em || !dataNoPeriodo(p.pago_em)) return;
        const lanc = lancamentos.find(l => l.id === p.lancamento_id);
        if (lanc?.tipo === 'Receber') recebido += Number(p.valor || 0);
        if (lanc?.tipo === 'Pagar') pago += Number(p.valor || 0);
      });
      const saldo = recebido - pago;
      const saldoClasse = saldo < 0 ? 'negativo' : 'positivo';

      artigo.innerHTML = `
        <div class="dashboard-widget-head">
          <div><i data-lucide="wallet-cards"></i><strong>Resumo financeiro</strong></div>
          <button class="dashboard-head-action" type="button" onclick="carregarResumoFinanceiroDashboard(true)" title="Atualizar"><i data-lucide="refresh-cw"></i></button>
        </div>
        <div class="dashboard-fin-grid">
          <div><span>A receber</span><strong>${moedaDashboard(aReceber)}</strong></div>
          <div><span>A pagar</span><strong>${moedaDashboard(aPagar)}</strong></div>
          <div><span>Recebido no período</span><strong>${moedaDashboard(recebido)}</strong></div>
          <div><span>Pago no período</span><strong>${moedaDashboard(pago)}</strong></div>
        </div>
        <div class="dashboard-fin-foot">
          <span>Saldo do período <b class="${saldoClasse}">${moedaDashboard(saldo)}</b></span>
          <button type="button" onclick="trocarAba('financeiro')">Abrir Financeiro <i data-lucide="arrow-right"></i></button>
        </div>`;
      artigo.dataset.carregado = '1';
      renderizarIcones();
    } catch (erro) {
      console.error('Widget financeiro:', erro);
      artigo.innerHTML = `
        <div class="dashboard-widget-head"><div><i data-lucide="wallet-cards"></i><strong>Resumo financeiro</strong></div></div>
        <div class="dashboard-fin-erro"><small>Não foi possível carregar o resumo financeiro.</small><button type="button" onclick="carregarResumoFinanceiroDashboard(true)">Tentar novamente</button></div>`;
      renderizarIcones();
    } finally {
      carregandoFinanceiro = false;
    }
  };

  const renderDashboardOriginal = renderizarDashboardPersonalizado;
  renderizarDashboardPersonalizado = function () {
    const cfg = dashboardConfig.find(x => x.id === 'financeiro');
    const visivel = !!cfg?.visivel;
    if (cfg) cfg.visivel = false;
    renderDashboardOriginal();
    if (cfg) cfg.visivel = visivel;
    inserirWidgetFinanceiro();
  };

  const renderConfigOriginal = renderizarConfigDashboard;
  renderizarConfigDashboard = function () {
    dashboardConfig = normalizarDashboardConfig(dashboardConfig);
    renderConfigOriginal();
  };

  const style = document.createElement('style');
  style.textContent = `
    .dashboard-fin-loading{min-height:145px;display:grid;place-items:center;align-content:center;gap:10px;color:var(--text-muted)}
    .dashboard-fin-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}
    .dashboard-fin-grid>div{padding:11px 12px;border:1px solid var(--border-color);border-radius:10px;background:rgba(53,117,203,.055);min-width:0}
    .dashboard-fin-grid span{display:block;margin-bottom:6px;color:var(--text-muted);font-size:10px;text-transform:uppercase;letter-spacing:.035em}
    .dashboard-fin-grid strong{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dashboard-fin-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;padding-top:10px;border-top:1px solid var(--border-color);font-size:11px;color:var(--text-muted)}
    .dashboard-fin-foot span b{display:block;margin-top:3px;font-size:15px;color:var(--text-main)}
    .dashboard-fin-foot span b.negativo{color:#fb7185}.dashboard-fin-foot span b.positivo{color:#31d6a0}
    .dashboard-fin-foot button,.dashboard-fin-erro button{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:#69a7ff;font:inherit;font-weight:700;cursor:pointer}
    .dashboard-fin-foot button svg{width:14px}
    .dashboard-fin-erro{min-height:130px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--text-muted);text-align:center}
    @media(max-width:620px){.dashboard-fin-grid{grid-template-columns:1fr}.dashboard-fin-foot{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);
})();
