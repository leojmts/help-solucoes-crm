/* Gerenciamento seguro de contas financeiras — Help Soluções Tecnológicas. */

let finMostrarContasInativas = false;

async function finContaTemHistorico(contaId) {
  const id = Number(contaId);
  const [pag, trOrig, trDest, ofxImp, ofxMov] = await Promise.all([
    supabaseClient.from('financeiro_pagamentos').select('id', { count: 'exact', head: true }).eq('conta_id', id),
    supabaseClient.from('financeiro_transferencias').select('id', { count: 'exact', head: true }).eq('conta_origem_id', id),
    supabaseClient.from('financeiro_transferencias').select('id', { count: 'exact', head: true }).eq('conta_destino_id', id),
    supabaseClient.from('financeiro_ofx_importacoes').select('id', { count: 'exact', head: true }).eq('conta_id', id),
    supabaseClient.from('financeiro_ofx_movimentos').select('id', { count: 'exact', head: true }).eq('conta_id', id)
  ]);
  const erro = [pag, trOrig, trDest, ofxImp, ofxMov].find(x => x.error)?.error;
  if (erro) throw erro;
  return [pag.count, trOrig.count, trDest.count, ofxImp.count, ofxMov.count].some(x => Number(x || 0) > 0);
}

async function finCarregarTodasContas() {
  const { data, error } = await supabaseClient
    .from('financeiro_contas')
    .select('*')
    .order('ativo', { ascending: false })
    .order('tipo')
    .order('nome');
  if (error) throw error;
  return data || [];
}

async function finGerenciarConta(id) {
  if (!finPermissao('financeiroCriar')) return avisarModulo('Você não possui permissão para gerenciar contas.');
  let contas, temHistorico;
  try {
    contas = await finCarregarTodasContas();
    temHistorico = await finContaTemHistorico(id);
  } catch (e) {
    return avisarModulo(`Não foi possível verificar a conta: ${e.message}`);
  }

  const conta = contas.find(x => Number(x.id) === Number(id));
  if (!conta) return avisarModulo('Conta não encontrada.');
  const principal = String(conta.nome || '').trim().toUpperCase() === 'CAIXA';

  if (!conta.ativo) {
    if (!confirm(`Reativar a conta "${conta.nome}"?`)) return;
    const { error } = await supabaseClient
      .from('financeiro_contas')
      .update({ ativo: true, atualizado_em: new Date().toISOString() })
      .eq('id', conta.id);
    if (error) return avisarModulo(error.message);
    await carregarContasFinanceiras();
    await finRenderCaixa();
    avisarModulo(`Conta ${conta.nome} reativada.`);
    return;
  }

  if (temHistorico || principal) {
    const motivo = principal
      ? 'A conta CAIXA é uma conta principal e não deve ser apagada da operação.'
      : 'Esta conta possui histórico financeiro e não pode ser apagada sem perder rastreabilidade.';
    if (!confirm(`${motivo}\n\nDeseja desativar "${conta.nome}"? Ela deixará de aparecer em novos pagamentos e transferências, mas todo o histórico será preservado.`)) return;
    const { error } = await supabaseClient
      .from('financeiro_contas')
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', conta.id);
    if (error) return avisarModulo(error.message);
    await carregarContasFinanceiras();
    await finRenderCaixa();
    avisarModulo(`Conta ${conta.nome} desativada. O histórico foi preservado.`);
    return;
  }

  if (!confirm(`Excluir definitivamente a conta "${conta.nome}"?\n\nEla não possui movimentações e poderá ser apagada com segurança.`)) return;
  const { error } = await supabaseClient.from('financeiro_contas').delete().eq('id', conta.id);
  if (error) return avisarModulo(error.message);
  await carregarContasFinanceiras();
  await finRenderCaixa();
  avisarModulo(`Conta ${conta.nome} excluída.`);
}

async function finAlternarVisualizacaoInativas() {
  finMostrarContasInativas = !finMostrarContasInativas;
  await finRenderCaixa();
}

