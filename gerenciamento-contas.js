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
    const saldo = c.ativo ? finSaldoConta(c) : Number(c.saldo_inicial || 0);
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
