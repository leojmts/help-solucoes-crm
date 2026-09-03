/* Filtros da aba Recorrências — isolados para não alterar a lógica financeira existente. */
(function(){
  // Loader isolado do módulo de anexos de clientes. Não altera a lógica financeira abaixo.
  if(!document.getElementById('clienteAnexosScript')){
    const clienteAnexosScript=document.createElement('script');
    clienteAnexosScript.id='clienteAnexosScript';
    clienteAnexosScript.src='cliente-anexos.js?v=20260903-1';
    document.head.appendChild(clienteAnexosScript);
  }

  // Complemento isolado: inclui chamados em aberto nas Pendências do Cliente.
  if(!document.getElementById('clientePendenciasChamadosScript')){
    const clientePendenciasChamadosScript=document.createElement('script');
    clientePendenciasChamadosScript.id='clientePendenciasChamadosScript';
    clientePendenciasChamadosScript.src='cliente-pendencias-chamados.js?v=20260903-1';
    document.head.appendChild(clientePendenciasChamadosScript);
  }

  const estado={busca:'',inicio:'',fim:'',tipo:'',status:''};

  function dataIso(card){
    const texto=card.querySelector('.fin-recorrencia-proxima')?.textContent||'';
    const m=texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m?`${m[3]}-${m[2]}-${m[1]}`:'';
  }

  function status(card){
    if(card.querySelector('.fin-recorrencia-cancelada'))return 'Cancelada';
    const botoes=[...card.querySelectorAll('button')].map(x=>(x.textContent||'').trim().toLowerCase());
    return botoes.some(x=>x.includes('ativar'))?'Pausada':'Ativa';
  }

  function aplicar(){
    const painel=document.getElementById('finPainelRecorrencias');
    const lista=painel?.querySelector('.fin-recorrencias-cards');
    if(!lista)return;
    const cards=[...lista.querySelectorAll(':scope > article')];
    let visiveis=0;
    cards.forEach(card=>{
      const texto=(card.textContent||'').toLowerCase();
      const tipo=card.querySelector('.fin-tipo')?.textContent?.trim()||'';
      const st=status(card);
      const data=dataIso(card);
      const mostrar=(!estado.busca||texto.includes(estado.busca.toLowerCase()))&&
        (!estado.tipo||tipo===estado.tipo)&&
        (!estado.status||st===estado.status)&&
        (!estado.inicio||(data&&data>=estado.inicio))&&
        (!estado.fim||(data&&data<=estado.fim));
      card.classList.toggle('fin-rec-oculto',!mostrar);
      if(mostrar)visiveis++;
    });
    let vazio=document.getElementById('finRecFiltroVazio');
    if(cards.length&&!visiveis){
      if(!vazio){vazio=document.createElement('p');vazio.id='finRecFiltroVazio';vazio.className='fin-vazio';lista.insertAdjacentElement('afterend',vazio)}
      vazio.textContent='Nenhuma recorrência encontrada com os filtros selecionados.';
    }else vazio?.remove();
  }

  function instalar(){
    const painel=document.getElementById('finPainelRecorrencias');
    const cabecalho=painel?.querySelector('.fin-section-head');
    const lista=painel?.querySelector('.fin-recorrencias-cards');
    if(!painel||!cabecalho||!lista)return;
    let box=document.getElementById('finRecFiltros');
    if(!box){
      box=document.createElement('div');
      box.id='finRecFiltros';
      box.className='fin-rec-filtros';
      box.innerHTML=`
        <label class="fin-rec-busca"><span>Buscar</span><input id="finRecBusca" type="search" placeholder="Cliente ou recorrência"></label>
        <label><span>De</span><input id="finRecInicio" type="date" title="Próximo vencimento a partir de"></label>
        <label><span>Até</span><input id="finRecFim" type="date" title="Próximo vencimento até"></label>
        <label><span>Tipo</span><select id="finRecTipo"><option value="">Receber e pagar</option><option value="Receber">Receber</option><option value="Pagar">Pagar</option></select></label>
        <label><span>Status</span><select id="finRecStatus"><option value="">Todos</option><option value="Ativa">Ativas</option><option value="Pausada">Pausadas</option><option value="Cancelada">Canceladas</option></select></label>
        <button id="finRecLimpar" type="button" class="btn btn-secondary" title="Limpar filtros"><i data-lucide="filter-x"></i>Limpar</button>`;
      cabecalho.insertAdjacentElement('afterend',box);
      const busca=document.getElementById('finRecBusca'),inicio=document.getElementById('finRecInicio'),fim=document.getElementById('finRecFim'),tipo=document.getElementById('finRecTipo'),st=document.getElementById('finRecStatus');
      busca.addEventListener('input',()=>{estado.busca=busca.value.trim();aplicar()});
      inicio.addEventListener('change',()=>{estado.inicio=inicio.value;aplicar()});
      fim.addEventListener('change',()=>{estado.fim=fim.value;aplicar()});
      tipo.addEventListener('change',()=>{estado.tipo=tipo.value;aplicar()});
      st.addEventListener('change',()=>{estado.status=st.value;aplicar()});
      document.getElementById('finRecLimpar').addEventListener('click',()=>{
        Object.assign(estado,{busca:'',inicio:'',fim:'',tipo:'',status:''});
        busca.value='';inicio.value='';fim.value='';tipo.value='';st.value='';aplicar();
      });
    }
    document.getElementById('finRecBusca').value=estado.busca;
    document.getElementById('finRecInicio').value=estado.inicio;
    document.getElementById('finRecFim').value=estado.fim;
    document.getElementById('finRecTipo').value=estado.tipo;
    document.getElementById('finRecStatus').value=estado.status;
    aplicar();
    if(window.lucide)lucide.createIcons();
  }

  const base=window.finRenderRecorrencias;
  if(typeof base==='function')window.finRenderRecorrencias=function(){const r=base.apply(this,arguments);instalar();return r};

  // Isolamento definitivo do Relatório de contas: trocar qualquer guia fecha o relatório.
  // A regra CSS abaixo também impede que ele fique visível em uma guia diferente de Lançamentos,
  // mesmo se algum outro script remover a classe hidden por engano.
  document.addEventListener('click',e=>{
    const alvo=e.target;
    if(!alvo?.closest)return;
    const aba=alvo.closest('#finNavegacao button[data-fin-aba]');
    if(aba){
      document.getElementById('financeiroRelatorios')?.classList.add('hidden');
      if(aba.dataset.finAba==='recorrencias')setTimeout(instalar,0);
      return;
    }
    const relatorio=alvo.closest('#visaoFinanceiro .header [onclick*="alternarRelatorioFinanceiro"]');
    if(relatorio){
      const lancamentos=document.querySelector('#finNavegacao button[data-fin-aba="lancamentos"]');
      if(lancamentos&&!lancamentos.classList.contains('active'))lancamentos.click();
    }
  },true);

  const style=document.createElement('style');
  style.textContent=`.fin-rec-filtros{display:grid;grid-template-columns:minmax(210px,1.35fr) repeat(4,minmax(135px,.8fr)) auto;gap:10px;align-items:end;margin:0 0 14px;padding:14px;border:1px solid var(--border-color);border-radius:12px;background:rgba(3,13,24,.24)}.fin-rec-filtros label{display:flex;flex-direction:column;gap:6px}.fin-rec-filtros label>span{font-size:10px;font-weight:750;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted)}.fin-rec-filtros input,.fin-rec-filtros select{width:100%;min-height:40px;padding:0 11px;border:1px solid var(--border-color);border-radius:9px;background:var(--input-bg,#071322);color:var(--text-main);outline:none}.fin-rec-filtros input:focus,.fin-rec-filtros select:focus{border-color:var(--accent-blue);box-shadow:0 0 0 3px rgba(59,130,246,.12)}.fin-rec-filtros .btn{min-height:40px;justify-content:center}.fin-rec-oculto{display:none!important}#visaoFinanceiro:has(#finNavegacao button[data-fin-aba]:not([data-fin-aba="lancamentos"]).active) #financeiroRelatorios{display:none!important}@media(max-width:1050px){.fin-rec-filtros{grid-template-columns:repeat(3,minmax(0,1fr))}.fin-rec-busca{grid-column:span 2}}@media(max-width:680px){.fin-rec-filtros{grid-template-columns:1fr 1fr}.fin-rec-busca{grid-column:1/-1}.fin-rec-filtros .btn{grid-column:1/-1}}`;
  document.head.appendChild(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(instalar,0),{once:true});else setTimeout(instalar,0);
})();
