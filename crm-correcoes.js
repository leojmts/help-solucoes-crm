/* Correcoes integradas: financeiro, OS e importacao de clientes. */
let finContas = [], finTransferencias = [], finOfxImportacoes = [], finOfxMovimentos = [], clientesOSCache = [];
const dataLocalISO = (d = new Date()) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};

function instalarCorrecoesCRM() {
  instalarContasFinanceirasUI();
  instalarConciliacaoOFX();
  instalarClientesOS();
  instalarImportacaoClientes();
  instalarFiltroDataRelatorio();
  if (window.lucide) lucide.createIcons();
}

function instalarContasFinanceirasUI() {
  const grid = document.querySelector('#modalFinBaixa .os-form-grid');
  if (grid && !document.getElementById('finBaixaConta')) {
    const referencia = document.getElementById('finBaixaReferencia')?.closest('label');
    referencia?.insertAdjacentHTML('afterend', '<label><span>Conta de destino / origem *</span><select id="finBaixaConta"></select></label>');
    const forma = document.getElementById('finBaixaForma');
    forma?.addEventListener('input', finSugerirContaPagamento);
    forma?.addEventListener('change', finSugerirContaPagamento);
  }
  if (!document.getElementById('modalFinTransferencia')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="modalFinTransferencia" class="modal-overlay os-overlay" onclick="if(event.target===this)finFechar('modalFinTransferencia')">
        <div class="modal financeiro-modal"><div class="os-modal-head"><div><span class="os-kicker">MOVIMENTAÇÃO INTERNA</span><h3>Transferir entre contas</h3><p>Ex.: retirar dinheiro do caixa e depositar no banco.</p></div><button class="os-close" onclick="finFechar('modalFinTransferencia')"><i data-lucide="x"></i></button></div>
        <div class="os-form-grid"><label><span>Conta de origem *</span><select id="finTransOrigem"></select></label><label><span>Conta de destino *</span><select id="finTransDestino"></select></label><label><span>Valor *</span><input id="finTransValor" type="number" min="0.01" step="0.01"></label><label><span>Data *</span><input id="finTransData" type="date"></label><label class="full"><span>Observações</span><textarea id="finTransObs" rows="3" placeholder="Motivo ou referência da transferência"></textarea></label></div>
        <div class="modal-actions"><button class="btn btn-secondary" onclick="finFechar('modalFinTransferencia')">Cancelar</button><button class="btn btn-primary" onclick="finSalvarTransferencia()"><i data-lucide="arrow-left-right"></i>Transferir</button></div></div>
      </div>
      <div id="modalFinConta" class="modal-overlay os-overlay" onclick="if(event.target===this)finFechar('modalFinConta')">
        <div class="modal financeiro-modal"><div class="os-modal-head"><div><span class="os-kicker">CONTA FINANCEIRA</span><h3>Nova conta</h3></div><button class="os-close" onclick="finFechar('modalFinConta')"><i data-lucide="x"></i></button></div>
        <div class="os-form-grid"><label class="full"><span>Nome *</span><input id="finContaNome" placeholder="Ex.: Sicredi, Nubank, Cofre"></label><label><span>Tipo *</span><select id="finContaTipo"><option>Banco</option><option>Caixa</option><option>Carteira</option></select></label><label><span>Saldo inicial</span><input id="finContaSaldo" type="number" step="0.01" value="0"></label></div>
        <div class="modal-actions"><button class="btn btn-secondary" onclick="finFechar('modalFinConta')">Cancelar</button><button class="btn btn-primary" onclick="finSalvarConta()">Salvar conta</button></div></div>
      </div>`);
  }
}

async function carregarContasFinanceiras() {
  const [contas, transferencias] = await Promise.all([
    supabaseClient.from('financeiro_contas').select('*').eq('ativo', true).order('tipo').order('nome'),
    supabaseClient.from('financeiro_transferencias').select('*,origem:financeiro_contas!financeiro_transferencias_conta_origem_id_fkey(nome,tipo),destino:financeiro_contas!financeiro_transferencias_conta_destino_id_fkey(nome,tipo)').order('data', { ascending: false }).limit(100)
  ]);
  if (contas.error || transferencias.error) throw contas.error || transferencias.error;
  finContas = contas.data || [];
  finTransferencias = transferencias.data || [];
  finPreencherContasBaixa();
}

const carregarFinanceiroAvancadoAnterior = carregarFinanceiroAvancado;
carregarFinanceiroAvancado = async function () {
  await carregarFinanceiroAvancadoAnterior();
  try {
    await carregarContasFinanceiras();
    finRenderFluxo();
    finRenderCaixa();
  } catch (e) {
    ['finPainelFluxo', 'finPainelCaixa'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<div class="fin-estado"><i data-lucide="circle-alert"></i><b>Não foi possível carregar</b><span>${osHtml(e.message)}</span><button class="btn btn-secondary" onclick="carregarFinanceiroAvancado()">Tentar novamente</button></div>`;
    });
  }
};

finAba = async function (aba, btn) {
  const view = document.getElementById('visaoFinanceiro');
  if (!view) return;
  view.querySelectorAll('[data-fin-painel]').forEach(x => {
    const ativo = x.dataset.finPainel === aba;
    x.classList.toggle('hidden', !ativo);
    x.setAttribute('aria-hidden', String(!ativo));
  });
  view.querySelectorAll('#finNavegacao button').forEach(x => {
    const ativo = x === btn || x.dataset.finAba === aba;
    x.classList.toggle('active', ativo);
    x.setAttribute('aria-selected', String(ativo));
  });
  btn?.classList.add('active');
  const painel = view.querySelector(`[data-fin-painel="${aba}"]`);
  if (painel && aba !== 'lancamentos') painel.innerHTML = '<div class="fin-estado"><span class="fin-spinner"></span><b>Carregando informações...</b></div>';
  try {
    if (!finContas.length) await carregarContasFinanceiras();
    if (!financeiroRegistros.length) await renderizarFinanceiroBase();
    const render = { fluxo: finRenderFluxo, recorrencias: finRenderRecorrencias, fornecedores: finRenderFornecedores, caixa: finRenderCaixa, conciliacao: finRenderConciliacao }[aba];
    if (render) await render();
  } catch (e) {
    if (painel) painel.innerHTML = `<div class="fin-estado"><i data-lucide="circle-alert"></i><b>Falha ao abrir esta área</b><span>${osHtml(e.message)}</span></div>`;
  }
  if (window.lucide) lucide.createIcons();
};

function finPreencherContasBaixa() {
  const select = document.getElementById('finBaixaConta');
  if (!select) return;
  const atual = select.value;
  select.innerHTML = finContas.map(x => `<option value="${x.id}">${osHtml(x.nome)} · ${x.tipo}</option>`).join('');
  if (finContas.some(x => String(x.id) === atual)) select.value = atual;
  else finSugerirContaPagamento();
}

function finSugerirContaPagamento() {
  const select = document.getElementById('finBaixaConta');
  if (!select || !finContas.length) return;
  const forma = (document.getElementById('finBaixaForma')?.value || '').toLowerCase();
  const tipo = /dinheiro|esp[eé]cie/.test(forma) ? 'Caixa' : /pix|transfer|ted|doc|boleto|cart[aã]o/.test(forma) ? 'Banco' : '';
  const conta = finContas.find(x => x.tipo === tipo) || finContas[0];
  if (conta) select.value = conta.id;
}

const finAbrirBaixaAnterior = finAbrirBaixa;
finAbrirBaixa = async function (id) {
  if (!finContas.length) await carregarContasFinanceiras();
  await finAbrirBaixaAnterior(id);
  finPreencherContasBaixa();
  finSugerirContaPagamento();
};

