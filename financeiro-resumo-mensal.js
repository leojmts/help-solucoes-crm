/* Resumos financeiros limitados ao mês atual. */
(function () {
  const moeda = valor => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function mesAtual() {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  }

  /* Tela Financeiro: A receber/A pagar = vencimentos do mês atual;
     Em atraso = qualquer pendência vencida; Movimentado = baixas do mês atual. */
  window.finRenderResumo = function () {
    const mes = mesAtual();
    const hoje = typeof finHoje === 'function' ? finHoje() : new Date().toISOString().slice(0, 10);
    const registros = Array.isArray(window.financeiroRegistros) ? window.financeiroRegistros : (typeof financeiroRegistros !== 'undefined' ? financeiroRegistros : []);
    const pagamentos = Array.isArray(window.finPagamentos) ? window.finPagamentos : (typeof finPagamentos !== 'undefined' ? finPagamentos : []);
    const saldo = typeof finSaldo === 'function' ? finSaldo : x => Math.max(0, Number(x.valor || 0) - Number(x.valor_pago || 0));

    const pendentes = registros.filter(x => x.status === 'Pendente');
    const pendentesMes = pendentes.filter(x => String(x.vencimento || '').slice(0, 7) === mes);
    const receber = pendentesMes.filter(x => x.tipo === 'Receber').reduce((s, x) => s + saldo(x), 0);
    const pagar = pendentesMes.filter(x => x.tipo === 'Pagar').reduce((s, x) => s + saldo(x), 0);
    const atrasado = pendentes.filter(x => x.vencimento && x.vencimento < hoje).reduce((s, x) => s + saldo(x), 0);
    const movimentado = pagamentos.filter(x => String(x.pago_em || '').slice(0, 7) === mes).reduce((s, x) => s + Number(x.valor || 0), 0);

    const el = document.getElementById('financeiroResumo');
    if (!el) return;
    el.innerHTML = [
      ['arrow-down-circle', 'A receber', receber, 'receber'],
      ['alert-triangle', 'Em atraso', atrasado, 'atraso'],
      ['arrow-up-circle', 'A pagar', pagar, 'pagar'],
      ['circle-check-big', 'Movimentado', movimentado, 'pago']
    ].map(([icone, titulo, valor, classe]) => `<article class="${classe}" title="Resumo do mês atual"><i data-lucide="${icone}"></i><span>${titulo}</span><strong>${typeof osMoeda === 'function' ? osMoeda(valor) : moeda(valor)}</strong></article>`).join('');
    if (window.lucide) lucide.createIcons();
  };

  async function totaisPendentesMes() {
    if (!window.supabaseClient) return null;
    const { data, error } = await supabaseClient
      .from('financeiro_lancamentos')
      .select('id,tipo,valor,valor_pago,vencimento,status')
      .eq('status', 'Pendente');
    if (error) return null;
    const mes = mesAtual();
    let receber = 0, pagar = 0;
    (data || []).forEach(x => {
      if (String(x.vencimento || '').slice(0, 7) !== mes) return;
      const restante = Math.max(0, Number(x.valor || 0) - Number(x.valor_pago || 0));
      if (x.tipo === 'Receber') receber += restante;
      if (x.tipo === 'Pagar') pagar += restante;
    });
    return { receber, pagar };
  }

  let corrigindoPins = false;
  async function corrigirPinsFinanceirosMensais() {
    if (corrigindoPins) return;
    const alvo = document.getElementById('dashboardWidgets');
    if (!alvo) return;
    const precisa = alvo.querySelector('[data-widget="financeiro"], [data-widget="financeiroReceber"], [data-widget="financeiroPagar"]');
    if (!precisa) return;
    corrigindoPins = true;
    try {
      const totais = await totaisPendentesMes();
      if (!totais) return;
      const receber = alvo.querySelector('[data-widget="financeiroReceber"] .dashboard-fin-kpi strong');
      const pagar = alvo.querySelector('[data-widget="financeiroPagar"] .dashboard-fin-kpi strong');
      const resumo = alvo.querySelectorAll('[data-widget="financeiro"] .dashboard-fin-grid > div strong');
      const vr = moeda(totais.receber), vp = moeda(totais.pagar);
      if (receber && receber.textContent !== vr) receber.textContent = vr;
      if (pagar && pagar.textContent !== vp) pagar.textContent = vp;
      if (resumo[0] && resumo[0].textContent !== vr) resumo[0].textContent = vr;
      if (resumo[1] && resumo[1].textContent !== vp) resumo[1].textContent = vp;
      const sr = alvo.querySelector('[data-widget="financeiroReceber"] .dashboard-fin-kpi small');
      const sp = alvo.querySelector('[data-widget="financeiroPagar"] .dashboard-fin-kpi small');
      if (sr) sr.textContent = 'Pendências com vencimento neste mês.';
      if (sp) sp.textContent = 'Pendências com vencimento neste mês.';
    } finally {
      corrigindoPins = false;
    }
  }

  const atualizarPinsOriginal = window.atualizarPinsFinanceiros;
  if (typeof atualizarPinsOriginal === 'function') {
    window.atualizarPinsFinanceiros = async function () {
      await atualizarPinsOriginal.apply(this, arguments);
      await corrigirPinsFinanceirosMensais();
    };
  }

  function observarDashboard() {
    const alvo = document.getElementById('dashboardWidgets');
    if (!alvo || alvo.dataset.resumoMensalObservado === '1') return;
    alvo.dataset.resumoMensalObservado = '1';
    let timer;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(corrigirPinsFinanceirosMensais, 80);
    }).observe(alvo, { childList: true, subtree: true });
    corrigirPinsFinanceirosMensais();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observarDashboard, { once: true });
  else observarDashboard();
  new MutationObserver(observarDashboard).observe(document.documentElement, { childList: true, subtree: true });
})();
