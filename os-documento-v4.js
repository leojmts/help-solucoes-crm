/* Documento comercial v4 da Ordem de Serviço — Help Soluções Tecnológicas. */
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

  const logo = new URL('help-logo-transparent.svg', window.location.href).href;
  const totalPecas = pecas.reduce((s,x)=>s + Number(x.quantidade||0)*Number(x.valor_unitario||0), 0);
  const totalServicos = servicos.reduce((s,x)=>s + Number(x.quantidade||0)*Number(x.valor_unitario||0), 0);
  const subtotal = totalPecas + totalServicos;
  const desconto = Number(atual.desconto || 0);
  const totalGeral = Number.isFinite(Number(atual.total)) ? Number(atual.total) : Math.max(0, subtotal - desconto);
  const moedaSemSimbolo = v => osMoeda(v).replace('R$ ','').replace('R$','').trim();
  const qtd = lista => lista.reduce((s,x)=>s+Number(x.quantidade||0),0);
  const emitido = atual.criado_em ? new Date(atual.criado_em).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');

  const linha = (x, i, unidade) => `<tr>
    <td class="c cod">${i+1}</td>
    <td class="desc">${osHtml(x.descricao || '—')}</td>
    <td class="c und">${unidade}</td>
    <td class="c qtd">${Number(x.quantidade||0)}</td>
    <td class="r valor">${moedaSemSimbolo(x.valor_unitario)}</td>
    <td class="r valor">0,00</td>
    <td class="r valor totalcol">${moedaSemSimbolo(Number(x.quantidade||0)*Number(x.valor_unitario||0))}</td>
  </tr>`;

  const tabela = (titulo, lista, unidade, vazio) => `<section class="osv4-section">
    <div class="osv4-bar">${titulo}</div>
    <table class="osv4-table">
      <colgroup><col class="w-cod"><col class="w-desc"><col class="w-und"><col class="w-qtd"><col class="w-unit"><col class="w-descval"><col class="w-total"></colgroup>
      <thead><tr><th>Cód.</th><th>Descrição</th><th>Und.</th><th>Qtd.</th><th>Unit. R$</th><th>Desc. R$</th><th>Total R$</th></tr></thead>
      <tbody>${lista.length ? lista.map((x,i)=>linha(x,i,unidade)).join('') : `<tr><td colspan="7" class="empty">${vazio}</td></tr>`}</tbody>
    </table>
  </section>`;

  const corpo = `<style>
  .folha.osv4{width:920px;max-width:calc(100% - 24px);margin:16px auto;padding:20px 25px 28px;border:0!important;color:#111;font:12px Arial,sans-serif;background:#fff}
  .osv4 *{box-sizing:border-box}.osv4-head{display:grid;grid-template-columns:minmax(0,1fr) 245px;gap:20px;align-items:start;padding-bottom:9px;border-bottom:2px solid #1f73d8}.osv4-company{display:flex;gap:13px;min-width:0}.osv4-company img{width:104px;height:62px;object-fit:contain;flex:0 0 auto}.osv4-company h1{margin:2px 0 5px;font-size:18px;line-height:1.05;color:#1769c2}.osv4-company p{margin:3px 0;font-size:11px}.osv4-meta{text-align:right;line-height:1.4;font-size:10.5px}.osv4-meta h2{font-size:16px;margin:0 0 2px}.osv4-meta .num{font-size:14px;font-weight:800;letter-spacing:.04em;white-space:nowrap}.osv4-meta b{white-space:nowrap}
  .osv4-alert{text-align:center;font-size:9.5px;font-weight:700;margin:8px 0 7px}.osv4-client{border:1px solid #c6cbd1;margin-bottom:8px}.osv4-row{display:grid;grid-template-columns:135px minmax(0,1fr);min-height:30px;border-bottom:1px solid #d8dce1}.osv4-row:last-child{border-bottom:0}.osv4-row span{padding:7px 9px;background:#f5f6f8;font-size:9.5px;font-weight:800;text-transform:uppercase}.osv4-row b,.osv4-row div{padding:7px 10px;min-width:0;overflow-wrap:anywhere}.osv4-inline{display:grid;grid-template-columns:1fr 1fr}.osv4-inline>div+div{border-left:1px solid #d8dce1}
  .osv4-data{display:grid;grid-template-columns:1fr 1fr;border:1px solid #c6cbd1;margin-bottom:8px}.osv4-data>div{padding:7px 9px;min-height:42px}.osv4-data>div:nth-child(even){border-left:1px solid #d8dce1}.osv4-data>div:nth-child(n+3){border-top:1px solid #d8dce1}.osv4-label{display:block;font-size:9px;font-weight:800;text-transform:uppercase;margin-bottom:3px;color:#444}.osv4-data b{font-size:11px;overflow-wrap:anywhere}
  .osv4-notes{display:grid;grid-template-columns:1fr 1fr;border:1px solid #c6cbd1;margin-bottom:8px}.osv4-notes>div{padding:7px 9px;min-height:50px}.osv4-notes>div+div{border-left:1px solid #d8dce1}.osv4-notes p{margin:3px 0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.35}
  .osv4-section{margin-top:8px;break-inside:avoid}.osv4-bar{border:1px solid #c6cbd1;border-bottom:0;background:#eceeef;padding:5px 7px;font-size:10px;font-weight:800;text-transform:uppercase}.osv4-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9.6px;font-variant-numeric:tabular-nums}.osv4-table .w-cod{width:6%}.osv4-table .w-desc{width:43%}.osv4-table .w-und{width:7%}.osv4-table .w-qtd{width:7%}.osv4-table .w-unit{width:12%}.osv4-table .w-descval{width:11%}.osv4-table .w-total{width:14%}.osv4-table th{background:#f0f1f2;border:1px solid #c6cbd1;padding:5px 4px;text-align:left;color:#111;line-height:1.15;overflow:hidden}.osv4-table td{border:1px solid #d1d5da;padding:6px 4px;vertical-align:middle;overflow:hidden}.osv4-table .c{text-align:center}.osv4-table .r{text-align:right}.osv4-table .valor{white-space:nowrap;font-size:9.2px;padding-left:2px;padding-right:5px}.osv4-table .desc{overflow-wrap:anywhere}.osv4-table .empty{text-align:center;color:#777;padding:9px}
  .osv4-summary{display:grid;grid-template-columns:1fr 1fr 1fr;margin-top:9px;border:1px solid #c6cbd1;break-inside:avoid}.osv4-summary .group{display:grid;grid-template-columns:1fr 1fr;min-width:0}.osv4-summary .group+div{border-left:1px solid #c6cbd1}.osv4-summary span{display:block;background:#eceeef;border-bottom:1px solid #c6cbd1;text-align:center;font-size:8.8px;font-weight:800;padding:4px}.osv4-summary b{display:block;text-align:center;padding:6px 3px;font-size:9.7px;white-space:nowrap}.osv4-summary .cell+.cell{border-left:1px solid #c6cbd1}.osv4-payment{font-size:10px;margin:9px 0 0}.osv4-total{display:flex;justify-content:flex-end;gap:10px;align-items:baseline;margin:20px 0 40px;font-size:15px;font-weight:700}.osv4-total strong{font-size:24px;white-space:nowrap;color:#1769c2}.osv4-sign{display:grid;grid-template-columns:220px 1fr;gap:65px;margin:50px 45px 0}.osv4-sign div{border-top:1px solid #222;padding-top:5px;text-align:center;font-size:10px}.osv4-foot{text-align:center;margin-top:20px;color:#777;font-size:9px}
  @media print{.folha.osv4{width:100%;max-width:none;margin:0;padding:5mm 6mm 4mm}.osv4-table{font-size:9pt}.osv4-table .valor{font-size:8.7pt}.osv4-head,.osv4-client,.osv4-data,.osv4-notes,.osv4-summary{break-inside:avoid}@page{size:A4 portrait;margin:5mm}}
  </style><main class="folha osv4">
    <header class="osv4-head"><div class="osv4-company"><img src="${logo}" alt="Help Soluções Tecnológicas"><div><h1>Help Soluções Tecnológicas</h1><p>Sistemas de gestão empresarial e informática</p><p>Atendimento técnico e soluções em tecnologia</p></div></div><div class="osv4-meta"><h2>Ordem de Serviço</h2><div class="num">${osHtml(atual.numero)}</div><div>Emitido em: <b>${osHtml(emitido)}</b></div><div>Situação: <b>${osHtml(atual.status || '—')}</b></div><div>Garantia: <b>${Number(atual.garantia_dias||0)} dias</b></div><div>Previsão: <b>${osData(atual.previsao)}</b></div></div></header>
    <div class="osv4-alert">NÃO É DOCUMENTO FISCAL · NÃO VÁLIDO COMO RECIBO/GARANTIA · NÃO COMPROVA PAGAMENTO</div>

    <section class="osv4-client">
      <div class="osv4-row"><span>Cliente</span><b>${osHtml(atual.cliente || '—')}</b></div>
      <div class="osv4-row"><span>Unidade</span><div class="osv4-inline"><div><b>${osHtml(atual.unidade || cliente.unidade || '—')}</b></div><div><b>${cliente.documento ? 'CNPJ: ' + osHtml(cliente.documento) : 'CNPJ: —'}</b></div></div></div>
      <div class="osv4-row"><span>Contato</span><div class="osv4-inline"><div>${cliente.telefone ? osHtml(cliente.telefone) : '—'}</div><div>${cliente.email ? osHtml(cliente.email) : '—'}</div></div></div>
    </section>

    <section class="osv4-data">
      <div><span class="osv4-label">Equipamento</span><b>${osHtml(atual.equipamento || '—')}</b></div>
      <div><span class="osv4-label">Marca / modelo</span><b>${osHtml(atual.marca_modelo || '—')}</b></div>
      <div><span class="osv4-label">Serial / patrimônio</span><b>${osHtml(atual.serial || '—')}</b></div>
      <div><span class="osv4-label">Técnico responsável</span><b>${osHtml(atual.tecnico || '—')}</b></div>
      <div><span class="osv4-label">Usuário / solicitante</span><b>${osHtml(atual.solicitante || '—')}</b></div>
      <div><span class="osv4-label">Problema relatado</span><b>${osHtml(atual.problema || '—')}</b></div>
    </section>

    <section class="osv4-notes"><div><span class="osv4-label">Diagnóstico</span><p>${osHtml(atual.diagnostico || '—')}</p></div><div><span class="osv4-label">Serviço executado</span><p>${osHtml(atual.servico_executado || '—')}</p></div></section>
    ${tabela('Peças / Produtos', pecas, 'UN', 'Nenhuma peça/produto informado.')}
    ${tabela('Serviços', servicos, 'SV', 'Nenhum serviço informado.')}

    <section class="osv4-summary"><div class="group"><div class="cell"><span>PRODUTOS</span><b>${qtd(pecas)} un.</b></div><div class="cell"><span>VALOR</span><b>${osMoeda(totalPecas)}</b></div></div><div class="group"><div class="cell"><span>SERVIÇOS</span><b>${qtd(servicos)} item(ns)</b></div><div class="cell"><span>VALOR</span><b>${osMoeda(totalServicos)}</b></div></div><div class="group"><div class="cell"><span>SUBTOTAL</span><b>${osMoeda(subtotal)}</b></div><div class="cell"><span>DESCONTO</span><b>${osMoeda(desconto)}</b></div></div></section>
    <div class="osv4-payment">Forma de pagamento: não informada</div>
    <div class="osv4-total"><span>Total geral:</span><strong>${osMoeda(totalGeral)}</strong></div>
    <section class="osv4-sign"><div>Data</div><div>${osHtml(atual.assinatura_nome || 'Assinatura do responsável / solicitante')}</div></section>
    <div class="osv4-foot">Help Soluções Tecnológicas · ${osHtml(atual.numero)} · Documento gerado pelo CRM</div>
  </main>`;
  abrirDocumentoImpressao(atual.numero, corpo);
};