finSalvarBaixa = async function () {
  if (!finPermissao('financeiroBaixar')) return avisarModulo('Sem permissão para dar baixa.');
  const id = Number(document.getElementById('finBaixaId').value), x = financeiroRegistros.find(a => a.id === id);
  const valor = Number(document.getElementById('finBaixaValor').value), contaId = Number(document.getElementById('finBaixaConta').value);
  if (!x || valor <= 0 || valor > finSaldo(x)) return avisarModulo('Informe um valor válido até ' + osMoeda(finSaldo(x)));
  const conta = finContas.find(a => a.id === contaId);
  if (!conta) return avisarModulo('Escolha a conta que receberá ou pagará este valor.');
  const conciliar = document.getElementById('finBaixaConciliar').checked;
  const payload = { lancamento_id: id, conta_id: contaId, valor, pago_em: document.getElementById('finBaixaData').value, forma_pagamento: document.getElementById('finBaixaForma').value.trim(), referencia_transacao: document.getElementById('finBaixaReferencia').value.trim(), observacoes: document.getElementById('finBaixaObs').value.trim(), responsavel_id: usuarioLogado.id };
  const { error } = await supabaseClient.from('financeiro_pagamentos').insert(payload);
  if (error) return avisarModulo(error.message);
  await supabaseClient.from('financeiro_lancamentos').update({ referencia_transacao: payload.referencia_transacao, baixado_por: usuarioLogado.id, conciliado: conciliar, conciliado_em: conciliar ? new Date().toISOString() : null }).eq('id', id);
  if (conta.tipo === 'Caixa' && finCaixaAtual) {
    await supabaseClient.from('financeiro_caixa_movimentos').insert({ caixa_id: finCaixaAtual.id, lancamento_id: id, tipo: x.tipo === 'Receber' ? 'Entrada' : 'Saída', descricao: x.descricao, valor });
  }
  finFechar('modalFinBaixa');
  await renderizarFinanceiro();
  avisarModulo(finSaldo(x) > valor ? `Baixa parcial registrada em ${conta.nome}.` : `Pagamento concluído em ${conta.nome}.`);
};

function finSaldoConta(conta) {
  const pagamentos = finPagamentos.filter(p => p.conta_id === conta.id).reduce((s, p) => {
    const lanc = financeiroRegistros.find(x => x.id === p.lancamento_id);
    return s + (lanc?.tipo === 'Pagar' ? -1 : 1) * Number(p.valor);
  }, 0);
  const transferido = finTransferencias.reduce((s, t) => s + (t.conta_destino_id === conta.id ? Number(t.valor) : 0) - (t.conta_origem_id === conta.id ? Number(t.valor) : 0), 0);
  return Number(conta.saldo_inicial || 0) + pagamentos + transferido;
}

finRenderCaixa = async function () {
  const el = document.getElementById('finPainelCaixa'); if (!el) return;
  let mov = [];
  if (finCaixaAtual) {
    const { data, error } = await supabaseClient.from('financeiro_caixa_movimentos').select('*').eq('caixa_id', finCaixaAtual.id).order('criado_em', { ascending: false });
    if (error) throw error; mov = data || [];
  }
  const calc = finCaixaAtual ? Number(finCaixaAtual.saldo_inicial) + mov.reduce((s, x) => s + (['Entrada', 'Suprimento'].includes(x.tipo) ? 1 : -1) * Number(x.valor), 0) : 0;
  el.innerHTML = `<div class="fin-section-head"><div><span class="os-kicker">CONTAS E CAIXA</span><h2>Onde o dinheiro está</h2><p>Dinheiro vai para o CAIXA; PIX e transferências podem ir para a conta bancária escolhida.</p></div><div class="actions">${finPermissao('financeiroCriar') ? '<button class="btn btn-secondary" onclick="finAbrirNovaConta()"><i data-lucide="landmark"></i>Nova conta</button>' : ''}${finPermissao('financeiroBaixar') ? '<button class="btn btn-primary" onclick="finAbrirTransferencia()"><i data-lucide="arrow-left-right"></i>Transferir</button>' : ''}</div></div>
    <div class="fin-contas">${finContas.map(c => `<article><span><i data-lucide="${c.tipo === 'Caixa' ? 'banknote' : c.tipo === 'Banco' ? 'landmark' : 'wallet-cards'}"></i>${osHtml(c.tipo)}</span><b>${osHtml(c.nome)}</b><strong>${osMoeda(finSaldoConta(c))}</strong></article>`).join('') || '<p class="fin-vazio">Nenhuma conta cadastrada.</p>'}</div>
    <section class="fin-caixa-operacional"><div class="fin-section-head"><div><h3>${finCaixaAtual ? 'Caixa operacional aberto' : 'Caixa operacional fechado'}</h3><p>${finCaixaAtual ? 'Aberto em ' + new Date(finCaixaAtual.aberto_em).toLocaleString('pt-BR') : 'Abra o caixa para conferir entradas, retiradas e divergências do turno.'}</p></div><div class="actions">${finCaixaAtual && finPermissao('financeiroBaixar') ? '<button class="btn btn-secondary" onclick="finAbrirMovimentoCaixa()">Movimento</button>' : ''}${finPermissao('financeiroBaixar') ? `<button class="btn btn-secondary" onclick="finAbrirCaixa()">${finCaixaAtual ? 'Fechar caixa' : 'Abrir caixa'}</button>` : ''}</div></div>${finCaixaAtual ? `<div class="fin-kpis"><article><span>Saldo inicial</span><b>${osMoeda(finCaixaAtual.saldo_inicial)}</b></article><article><span>Saldo calculado</span><b>${osMoeda(calc)}</b></article><article><span>Movimentos</span><b>${mov.length}</b></article></div>` : ''}</section>
    <section><div class="fin-section-head"><div><h3>Últimas transferências</h3><p>Movimentações entre caixa, bancos e carteiras.</p></div></div><div class="fin-cards">${finTransferencias.slice(0, 12).map(t => `<article><div><b>${osHtml(t.origem?.nome)} → ${osHtml(t.destino?.nome)}</b><small>${osData(t.data)}${t.observacoes ? ' · ' + osHtml(t.observacoes) : ''}</small></div><strong>${osMoeda(t.valor)}</strong></article>`).join('') || '<p class="fin-vazio">Nenhuma transferência registrada.</p>'}</div></section>`;
  if (window.lucide) lucide.createIcons();
};

function finAbrirNovaConta() {
  document.getElementById('finContaNome').value = '';
  document.getElementById('finContaTipo').value = 'Banco';
  document.getElementById('finContaSaldo').value = '0';
  document.getElementById('modalFinConta').classList.add('active');
}
async function finSalvarConta() {
  const payload = { nome: document.getElementById('finContaNome').value.trim(), tipo: document.getElementById('finContaTipo').value, saldo_inicial: Number(document.getElementById('finContaSaldo').value || 0), atualizado_em: new Date().toISOString() };
  if (!payload.nome) return avisarModulo('Informe o nome da conta.');
  const { error } = await supabaseClient.from('financeiro_contas').insert(payload);
  if (error) return avisarModulo(error.message);
  finFechar('modalFinConta'); await carregarContasFinanceiras(); finRenderCaixa();
}
function finAbrirTransferencia() {
  if (finContas.length < 2) return avisarModulo('Cadastre pelo menos duas contas.');
  const opcoes = finContas.map(c => `<option value="${c.id}">${osHtml(c.nome)} · ${osMoeda(finSaldoConta(c))}</option>`).join('');
  document.getElementById('finTransOrigem').innerHTML = opcoes;
  document.getElementById('finTransDestino').innerHTML = opcoes;
  document.getElementById('finTransDestino').selectedIndex = 1;
  document.getElementById('finTransValor').value = '';
  document.getElementById('finTransData').value = dataLocalISO();
  document.getElementById('finTransObs').value = '';
  document.getElementById('modalFinTransferencia').classList.add('active');
}
async function finSalvarTransferencia() {
  const origem = Number(document.getElementById('finTransOrigem').value), destino = Number(document.getElementById('finTransDestino').value), valor = Number(document.getElementById('finTransValor').value);
  if (!origem || !destino || origem === destino || valor <= 0) return avisarModulo('Escolha contas diferentes e informe um valor válido.');
  const contaOrigem = finContas.find(x => x.id === origem);
  if (valor > finSaldoConta(contaOrigem)) return avisarModulo('O valor ultrapassa o saldo disponível na conta de origem.');
  const payload = { conta_origem_id: origem, conta_destino_id: destino, valor, data: document.getElementById('finTransData').value, observacoes: document.getElementById('finTransObs').value.trim(), criado_por: usuarioLogado.id };
  const { error } = await supabaseClient.from('financeiro_transferencias').insert(payload);
  if (error) return avisarModulo(error.message);
  if (contaOrigem?.tipo === 'Caixa' && finCaixaAtual) await supabaseClient.from('financeiro_caixa_movimentos').insert({ caixa_id: finCaixaAtual.id, tipo: 'Retirada', descricao: `Transferência para ${finContas.find(x => x.id === destino)?.nome}`, valor });
  finFechar('modalFinTransferencia'); await carregarContasFinanceiras(); finRenderCaixa(); avisarModulo('Transferência registrada.');
}