const finRenderCaixaComGerenciamentoBase = finRenderCaixa;
finRenderCaixa = async function () {
  await finRenderCaixaComGerenciamentoBase();
  const el = document.getElementById('finPainelCaixa');
  if (!el) return;

  let todas = [];
  try {
    todas = await finCarregarTodasContas();
  } catch (e) {
    return;
  }

  const ativas = todas.filter(x => x.ativo);
  const inativas = todas.filter(x => !x.ativo);
  const lista = finMostrarContasInativas ? todas : ativas;
  const blocoAtual = el.querySelector('.fin-contas');
  if (!blocoAtual) return;

  const historicoMap = new Map();
  await Promise.all(lista.map(async c => {
    try { historicoMap.set(c.id, await finContaTemHistorico(c.id)); }
    catch { historicoMap.set(c.id, true); }
  }));

  blocoAtual.innerHTML = lista.map(c => {
    const historico = historicoMap.get(c.id) === true;
    const saldo = finSaldoConta(c);
    const principal = String(c.nome).trim().toUpperCase() === 'CAIXA';
    const acao = c.ativo ? (historico || principal ? 'Desativar' : 'Excluir') : 'Reativar';
    const icone = c.ativo ? (acao === 'Excluir' ? 'trash-2' : 'archive') : 'rotate-ccw';
    return `<article class="${c.ativo ? '' : 'fin-conta-inativa'}">
      <span><i data-lucide="${c.tipo === 'Caixa' ? 'banknote' : c.tipo === 'Banco' ? 'landmark' : 'wallet-cards'}"></i>${osHtml(c.tipo)}${c.ativo ? '' : ' · Inativa'}</span>
      <b>${osHtml(c.nome)}</b>
      <strong>${osMoeda(saldo)}</strong>
      ${finPermissao('financeiroCriar') ? `<div class="fin-conta-acoes"><button type="button" class="btn btn-secondary" onclick="finGerenciarConta(${c.id})"><i data-lucide="${icone}"></i>${acao}</button></div>` : ''}
    </article>`;
  }).join('') || '<p class="fin-vazio">Nenhuma conta cadastrada.</p>';

  const cabecalho = el.querySelector('.fin-section-head .actions');
  if (cabecalho && !document.getElementById('finBtnInativas')) {
    cabecalho.insertAdjacentHTML('afterbegin', `<button id="finBtnInativas" type="button" class="btn btn-secondary" onclick="finAlternarVisualizacaoInativas()"><i data-lucide="eye"></i>${inativas.length ? `Inativas (${inativas.length})` : 'Inativas'}</button>`);
  } else if (document.getElementById('finBtnInativas')) {
    document.getElementById('finBtnInativas').innerHTML = `<i data-lucide="${finMostrarContasInativas ? 'eye-off' : 'eye'}"></i>${finMostrarContasInativas ? 'Ocultar inativas' : `Inativas (${inativas.length})`}`;
  }

  if (window.lucide) lucide.createIcons();
};

/* Contas inativas não entram em novos pagamentos, transferências ou seletores. */
const carregarContasFinanceirasGerenciamentoBase = carregarContasFinanceiras;
carregarContasFinanceiras = async function () {
  await carregarContasFinanceirasGerenciamentoBase();
  finContas = finContas.filter(x => x.ativo !== false);
  finPreencherContasBaixa();
};

