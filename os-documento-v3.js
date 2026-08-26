/* Layout comercial v3 da Ordem de Serviço — carregado por último para substituir geradores antigos. */
window.imprimirOS = async function () {
  if (!osAtual) return;
  const atual = osAtual;
  const itens = atual.os_itens || [];
  const pecas = itens.filter(x => x.tipo === 'Peça');
  const servicos = itens.filter(x => x.tipo === 'Serviço');
  let cliente = {};
  try {
    const r = await supabaseClient.from('clientes').select('nome,unidade,documento,telefone,email').eq('nome', atual.cliente).limit(1);
    cliente = r.data?.[0] || {};
  } catch (_) {}

  const logo = new URL('help-logo.png', window.location.href).href;
  const totalPecas = pecas.reduce((s,x)=>s + Number(x.quantidade||0)*Number(x.valor_unitario||0), 0);
  const totalServicos = servicos.reduce((s,x)=>s + Number(x.quantidade||0)*Number(x.valor_unitario||0), 0);
  const subtotal = totalPecas + totalServicos;
  const desconto = Number(atual.desconto || 0);
  const moedaSemSimbolo = v => osMoeda(v).replace('R$ ','').replace('R$','').trim();
  const qtd = lista => lista.reduce((s,x)=>s+Number(x.quantidade||0),0);
  const linha = (x, i, unidade) => `<tr><td class="c">${i+1}</td><td>${osHtml(x.descricao || '—')}</td><td>${osHtml(atual.tecnico || '—')}</td><td class="c">${unidade}</td><td class="c">${Number(x.quantidade||0)}</td><td class="r">${moedaSemSimbolo(x.valor_unitario)}</td><td class="r">0,00</td><td class="r">${moedaSemSimbolo(Number(x.quantidade||0)*Number(x.valor_unitario||0))}</td></tr>`;
  const tabela = (titulo, lista, unidade, vazio) => `<section class="osv3-section"><div class="osv3-bar">${titulo}</div><table class="osv3-table"><thead><tr><th>Cód.</th><th>Descrição</th><th>Técnico</th><th>Und.</th><th>Qtd.</th><th>Unit. R$</th><th>Desc. R$</th><th>Total R$</th></tr></thead><tbody>${lista.length ? lista.map((x,i)=>linha(x,i,unidade)).join('') : `<tr><td colspan="8" class="empty">${vazio}</td></tr>`}</tbody></table></section>`;

  const corpo = `<style>
  .folha.osv3{width:940px;max-width:calc(100% - 24px);margin:16px auto;padding:20px 26px 28px;border:0!important;color:#111;font:12px Arial,sans-serif}
  .osv3 *{box-sizing:border-box}.osv3-head{display:grid;grid-template-columns:1fr 255px;gap:22px;align-items:start}.osv3-company{display:flex;gap:13px}.osv3-company img{width:125px;height:65px;object-fit:contain}.osv3-company h1{margin:1px 0 5px;font-size:18px;line-height:1.05}.osv3-company p{margin:3px 0;font-size:12px}.osv3-meta{text-align:right;line-height:1.45}.osv3-meta h2{font-size:16px;margin:0 0 2px}.osv3-meta .num{font-size:16px;font-weight:800;letter-spacing:.08em}.osv3-alert{text-align:center;font-size:10px;font-weight:700;margin:9px 0 6px}.osv3-client{border:1px solid #bfc3c7;padding:8px 12px;margin-bottom:9px;line-height:1.45}.osv3-client b{font-size:13px}.osv3-trio{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #c8c8c8;margin-bottom:9px}.osv3-trio>div{padding:6px 8px;min-height:42px}.osv3-trio>div+div{border-left:1px solid #c8c8c8}.osv3-label{display:block;font-size:9px;font-weight:800;margin-bottom:3px}.osv3-notes{display:grid;grid-template-columns:1fr 1fr;border:1px solid #c8c8c8;margin-bottom:9px}.osv3-notes>div{padding:7px 9px;min-height:46px}.osv3-notes>div+div{border-left:1px solid #c8c8c8}.osv3-notes p{margin:3px 0;white-space:pre-wrap}.osv3-section{margin-top:9px}.osv3-bar{border:1px solid #c9c9c9;border-bottom:0;background:#ededed;padding:5px 7px;font-size:10px;font-weight:800;text-transform:uppercase}.osv3-table{width:100%;border-collapse:collapse;font-size:11px}.osv3-table th{background:#efefef;border:1px solid #c9c9c9;padding:6px 6px;text-align:left;color:#111}.osv3-table td{border:1px solid #d1d1d1;padding:7px 6px}.osv3-table .c{text-align:center}.osv3-table .r{text-align:right;white-space:nowrap}.osv3-table .empty{text-align:center;color:#777;padding:10px}.osv3-summary{display:grid;grid-template-columns:1fr 1fr 1fr;margin-top:10px;border:1px solid #c9c9c9}.osv3-summary .group{display:grid;grid-template-columns:1fr 1fr}.osv3-summary .group+div{border-left:1px solid #c9c9c9}.osv3-summary span{display:block;background:#ededed;border-bottom:1px solid #c9c9c9;text-align:center;font-size:9px;font-weight:800;padding:4px}.osv3-summary b{display:block;text-align:center;padding:6px;font-size:10px}.osv3-summary .cell+ .cell{border-left:1px solid #c9c9c9}.osv3-payment{font-size:12px;margin:10px 0 0}.osv3-total{display:flex;justify-content:flex-end;gap:10px;align-items:baseline;margin:25px 0 50px;font-size:15px;font-weight:700}.osv3-total strong{font-size:25px}.osv3-sign{display:grid;grid-template-columns:260px 1fr;gap:70px;margin:58px 48px 0}.osv3-sign div{border-top:1px solid #222;padding-top:5px;text-align:center;font-size:10px}.osv3-foot{text-align:center;margin-top:22px;color:#777;font-size:9px}
  @media print{.folha.osv3{width:100%;max-width:none;margin:0;padding:6mm 7mm 4mm}.osv3-section,.osv3-summary,.osv3-trio,.osv3-notes{break-inside:avoid}@page{size:A4 portrait;margin:5mm}}
  </style><main class="folha osv3">
    <header class="osv3-head"><div class="osv3-company"><img src="${logo}" alt="Help Soluções Tecnológicas"><div><h1>HELP SOLUÇÕES TECNOLÓGICAS</h1><p>Sistemas de gestão empresarial e informática</p><p>Atendimento técnico e soluções em tecnologia</p></div></div><div class="osv3-meta"><h2>Ordem de Serviço</h2><div class="num">${osHtml(atual.numero)}</div><div>Data: <b>${osData(atual.criado_em)}</b></div><div>Situação: <b>${osHtml(atual.status || '—')}</b></div><div>Garantia: <b>${Number(atual.garantia_dias||0)} dias</b></div><div>Data de entrega: <b>${osData(atual.previsao)}</b></div></div></header>
    <div class="osv3-alert">NÃO É DOCUMENTO FISCAL · NÃO VÁLIDO COMO RECIBO/GARANTIA · NÃO COMPROVA PAGAMENTO</div>
    <section class="osv3-client"><b>${osHtml(atual.cliente || 'CLIENTE')}</b>${cliente.documento ? ` · ${osHtml(cliente.documento)}` : ''}${cliente.telefone ? ` · ${osHtml(cliente.telefone)}` : ''}<br>${osHtml(atual.unidade || cliente.unidade || '—')}${cliente.email ? ` · ${osHtml(cliente.email)}` : ''}</section>
    <section class="osv3-trio"><div><span class="osv3-label">OBJETO</span><b>${osHtml([atual.equipamento,atual.marca_modelo].filter(Boolean).join(' ') || '—')}</b></div><div><span class="osv3-label">USUÁRIO / SOLICITANTE</span><b>${osHtml(atual.solicitante || '—')}</b></div><div><span class="osv3-label">DEFEITO RELATADO</span><b>${osHtml(atual.problema || '—')}</b></div></section>
    <section class="osv3-notes"><div><span class="osv3-label">DIAGNÓSTICO</span><p>${osHtml(atual.diagnostico || '—')}</p></div><div><span class="osv3-label">SERVIÇO EXECUTADO</span><p>${osHtml(atual.servico_executado || '—')}</p></div></section>
    ${tabela('Peças / Produtos', pecas, 'UN', 'Nenhuma peça/produto informado.')}
    ${tabela('Serviços', servicos, 'SV', 'Nenhum serviço informado.')}
    <section class="osv3-summary"><div class="group"><div class="cell"><span>PRODUTOS</span><b>${qtd(pecas)} un.</b></div><div class="cell"><span>VALOR</span><b>${osMoeda(totalPecas)}</b></div></div><div class="group"><div class="cell"><span>SERVIÇOS</span><b>${qtd(servicos)} item(ns)</b></div><div class="cell"><span>VALOR</span><b>${osMoeda(totalServicos)}</b></div></div><div class="group"><div class="cell"><span>SUBTOTAL</span><b>${osMoeda(subtotal)}</b></div><div class="cell"><span>DESCONTO</span><b>${osMoeda(desconto)}</b></div></div></section>
    <div class="osv3-payment">Forma de pagamento: não informada</div>
    <div class="osv3-total"><span>Total geral R$:</span><strong>${moedaSemSimbolo(atual.total)}</strong></div>
    <section class="osv3-sign"><div>Data</div><div>${osHtml(atual.assinatura_nome || 'Assinatura do solicitante')}</div></section>
    <div class="osv3-foot">Help Soluções Tecnológicas · ${osHtml(atual.numero)} · Documento gerado pelo CRM</div>
  </main>`;
  abrirDocumentoImpressao(atual.numero, corpo);
};