function instalarConciliacaoOFX() {
  if (document.getElementById('finArquivoOFX')) return;
  document.body.insertAdjacentHTML('beforeend', '<input id="finArquivoOFX" class="hidden" type="file" accept=".ofx,.qfx,application/x-ofx,text/ofx" onchange="finImportarOFX(this.files[0]);this.value=\'\'">');
}

async function carregarConciliacaoOFX() {
  const [importacoes, movimentos] = await Promise.all([
    supabaseClient.from('financeiro_ofx_importacoes').select('*,financeiro_contas(nome,tipo)').order('criado_em', { ascending: false }).limit(50),
    supabaseClient.from('financeiro_ofx_movimentos').select('*,financeiro_contas(nome,tipo),financeiro_ofx_importacoes(nome_arquivo,criado_em)').order('data', { ascending: false }).limit(1000)
  ]);
  if (importacoes.error || movimentos.error) throw importacoes.error || movimentos.error;
  finOfxImportacoes = importacoes.data || [];
  finOfxMovimentos = movimentos.data || [];
}

function finOfxCandidatos(movimento) {
  const usados = new Set(finOfxMovimentos.filter(x => x.status === 'Conciliado' && x.pagamento_id && x.id !== movimento.id).map(x => Number(x.pagamento_id)));
  const tipoEsperado = Number(movimento.valor) > 0 ? 'Receber' : 'Pagar';
  const dataMov = new Date(`${movimento.data}T12:00:00`);
  return finPagamentos.map(p => ({ pagamento: p, lancamento: financeiroRegistros.find(x => Number(x.id) === Number(p.lancamento_id)) }))
    .filter(x => x.lancamento && x.lancamento.tipo === tipoEsperado && Number(x.pagamento.conta_id) === Number(movimento.conta_id) && !usados.has(Number(x.pagamento.id)) && Math.abs(Number(x.pagamento.valor) - Math.abs(Number(movimento.valor))) < 0.01 && Math.abs(new Date(`${x.pagamento.pago_em}T12:00:00`) - dataMov) <= 7 * 86400000)
    .sort((a, b) => Math.abs(new Date(`${a.pagamento.pago_em}T12:00:00`) - dataMov) - Math.abs(new Date(`${b.pagamento.pago_em}T12:00:00`) - dataMov))
    .slice(0, 10);
}