/* OS: discriminação visual e documental de Serviços e Peças. */
(function instalarItensSeparadosOS() {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .os-itens-separados{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px 16px}
    .os-grupo-itens{border:1px solid var(--border);border-radius:12px;overflow:hidden;background:rgba(10,25,42,.22)}
    .os-grupo-itens>header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 13px;border-bottom:1px solid var(--border);background:rgba(58,125,220,.06)}
    .os-grupo-itens>header div{display:flex;align-items:center;gap:8px;font-weight:700}.os-grupo-itens>header svg{width:17px;color:#69a7ff}
    .os-grupo-itens>header .btn{padding:7px 10px;font-size:11px}.os-grupo-lista{display:grid;gap:8px;padding:10px}
    .os-item-separado{display:grid;grid-template-columns:minmax(150px,1fr) 68px 105px 92px 34px;gap:7px;align-items:center}
    .os-item-separado input{width:100%;border:1px solid var(--border);border-radius:9px;background:var(--input-bg,#071322);color:var(--text);padding:10px 11px;outline:none}
    .os-item-separado b{text-align:right;font-size:12px}.os-item-separado button{display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--muted);cursor:pointer}
    .os-item-separado button:hover{color:#fb7185;border-color:#fb7185}.os-item-separado button svg{width:15px}.os-grupo-vazio{padding:20px 12px;text-align:center;color:var(--muted);font-size:12px}
    html[data-theme="light"] .os-grupo-itens{background:#f8fafc}.os-title-action.os-itens-head .actions{display:flex;gap:8px;flex-wrap:wrap}
    @media(max-width:820px){.os-itens-separados{grid-template-columns:1fr}.os-item-separado{grid-template-columns:1fr 62px 92px 34px}.os-item-separado b{grid-column:1/-2;text-align:left}}
  `;
  document.head.appendChild(estilo);

  function configurarCabecalhoItens() {
    const box = document.getElementById('osItens');
    const section = box?.closest('.os-form-section');
    const head = section?.querySelector('.os-section-title.os-title-action');
    if (!head || head.classList.contains('os-itens-head')) return;
    head.classList.add('os-itens-head');
    head.innerHTML = `<div><i data-lucide="list-plus"></i><span><strong>Itens da ordem de serviço</strong><small>Serviços e peças ficam discriminados separadamente</small></span></div><div class="actions"><button type="button" class="btn btn-secondary" onclick="adicionarItemOS('Serviço')"><i data-lucide="wrench"></i>Adicionar serviço</button><button type="button" class="btn btn-secondary" onclick="adicionarItemOS('Peça')"><i data-lucide="package-plus"></i>Adicionar peça</button></div>`;
  }

  window.adicionarItemOS = function (tipo = 'Serviço') {
    osItensEdicao.push({ tipo: tipo === 'Peça' ? 'Peça' : 'Serviço', descricao: '', quantidade: 1, valor_unitario: 0 });
    atualizarItensOS();
  };

  window.atualizarItensOS = function () {
    configurarCabecalhoItens();
    const box = document.getElementById('osItens');
    if (!box) return;
    const renderGrupo = (tipo, titulo, icone) => {
      const itens = osItensEdicao.map((x, i) => ({ x, i })).filter(a => a.x.tipo === tipo);
      return `<section class="os-grupo-itens"><header><div><i data-lucide="${icone}"></i>${titulo}</div><button type="button" class="btn btn-secondary" onclick="adicionarItemOS('${tipo}')"><i data-lucide="plus"></i>Adicionar</button></header><div class="os-grupo-lista">${itens.length ? itens.map(({x,i}) => `<div class="os-item-separado"><input value="${osHtml(x.descricao)}" placeholder="Descrição do ${tipo === 'Peça' ? 'item/peça' : 'serviço'}" oninput="atualizarItemOS(${i},'descricao',this.value)"><input type="number" min="0.01" step="0.01" value="${x.quantidade}" title="Quantidade" oninput="atualizarItemOS(${i},'quantidade',this.value)"><input type="number" min="0" step="0.01" value="${x.valor_unitario}" title="Valor unitário" oninput="atualizarItemOS(${i},'valor_unitario',this.value)"><b>${osMoeda(Number(x.quantidade) * Number(x.valor_unitario))}</b><button type="button" onclick="removerItemOS(${i})" title="Remover"><i data-lucide="trash-2"></i></button></div>`).join('') : `<div class="os-grupo-vazio">Nenhum ${tipo === 'Peça' ? 'item/peça' : 'serviço'} adicionado.</div>`}</div></section>`;
    };
    box.className = 'os-itens os-itens-separados';
    box.innerHTML = renderGrupo('Serviço', 'Serviços', 'wrench') + renderGrupo('Peça', 'Peças', 'package');
    calcularTotaisOS();
    if (window.lucide) lucide.createIcons();
  };

  window.imprimirOS = function () {
    if (!osAtual) return;
    const itens = osAtual.os_itens || [];
    const servicos = itens.filter(x => x.tipo === 'Serviço');
    const pecas = itens.filter(x => x.tipo === 'Peça');
    const subtotalServicos = servicos.reduce((s,x)=>s + Number(x.quantidade || 0) * Number(x.valor_unitario || 0), 0);
    const subtotalPecas = pecas.reduce((s,x)=>s + Number(x.quantidade || 0) * Number(x.valor_unitario || 0), 0);
    const tabela = (titulo, lista, vazio) => `<h3 style="margin:24px 0 8px">${titulo}</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${lista.length ? lista.map(x => `<tr><td>${osHtml(x.descricao)}</td><td>${x.quantidade}</td><td>${osMoeda(x.valor_unitario)}</td><td>${osMoeda(Number(x.quantidade) * Number(x.valor_unitario))}</td></tr>`).join('') : `<tr><td colspan="4">${vazio}</td></tr>`}</tbody></table>`;
    const corpo = `<main class="folha"><div class="marca">${marcaHelpDocumento()}<div class="doc"><b>${osHtml(osAtual.numero)}</b><br>Emitido em ${new Date().toLocaleDateString('pt-BR')}</div></div><h2>Ordem de Serviço</h2><div class="linha"><span>Cliente</span><b>${osHtml(osAtual.cliente)}</b></div><div class="linha"><span>Unidade</span><b>${osHtml(osAtual.unidade || '—')}</b></div><div class="linha"><span>Equipamento</span><b>${osHtml([osAtual.equipamento, osAtual.marca_modelo].filter(Boolean).join(' · ') || '—')}</b></div><div class="linha"><span>Serial / patrimônio</span><b>${osHtml(osAtual.serial || '—')}</b></div><div class="linha"><span>Técnico</span><b>${osHtml(osAtual.tecnico || '—')}</b></div><h3>Problema relatado</h3><p>${osHtml(osAtual.problema) || '—'}</p><h3>Diagnóstico e serviço executado</h3><p>${osHtml(osAtual.diagnostico) || '—'}<br>${osHtml(osAtual.servico_executado) || ''}</p>${tabela('Serviços', servicos, 'Nenhum serviço discriminado.') }<div class="linha"><span>Subtotal de serviços</span><b>${osMoeda(subtotalServicos)}</b></div>${tabela('Peças', pecas, 'Nenhuma peça discriminada.') }<div class="linha"><span>Subtotal de peças</span><b>${osMoeda(subtotalPecas)}</b></div>${Number(osAtual.desconto || 0) > 0 ? `<div class="linha"><span>Desconto</span><b>- ${osMoeda(osAtual.desconto)}</b></div>` : ''}<div class="valor">Total: ${osMoeda(osAtual.total)}</div><div class="assinatura">${osHtml(osAtual.assinatura_nome || 'Responsável pelo aceite')}</div><div class="rodape">Help Soluções Tecnológicas · Documento gerado pelo Sistema</div></main>`;
    abrirDocumentoImpressao(osAtual.numero, corpo);
  };
})();
