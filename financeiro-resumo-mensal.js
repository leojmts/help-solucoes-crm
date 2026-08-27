/* Filtros de período e resumos financeiros — Help Soluções Tecnológicas. */
(function () {
  const CHAVE_PERIODO = 'help-financeiro-periodo';
  const CHAVE_INICIO = 'help-financeiro-periodo-inicio';
  const CHAVE_FIM = 'help-financeiro-periodo-fim';
  const moeda = valor => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const pad = n => String(n).padStart(2, '0');
  const dataISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  function faixaMes(offset = 0) {
    const agora = new Date();
    const inicio = new Date(agora.getFullYear(), agora.getMonth() + offset, 1);
    const fim = new Date(agora.getFullYear(), agora.getMonth() + offset + 1, 0);
    return { inicio: dataISO(inicio), fim: dataISO(fim) };
  }

  function periodoSelecionado() {
    const select = document.getElementById('finPeriodoFiltro');
    return select?.value || localStorage.getItem(CHAVE_PERIODO) || 'atual';
  }

  function faixaSelecionada() {
    const periodo = periodoSelecionado();
    if (periodo === 'todos') return { periodo, inicio: '', fim: '' };
    if (periodo === 'atual') return { periodo, ...faixaMes(0) };
    if (periodo === 'proximo') return { periodo, ...faixaMes(1) };
    if (periodo === 'anterior') return { periodo, ...faixaMes(-1) };
    if (periodo === 'atualProximo') {
      const atual = faixaMes(0), proximo = faixaMes(1);
      return { periodo, inicio: atual.inicio, fim: proximo.fim };
    }
    const atual = faixaMes(0);
    return {
      periodo: 'personalizado',
      inicio: document.getElementById('finPeriodoInicio')?.value || localStorage.getItem(CHAVE_INICIO) || atual.inicio,
      fim: document.getElementById('finPeriodoFim')?.value || localStorage.getItem(CHAVE_FIM) || atual.fim
    };
  }

  function dentroDaFaixa(valor, faixa) {
    if (faixa.periodo === 'todos') return true;
    const data = String(valor || '').slice(0, 10);
    if (!data) return false;
    if (faixa.inicio && data < faixa.inicio) return false;
    if (faixa.fim && data > faixa.fim) return false;
    return true;
  }

  function rotuloPeriodo(faixa = faixaSelecionada()) {
    const nomes = {
      atual: 'Mês atual',
      proximo: 'Próximo mês',
      anterior: 'Mês anterior',
      atualProximo: 'Mês atual + próximo',
      todos: 'Todos os períodos',
      personalizado: 'Período personalizado'
    };
    return nomes[faixa.periodo] || 'Período selecionado';
  }

  function atualizarCamposPersonalizados() {
    const personalizado = periodoSelecionado() === 'personalizado';
    const campos = document.getElementById('finPeriodoPersonalizado');
    if (campos) campos.classList.toggle('hidden', !personalizado);
    if (!personalizado) return;

    const atual = faixaMes(0);
    const inicio = document.getElementById('finPeriodoInicio');
    const fim = document.getElementById('finPeriodoFim');
    if (inicio && !inicio.value) inicio.value = localStorage.getItem(CHAVE_INICIO) || atual.inicio;
    if (fim && !fim.value) fim.value = localStorage.getItem(CHAVE_FIM) || atual.fim;
  }

  function instalarFiltroPeriodo() {
    const toolbar = document.querySelector('#visaoFinanceiro .financeiro-painel .financeiro-toolbar');
    if (!toolbar || document.getElementById('finPeriodoFiltro')) return false;

    const filtroStatus = document.getElementById('financeiroFiltro');
    const bloco = document.createElement('div');
    bloco.className = 'fin-periodo-filtro';
    bloco.innerHTML = `
      <select id="finPeriodoFiltro" aria-label="Período dos lançamentos" title="Período exibido no Financeiro">
        <option value="atual">Mês atual</option>
        <option value="proximo">Próximo mês</option>
        <option value="atualProximo">Mês atual + próximo</option>
        <option value="anterior">Mês anterior</option>
        <option value="todos">Todos os períodos</option>
        <option value="personalizado">Personalizado</option>
      </select>
      <div id="finPeriodoPersonalizado" class="fin-periodo-personalizado hidden">
        <label><span>De</span><input id="finPeriodoInicio" type="date"></label>
        <label><span>Até</span><input id="finPeriodoFim" type="date"></label>
      </div>`;

    if (filtroStatus) filtroStatus.insertAdjacentElement('beforebegin', bloco);
    else toolbar.appendChild(bloco);

    const select = document.getElementById('finPeriodoFiltro');
    const salvo = localStorage.getItem(CHAVE_PERIODO);
    if (['atual','proximo','atualProximo','anterior','todos','personalizado'].includes(salvo)) select.value = salvo;
    else select.value = 'atual';

    const inicio = document.getElementById('finPeriodoInicio');
    const fim = document.getElementById('finPeriodoFim');
    if (inicio) inicio.value = localStorage.getItem(CHAVE_INICIO) || '';
    if (fim) fim.value = localStorage.getItem(CHAVE_FIM) || '';

    select.addEventListener('change', () => {
      localStorage.setItem(CHAVE_PERIODO, select.value);
      atualizarCamposPersonalizados();
      window.renderizarTabelaFinanceiro?.();
      window.finRenderResumo?.();
    });
    inicio?.addEventListener('change', () => {
      localStorage.setItem(CHAVE_INICIO, inicio.value || '');
      window.renderizarTabelaFinanceiro?.();
      window.finRenderResumo?.();
    });
    fim?.addEventListener('change', () => {
      localStorage.setItem(CHAVE_FIM, fim.value || '');
      window.renderizarTabelaFinanceiro?.();
      window.finRenderResumo?.();
    });

    atualizarCamposPersonalizados();
    window.renderizarTabelaFinanceiro?.();
    window.finRenderResumo?.();
    return true;
  }

  /* Resumo: receber/pagar e movimentado acompanham o período selecionado.
     Em atraso continua global, pois representa tudo que já venceu e segue pendente. */
  window.finRenderResumo = function () {
    instalarFiltroPeriodo();
    const faixa = faixaSelecionada();
    const hoje = typeof finHoje === 'function' ? finHoje() : new Date().toISOString().slice(0, 10);
    const registros = typeof financeiroRegistros !== 'undefined' && Array.isArray(financeiroRegistros) ? financeiroRegistros : [];
    const pagamentos = typeof finPagamentos !== 'undefined' && Array.isArray(finPagamentos) ? finPagamentos : [];
    const saldo = typeof finSaldo === 'function' ? finSaldo : x => Math.max(0, Number(x.valor || 0) - Number(x.valor_pago || 0));

    const pendentes = registros.filter(x => x.status === 'Pendente');
    const pendentesPeriodo = pendentes.filter(x => dentroDaFaixa(x.vencimento, faixa));
    const receber = pendentesPeriodo.filter(x => x.tipo === 'Receber').reduce((s, x) => s + saldo(x), 0);
    const pagar = pendentesPeriodo.filter(x => x.tipo === 'Pagar').reduce((s, x) => s + saldo(x), 0);
    const atrasado = pendentes.filter(x => x.vencimento && x.vencimento < hoje).reduce((s, x) => s + saldo(x), 0);
    const movimentado = pagamentos.filter(x => dentroDaFaixa(x.pago_em, faixa)).reduce((s, x) => s + Number(x.valor || 0), 0);

    const el = document.getElementById('financeiroResumo');
    if (!el) return;
    const rotulo = rotuloPeriodo(faixa);
    el.innerHTML = [
      ['arrow-down-circle', 'A receber', receber, 'receber', rotulo],
      ['alert-triangle', 'Em atraso', atrasado, 'atraso', 'Todas as pendências vencidas'],
      ['arrow-up-circle', 'A pagar', pagar, 'pagar', rotulo],
      ['circle-check-big', 'Movimentado', movimentado, 'pago', rotulo]
    ].map(([icone, titulo, valor, classe, periodo]) => `<article class="${classe}" title="${periodo}"><i data-lucide="${icone}"></i><span>${titulo}<small>${periodo}</small></span><strong>${typeof osMoeda === 'function' ? osMoeda(valor) : moeda(valor)}</strong></article>`).join('');
    if (window.lucide) lucide.createIcons();
  };

  /* Tabela principal: busca + tipo/status + período funcionam em conjunto. */
  window.renderizarTabelaFinanceiro = function () {
    instalarFiltroPeriodo();
    const busca = (document.getElementById('financeiroBusca')?.value || '').toLowerCase();
    const filtro = document.getElementById('financeiroFiltro')?.value || '';
    const hoje = typeof finHoje === 'function' ? finHoje() : new Date().toISOString().slice(0, 10);
    const faixa = faixaSelecionada();
    const registros = typeof financeiroRegistros !== 'undefined' && Array.isArray(financeiroRegistros) ? financeiroRegistros : [];
    const saldoFn = typeof finSaldo === 'function' ? finSaldo : x => Math.max(0, Number(x.valor || 0) - Number(x.valor_pago || 0));
    const anexos = typeof finAnexos !== 'undefined' && Array.isArray(finAnexos) ? finAnexos : [];
    const html = typeof osHtml === 'function' ? osHtml : v => String(v ?? '');
    const data = typeof osData === 'function' ? osData : v => v || '—';
    const moedaFn = typeof osMoeda === 'function' ? osMoeda : moeda;
    const pode = chave => typeof finPermissao === 'function' ? finPermissao(chave) : true;

    const lista = registros.filter(x => {
      const atraso = x.status === 'Pendente' && x.vencimento < hoje;
      const bateBusca = !busca || [x.descricao, x.categoria, x.ordens_servico?.numero, x.financeiro_fornecedores?.nome].join(' ').toLowerCase().includes(busca);
      const bateFiltro = !filtro || x.tipo === filtro || x.status === filtro || (filtro === 'Atrasado' && atraso);
      const batePeriodo = dentroDaFaixa(x.vencimento, faixa);
      return bateBusca && bateFiltro && batePeriodo;
    });

    const tabela = document.getElementById('financeiroTabela');
    if (!tabela) return;
    tabela.innerHTML = `<div class="financeiro-table-wrap"><table><thead><tr><th>Descrição</th><th>Tipo</th><th>Vencimento</th><th>Valor / saldo</th><th>Status</th><th>Ações</th></tr></thead><tbody>${lista.map(x => {
      const atraso = x.status === 'Pendente' && x.vencimento < hoje;
      const parcela = x.parcelas_total ? ` · ${x.parcela_numero}/${x.parcelas_total}` : '';
      const saldo = saldoFn(x);
      const qtdAnexos = anexos.filter(a => a.lancamento_id === x.id).length;
      return `<tr><td><b>${html(x.descricao)}${parcela}</b><small>${html(x.categoria)}${x.financeiro_fornecedores?.nome ? ' · ' + html(x.financeiro_fornecedores.nome) : ''}</small></td><td><span class="fin-tipo ${String(x.tipo || '').toLowerCase()}">${html(x.tipo)}</span></td><td>${data(x.vencimento)}</td><td><b>${moedaFn(x.valor)}</b>${Number(x.valor_pago) > 0 ? `<small>Pago ${moedaFn(x.valor_pago)} · saldo ${moedaFn(saldo)}</small>` : ''}</td><td><span class="fin-status ${atraso ? 'atrasado' : String(x.status || '').toLowerCase()}">${atraso ? 'Atrasado' : Number(x.valor_pago) > 0 && saldo > 0 ? 'Parcial' : html(x.status)}</span>${x.conciliado ? '<small class="fin-conciliado">Conciliado</small>' : ''}</td><td><div class="fin-acoes">${x.status === 'Pendente' && pode('financeiroBaixar') ? `<button title="Registrar pagamento" onclick="finAbrirBaixa(${x.id})"><i data-lucide="badge-check"></i></button>` : ''}<button title="Cobrar pelo WhatsApp" onclick="finCobrarWhatsApp(${x.id})"><i data-lucide="message-circle"></i></button><button title="Anexos (${qtdAnexos})" onclick="finAbrirAnexos(${x.id})"><i data-lucide="paperclip"></i></button>${pode('financeiroCriar') ? `<button title="Editar" onclick="editarFinanceiro(${x.id})"><i data-lucide="pencil"></i></button>` : ''}${pode('financeiroExcluir') ? `<button title="Excluir" onclick="excluirFinanceiro(${x.id})"><i data-lucide="trash-2"></i></button>` : ''}</div></td></tr>`;
    }).join('') || `<tr><td colspan="6" class="fin-vazio">Nenhum lançamento encontrado em ${rotuloPeriodo(faixa).toLowerCase()}.</td></tr>`}</tbody></table></div>`;
    if (window.lucide) lucide.createIcons();
  };

  /* Mantém os pins do Dashboard no mês atual; o filtro acima pertence à tela Financeiro. */
  async function totaisPendentesMesAtual() {
    if (!window.supabaseClient) return null;
    const { data, error } = await supabaseClient.from('financeiro_lancamentos').select('id,tipo,valor,valor_pago,vencimento,status').eq('status', 'Pendente');
    if (error) return null;
    const faixa = faixaMes(0);
    let receber = 0, pagar = 0;
    (data || []).forEach(x => {
      if (!dentroDaFaixa(x.vencimento, { periodo: 'atual', ...faixa })) return;
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
      const totais = await totaisPendentesMesAtual();
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
    } finally { corrigindoPins = false; }
  }

  const atualizarPinsOriginal = window.atualizarPinsFinanceiros;
  if (typeof atualizarPinsOriginal === 'function') {
    window.atualizarPinsFinanceiros = async function () {
      await atualizarPinsOriginal.apply(this, arguments);
      await corrigirPinsFinanceirosMensais();
    };
  }

  function observar() {
    instalarFiltroPeriodo();
    const dashboard = document.getElementById('dashboardWidgets');
    if (dashboard && dashboard.dataset.resumoMensalObservado !== '1') {
      dashboard.dataset.resumoMensalObservado = '1';
      let timer;
      new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(corrigirPinsFinanceirosMensais, 80);
      }).observe(dashboard, { childList: true, subtree: true });
      corrigirPinsFinanceirosMensais();
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .fin-periodo-filtro{display:flex;align-items:center;gap:8px;min-width:0}
    .fin-periodo-filtro>select{min-width:185px}
    .fin-periodo-personalizado{display:flex;align-items:center;gap:7px}
    .fin-periodo-personalizado.hidden{display:none!important}
    .fin-periodo-personalizado label{display:flex;align-items:center;gap:5px;color:var(--text-muted);font-size:10px;font-weight:700;text-transform:uppercase;white-space:nowrap}
    .fin-periodo-personalizado input{min-width:132px}
    #financeiroResumo article span small{display:block;margin-top:4px;font-size:9px;font-weight:500;text-transform:none;letter-spacing:0;color:var(--text-muted);opacity:.9}
    @media(max-width:980px){.financeiro-toolbar{flex-wrap:wrap}.fin-periodo-filtro{width:100%;flex-wrap:wrap}.fin-periodo-filtro>select{flex:1}.fin-periodo-personalizado{flex:1;flex-wrap:wrap}.fin-periodo-personalizado label{flex:1}.fin-periodo-personalizado input{width:100%;min-width:0}}
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observar, { once: true });
  else observar();
  new MutationObserver(observar).observe(document.documentElement, { childList: true, subtree: true });
})();