async function finRenderConciliacao(recarregar = true) {
  const el = document.getElementById('finPainelConciliacao'); if (!el) return;
  const contaAtual = document.getElementById('finOfxContaFiltro')?.value || '';
  const statusAtual = document.getElementById('finOfxStatusFiltro')?.value || '';
  const buscaAtual = document.getElementById('finOfxBusca')?.value || '';
  try {
    if (!finContas.length) await carregarContasFinanceiras();
    if (!finPagamentos.length || !financeiroRegistros.length) await renderizarFinanceiroBase();
    if (recarregar) await carregarConciliacaoOFX();
  } catch (e) {
    el.innerHTML = `<div class="fin-estado"><i data-lucide="circle-alert"></i><b>Não foi possível carregar a conciliação</b><span>${osHtml(e.message)}</span><button class="btn btn-secondary" onclick="finRenderConciliacao()">Tentar novamente</button></div>`;
    if (window.lucide) lucide.createIcons(); return;
  }
  const contas = finContas.filter(x => x.tipo !== 'Caixa');
  if (!contas.length) {
    el.innerHTML = '<div class="fin-estado"><i data-lucide="landmark"></i><b>Cadastre uma conta bancária primeiro</b><span>Abra “Controle de caixa” e crie uma conta do tipo Banco.</span></div>';
    if (window.lucide) lucide.createIcons(); return;
  }
  const contaSelecionada = contaAtual && contas.some(x => String(x.id) === contaAtual) ? contaAtual : String(contas[0].id);
  const termo = buscaAtual.toLocaleLowerCase('pt-BR');
  const lista = finOfxMovimentos.filter(x => String(x.conta_id) === contaSelecionada && (!statusAtual || x.status === statusAtual) && (!termo || `${x.descricao} ${x.documento} ${x.fitid}`.toLocaleLowerCase('pt-BR').includes(termo)));
  const daConta = finOfxMovimentos.filter(x => String(x.conta_id) === contaSelecionada);
  const total = daConta.reduce((s, x) => s + Number(x.valor), 0);
  el.innerHTML = `<div class="fin-section-head"><div><span class="os-kicker">CONCILIAÇÃO BANCÁRIA</span><h2>Extratos OFX</h2><p>Compare o extrato do banco com as baixas registradas no CRM.</p></div>${finPermissao('financeiroBaixar') ? '<button class="btn btn-primary" onclick="finSelecionarArquivoOFX()"><i data-lucide="file-up"></i>Importar OFX</button>' : ''}</div>
    <div class="fin-ofx-toolbar"><label><span>Conta bancária</span><select id="finOfxContaFiltro" onchange="finRenderConciliacao(false)">${contas.map(c => `<option value="${c.id}" ${String(c.id) === contaSelecionada ? 'selected' : ''}>${osHtml(c.nome)}</option>`).join('')}</select></label><label><span>Status</span><select id="finOfxStatusFiltro" onchange="finRenderConciliacao(false)"><option value="">Todos</option>${['Pendente','Conciliado','Ignorado'].map(s => `<option ${s === statusAtual ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="fin-ofx-busca"><span>Pesquisar</span><input id="finOfxBusca" value="${osHtml(buscaAtual)}" placeholder="Descrição, documento ou FITID" oninput="clearTimeout(window.finOfxBuscaTimer);window.finOfxBuscaTimer=setTimeout(()=>finRenderConciliacao(false),250)"></label></div>
    <div class="fin-kpis fin-ofx-kpis"><article><span>Movimentos</span><b>${daConta.length}</b></article><article><span>Pendentes</span><b>${daConta.filter(x => x.status === 'Pendente').length}</b></article><article><span>Conciliados</span><b>${daConta.filter(x => x.status === 'Conciliado').length}</b></article><article><span>Resultado do extrato</span><b>${osMoeda(total)}</b></article></div>
    <div class="fin-ofx-lista">${lista.map(m => {
      const candidatos = finOfxCandidatos(m), pagamento = finPagamentos.find(p => Number(p.id) === Number(m.pagamento_id)), lancamento = pagamento && financeiroRegistros.find(x => Number(x.id) === Number(pagamento.lancamento_id));
      const sugestoes = candidatos.map((x, i) => `<option value="${x.pagamento.id}" ${i === 0 ? 'selected' : ''}>${osData(x.pagamento.pago_em)} · ${osHtml(x.lancamento.descricao)} · ${osMoeda(x.pagamento.valor)}</option>`).join('');
      return `<article class="fin-ofx-item ${m.status.toLowerCase()}"><div class="fin-ofx-principal"><span class="fin-ofx-data">${osData(m.data)}</span><div class="fin-ofx-descricao"><b>${osHtml(m.descricao || 'Movimento sem descrição')}</b><small>${osHtml(m.documento || m.fitid)} · ${osHtml(m.financeiro_ofx_importacoes?.nome_arquivo || '')}</small></div><strong class="fin-ofx-valor ${Number(m.valor) >= 0 ? 'credito' : 'debito'}">${Number(m.valor) >= 0 ? '+' : '−'} ${osMoeda(Math.abs(Number(m.valor)))}</strong><span class="fin-status ${m.status.toLowerCase()}">${m.status}</span></div>${m.status === 'Pendente' ? `<div class="fin-ofx-match"><select id="finOfxMatch-${m.id}"><option value="">${candidatos.length ? 'Escolha uma baixa' : 'Nenhuma baixa compatível'}</option>${sugestoes}</select><button class="btn btn-primary" ${candidatos.length ? '' : 'disabled'} onclick="finConciliarOFX('${m.id}')"><i data-lucide="link-2"></i>Conciliar</button><button class="btn btn-secondary" onclick="finIgnorarOFX('${m.id}')">Ignorar</button></div>` : m.status === 'Conciliado' ? `<div class="fin-ofx-vinculo"><span><i data-lucide="circle-check"></i>Vinculado a ${osHtml(lancamento?.descricao || 'pagamento registrado')} · ${pagamento ? osMoeda(pagamento.valor) : ''}</span><button onclick="finDesfazerConciliacaoOFX('${m.id}')">Desfazer</button></div>` : `<div class="fin-ofx-vinculo ignorado"><span>Movimento ignorado na conciliação</span><button onclick="finDesfazerConciliacaoOFX('${m.id}')">Reabrir</button></div>`}</article>`;
    }).join('') || '<div class="fin-estado fin-ofx-vazio"><i data-lucide="file-search"></i><b>Nenhum movimento encontrado</b><span>Importe o extrato OFX desta conta ou altere os filtros.</span></div>'}</div>
    <div class="fin-ofx-importacoes"><h4>Importações recentes</h4><div class="fin-ofx-importacoes-lista">${finOfxImportacoes.filter(x => String(x.conta_id) === contaSelecionada).slice(0, 5).map(x => `<div><strong>${osHtml(x.nome_arquivo)}</strong><span>${x.quantidade} movimento(s)</span><span>${new Date(x.criado_em).toLocaleDateString('pt-BR')}</span></div>`).join('') || '<span>Nenhum arquivo importado nesta conta.</span>'}</div></div>`;
  if (window.lucide) lucide.createIcons();
}

function finSelecionarArquivoOFX() {
  const conta = document.getElementById('finOfxContaFiltro')?.value;
  if (!conta) return avisarModulo('Escolha a conta bancária antes de importar.');
  document.getElementById('finArquivoOFX').click();
}

const finOfxTag = (texto, tag) => {
  const achou = texto.match(new RegExp(`<${tag}>\\s*([^<\\r\\n]+)`, 'i'));
  return (achou?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
};
const finOfxData = valor => { const m = String(valor || '').match(/(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };
const finOfxTexto = valor => String(valor || '').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').trim();
function finOfxIdAlternativo(texto) { let h = 2166136261; for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); } return `AUTO-${(h >>> 0).toString(16).padStart(8, '0')}`; }
async function finHashArquivo(arquivo) { const bytes = new Uint8Array(await arquivo.arrayBuffer()), hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)); return [...hash].map(x => x.toString(16).padStart(2, '0')).join(''); }

function finParseOFX(texto) {
  const movimentos = []; const regex = /<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi; let achou;
  while ((achou = regex.exec(texto)) && movimentos.length < 5000) {
    const bloco = achou[1], data = finOfxData(finOfxTag(bloco, 'DTPOSTED')), bruto = finOfxTag(bloco, 'TRNAMT'), valor = Number(String(bruto).replace(',', '.'));
    if (!data || !Number.isFinite(valor) || valor === 0) continue;
    const descricao = finOfxTexto(finOfxTag(bloco, 'MEMO') || finOfxTag(bloco, 'NAME') || finOfxTag(bloco, 'PAYEEID'));
    const documento = finOfxTexto(finOfxTag(bloco, 'CHECKNUM') || finOfxTag(bloco, 'REFNUM'));
    const informado = finOfxTexto(finOfxTag(bloco, 'FITID'));
    movimentos.push({ data, valor: Math.round(valor * 100) / 100, tipo: valor >= 0 ? 'Crédito' : 'Débito', descricao: descricao.slice(0, 500), documento: documento.slice(0, 120), fitid: (informado || finOfxIdAlternativo(`${data}|${valor}|${descricao}|${documento}|${movimentos.length}`)).slice(0, 255) });
  }
  return { movimentos, bancoId: finOfxTexto(finOfxTag(texto, 'BANKID')).slice(0, 50), agencia: finOfxTexto(finOfxTag(texto, 'BRANCHID')).slice(0, 50), contaBancaria: finOfxTexto(finOfxTag(texto, 'ACCTID')).slice(0, 100) };
}

async function finImportarOFX(arquivo) {
  if (!arquivo) return;
  if (!finPermissao('financeiroBaixar')) return avisarModulo('Você não possui permissão para importar extratos.');
  if (!/\.(ofx|qfx)$/i.test(arquivo.name)) return avisarModulo('Selecione um arquivo OFX ou QFX.');
  if (arquivo.size > 5 * 1024 * 1024) return avisarModulo('O arquivo deve ter no máximo 5 MB.');
  const contaId = Number(document.getElementById('finOfxContaFiltro')?.value); if (!contaId) return avisarModulo('Escolha a conta bancária.');
  let parsed; try { parsed = finParseOFX(await arquivo.text()); } catch (e) { return avisarModulo(`Não foi possível ler o OFX: ${e.message}`); }
  if (!parsed.movimentos.length) return avisarModulo('Nenhum movimento bancário válido foi encontrado neste OFX.');
  const hash = await finHashArquivo(arquivo), datas = parsed.movimentos.map(x => x.data).sort();
  const { data: lote, error } = await supabaseClient.from('financeiro_ofx_importacoes').insert({ conta_id: contaId, nome_arquivo: arquivo.name.slice(0, 255), hash_arquivo: hash, banco_id: parsed.bancoId, agencia: parsed.agencia, conta_bancaria: parsed.contaBancaria, data_inicio: datas[0], data_fim: datas.at(-1), quantidade: parsed.movimentos.length, importado_por: usuarioLogado.id }).select('id').single();
  if (error) return avisarModulo(error.code === '23505' ? 'Este mesmo arquivo OFX já foi importado nesta conta.' : error.message);
  let importados = 0;
  for (let i = 0; i < parsed.movimentos.length; i += 250) {
    const dados = parsed.movimentos.slice(i, i + 250).map(x => ({ ...x, importacao_id: lote.id, conta_id: contaId }));
    const r = await supabaseClient.from('financeiro_ofx_movimentos').upsert(dados, { onConflict: 'conta_id,fitid', ignoreDuplicates: true }).select('id');
    if (r.error) return avisarModulo(`O lote foi criado, mas houve falha nos movimentos: ${r.error.message}`);
    importados += (r.data || []).length;
  }
  await finRenderConciliacao(); avisarModulo(`${importados} movimento(s) novo(s) importado(s). ${parsed.movimentos.length - importados} duplicado(s) ignorado(s).`);
}

async function finConciliarOFX(id) {
  if (!finPermissao('financeiroBaixar')) return avisarModulo('Sem permissão para conciliar.');
  const movimento = finOfxMovimentos.find(x => x.id === id), pagamentoId = Number(document.getElementById(`finOfxMatch-${id}`)?.value), pagamento = finPagamentos.find(x => Number(x.id) === pagamentoId), lancamento = pagamento && financeiroRegistros.find(x => Number(x.id) === Number(pagamento.lancamento_id));
  if (!movimento || !pagamentoId || !pagamento) return avisarModulo('Escolha uma baixa compatível.');
  if (!lancamento || Number(pagamento.conta_id) !== Number(movimento.conta_id) || lancamento.tipo !== (Number(movimento.valor) > 0 ? 'Receber' : 'Pagar')) return avisarModulo('A baixa escolhida não pertence à mesma conta ou ao mesmo tipo de movimento.');
  if (Math.abs(Number(pagamento.valor) - Math.abs(Number(movimento.valor))) >= 0.01) return avisarModulo('O valor do extrato é diferente do pagamento escolhido.');
  const { error } = await supabaseClient.from('financeiro_ofx_movimentos').update({ status: 'Conciliado', pagamento_id: pagamentoId, conciliado_por: usuarioLogado.id, conciliado_em: new Date().toISOString() }).eq('id', id);
  if (error) return avisarModulo(error.code === '23505' ? 'Este pagamento já foi conciliado com outro movimento.' : error.message);
  const atualizado = await supabaseClient.from('financeiro_lancamentos').update({ conciliado: true, conciliado_em: new Date().toISOString() }).eq('id', pagamento.lancamento_id);
  if (atualizado.error) { await supabaseClient.from('financeiro_ofx_movimentos').update({ status: 'Pendente', pagamento_id: null, conciliado_por: null, conciliado_em: null }).eq('id', id); return avisarModulo(`Não foi possível atualizar o lançamento: ${atualizado.error.message}`); }
  await finRenderConciliacao(); avisarModulo('Movimento conciliado com sucesso.');
}

async function finIgnorarOFX(id) {
  if (!finPermissao('financeiroBaixar')) return;
  const { error } = await supabaseClient.from('financeiro_ofx_movimentos').update({ status: 'Ignorado', pagamento_id: null, conciliado_por: null, conciliado_em: null }).eq('id', id);
  if (error) return avisarModulo(error.message); await finRenderConciliacao();
}

async function finDesfazerConciliacaoOFX(id) {
  if (!finPermissao('financeiroBaixar')) return;
  const movimento = finOfxMovimentos.find(x => x.id === id), pagamento = movimento?.pagamento_id && finPagamentos.find(x => Number(x.id) === Number(movimento.pagamento_id));
  const { error } = await supabaseClient.from('financeiro_ofx_movimentos').update({ status: 'Pendente', pagamento_id: null, conciliado_por: null, conciliado_em: null }).eq('id', id);
  if (error) return avisarModulo(error.message);
  if (pagamento) {
    const outros = finOfxMovimentos.some(x => x.id !== id && x.status === 'Conciliado' && finPagamentos.find(p => Number(p.id) === Number(x.pagamento_id))?.lancamento_id === pagamento.lancamento_id);
    if (!outros) await supabaseClient.from('financeiro_lancamentos').update({ conciliado: false, conciliado_em: null }).eq('id', pagamento.lancamento_id);
  }
  await finRenderConciliacao();
}

finRenderFluxo = function (periodo = document.getElementById('finFluxoPeriodo')?.value || 'mes') {
  const el = document.getElementById('finPainelFluxo'); if (!el) return;
  const agora = new Date(`${dataLocalISO()}T12:00:00`), quantidade = periodo === 'dia' ? 14 : periodo === 'semana' ? 8 : 6;
  const grupos = Array.from({ length: quantidade }, (_, i) => {
    const inicio = new Date(agora);
    if (periodo === 'mes') { inicio.setDate(1); inicio.setMonth(inicio.getMonth() - (quantidade - 1 - i)); }
    else if (periodo === 'semana') { inicio.setDate(inicio.getDate() - inicio.getDay() - (quantidade - 1 - i) * 7); }
    else inicio.setDate(inicio.getDate() - (quantidade - 1 - i));
    const fim = new Date(inicio); periodo === 'mes' ? fim.setMonth(fim.getMonth() + 1) : fim.setDate(fim.getDate() + (periodo === 'semana' ? 7 : 1));
    const pagamentos = finPagamentos.filter(p => { const d = new Date(`${p.pago_em}T12:00:00`); return d >= inicio && d < fim; });
    const entrada = pagamentos.filter(p => financeiroRegistros.find(x => x.id === p.lancamento_id)?.tipo === 'Receber').reduce((s, p) => s + Number(p.valor), 0);
    const saida = pagamentos.filter(p => financeiroRegistros.find(x => x.id === p.lancamento_id)?.tipo === 'Pagar').reduce((s, p) => s + Number(p.valor), 0);
    const label = periodo === 'mes' ? inicio.toLocaleDateString('pt-BR', { month: 'short' }) : periodo === 'semana' ? `Sem ${inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return { label, entrada, saida };
  });
  const max = Math.max(1, ...grupos.flatMap(x => [x.entrada, x.saida]));
  const realizado = grupos.reduce((s, x) => s + x.entrada - x.saida, 0);
  const pendentes = financeiroRegistros.filter(x => x.status === 'Pendente');
  const previsto = realizado + pendentes.reduce((s, x) => s + (x.tipo === 'Receber' ? 1 : -1) * finSaldo(x), 0);
  el.innerHTML = `<div class="fin-section-head"><div><span class="os-kicker">FLUXO DE CAIXA</span><h2>Movimentação realizada e prevista</h2><p>O realizado usa a data de cada baixa; a previsão usa os vencimentos ainda pendentes.</p></div><select id="finFluxoPeriodo" onchange="finRenderFluxo(this.value)"><option value="dia" ${periodo === 'dia' ? 'selected' : ''}>14 dias</option><option value="semana" ${periodo === 'semana' ? 'selected' : ''}>8 semanas</option><option value="mes" ${periodo === 'mes' ? 'selected' : ''}>6 meses</option></select></div><div class="fin-kpis"><article><span>Saldo no período</span><b>${osMoeda(realizado)}</b></article><article><span>Saldo futuro previsto</span><b>${osMoeda(previsto)}</b></article><article><span>Pendências</span><b>${pendentes.length}</b></article></div><div class="fin-grafico">${grupos.map(x => `<div class="fin-mes"><div class="fin-barras"><i class="entrada" style="height:${x.entrada ? Math.max(5, x.entrada / max * 150) : 2}px" title="Entradas ${osMoeda(x.entrada)}"></i><i class="saida" style="height:${x.saida ? Math.max(5, x.saida / max * 150) : 2}px" title="Saídas ${osMoeda(x.saida)}"></i></div><b>${x.label}</b><small>${osMoeda(x.entrada - x.saida)}</small></div>`).join('')}</div><div class="fin-legenda"><span><i class="entrada"></i>Entradas baixadas</span><span><i class="saida"></i>Saídas baixadas</span></div>`;
};

