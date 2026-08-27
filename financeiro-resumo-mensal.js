/* Filtros de período do Financeiro — versão estável sem observador global. */
(function () {
  const K_PERIODO='help-financeiro-periodo', K_INICIO='help-financeiro-periodo-inicio', K_FIM='help-financeiro-periodo-fim';
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const moeda=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

  function mes(offset=0){
    const a=new Date();
    return {inicio:iso(new Date(a.getFullYear(),a.getMonth()+offset,1)),fim:iso(new Date(a.getFullYear(),a.getMonth()+offset+1,0))};
  }
  function periodo(){return document.getElementById('finPeriodoFiltro')?.value||localStorage.getItem(K_PERIODO)||'atual'}
  function faixa(){
    const p=periodo();
    if(p==='todos') return {periodo:p,inicio:'',fim:''};
    if(p==='atual') return {periodo:p,...mes(0)};
    if(p==='proximo') return {periodo:p,...mes(1)};
    if(p==='anterior') return {periodo:p,...mes(-1)};
    if(p==='atualProximo'){const a=mes(0),b=mes(1);return {periodo:p,inicio:a.inicio,fim:b.fim}}
    const a=mes(0);
    return {periodo:'personalizado',inicio:document.getElementById('finPeriodoInicio')?.value||localStorage.getItem(K_INICIO)||a.inicio,fim:document.getElementById('finPeriodoFim')?.value||localStorage.getItem(K_FIM)||a.fim};
  }
  function dentro(valor,f){
    if(f.periodo==='todos') return true;
    const d=String(valor||'').slice(0,10);
    return !!d && (!f.inicio||d>=f.inicio) && (!f.fim||d<=f.fim);
  }
  function rotulo(p=periodo()){
    return ({atual:'Mês atual',proximo:'Próximo mês',atualProximo:'Mês atual + próximo',anterior:'Mês anterior',todos:'Todos os períodos',personalizado:'Período personalizado'})[p]||'Período selecionado';
  }

  function aplicarFiltro(){
    const personalizado=periodo()==='personalizado';
    document.getElementById('finPeriodoPersonalizado')?.classList.toggle('hidden',!personalizado);
  }

  function instalarFiltro(){
    if(document.getElementById('finPeriodoFiltro')) return;
    const toolbar=document.querySelector('#visaoFinanceiro .financeiro-painel .financeiro-toolbar');
    if(!toolbar) return;
    const alvo=document.getElementById('financeiroFiltro');
    const wrap=document.createElement('div');
    wrap.className='fin-periodo-filtro';
    wrap.innerHTML=`<select id="finPeriodoFiltro" title="Período exibido">
      <option value="atual">Mês atual</option>
      <option value="proximo">Próximo mês</option>
      <option value="atualProximo">Mês atual + próximo</option>
      <option value="anterior">Mês anterior</option>
      <option value="todos">Todos os períodos</option>
      <option value="personalizado">Personalizado</option>
    </select><div id="finPeriodoPersonalizado" class="fin-periodo-personalizado hidden">
      <label><span>De</span><input id="finPeriodoInicio" type="date"></label>
      <label><span>Até</span><input id="finPeriodoFim" type="date"></label>
    </div>`;
    (alvo||toolbar).insertAdjacentElement(alvo?'beforebegin':'beforeend',wrap);
    const s=document.getElementById('finPeriodoFiltro');
    const salvo=localStorage.getItem(K_PERIODO);
    if(['atual','proximo','atualProximo','anterior','todos','personalizado'].includes(salvo)) s.value=salvo;
    document.getElementById('finPeriodoInicio').value=localStorage.getItem(K_INICIO)||'';
    document.getElementById('finPeriodoFim').value=localStorage.getItem(K_FIM)||'';
    aplicarFiltro();
    s.addEventListener('change',()=>{localStorage.setItem(K_PERIODO,s.value);aplicarFiltro();window.renderizarTabelaFinanceiro?.();window.finRenderResumo?.();window.atualizarPinsFinanceiros?.()});
    document.getElementById('finPeriodoInicio').addEventListener('change',e=>{localStorage.setItem(K_INICIO,e.target.value||'');window.renderizarTabelaFinanceiro?.();window.finRenderResumo?.();window.atualizarPinsFinanceiros?.()});
    document.getElementById('finPeriodoFim').addEventListener('change',e=>{localStorage.setItem(K_FIM,e.target.value||'');window.renderizarTabelaFinanceiro?.();window.finRenderResumo?.();window.atualizarPinsFinanceiros?.()});
  }

  window.finRenderResumo=function(){
    instalarFiltro();
    const f=faixa(), hoje=typeof finHoje==='function'?finHoje():new Date().toISOString().slice(0,10);
    const regs=typeof financeiroRegistros!=='undefined'&&Array.isArray(financeiroRegistros)?financeiroRegistros:[];
    const pags=typeof finPagamentos!=='undefined'&&Array.isArray(finPagamentos)?finPagamentos:[];
    const saldo=typeof finSaldo==='function'?finSaldo:(x=>Math.max(0,Number(x.valor||0)-Number(x.valor_pago||0)));
    const pend=regs.filter(x=>x.status==='Pendente');
    const noPeriodo=pend.filter(x=>dentro(x.vencimento,f));
    const receber=noPeriodo.filter(x=>x.tipo==='Receber').reduce((s,x)=>s+saldo(x),0);
    const pagar=noPeriodo.filter(x=>x.tipo==='Pagar').reduce((s,x)=>s+saldo(x),0);
    const atraso=pend.filter(x=>x.vencimento&&x.vencimento<hoje).reduce((s,x)=>s+saldo(x),0);
    const mov=pags.filter(x=>dentro(x.pago_em,f)).reduce((s,x)=>s+Number(x.valor||0),0);
    const el=document.getElementById('financeiroResumo'); if(!el) return;
    const r=rotulo(f.periodo);
    el.innerHTML=[
      ['arrow-down-circle','A receber',receber,'receber',r],
      ['alert-triangle','Em atraso',atraso,'atraso','Todas as pendências vencidas'],
      ['arrow-up-circle','A pagar',pagar,'pagar',r],
      ['circle-check-big','Movimentado',mov,'pago',r]
    ].map(([i,t,v,c,sub])=>`<article class="${c}"><i data-lucide="${i}"></i><span>${t}<small>${sub}</small></span><strong>${typeof osMoeda==='function'?osMoeda(v):moeda(v)}</strong></article>`).join('');
    if(window.lucide) lucide.createIcons();
  };

  window.renderizarTabelaFinanceiro=function(){
    instalarFiltro();
    const busca=(document.getElementById('financeiroBusca')?.value||'').toLowerCase(), filtro=document.getElementById('financeiroFiltro')?.value||'';
    const hoje=typeof finHoje==='function'?finHoje():new Date().toISOString().slice(0,10), f=faixa();
    const regs=typeof financeiroRegistros!=='undefined'&&Array.isArray(financeiroRegistros)?financeiroRegistros:[];
    const saldoFn=typeof finSaldo==='function'?finSaldo:(x=>Math.max(0,Number(x.valor||0)-Number(x.valor_pago||0)));
    const anexos=typeof finAnexos!=='undefined'&&Array.isArray(finAnexos)?finAnexos:[];
    const html=typeof osHtml==='function'?osHtml:(v=>String(v??'')), data=typeof osData==='function'?osData:(v=>v||'—'), moedaFn=typeof osMoeda==='function'?osMoeda:moeda;
    const pode=k=>typeof finPermissao==='function'?finPermissao(k):true;
    const lista=regs.filter(x=>{
      const atraso=x.status==='Pendente'&&x.vencimento<hoje;
      const okBusca=!busca||[x.descricao,x.categoria,x.ordens_servico?.numero,x.financeiro_fornecedores?.nome].join(' ').toLowerCase().includes(busca);
      const okFiltro=!filtro||x.tipo===filtro||x.status===filtro||(filtro==='Atrasado'&&atraso);
      return okBusca&&okFiltro&&dentro(x.vencimento,f);
    });
    const tabela=document.getElementById('financeiroTabela'); if(!tabela) return;
    tabela.innerHTML=`<div class="financeiro-table-wrap"><table><thead><tr><th>Descrição</th><th>Tipo</th><th>Vencimento</th><th>Valor / saldo</th><th>Status</th><th>Ações</th></tr></thead><tbody>${lista.map(x=>{
      const atraso=x.status==='Pendente'&&x.vencimento<hoje,parcela=x.parcelas_total?` · ${x.parcela_numero}/${x.parcelas_total}`:'',saldo=saldoFn(x),qtd=anexos.filter(a=>a.lancamento_id===x.id).length;
      return `<tr><td><b>${html(x.descricao)}${parcela}</b><small>${html(x.categoria)}${x.financeiro_fornecedores?.nome?' · '+html(x.financeiro_fornecedores.nome):''}</small></td><td><span class="fin-tipo ${String(x.tipo||'').toLowerCase()}">${html(x.tipo)}</span></td><td>${data(x.vencimento)}</td><td><b>${moedaFn(x.valor)}</b>${Number(x.valor_pago)>0?`<small>Pago ${moedaFn(x.valor_pago)} · saldo ${moedaFn(saldo)}</small>`:''}</td><td><span class="fin-status ${atraso?'atrasado':String(x.status||'').toLowerCase()}">${atraso?'Atrasado':Number(x.valor_pago)>0&&saldo>0?'Parcial':html(x.status)}</span>${x.conciliado?'<small class="fin-conciliado">Conciliado</small>':''}</td><td><div class="fin-acoes">${x.status==='Pendente'&&pode('financeiroBaixar')?`<button title="Registrar pagamento" onclick="finAbrirBaixa(${x.id})"><i data-lucide="badge-check"></i></button>`:''}<button title="Cobrar pelo WhatsApp" onclick="finCobrarWhatsApp(${x.id})"><i data-lucide="message-circle"></i></button><button title="Anexos (${qtd})" onclick="finAbrirAnexos(${x.id})"><i data-lucide="paperclip"></i></button>${pode('financeiroCriar')?`<button title="Editar" onclick="editarFinanceiro(${x.id})"><i data-lucide="pencil"></i></button>`:''}${pode('financeiroExcluir')?`<button title="Excluir" onclick="excluirFinanceiro(${x.id})"><i data-lucide="trash-2"></i></button>`:''}</div></td></tr>`;
    }).join('')||`<tr><td colspan="6" class="fin-vazio">Nenhum lançamento encontrado em ${rotulo(f.periodo).toLowerCase()}.</td></tr>`}</tbody></table></div>`;
    if(window.lucide) lucide.createIcons();
  };

  const trocarOriginal=window.trocarAba;
  if(typeof trocarOriginal==='function'){
    window.trocarAba=function(aba){
      const r=trocarOriginal.apply(this,arguments);
      if(aba==='financeiro') setTimeout(()=>{instalarFiltro();window.renderizarTabelaFinanceiro?.();window.finRenderResumo?.()},0);
      return r;
    };
  }

  const style=document.createElement('style');
  style.textContent=`.fin-periodo-filtro{display:flex;align-items:center;gap:8px;min-width:0}.fin-periodo-filtro>select{min-width:185px}.fin-periodo-personalizado{display:flex;gap:7px;align-items:center}.fin-periodo-personalizado.hidden{display:none!important}.fin-periodo-personalizado label{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase}.fin-periodo-personalizado input{min-width:132px}#financeiroResumo article span small{display:block;margin-top:4px;font-size:9px;font-weight:500;text-transform:none;letter-spacing:0;color:var(--text-muted)}@media(max-width:980px){.financeiro-toolbar{flex-wrap:wrap}.fin-periodo-filtro{width:100%;flex-wrap:wrap}.fin-periodo-filtro>select{flex:1}.fin-periodo-personalizado{flex:1;flex-wrap:wrap}}`;
  document.head.appendChild(style);

  function iniciar(){
    instalarFiltro();
    if(window.lucide) lucide.createIcons();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true}); else iniciar();
})();