/* Pins financeiros opcionais do Dashboard. */
(function () {
  if (typeof DASHBOARD_WIDGETS === 'undefined' || typeof normalizarDashboardConfig !== 'function') return;

  const IDS_FIN = ['financeiro','financeiroReceber','financeiroPagar','financeiroSaldo','financeiroVencimentos','financeiroContas'];
  DASHBOARD_WIDGETS.financeiro = { titulo: 'Resumo financeiro', icone: 'wallet-cards', tamanho: 'medio' };
  DASHBOARD_WIDGETS.financeiroReceber = { titulo: 'Financeiro · A receber', icone: 'circle-arrow-down', tamanho: 'pequeno' };
  DASHBOARD_WIDGETS.financeiroPagar = { titulo: 'Financeiro · A pagar', icone: 'circle-arrow-up', tamanho: 'pequeno' };
  DASHBOARD_WIDGETS.financeiroSaldo = { titulo: 'Financeiro · Saldo do período', icone: 'landmark', tamanho: 'pequeno' };
  DASHBOARD_WIDGETS.financeiroVencimentos = { titulo: 'Financeiro · Próximos vencimentos', icone: 'calendar-clock', tamanho: 'medio' };
  DASHBOARD_WIDGETS.financeiroContas = { titulo: 'Financeiro · Saldos por conta', icone: 'building-2', tamanho: 'medio' };
  dashboardConfig = normalizarDashboardConfig(dashboardConfig);

  function podeVerFinanceiro() {
    if (!usuarioLogado) return false;
    if (usuarioLogado.perfil === 'admin') return true;
    const p = usuarioLogado.permissoes || {};
    if (Array.isArray(p)) return p.includes('financeiro') || p.includes('financeiroVisualizar');
    return !!(p.financeiro || p.financeiroVisualizar);
  }

  const moeda = valor => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataBR = valor => {
    if (!valor) return 'Sem vencimento';
    const d = new Date(`${String(valor).slice(0,10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? valor : d.toLocaleDateString('pt-BR');
  };
  const esc = valor => typeof escaparHtml === 'function' ? escaparHtml(String(valor ?? '')) : String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  const padFin = n => String(n).padStart(2,'0');
  const isoFin = d => `${d.getFullYear()}-${padFin(d.getMonth()+1)}-${padFin(d.getDate())}`;
  function mesFinanceiro(offset=0) {
    const a = new Date();
    return { inicio: isoFin(new Date(a.getFullYear(), a.getMonth()+offset, 1)), fim: isoFin(new Date(a.getFullYear(), a.getMonth()+offset+1, 0)) };
  }
  function faixaFinanceiro() {
    const p = localStorage.getItem('help-financeiro-periodo') || 'atual';
    if (p === 'todos') return { periodo:p, inicio:'', fim:'' };
    if (p === 'atual') return { periodo:p, ...mesFinanceiro(0) };
    if (p === 'proximo') return { periodo:p, ...mesFinanceiro(1) };
    if (p === 'anterior') return { periodo:p, ...mesFinanceiro(-1) };
    if (p === 'atualProximo') { const a=mesFinanceiro(0), b=mesFinanceiro(1); return { periodo:p, inicio:a.inicio, fim:b.fim }; }
    const a=mesFinanceiro(0);
    return { periodo:'personalizado', inicio:localStorage.getItem('help-financeiro-periodo-inicio') || a.inicio, fim:localStorage.getItem('help-financeiro-periodo-fim') || a.fim };
  }
  function dentroFinanceiro(valor, faixa) {
    if (faixa.periodo === 'todos') return true;
    const d = String(valor || '').slice(0,10);
    return !!d && (!faixa.inicio || d >= faixa.inicio) && (!faixa.fim || d <= faixa.fim);
  }

  let cache = null;
  let carregando = null;

  async function buscarDados(forcar = false) {
    cache = null; // sempre busca dados atuais ao redesenhar o Dashboard
    if (carregando) return carregando;
    carregando = (async () => {
      const [lancRes, pagRes, contasRes, transfRes] = await Promise.all([
        supabaseClient.from('financeiro_lancamentos').select('id,tipo,descricao,valor,vencimento,status'),
        supabaseClient.from('financeiro_pagamentos').select('lancamento_id,conta_id,valor,pago_em'),
        supabaseClient.from('financeiro_contas').select('id,nome,tipo,saldo_inicial,ativo').order('tipo').order('nome'),
        supabaseClient.from('financeiro_transferencias').select('conta_origem_id,conta_destino_id,valor')
      ]);
      const erro = lancRes.error || pagRes.error || contasRes.error || transfRes.error;
      if (erro) throw erro;

      const lancamentos = lancRes.data || [];
      const pagamentos = pagRes.data || [];
      const contas = contasRes.data || [];
      const transferencias = transfRes.data || [];
      const periodoFinanceiro = faixaFinanceiro();
      const porId = new Map(lancamentos.map(l => [String(l.id), l]));
      const pagoPorLanc = new Map();
      pagamentos.forEach(p => pagoPorLanc.set(String(p.lancamento_id), (pagoPorLanc.get(String(p.lancamento_id)) || 0) + Number(p.valor || 0)));

      let aReceber = 0, aPagar = 0, recebido = 0, pago = 0;
      const pendentes = [];
      lancamentos.forEach(l => {
        if (String(l.status || '').toLowerCase() === 'cancelado') return;
        const restante = Math.max(0, Number(l.valor || 0) - (pagoPorLanc.get(String(l.id)) || 0));
        if (dentroFinanceiro(l.vencimento, periodoFinanceiro)) {
          if (l.tipo === 'Receber') aReceber += restante;
          if (l.tipo === 'Pagar') aPagar += restante;
          if (restante > 0) pendentes.push({ ...l, restante });
        }
      });
      pagamentos.forEach(p => {
        if (!p.pago_em || !dentroFinanceiro(p.pago_em, periodoFinanceiro)) return;
        const lanc = porId.get(String(p.lancamento_id));
        if (lanc?.tipo === 'Receber') recebido += Number(p.valor || 0);
        if (lanc?.tipo === 'Pagar') pago += Number(p.valor || 0);
      });

      const saldoPeriodo = recebido - pago;
      pendentes.sort((a,b) => {
        if (!a.vencimento && !b.vencimento) return 0;
        if (!a.vencimento) return 1;
        if (!b.vencimento) return -1;
        return String(a.vencimento).localeCompare(String(b.vencimento));
      });

      const saldosContas = contas.map(c => {
        const movPag = pagamentos.reduce((s,p) => {
          if (String(p.conta_id) !== String(c.id)) return s;
          const lanc = porId.get(String(p.lancamento_id));
          return s + (lanc?.tipo === 'Pagar' ? -1 : 1) * Number(p.valor || 0);
        }, 0);
        const movTransf = transferencias.reduce((s,t) => s + (String(t.conta_destino_id) === String(c.id) ? Number(t.valor || 0) : 0) - (String(t.conta_origem_id) === String(c.id) ? Number(t.valor || 0) : 0), 0);
        return { ...c, saldo: Number(c.saldo_inicial || 0) + movPag + movTransf };
      });

      cache = { aReceber, aPagar, recebido, pago, saldoPeriodo, pendentes, saldosContas, periodoFinanceiro };
      return cache;
    })();
    try { return await carregando; }
    finally { carregando = null; }
  }

  function cabecalho(id, atualizar = true) {
    const w = DASHBOARD_WIDGETS[id];
    return `<div class="dashboard-widget-head"><div><span class="dashboard-widget-icon"><i data-lucide="${w.icone}"></i></span><h3>${w.titulo}</h3></div>${atualizar?'<button class="dashboard-head-action" type="button" onclick="atualizarPinsFinanceiros()" title="Atualizar"><i data-lucide="refresh-cw"></i></button>':''}</div>`;
  }

  function carregandoHtml(id) {
    return cabecalho(id,false) + '<div class="dashboard-fin-loading"><span class="fin-spinner"></span><small>Carregando financeiro...</small></div>';
  }

  function abrirFinanceiro() { trocarAba('financeiro'); }
  window.abrirFinanceiroDashboard = abrirFinanceiro;

  function htmlWidget(id, d) {
    if (id === 'financeiro') {
      const classe = d.saldoPeriodo < 0 ? 'negativo' : 'positivo';
      return cabecalho(id) + `
        <div class="dashboard-fin-grid">
          <div><span>A receber</span><strong>${moeda(d.aReceber)}</strong></div>
          <div><span>A pagar</span><strong>${moeda(d.aPagar)}</strong></div>
          <div><span>Recebido no período</span><strong>${moeda(d.recebido)}</strong></div>
          <div><span>Pago no período</span><strong>${moeda(d.pago)}</strong></div>
        </div>
        <div class="dashboard-fin-foot"><span>Saldo do período <b class="${classe}">${moeda(d.saldoPeriodo)}</b></span><button type="button" onclick="abrirFinanceiroDashboard()">Abrir Financeiro <i data-lucide="arrow-right"></i></button></div>`;
    }
    if (id === 'financeiroReceber') return cabecalho(id) + `<div class="dashboard-fin-kpi receber"><span>Total pendente</span><strong>${moeda(d.aReceber)}</strong><small>Valores ainda não recebidos.</small></div><button class="dashboard-head-action" onclick="abrirFinanceiroDashboard()">Ver lançamentos</button>`;
    if (id === 'financeiroPagar') return cabecalho(id) + `<div class="dashboard-fin-kpi pagar"><span>Total pendente</span><strong>${moeda(d.aPagar)}</strong><small>Contas ainda não pagas.</small></div><button class="dashboard-head-action" onclick="abrirFinanceiroDashboard()">Ver lançamentos</button>`;
    if (id === 'financeiroSaldo') {
      const classe = d.saldoPeriodo < 0 ? 'negativo' : 'positivo';
      return cabecalho(id) + `<div class="dashboard-fin-kpi saldo ${classe}"><span>Entradas − saídas</span><strong>${moeda(d.saldoPeriodo)}</strong><small>${moeda(d.recebido)} recebidos · ${moeda(d.pago)} pagos</small></div>`;
    }
    if (id === 'financeiroVencimentos') {
      const linhas = d.pendentes.slice(0,5).map(x => `<button class="dashboard-fin-linha" type="button" onclick="abrirFinanceiroDashboard()"><span><strong>${esc(x.descricao || (x.tipo === 'Pagar' ? 'Conta a pagar' : 'Conta a receber'))}</strong><small>${x.tipo} · ${dataBR(x.vencimento)}</small></span><b>${moeda(x.restante)}</b></button>`).join('');
      return cabecalho(id) + `<div class="dashboard-fin-vencimentos">${linhas || '<div class="dashboard-widget-vazio"><i data-lucide="check-circle-2"></i><span>Nenhum lançamento pendente.</span></div>'}</div>`;
    }
    if (id === 'financeiroContas') {
      const linhas = d.saldosContas.filter(c => c.ativo !== false).slice(0,6).map(c => `<button class="dashboard-fin-linha" type="button" onclick="abrirFinanceiroDashboard()"><span><strong>${esc(c.nome)}</strong><small>${esc(c.tipo)}</small></span><b>${moeda(c.saldo)}</b></button>`).join('');
      return cabecalho(id) + `<div class="dashboard-fin-contas">${linhas || '<div class="dashboard-widget-vazio"><span>Nenhuma conta financeira cadastrada.</span></div>'}</div>`;
    }
    return '';
  }

  function inserirEstruturas() {
    if (!podeVerFinanceiro()) return [];
    const alvo = document.getElementById('dashboardWidgets');
    if (!alvo) return [];
    const visiveis = dashboardConfig.filter(x => x.visivel);
    const criados = [];
    visiveis.forEach((cfg, pos) => {
      if (!IDS_FIN.includes(cfg.id)) return;
      let artigo = alvo.querySelector(`[data-widget="${cfg.id}"]`);
      if (!artigo) {
        artigo = document.createElement('article');
        artigo.className = `dashboard-widget tamanho-${cfg.tamanho}`;
        artigo.dataset.widget = cfg.id;
        artigo.innerHTML = carregandoHtml(cfg.id);
        let antes = null;
        for (let i = pos + 1; i < visiveis.length; i++) {
          antes = alvo.querySelector(`[data-widget="${visiveis[i].id}"]`);
          if (antes) break;
        }
        alvo.insertBefore(artigo, antes);
      }
      criados.push(artigo);
    });
    renderizarIcones();
    return criados;
  }

  async function preencherPins(forcar = false) {
    const artigos = inserirEstruturas();
    if (!artigos.length) return;
    if (forcar) artigos.forEach(a => a.innerHTML = carregandoHtml(a.dataset.widget));
    try {
      const dados = await buscarDados(forcar);
      artigos.forEach(a => { a.innerHTML = htmlWidget(a.dataset.widget, dados); a.dataset.carregado = '1'; });
      renderizarIcones();
    } catch (erro) {
      console.error('Pins financeiros:', erro);
      artigos.forEach(a => a.innerHTML = cabecalho(a.dataset.widget,false) + '<div class="dashboard-fin-erro"><small>Não foi possível carregar os dados financeiros.</small><button type="button" onclick="atualizarPinsFinanceiros()">Tentar novamente</button></div>');
      renderizarIcones();
    }
  }

  window.atualizarPinsFinanceiros = async function () { cache = null; await preencherPins(true); };
  window.carregarResumoFinanceiroDashboard = window.atualizarPinsFinanceiros;

  const renderDashboardOriginal = renderizarDashboardPersonalizado;
  renderizarDashboardPersonalizado = function () {
    const estados = new Map();
    dashboardConfig.forEach(c => { if (IDS_FIN.includes(c.id)) { estados.set(c.id,c.visivel); c.visivel = false; } });
    renderDashboardOriginal();
    dashboardConfig.forEach(c => { if (estados.has(c.id)) c.visivel = estados.get(c.id); });
    preencherPins(true);
  };

  const renderConfigOriginal = renderizarConfigDashboard;
  renderizarConfigDashboard = function () {
    dashboardConfig = normalizarDashboardConfig(dashboardConfig);
    renderConfigOriginal();
  };

  const style = document.createElement('style');
  style.textContent = `
    .dashboard-fin-loading{min-height:120px;display:grid;place-items:center;align-content:center;gap:10px;color:var(--text-muted)}
    .dashboard-fin-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}
    .dashboard-fin-grid>div{padding:11px 12px;border:1px solid var(--border-color);border-radius:10px;background:rgba(53,117,203,.055);min-width:0}
    .dashboard-fin-grid span{display:block;margin-bottom:6px;color:var(--text-muted);font-size:10px;text-transform:uppercase;letter-spacing:.035em}
    .dashboard-fin-grid strong{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dashboard-fin-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;padding-top:10px;border-top:1px solid var(--border-color);font-size:11px;color:var(--text-muted)}
    .dashboard-fin-foot span b{display:block;margin-top:3px;font-size:15px;color:var(--text-main)}
    .dashboard-fin-foot span b.negativo{color:#fb7185}.dashboard-fin-foot span b.positivo{color:#31d6a0}
    .dashboard-fin-foot button,.dashboard-fin-erro button{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:#4f91e8;font:inherit;font-weight:700;cursor:pointer}
    .dashboard-fin-foot button svg{width:14px}.dashboard-fin-erro{min-height:110px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--text-muted);text-align:center}
    @media(max-width:620px){.dashboard-fin-grid{grid-template-columns:1fr}.dashboard-fin-foot{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);
})();