function instalarFiltroDataRelatorio() {
  const filtros = document.querySelector('.fin-rel-filtros');
  if (filtros && !document.getElementById('finRelBaseData')) filtros.insertAdjacentHTML('beforeend', '<label><span>Data usada</span><select id="finRelBaseData" onchange="renderizarRelatorioFinanceiro()"><option value="vencimento">Vencimento</option><option value="pagamento">Pagamento / baixa</option></select></label>');
}
alternarRelatorioFinanceiro = async function () {
  const box = document.getElementById('financeiroRelatorios'), abrindo = box.classList.contains('hidden'); box.classList.toggle('hidden');
  if (abrindo) {
    if (!financeiroRegistros.length) await renderizarFinanceiroBase();
    const hoje = new Date(), inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    document.getElementById('finRelInicio').value = dataLocalISO(inicio);
    document.getElementById('finRelFim').value = dataLocalISO(hoje);
    await renderizarRelatorioFinanceiro(); box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};
dadosRelatorioFinanceiro = function () {
  const inicio = document.getElementById('finRelInicio')?.value || '', fim = document.getElementById('finRelFim')?.value || '', tipo = document.getElementById('finRelTipo')?.value || '', status = document.getElementById('finRelStatus')?.value || '', base = document.getElementById('finRelBaseData')?.value || 'vencimento', hoje = dataLocalISO();
  return financeiroRegistros.filter(x => {
    const atrasado = x.status === 'Pendente' && x.vencimento < hoje;
    const pagamentos = finPagamentos.filter(p => p.lancamento_id === x.id && (!inicio || p.pago_em >= inicio) && (!fim || p.pago_em <= fim));
    const dataOk = base === 'pagamento' ? pagamentos.length > 0 : (!inicio || x.vencimento >= inicio) && (!fim || x.vencimento <= fim);
    return dataOk && (!tipo || x.tipo === tipo) && (!status || x.status === status || (status === 'Atrasado' && atrasado));
  });
};
renderizarRelatorioFinanceiro = async function () {
  if (!financeiroRegistros.length) await renderizarFinanceiroBase();
  const lista = dadosRelatorioFinanceiro(), ids = new Set(lista.map(x => x.id));
  const inicio = document.getElementById('finRelInicio')?.value || '', fim = document.getElementById('finRelFim')?.value || '';
  const pagos = finPagamentos.filter(p => ids.has(p.lancamento_id) && (!inicio || p.pago_em >= inicio) && (!fim || p.pago_em <= fim));
  const entradas = pagos.filter(p => financeiroRegistros.find(x => x.id === p.lancamento_id)?.tipo === 'Receber').reduce((s, p) => s + Number(p.valor), 0);
  const saidas = pagos.filter(p => financeiroRegistros.find(x => x.id === p.lancamento_id)?.tipo === 'Pagar').reduce((s, p) => s + Number(p.valor), 0);
  const pendente = lista.reduce((s, x) => s + (x.status === 'Pendente' ? finSaldo(x) : 0), 0);
  document.getElementById('finRelResumo').innerHTML = [['Entradas baixadas', entradas], ['Saídas baixadas', saidas], ['Saldo realizado', entradas - saidas], ['Saldo pendente', pendente]].map(([t, v]) => `<article><span>${t}</span><strong>${osMoeda(v)}</strong></article>`).join('');
  document.getElementById('finRelTabela').innerHTML = `<div class="financeiro-table-wrap"><table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Pago</th><th>Saldo</th></tr></thead><tbody>${lista.map(x => `<tr><td>${osData(x.vencimento)}</td><td><b>${osHtml(x.descricao)}</b><small>${osHtml(x.categoria || 'Outros')}</small></td><td>${osHtml(x.tipo)}</td><td>${osMoeda(x.valor)}</td><td>${osMoeda(x.valor_pago)}</td><td><b>${osMoeda(finSaldo(x))}</b></td></tr>`).join('') || '<tr><td colspan="6" class="fin-vazio">Nenhuma conta encontrada neste período. Tente trocar “Data usada”.</td></tr>'}</tbody></table></div>`;
};
exportarRelatorioFinanceiroCSV = function () {
  const lista = dadosRelatorioFinanceiro(); if (!lista.length) return avisarModulo('Não há dados para exportar neste filtro.');
  const linhas = [['Vencimento', 'Descrição', 'Categoria', 'Tipo', 'Status', 'Valor', 'Pago', 'Saldo'], ...lista.map(x => [x.vencimento, x.descricao, x.categoria, x.tipo, x.status, Number(x.valor).toFixed(2), Number(x.valor_pago || 0).toFixed(2), finSaldo(x).toFixed(2)])];
  const blob = new Blob(['\ufeff' + linhas.map(l => l.map(csvSeguro).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `relatorio-financeiro-${dataLocalISO()}.csv`; a.click(); URL.revokeObjectURL(url);
};
imprimirRelatorioFinanceiro = function () {
  const lista = dadosRelatorioFinanceiro(); if (!lista.length) return avisarModulo('Não há dados para imprimir neste filtro.');
  const inicio = osData(document.getElementById('finRelInicio').value), fim = osData(document.getElementById('finRelFim').value), ids = new Set(lista.map(x => x.id));
  const pagamentos = finPagamentos.filter(p => ids.has(p.lancamento_id)), entradas = pagamentos.filter(p => financeiroRegistros.find(x => x.id === p.lancamento_id)?.tipo === 'Receber').reduce((s, p) => s + Number(p.valor), 0), saidas = pagamentos.filter(p => financeiroRegistros.find(x => x.id === p.lancamento_id)?.tipo === 'Pagar').reduce((s, p) => s + Number(p.valor), 0);
  const corpo = `<main class="folha"><div class="marca">${marcaHelpDocumento()}<div class="doc">Período<br><b>${inicio} a ${fim}</b></div></div><h2>Relatório de contas</h2><div class="linha"><span>Entradas baixadas</span><b>${osMoeda(entradas)}</b></div><div class="linha"><span>Saídas baixadas</span><b>${osMoeda(saidas)}</b></div><div class="linha"><span>Saldo realizado</span><b>${osMoeda(entradas - saidas)}</b></div><table style="width:100%;border-collapse:collapse;margin-top:28px"><thead><tr><th>Vencimento</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Pago</th><th>Saldo</th></tr></thead><tbody>${lista.map(x => `<tr><td>${osData(x.vencimento)}</td><td>${osHtml(x.descricao)}</td><td>${osHtml(x.tipo)}</td><td>${osMoeda(x.valor)}</td><td>${osMoeda(x.valor_pago)}</td><td>${osMoeda(finSaldo(x))}</td></tr>`).join('')}</tbody></table><div class="rodape">Help Soluções Tecnológicas · Gerado em ${new Date().toLocaleString('pt-BR')}</div></main>`;
  abrirDocumentoImpressao('Relatório financeiro', corpo);
};

const finRenderRecorrenciasAnterior = finRenderRecorrencias;
finRenderRecorrencias = function () {
  finRenderRecorrenciasAnterior();
  const head = document.querySelector('#finPainelRecorrencias .fin-section-head');
  if (head && finPermissao('financeiroCriar')) head.insertAdjacentHTML('beforeend', '<button class="btn btn-primary" onclick="finNovaRecorrencia()"><i data-lucide="plus"></i>Nova recorrência</button>');
  if (window.lucide) lucide.createIcons();
};
function finNovaRecorrencia() {
  abrirModalFinanceiro();
  setTimeout(() => {
    document.getElementById('finRecorrente').checked = true;
    document.getElementById('finRecorrenciaCampos').classList.remove('hidden');
    document.getElementById('financeiroModalTitulo').textContent = 'Nova conta recorrente';
  }, 30);
}

function instalarClientesOS() {
  const input = document.getElementById('osCliente'); if (!input || document.getElementById('osClientesLista')) return;
  input.setAttribute('list', 'osClientesLista'); input.insertAdjacentHTML('afterend', '<datalist id="osClientesLista"></datalist>');
  input.addEventListener('change', preencherClienteNaOS);
}
async function carregarClientesOS() {
  const { data, error } = await supabaseClient.from('clientes').select('id,nome,unidade,documento,telefone,email').order('nome');
  if (error) throw error; clientesOSCache = data || [];
  const lista = document.getElementById('osClientesLista'); if (lista) lista.innerHTML = clientesOSCache.map(c => `<option value="${osHtml(c.nome)}">${osHtml(c.unidade || '')}</option>`).join('');
}
function preencherClienteNaOS() {
  const nome = document.getElementById('osCliente').value.trim().toLocaleLowerCase('pt-BR'), c = clientesOSCache.find(x => x.nome.trim().toLocaleLowerCase('pt-BR') === nome);
  if (c && !document.getElementById('osUnidade').value) document.getElementById('osUnidade').value = c.unidade || '';
}
const renderizarOrdensServicoAnterior = renderizarOrdensServico;
renderizarOrdensServico = async function () { await Promise.all([renderizarOrdensServicoAnterior(), carregarClientesOS()]); };
const abrirModalOSAnterior = abrirModalOS;
abrirModalOS = function (prefill = {}) { abrirModalOSAnterior(prefill); if (!clientesOSCache.length) carregarClientesOS().catch(e => avisarModulo(e.message)); };

function marcaHelpDocumento() {
  const logo = new URL('help-logo.png', window.location.href).href;
  return `<div style="display:flex;align-items:center;gap:14px"><img src="${logo}" alt="Help Soluções Tecnológicas" style="width:72px;height:72px;object-fit:cover;border-radius:50%;display:block"><div><h1 style="margin:0;color:#1769e0;font-size:23px">Help Soluções Tecnológicas</h1><small style="color:#68778b">Sistemas de gestão empresarial e informática</small></div></div>`;
}
imprimirOS = function () {
  if (!osAtual) return;
  const itens = osAtual.os_itens || [];
  const pecas = itens.filter(x => x.tipo === 'Peça');
  const servicos = itens.filter(x => x.tipo === 'Serviço');
  const cliente = clientesOSCache.find(c => String(c.nome || '').trim().toLocaleLowerCase('pt-BR') === String(osAtual.cliente || '').trim().toLocaleLowerCase('pt-BR')) || {};
  const logo = new URL('help-logo.png', window.location.href).href;
  const totalPecas = pecas.reduce((s, x) => s + Number(x.quantidade || 0) * Number(x.valor_unitario || 0), 0);
  const totalServicos = servicos.reduce((s, x) => s + Number(x.quantidade || 0) * Number(x.valor_unitario || 0), 0);
  const subtotal = totalPecas + totalServicos;
  const desconto = Number(osAtual.desconto || 0);
  const linhaItem = (x, i) => `<tr><td class="num">${i + 1}</td><td>${osHtml(x.descricao || '—')}</td><td>${osHtml(osAtual.tecnico || '—')}</td><td class="centro">UN</td><td class="centro">${Number(x.quantidade || 0)}</td><td class="dinheiro">${osMoeda(x.valor_unitario)}</td><td class="dinheiro">${osMoeda(Number(x.quantidade || 0) * Number(x.valor_unitario || 0))}</td></tr>`;
  const tabela = (titulo, lista, vazio) => `<section class="os-doc-bloco"><div class="os-doc-titulo">${titulo}</div><table class="os-doc-tabela"><thead><tr><th>Cód.</th><th>Descrição</th><th>Técnico</th><th>Und.</th><th>Qtd.</th><th>Unit. R$</th><th>Total R$</th></tr></thead><tbody>${lista.length ? lista.map(linhaItem).join('') : `<tr><td colspan="7" class="vazio">${vazio}</td></tr>`}</tbody></table></section>`;

  const corpo = `<style>
    .folha.os-doc-ref{width:900px;max-width:calc(100% - 24px);margin:18px auto;padding:24px 28px 30px;border-top:0;color:#171717;font-family:Arial,sans-serif;font-size:12px}
    .os-doc-ref *{box-sizing:border-box}.os-doc-cab{display:grid;grid-template-columns:1fr 260px;gap:24px;align-items:start;margin-bottom:8px}
    .os-doc-empresa{display:flex;gap:14px;align-items:flex-start}.os-doc-empresa img{width:92px;height:58px;object-fit:contain}.os-doc-empresa h1{margin:0 0 5px;font-size:18px;color:#111;text-transform:uppercase}.os-doc-empresa p{margin:3px 0;color:#222;line-height:1.35}
    .os-doc-meta{text-align:right;line-height:1.5}.os-doc-meta h2{margin:0 0 1px;font-size:16px}.os-doc-meta strong.numero{display:block;font-size:17px;letter-spacing:.08em;margin-bottom:4px}
    .os-doc-aviso{text-align:center;font-size:10px;font-weight:700;padding:7px 5px;border-bottom:1px solid #c8c8c8;margin-bottom:8px}
    .os-doc-cliente{border:1px solid #c8c8c8;padding:9px 12px;margin-bottom:9px;font-size:12px;line-height:1.45}.os-doc-cliente strong{font-size:13px}.os-doc-cliente span{margin-right:10px}
    .os-doc-triplo{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #c8c8c8;margin-bottom:9px}.os-doc-triplo>div{min-height:43px;padding:6px 8px;border-right:1px solid #c8c8c8}.os-doc-triplo>div:last-child{border-right:0}.os-doc-label{display:block;font-size:9px;font-weight:700;text-transform:uppercase;margin-bottom:3px}.os-doc-triplo b{font-size:11px}
    .os-doc-detalhes{display:grid;grid-template-columns:1fr 1fr;border:1px solid #c8c8c8;margin-bottom:9px}.os-doc-detalhes>div{padding:7px 9px;min-height:48px}.os-doc-detalhes>div+div{border-left:1px solid #c8c8c8}.os-doc-detalhes p{margin:3px 0 0;white-space:pre-wrap;line-height:1.35}
    .os-doc-bloco{margin-top:9px}.os-doc-titulo{padding:5px 8px;border:1px solid #c8c8c8;border-bottom:0;background:#ededed;font-size:10px;font-weight:800;text-align:left;text-transform:uppercase;letter-spacing:.04em}
    .os-doc-tabela{width:100%;border-collapse:collapse;font-size:11px}.os-doc-tabela th{padding:6px 7px;background:#f0f0f0;border:1px solid #c8c8c8;color:#171717;text-align:left;text-transform:none;font-size:10px}.os-doc-tabela td{padding:7px;border:1px solid #d2d2d2;vertical-align:middle}.os-doc-tabela .num,.os-doc-tabela .centro{text-align:center}.os-doc-tabela .dinheiro{text-align:right;white-space:nowrap}.os-doc-tabela .vazio{text-align:center;color:#777;padding:10px}
    .os-doc-resumo{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;margin-top:10px;border:1px solid #c8c8c8}.os-doc-resumo>div{text-align:center;border-right:1px solid #c8c8c8}.os-doc-resumo>div:last-child{border-right:0}.os-doc-resumo span{display:block;padding:4px;background:#ededed;border-bottom:1px solid #c8c8c8;font-size:9px;font-weight:800;text-transform:uppercase}.os-doc-resumo b{display:block;padding:7px;font-size:11px}
    .os-doc-total{display:flex;justify-content:flex-end;align-items:baseline;gap:9px;margin:24px 0 34px;font-size:15px;font-weight:700}.os-doc-total strong{font-size:24px}
    .os-doc-assinaturas{display:grid;grid-template-columns:220px 1fr;gap:80px;align-items:end;margin:56px 45px 0}.os-doc-assinaturas div{border-top:1px solid #222;text-align:center;padding-top:6px;font-size:10px}.os-doc-rodape{text-align:center;color:#777;font-size:9px;margin-top:24px}
    @media print{.folha.os-doc-ref{width:100%;max-width:none;margin:0;padding:8mm 8mm 5mm}.os-doc-bloco,.os-doc-resumo,.os-doc-triplo,.os-doc-detalhes{break-inside:avoid}@page{size:A4 portrait;margin:6mm}}
  </style><main class="folha os-doc-ref">
    <header class="os-doc-cab">
      <div class="os-doc-empresa"><img src="${logo}" alt="Help Soluções Tecnológicas"><div><h1>Help Soluções Tecnológicas</h1><p>Sistemas de gestão empresarial e informática</p><p>Atendimento técnico e soluções em tecnologia</p></div></div>
      <div class="os-doc-meta"><h2>Ordem de Serviço</h2><strong class="numero">${osHtml(osAtual.numero)}</strong><div>Data: <b>${osData(osAtual.criado_em)}</b></div><div>Situação: <b>${osHtml(osAtual.status || '—')}</b></div><div>Garantia: <b>${Number(osAtual.garantia_dias || 0)} dias</b></div><div>Previsão: <b>${osData(osAtual.previsao)}</b></div></div>
    </header>
    <div class="os-doc-aviso">ORDEM DE SERVIÇO — NÃO É DOCUMENTO FISCAL E NÃO COMPROVA PAGAMENTO</div>
    <section class="os-doc-cliente"><strong>${osHtml(osAtual.cliente || 'CLIENTE')}</strong> ${cliente.documento ? `<span>· ${osHtml(cliente.documento)}</span>` : ''}${cliente.telefone ? `<span>· ${osHtml(cliente.telefone)}</span>` : ''}<br><span>${osHtml(osAtual.unidade || cliente.unidade || '—')}</span>${cliente.email ? `<span> · ${osHtml(cliente.email)}</span>` : ''}</section>
    <section class="os-doc-triplo"><div><span class="os-doc-label">Objeto</span><b>${osHtml([osAtual.equipamento, osAtual.marca_modelo].filter(Boolean).join(' · ') || '—')}</b></div><div><span class="os-doc-label">Usuário / solicitante</span><b>${osHtml(osAtual.solicitante || '—')}</b></div><div><span class="os-doc-label">Defeito relatado</span><b>${osHtml(osAtual.problema || '—')}</b></div></section>
    <section class="os-doc-detalhes"><div><span class="os-doc-label">Diagnóstico</span><p>${osHtml(osAtual.diagnostico || '—')}</p></div><div><span class="os-doc-label">Serviço executado</span><p>${osHtml(osAtual.servico_executado || '—')}</p></div></section>
    ${tabela('Peças / Produtos', pecas, 'Nenhuma peça informada.')}
    ${tabela('Serviços', servicos, 'Nenhum serviço informado.')}
    <section class="os-doc-resumo"><div><span>Peças / Produtos</span><b>${pecas.reduce((s,x)=>s+Number(x.quantidade||0),0)} un. · ${osMoeda(totalPecas)}</b></div><div><span>Serviços</span><b>${servicos.reduce((s,x)=>s+Number(x.quantidade||0),0)} item(ns) · ${osMoeda(totalServicos)}</b></div><div><span>Subtotal</span><b>${osMoeda(subtotal)}</b></div><div><span>Desconto</span><b>${osMoeda(desconto)}</b></div></section>
    <div class="os-doc-total"><span>Total geral R$:</span><strong>${osMoeda(osAtual.total).replace('R$ ','').replace('R$','').trim()}</strong></div>
    <section class="os-doc-assinaturas"><div>Data</div><div>${osHtml(osAtual.assinatura_nome || 'Assinatura do responsável / solicitante')}</div></section>
    <div class="os-doc-rodape">Help Soluções Tecnológicas · ${osHtml(osAtual.numero)} · Documento gerado pelo CRM</div>
  </main>`;
  abrirDocumentoImpressao(osAtual.numero, corpo);
};
compartilharOSWhatsApp = function () { if (!osAtual) return; const texto = `*${osAtual.numero} — Help Soluções Tecnológicas*\nCliente: ${osAtual.cliente}\nEquipamento: ${osAtual.equipamento || '-'}\nStatus: ${osAtual.status}\nTotal: ${osMoeda(osAtual.total)}\nGarantia: ${osAtual.garantia_dias || 0} dias`; window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener'); };

function instalarImportacaoClientes() {
  const acoes = document.querySelector('#cadastroClientes .cadastro-actions');
  if (!acoes || document.getElementById('arquivoImportarClientes')) return;
  acoes.insertAdjacentHTML('afterbegin', '<input id="arquivoImportarClientes" type="file" accept=".csv,text/csv" class="hidden" onchange="importarClientesCSV(this.files[0]);this.value=\'\'"><button class="btn btn-secondary" type="button" onclick="document.getElementById(\'arquivoImportarClientes\').click()"><i data-lucide="file-up"></i>Importar CSV</button><button class="btn btn-secondary btn-icon" type="button" title="Baixar modelo de importação" onclick="baixarModeloClientesCSV()"><i data-lucide="file-down"></i></button>');
}
function parseCSV(texto) {
  const linhas = []; let linha = [], campo = '', aspas = false;
  for (let i = 0; i < texto.length; i++) { const c = texto[i]; if (c === '"') { if (aspas && texto[i + 1] === '"') { campo += '"'; i++; } else aspas = !aspas; } else if ((c === ',' || c === ';') && !aspas) { linha.push(campo.trim()); campo = ''; } else if ((c === '\n' || c === '\r') && !aspas) { if (c === '\r' && texto[i + 1] === '\n') i++; linha.push(campo.trim()); if (linha.some(Boolean)) linhas.push(linha); linha = []; campo = ''; } else campo += c; }
  linha.push(campo.trim()); if (linha.some(Boolean)) linhas.push(linha); return linhas;
}
const normalizarCabecalho = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
async function importarClientesCSV(arquivo) {
  if (!arquivo) return; if (arquivo.size > 5 * 1024 * 1024) return avisarModulo('O CSV deve ter no máximo 5 MB.');
  const linhas = parseCSV((await arquivo.text()).replace(/^\ufeff/, '')); if (linhas.length < 2) return avisarModulo('O arquivo não possui dados para importar.');
  const cab = linhas[0].map(normalizarCabecalho), idx = (...nomes) => cab.findIndex(x => nomes.includes(x));
  const mapa = { nome: idx('nome', 'razaosocial', 'cliente'), unidade: idx('unidade', 'filial'), documento: idx('documento', 'cnpjcpf', 'cnpj', 'cpf'), ie: idx('ie', 'inscricaoestadual'), regime: idx('regime', 'regimetributario'), telefone: idx('telefone', 'celular', 'whatsapp'), email: idx('email'), observacoes_tecnicas: idx('observacoestecnicas', 'observacoes', 'obs') };
  if (mapa.nome < 0) return avisarModulo('Inclua uma coluna chamada Nome ou Razão Social.');
  const dados = linhas.slice(1).map(l => Object.fromEntries(Object.entries(mapa).map(([k, i]) => [k, i >= 0 ? String(l[i] || '').trim() : '']))).filter(x => x.nome).map(x => ({ ...x, unidade: x.unidade || '-', documento: x.documento || '-', ie: x.ie || '-', regime: x.regime || 'Não informado', telefone: x.telefone || '-', email: x.email || '-' }));
  const { data: existentes, error } = await supabaseClient.from('clientes').select('nome,unidade,documento'); if (error) return avisarModulo(error.message);
  const chaves = new Set((existentes || []).map(x => `${x.nome}|${x.unidade}|${x.documento}`.toLocaleLowerCase('pt-BR'))), novos = dados.filter(x => { const k = `${x.nome}|${x.unidade}|${x.documento}`.toLocaleLowerCase('pt-BR'); if (chaves.has(k)) return false; chaves.add(k); return true; });
  if (!novos.length) return avisarModulo('Todos os clientes do arquivo já estão cadastrados.');
  if (!confirm(`Importar ${novos.length} cliente(s)? ${dados.length - novos.length} duplicado(s) serão ignorados.`)) return;
  for (let i = 0; i < novos.length; i += 200) { const r = await supabaseClient.from('clientes').insert(novos.slice(i, i + 200)); if (r.error) return avisarModulo(`Falha após ${i} registro(s): ${r.error.message}`); }
  await carregarClientesDaNuvem(); avisarModulo(`${novos.length} cliente(s) importado(s) com sucesso.`);
}
function baixarModeloClientesCSV() {
  const conteudo = '\ufeffNome;Unidade;CNPJ/CPF;IE;Regime Tributário;Telefone;E-mail;Observações técnicas\r\nCliente Exemplo;Matriz;00.000.000/0001-00;ISENTO;Simples Nacional;(67) 99999-9999;contato@exemplo.com;Informações internas';
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = 'modelo-importacao-clientes.csv'; a.click(); URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => setTimeout(instalarCorrecoesCRM, 20));
