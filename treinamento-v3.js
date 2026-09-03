(() => {
  'use strict';

  const K = {
    edits: 'helpTrainingV3Edits',
    custom: 'helpTrainingV3CustomLessons',
    procedures: 'helpTrainingV3Procedures',
    favorites: 'helpTrainingV3Favorites',
    recent: 'helpTrainingV3Recent',
    history: 'helpTrainingV3History',
    news: 'helpTrainingV3News',
    feedback: 'helpTrainingV3Feedback',
    order: 'helpTrainingV3Order',
    admin: 'helpTrainingV3AdminMode'
  };
  const jget = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); } catch { return fallback; } };
  const jset = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug = v => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const now = () => new Date().toISOString();

  const levelMap = {
    'fund-nav':'Básico','fund-dashboard':'Básico','fund-personalizar':'Operacional','fund-notif':'Operacional',
    'call-open':'Básico','call-interactions':'Operacional','call-files':'Operacional','call-timer':'Avançado','call-os':'Operacional',
    'crm-lead':'Básico','crm-flow':'Operacional','crm-follow':'Operacional','crm-lost':'Avançado','crm-convert':'Avançado',
    'gc-360':'Básico','gc-proposal':'Operacional','gc-proposal-flow':'Avançado','gc-sales':'Avançado',
    'client-new':'Básico','client-supplier':'Operacional','client-csv':'Avançado',
    'cat-item':'Básico','cat-stock':'Operacional','cat-history':'Avançado',
    'eq-new':'Básico','eq-branches':'Operacional','eq-move':'Operacional','eq-loan':'Avançado',
    'proc-new':'Básico','proc-work':'Operacional','os-new':'Básico','os-items':'Operacional','os-flow':'Operacional','os-docs':'Avançado',
    'fin-launch':'Básico','fin-pay':'Operacional','fin-rec':'Operacional','fin-accounts':'Operacional','fin-cash':'Operacional','fin-flow':'Avançado','fin-files':'Operacional','fin-ofx':'Avançado','fin-report':'Avançado',
    'ct-new':'Básico','ct-billing':'Operacional','ct-activate':'Avançado','ct-docs':'Operacional','ct-cycle':'Avançado','ct-onboarding':'Avançado',
    'rep-oper':'Operacional','rep-dossier':'Operacional','adm-users':'Avançado','adm-config':'Avançado','adm-backup':'Avançado','adm-answers':'Operacional','adm-kb':'Operacional'
  };

  const warnings = {
    chamados:'Antes de marcar um chamado como Resolvido, confirme a solução com o cliente e registre a resolução e o tempo de atendimento.',
    comercial:'Toda oportunidade ativa deve ter um próximo passo claro. Evite deixar lead sem data ou ação futura.',
    clientes:'Não registre senhas, códigos de autenticação ou credenciais nas observações técnicas.',
    catalogo:'Não altere saldo de produto manualmente para corrigir estoque; use uma movimentação para manter rastreabilidade.',
    equipamentos:'Antes de receber uma devolução, confira a condição física e os acessórios entregues.',
    processos:'Concluir uma execução não é o mesmo que excluir o processo. Preserve o histórico das rotinas recorrentes.',
    os:'Antes de gerar cobrança, confira serviços, peças, desconto e total final da OS.',
    financeiro:'Baixa registra o que realmente entrou ou saiu. Não altere o valor original só porque o pagamento foi parcial.',
    contratos:'Cancelar, encerrar e excluir têm efeitos diferentes. Contratos com histórico financeiro não devem ser apagados.',
    administracao:'Permissão deve seguir necessidade do cargo. Evite liberar exclusão, financeiro ou administração sem necessidade.'
  };

  const commonErrors = {
    chamados:['Resolver sem registrar tempo ou resolução','Não registrar contatos importantes no histórico','Criar nova OS quando já existe uma vinculada'],
    comercial:['Mover etapa sem registrar o que aconteceu','Deixar oportunidade sem follow-up','Marcar perda sem informar o motivo real'],
    clientes:['Duplicar empresa já cadastrada','Registrar credenciais em observações','Não revisar dados preenchidos por consulta/importação'],
    catalogo:['Apagar item usado em histórico','Ajustar quantidade sem movimentação','Cadastrar o mesmo item com códigos diferentes'],
    equipamentos:['Emprestar reserva sem previsão de devolução','Não registrar acessórios','Mover equipamento sem informar destino ou condição'],
    processos:['Criar processo sem responsável','Marcar tudo como concluído sem executar','Apagar rotina recorrente para interromper temporariamente'],
    os:['Misturar peças e serviços','Entregar sem atualizar status','Gerar cobrança antes de revisar o total'],
    financeiro:['Baixar na conta errada','Criar recorrência duplicada','Usar edição de lançamento para simular baixa parcial','Ignorar divergência de caixa'],
    contratos:['Ativar antes de revisar valores e vigência','Excluir contrato com histórico em vez de cancelar','Renovar sem revisar unidades atendidas'],
    administracao:['Dar perfil ADM por conveniência','Alterar parâmetros sem validar impacto','Confundir exportar backup com restauração automática']
  };

  const quizBank = {
    'call-timer':{q:'O que deve existir antes de marcar o chamado como Resolvido?',opts:['Somente uma observação interna','Resolução, tempo registrado e confirmação com o cliente','Uma OS obrigatoriamente','Apenas o nome do técnico'],correct:1},
    'crm-follow':{q:'Depois de realizar um follow-up e o cliente pedir retorno na próxima semana, o correto é:',opts:['Fechar a oportunidade','Apagar o contato anterior','Registrar o resultado e agendar a próxima ação','Mover direto para Fechado'],correct:2},
    'client-new':{q:'Qual informação NÃO deve ser guardada em observações técnicas?',opts:['IP fixo da impressora','Orientação de rede','Senha ou código de autenticação','Modelo de equipamento'],correct:2},
    'cat-stock':{q:'Como corrigir o saldo de um produto mantendo histórico?',opts:['Editar a quantidade diretamente','Criar uma movimentação de estoque','Criar outro produto','Excluir e cadastrar novamente'],correct:1},
    'eq-loan':{q:'O que é essencial em um empréstimo de máquina reserva?',opts:['Só o nome do cliente','Cliente, responsável, condição, acessórios e previsão quando aplicável','Apenas o número de série','Transformar a propriedade para o cliente'],correct:1},
    'os-docs':{q:'Antes de gerar cobrança de uma OS, você deve:',opts:['Conferir total, serviços, peças e desconto','Excluir o chamado','Fechar o caixa','Criar outro cliente'],correct:0},
    'fin-pay':{q:'Uma cobrança de R$ 1.000 recebeu apenas R$ 400. O correto é:',opts:['Editar a cobrança para R$ 400','Registrar baixa parcial de R$ 400','Marcar como Pago integralmente','Excluir e recriar'],correct:1},
    'fin-ofx':{q:'Qual é a função da conciliação OFX?',opts:['Criar contratos','Comparar movimentos bancários com baixas registradas','Cadastrar clientes','Gerar OS'],correct:1},
    'ct-activate':{q:'O que acontece ao ativar um contrato configurado para cobrança?',opts:['O contrato é apagado','As cobranças financeiras são geradas conforme as regras','Todos os chamados são encerrados','O cliente vira fornecedor'],correct:1},
    'adm-users':{q:'Qual é a melhor regra para permissões?',opts:['Todo mundo ADM','Liberar somente o necessário para o cargo','Liberar exclusão para todos','Compartilhar a mesma conta'],correct:1}
  };

  const flows = [
    {icon:'🎧',title:'Atendimento técnico completo',roles:['suporte','gestao'],steps:['Cliente solicita suporte','Abrir Chamado','Registrar interações e tempo','Gerar OS quando houver serviço técnico','Executar diagnóstico, serviços e peças','Gerar cobrança quando aplicável','Entregar e preservar histórico'],after:'Chamado, OS e financeiro permanecem conectados ao histórico do cliente.'},
    {icon:'🤝',title:'Venda até implantação',roles:['comercial','gestao','financeiro'],steps:['Cadastrar/acompanhar lead','Realizar follow-ups','Criar proposta','Aprovar proposta','Converter em contrato','Ativar contrato e gerar cobranças','Acompanhar onboarding em Processos'],after:'O comercial entrega para a operação sem recadastrar tudo do zero.'},
    {icon:'💰',title:'Receita até conciliação bancária',roles:['financeiro','gestao'],steps:['Criar conta a receber','Cobrar cliente','Registrar baixa total ou parcial','Selecionar a conta correta','Importar extrato OFX/QFX','Conciliar movimento bancário','Conferir relatório e saldo'],after:'O sistema mantém o vínculo entre lançamento, pagamento, conta e movimento do extrato.'},
    {icon:'🖥️',title:'Equipamento recebido para manutenção',roles:['suporte','gestao'],steps:['Cadastrar/localizar equipamento','Registrar recebimento/movimentação','Vincular cliente, filial e OS','Atualizar localização e condição','Executar manutenção','Registrar retorno ao cliente','Atualizar histórico do equipamento'],after:'A trajetória do equipamento fica rastreável por cliente, unidade e OS.'},
    {icon:'🔁',title:'Rotina interna recorrente',roles:['geral','gestao'],steps:['Criar Processo','Definir responsáveis','Configurar frequência','Executar checklist','Registrar progresso','Concluir execução','Aguardar próxima ocorrência'],after:'A recorrência preserva histórico e gera continuidade sem recriar a tarefa manualmente.'}
  ];

  const defaultNews = [
    {id:'n1',date:'2026-09-03',title:'Central de Treinamento auditada',text:'A base de treinamento foi reorganizada conforme as funções efetivamente carregadas pelo CRM.',links:['fund-nav']},
    {id:'n2',date:'2026-09-02',title:'Financeiro com filtros, previsão e conciliação',text:'Treinamentos de baixa parcial, fluxo de caixa, contas e OFX estão disponíveis.',links:['fin-pay','fin-flow','fin-ofx']},
    {id:'n3',date:'2026-09-01',title:'Contratos e almoxarifado ampliados',text:'A Central agora documenta cobertura por filiais, onboarding, equipamentos, empréstimos e devoluções.',links:['ct-new','ct-onboarding','eq-loan']}
  ];

  function edits(){ return jget(K.edits, {}); }
  function custom(){ return jget(K.custom, []); }
  function favorites(){ return jget(K.favorites, []); }
  function recent(){ return jget(K.recent, []); }
  function news(){ const n=jget(K.news, null); if(n) return n; jset(K.news, defaultNews); return defaultNews; }
  function adminMode(){ return localStorage.getItem(K.admin) === '1'; }
  function feedback(){ return jget(K.feedback, {}); }

  function moduleOfLesson(id){ return moduleData.find(m => m.lessons.some(l => l.id === id)); }
  function rawLesson(id){ for(const m of moduleData){ const l=m.lessons.find(x=>x.id===id); if(l) return {m,l}; } return null; }
  function metaFor(id){
    const r=rawLesson(id); if(!r) return null;
    const e=edits()[id] || {};
    return {...r.l,...e,id,level:e.level||levelMap[id]||'Operacional',status:e.status||'Publicado',mandatory:e.mandatory ?? ['fund-nav','call-open','crm-lead','client-new','os-new','fin-launch','ct-new'].includes(id),roles:e.roles||r.m.roles,warning:e.warning||warnings[r.m.id]||'',errors:e.errors||commonErrors[r.m.id]||[],images:e.images||[],quiz:e.quiz||quizBank[id]||null,moduleId:r.m.id,moduleTitle:r.m.title};
  }

  function applyCustomLessons(){
    const existing=new Set(moduleData.flatMap(m=>m.lessons.map(l=>l.id)));
    custom().forEach(c=>{
      if(existing.has(c.id)) return;
      const m=moduleData.find(x=>x.id===c.moduleId); if(!m) return;
      m.lessons.push({id:c.id,title:c.title,desc:c.desc,steps:c.steps||[]}); existing.add(c.id);
    });
    applyOrder();
  }
  function applyOrder(){
    const order=jget(K.order,{});
    moduleData.forEach(m=>{
      const ids=order[m.id]; if(!Array.isArray(ids)) return;
      m.lessons.sort((a,b)=>{const ai=ids.indexOf(a.id),bi=ids.indexOf(b.id);return (ai<0?9999:ai)-(bi<0?9999:bi)});
    });
  }

  function injectCSS(){
    const s=document.createElement('style');s.id='trainingV3Style';s.textContent=`
    .v3-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.v3-card{padding:17px}.v3-card h3{margin:0 0 6px;font-size:14px}.v3-card p{margin:0;color:var(--muted);font-size:10px;line-height:1.5}.v3-level{font-size:8px;font-weight:900;border-radius:999px;padding:4px 7px;background:var(--surface3);color:var(--muted)}.v3-level.basico{background:var(--okSoft);color:var(--ok)}.v3-level.operacional{background:var(--accentSoft);color:var(--accent)}.v3-level.avancado{background:var(--purpleSoft);color:var(--purple)}
    .v3-alert{margin:13px 0;padding:12px;border-radius:11px;border:1px solid var(--line);font-size:9px;line-height:1.5}.v3-alert.warn{background:var(--warnSoft);color:var(--warn)}.v3-alert.danger{background:var(--dangerSoft);color:var(--danger)}.v3-alert b{display:block;margin-bottom:3px}.v3-errors{margin:5px 0 0;padding-left:17px}.v3-quiz{margin-top:15px;border:1px solid var(--line);background:var(--surface2);border-radius:12px;padding:13px}.v3-quiz h4{font-size:11px;margin:0 0 9px}.v3-quiz-options{display:grid;gap:6px}.v3-quiz button{text-align:left;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--text);padding:9px;font-size:9px}.v3-quiz button.correct{border-color:var(--ok);background:var(--okSoft);color:var(--ok)}.v3-quiz button.wrong{border-color:var(--danger);background:var(--dangerSoft);color:var(--danger)}
    .v3-flow{display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px;align-items:start}.v3-flow-icon{width:44px;height:44px;border-radius:12px;background:var(--accentSoft);display:grid;place-items:center;font-size:20px}.v3-flow-steps{display:flex;flex-wrap:wrap;gap:5px;margin-top:12px}.v3-flow-step{font-size:8px;border:1px solid var(--line);background:var(--surface2);border-radius:999px;padding:5px 7px}.v3-flow-arrow{color:var(--muted);font-size:9px;align-self:center}.v3-after{margin-top:10px;padding:9px;background:var(--okSoft);color:var(--ok);border-radius:9px;font-size:8px}
    .v3-track-head{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}.v3-cert{padding:14px;border:1px solid var(--line);background:var(--surface2);border-radius:12px;margin:13px 0}.v3-checklist{display:grid;gap:7px;margin-top:10px}.v3-check{display:flex;align-items:center;gap:8px;font-size:9px;color:var(--muted)}.v3-check input{accent-color:var(--accent)}
    .v3-fav{border:0;background:transparent;color:var(--warn);font-size:16px;padding:3px 6px}.v3-media{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.v3-media img{width:100%;max-height:220px;object-fit:cover;border-radius:10px;border:1px solid var(--line);background:var(--surface2)}.v3-media-empty{padding:18px;border:1px dashed var(--line);border-radius:10px;color:var(--muted);font-size:9px;text-align:center}
    .v3-news{display:grid;gap:9px}.v3-news article{padding:15px}.v3-news time{font-size:8px;color:var(--muted);font-weight:800}.v3-news h3{font-size:13px;margin:4px 0}.v3-news p{font-size:9px;color:var(--muted);line-height:1.45}.v3-news-links{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    .v3-admin-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.v3-admin-layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:12px}.v3-admin-list{max-height:680px;overflow:auto;padding:9px}.v3-admin-item{padding:10px;border:1px solid var(--line);border-radius:9px;margin-bottom:6px;background:var(--surface2);cursor:pointer}.v3-admin-item[draggable=true]{cursor:grab}.v3-admin-item b{display:block;font-size:10px}.v3-admin-item span{font-size:8px;color:var(--muted)}.v3-form{padding:16px}.v3-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.v3-form label{display:grid;gap:4px;font-size:8px;font-weight:850;color:var(--muted)}.v3-form input,.v3-form select,.v3-form textarea{width:100%;border:1px solid var(--line);border-radius:9px;background:var(--surface2);color:var(--text);padding:9px;font-size:9px;outline:none}.v3-form textarea{min-height:78px;resize:vertical}.v3-full{grid-column:1/-1}.v3-status{display:inline-flex;font-size:8px;padding:4px 7px;border-radius:999px;font-weight:900}.v3-status.publicado{background:var(--okSoft);color:var(--ok)}.v3-status.rascunho{background:var(--warnSoft);color:var(--warn)}.v3-status.oculto{background:var(--dangerSoft);color:var(--danger)}.v3-history{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}.v3-history-item{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid var(--line);padding:7px 0;font-size:8px;color:var(--muted)}
    .v3-manager{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}.v3-manager article{padding:12px}.v3-manager span{display:block;font-size:8px;color:var(--muted)}.v3-manager b{font-size:19px}.v3-confusion{margin-top:10px}.v3-confusion div{display:flex;justify-content:space-between;padding:7px;border-bottom:1px solid var(--line);font-size:9px}
    @media(max-width:900px){.v3-admin-layout{grid-template-columns:1fr}.v3-admin-list{max-height:300px}.v3-grid{grid-template-columns:1fr}}@media(max-width:650px){.v3-form-grid,.v3-manager,.v3-media{grid-template-columns:1fr}.v3-full{grid-column:auto}}
    `;document.head.appendChild(s);
  }

  function addViewButton(name,label,where='training'){
    const side=document.querySelector('.sidebar');
    if(side&&!side.querySelector(`[data-nav="${name}"]`)){
      const note=side.querySelector('.side-note');
      const b=document.createElement('button');b.className='nav-item';b.dataset.nav=name;b.innerHTML=`<span class="dot"></span>${label}`;b.onclick=()=>showView(name);side.insertBefore(b,note);
    }
    const tabs=document.querySelector('.tabs');
    if(tabs&&!tabs.querySelector(`[data-tab="${name}"]`)){
      const b=document.createElement('button');b.className='tab';b.dataset.tab=name;b.textContent=label;b.onclick=()=>showView(name);tabs.appendChild(b);
    }
  }
  function addView(name,html=''){
    if(document.getElementById('view-'+name))return;
    const proto=document.querySelector('.prototype');const sec=document.createElement('section');sec.id='view-'+name;sec.className='view';sec.innerHTML=html;proto?.parentNode.insertBefore(sec,proto);
  }

  const originalShowView=window.showView;
  window.showView=function(name){
    const customNames=['track','flows','favorites','news','admin'];
    if(!customNames.includes(name)) return originalShowView(name);
    currentView=name;
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-'+name)?.classList.add('active');
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));
    document.querySelectorAll('[data-nav]').forEach(t=>t.classList.toggle('active',t.dataset.nav===name));
    renderV3(name);
  };

  function renderV3(name){if(name==='track')renderTrack();if(name==='flows')renderFlows();if(name==='favorites')renderFavorites();if(name==='news')renderNews();if(name==='admin')renderAdmin();}

  function visibleLesson(m,id,role){
    const x=metaFor(id); if(!x)return false;
    if(x.hidden||x.status==='Oculto')return false;
    if(x.status==='Rascunho'&&!adminMode())return false;
    return role==='all'||x.roles.includes(role)||x.roles.includes('geral');
  }

  const originalOpenModule=window.openModule;
  window.openModule=function(id){
    const m=moduleData.find(x=>x.id===id);if(!m)return originalOpenModule(id);
    const role=document.getElementById('roleFilter')?.value||'all',done=completed();
    const lessons=m.lessons.filter(l=>visibleLesson(m,l.id,role));
    document.getElementById('modalEyebrow').textContent='Trilha · '+m.roles.map(roleName).join(' / ');
    document.getElementById('modalTitle').textContent=m.title;
    document.getElementById('modalSubtitle').textContent=m.summary;
    document.getElementById('modalBody').innerHTML=`<div class="tags" style="margin:0 0 13px"><span class="tag active">Ativo hoje</span><span class="tag">${m.features.length} funcionalidades catalogadas</span></div><div class="lesson-list">${lessons.map(l=>{const x=metaFor(l.id),fav=favorites().includes(l.id);return`<article class="lesson" onclick="openLesson('${l.id}')"><div class="lesson-top"><div><div class="tags" style="margin:0 0 5px"><span class="v3-level ${slug(x.level)}">${esc(x.level)}</span>${x.mandatory?'<span class="tag plan">Obrigatória</span>':''}${x.status==='Rascunho'?'<span class="v3-status rascunho">Rascunho</span>':''}</div><h4>${esc(x.title)}</h4><p>${esc(x.desc)}</p></div><div style="display:flex;align-items:flex-start;gap:5px"><button class="v3-fav" onclick="event.stopPropagation();toggleFavorite('${l.id}')" title="Favoritar">${fav?'★':'☆'}</button><span class="lesson-state ${done.includes(l.id)?'done':''}">${done.includes(l.id)?'Concluída ✓':'Abrir aula'}</span></div></div></article>`}).join('')||'<div class="empty" style="display:block">Nenhuma aula publicada para este setor.</div>'}</div>`;openModal();
  };

  window.toggleFavorite=function(id){let f=favorites();f=f.includes(id)?f.filter(x=>x!==id):[id,...f];jset(K.favorites,f.slice(0,100));showToast(f.includes(id)?'Adicionado aos favoritos.':'Removido dos favoritos.');};
  function recordRecent(id){let r=recent().filter(x=>x.id!==id);r.unshift({id,at:now()});jset(K.recent,r.slice(0,20));}

  const originalOpenLesson=window.openLesson;
  window.openLesson=function(id){
    const x=metaFor(id);if(!x)return originalOpenLesson(id);recordRecent(id);
    const done=completed().includes(id),fav=favorites().includes(id);
    document.getElementById('modalEyebrow').textContent=`Aula · ${x.moduleTitle}`;
    document.getElementById('modalTitle').textContent=x.title;
    document.getElementById('modalSubtitle').textContent=x.desc;
    const media=x.images.length?`<div class="v3-media">${x.images.map(u=>`<img src="${esc(u)}" alt="Imagem de apoio da aula" onerror="this.outerHTML='<div class=&quot;v3-media-empty&quot;>Imagem indisponível</div>'">`).join('')}</div>`:`<div class="v3-media-empty">📷 Esta aula aceita imagens reais da tela. No Modo ADM, cole a URL da captura quando ela estiver disponível.</div>`;
    const quiz=x.quiz?`<section class="v3-quiz" id="quiz-${id}"><h4>Mini teste · ${esc(x.quiz.q)}</h4><div class="v3-quiz-options">${x.quiz.opts.map((o,i)=>`<button onclick="answerQuiz('${id}',${i},this)">${esc(o)}</button>`).join('')}</div><small id="quizResult-${id}" style="display:block;margin-top:7px;color:var(--muted)"></small></section>`:'';
    document.getElementById('modalBody').innerHTML=`<div class="tags" style="margin:0 0 10px"><span class="v3-level ${slug(x.level)}">${esc(x.level)}</span>${x.mandatory?'<span class="tag plan">Obrigatória para a trilha</span>':''}<span class="v3-status ${slug(x.status)}">${esc(x.status)}</span></div>${media}<div class="steps">${x.steps.map((s,i)=>`<div class="step"><div class="step-num">${i+1}</div><div><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div></div>`).join('')}</div>${x.warning?`<div class="v3-alert warn"><b>⚠ Atenção</b>${esc(x.warning)}</div>`:''}${x.errors?.length?`<div class="v3-alert danger"><b>Erros comuns que você deve evitar</b><ul class="v3-errors">${x.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}${quiz}<div class="actions"><button class="btn primary" onclick="toggleLesson('${id}')">${done?'Aula concluída ✓':'Marcar como concluída'}</button><button class="btn" onclick="toggleFavorite('${id}');openLesson('${id}')">${fav?'★ Favoritada':'☆ Favoritar'}</button><button class="btn" onclick="notUnderstood('${id}')">Não entendi</button><button class="btn" onclick="openModule('${x.moduleId}')">Voltar à trilha</button>${adminMode()?`<button class="btn" onclick="closeModal();showView('admin');setTimeout(()=>editLesson('${id}'),50)">Editar aula</button>`:''}</div>`;openModal();
  };
  window.answerQuiz=function(id,choice,btn){const x=metaFor(id);if(!x?.quiz)return;const box=document.getElementById('quiz-'+id);box.querySelectorAll('button').forEach((b,i)=>{b.disabled=true;if(i===x.quiz.correct)b.classList.add('correct')});if(choice!==x.quiz.correct)btn.classList.add('wrong');document.getElementById('quizResult-'+id).textContent=choice===x.quiz.correct?'✓ Correto.':'Resposta incorreta. Revise a aula e tente lembrar do fluxo correto.';};
  window.notUnderstood=function(id){const f=feedback();f[id]=(f[id]||0)+1;jset(K.feedback,f);showToast('Dúvida registrada neste navegador para revisão do treinamento.');};

  function selectedRole(){const r=document.getElementById('roleFilter')?.value||'all';return r==='all'?'geral':r;}
  function renderTrack(){
    const role=selectedRole(),lessons=moduleData.flatMap(m=>m.lessons.map(l=>metaFor(l.id))).filter(Boolean).filter(x=>(x.roles.includes(role)||x.roles.includes('geral'))&&!x.hidden&&x.status==='Publicado');
    const mandatory=lessons.filter(x=>x.mandatory),done=completed(),doneMand=mandatory.filter(x=>done.includes(x.id)).length,pct=mandatory.length?Math.round(doneMand/mandatory.length*100):0;
    const next=mandatory.find(x=>!done.includes(x.id))||lessons.find(x=>!done.includes(x.id));
    const recentList=recent().map(r=>metaFor(r.id)).filter(Boolean).slice(0,4);
    const box=document.getElementById('v3Track');box.innerHTML=`<article class="card v3-card"><div class="v3-track-head"><div><div class="eyebrow">Trilha recomendada · ${roleName(role)}</div><h3 style="font-size:18px;margin-top:5px">Seu caminho de capacitação</h3><p>${doneMand} de ${mandatory.length} aulas obrigatórias concluídas.</p></div><b style="font-size:28px">${pct}%</b></div><div class="bar" style="margin-top:12px"><i style="width:${pct}%"></i></div>${next?`<div class="v3-cert"><b style="font-size:11px">Continue de onde importa</b><p style="margin:5px 0 9px">${esc(next.moduleTitle)} → ${esc(next.title)}</p><button class="btn primary" onclick="openLesson('${next.id}')">Continuar treinamento</button></div>`:''}<div class="v3-checklist"><b style="font-size:10px">Checklist do primeiro dia</b>${['Conhecer o Dashboard','Abrir a trilha do seu setor','Concluir ao menos uma aula obrigatória','Salvar um procedimento nos Favoritos','Saber onde usar o Assistente Help'].map((t,i)=>`<label class="v3-check"><input type="checkbox" ${jget('helpTrainingV3FirstDay',[]).includes(i)?'checked':''} onchange="toggleFirstDay(${i},this.checked)">${t}</label>`).join('')}</div></article><div class="section-head"><h2>Treinamentos obrigatórios</h2><span>Básico → Operacional → Avançado</span></div><div class="v3-grid">${mandatory.sort((a,b)=>['Básico','Operacional','Avançado'].indexOf(a.level)-['Básico','Operacional','Avançado'].indexOf(b.level)).map(x=>lessonCard(x)).join('')||'<div class="empty" style="display:block">Nenhuma aula obrigatória configurada.</div>'}</div>${pct===100&&mandatory.length?`<article class="card v3-card" style="margin-top:12px"><div class="eyebrow">Certificação interna · Demonstração</div><h3>Trilha ${roleName(role)} concluída</h3><p>Na integração real, aqui poderá ser registrado o certificado interno com usuário, data e versão do treinamento.</p><button class="btn primary" onclick="showToast('Certificado demonstrativo concluído. Na versão real será salvo por usuário.')">Emitir certificado demonstrativo</button></article>`:''}${recentList.length?`<div class="section-head"><h2>Vistos recentemente</h2><span>Continue rapidamente</span></div><div class="v3-grid">${recentList.map(x=>lessonCard(x)).join('')}</div>`:''}`;
  }
  window.toggleFirstDay=function(i,on){let a=jget('helpTrainingV3FirstDay',[]);a=on?[...new Set([...a,i])]:a.filter(x=>x!==i);jset('helpTrainingV3FirstDay',a)};
  function lessonCard(x){return`<article class="card v3-card" style="cursor:pointer" onclick="openLesson('${x.id}')"><div class="tags" style="margin:0 0 7px"><span class="v3-level ${slug(x.level)}">${esc(x.level)}</span>${x.mandatory?'<span class="tag plan">Obrigatória</span>':''}</div><h3>${esc(x.title)}</h3><p>${esc(x.moduleTitle)} · ${esc(x.desc)}</p></article>`}

  function renderFlows(){const role=selectedRole(),list=flows.filter(f=>role==='geral'||f.roles.includes(role)||f.roles.includes('geral'));document.getElementById('v3Flows').innerHTML=list.map(f=>`<article class="card v3-card"><div class="v3-flow"><div class="v3-flow-icon">${f.icon}</div><div><h3>${esc(f.title)}</h3><p>Aprenda o processo completo, não apenas uma tela isolada.</p></div></div><div class="v3-flow-steps">${f.steps.map((s,i)=>`${i?'<span class="v3-flow-arrow">→</span>':''}<span class="v3-flow-step">${esc(s)}</span>`).join('')}</div><div class="v3-after"><b>O que acontece depois?</b> ${esc(f.after)}</div></article>`).join('')||'<div class="empty" style="display:block">Nenhum fluxo específico para este setor.</div>'}

  function renderFavorites(){const f=favorites().map(metaFor).filter(Boolean),r=recent().map(x=>metaFor(x.id)).filter(Boolean).slice(0,8);document.getElementById('v3Favorites').innerHTML=`<div class="section-head"><h2>Favoritos</h2><span>${f.length} aula(s)</span></div><div class="v3-grid">${f.map(lessonCard).join('')||'<div class="empty" style="display:block">Use ☆ Favoritar dentro de uma aula para guardar seus procedimentos mais usados.</div>'}</div><div class="section-head"><h2>Vistos recentemente</h2><span>Histórico local</span></div><div class="v3-grid">${r.map(lessonCard).join('')||'<div class="empty" style="display:block">Abra uma aula para começar seu histórico recente.</div>'}</div>`}

  function renderNews(){document.getElementById('v3News').innerHTML=news().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(n=>`<article class="card"><time>${new Date(n.date+'T12:00:00').toLocaleDateString('pt-BR')}</time><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p><div class="v3-news-links">${(n.links||[]).map(id=>metaFor(id)?`<button class="btn" onclick="openLesson('${id}')">${esc(metaFor(id).title)}</button>`:'').join('')}</div></article>`).join('')}

  function injectViews(){
    addViewButton('track','Minha trilha');addViewButton('flows','Fluxos completos');addViewButton('favorites','Favoritos');addViewButton('news','Novidades');addViewButton('admin','Modo ADM');
    addView('track','<div id="v3Track"></div>');
    addView('flows','<div class="section-head"><h2>Treinamento por processo completo</h2><span>Entenda o começo, meio, fim e os efeitos entre módulos</span></div><div id="v3Flows" class="v3-grid"></div>');
    addView('favorites','<div id="v3Favorites"></div>');
    addView('news','<div class="section-head"><h2>Novidades do Sistema</h2><span>Atualizações vinculadas às aulas relacionadas</span></div><div id="v3News" class="v3-news"></div>');
    addView('admin','<div id="v3Admin"></div>');
  }

  function saveHistory(id,snapshot,action){const h=jget(K.history,{});h[id]=h[id]||[];h[id].unshift({at:now(),action,snapshot});h[id]=h[id].slice(0,20);jset(K.history,h);}
  function snapshot(id){const x=metaFor(id);return x?JSON.parse(JSON.stringify(x)):null;}
  function renderAdmin(){
    const box=document.getElementById('v3Admin'),mode=adminMode(),done=completed().length,fb=feedback(),conf=Object.entries(fb).sort((a,b)=>b[1]-a[1]).slice(0,5);
    if(!mode){box.innerHTML=`<article class="card v3-card"><div class="eyebrow">Editor demonstrativo</div><h3>Modo Administrador do Treinamento</h3><p>Ative para editar o protótipo. Tudo fica somente neste navegador; nada é enviado ao Supabase e nenhum usuário real é alterado.</p><div class="actions"><button class="btn primary" onclick="enableAdmin()">Ativar Modo ADM local</button></div></article>`;return}
    const list=moduleData.flatMap(m=>m.lessons.map(l=>metaFor(l.id))).filter(Boolean);
    box.innerHTML=`<div class="v3-manager"><article class="card"><span>Aulas no catálogo</span><b>${list.length}</b></article><article class="card"><span>Concluídas neste navegador</span><b>${done}</b></article><article class="card"><span>Dúvidas “Não entendi”</span><b>${Object.values(fb).reduce((a,b)=>a+b,0)}</b></article></div><div class="v3-admin-toolbar"><button class="btn primary" onclick="newLesson()">+ Nova aula</button><button class="btn" onclick="newProcedure()">+ Procedimento rápido</button><button class="btn" onclick="newNews()">+ Novidade</button><button class="btn" onclick="disableAdmin()">Sair do Modo ADM</button></div>${conf.length?`<article class="card v3-card v3-confusion"><h3>Aulas com mais “Não entendi”</h3>${conf.map(([id,n])=>`<div><span>${esc(metaFor(id)?.title||id)}</span><b>${n}</b></div>`).join('')}</article>`:''}<div class="v3-admin-layout"><section class="card v3-admin-list" id="adminLessonList">${moduleData.map(m=>`<div class="eyebrow" style="margin:10px 4px 6px">${esc(m.title)}</div>${m.lessons.map(l=>{const x=metaFor(l.id);return`<article class="v3-admin-item" draggable="true" data-id="${l.id}" data-module="${m.id}" onclick="editLesson('${l.id}')"><b>${esc(x.title)}</b><span>${esc(x.level)} · ${esc(x.status)}${x.mandatory?' · obrigatória':''}</span></article>`}).join('')}`).join('')}</section><section class="card v3-form" id="adminEditor"><div class="empty" style="display:block">Selecione uma aula ou crie uma nova.</div></section></div>`;bindDrag();
  }
  window.enableAdmin=function(){localStorage.setItem(K.admin,'1');renderAdmin();showToast('Modo ADM local ativado.');};window.disableAdmin=function(){localStorage.removeItem(K.admin);renderAdmin();};

  function formLesson(x,isNew=false){
    const roleOpts=['geral','suporte','comercial','financeiro','gestao','admin'];
    document.getElementById('adminEditor').innerHTML=`<div class="eyebrow">${isNew?'Nova aula':'Editar aula'}</div><h3 style="margin:5px 0 12px">${esc(x.title||'Sem título')}</h3><div class="v3-form-grid"><label>Módulo<select id="edModule">${moduleData.map(m=>`<option value="${m.id}" ${m.id===x.moduleId?'selected':''}>${esc(m.title)}</option>`).join('')}</select></label><label>Nível<select id="edLevel">${['Básico','Operacional','Avançado'].map(v=>`<option ${v===x.level?'selected':''}>${v}</option>`).join('')}</select></label><label class="v3-full">Título<input id="edTitle" value="${esc(x.title||'')}"></label><label class="v3-full">Descrição<textarea id="edDesc">${esc(x.desc||'')}</textarea></label><label>Status<select id="edStatus">${['Publicado','Rascunho','Oculto'].map(v=>`<option ${v===x.status?'selected':''}>${v}</option>`).join('')}</select></label><label>Obrigatória<select id="edMandatory"><option value="false" ${!x.mandatory?'selected':''}>Não</option><option value="true" ${x.mandatory?'selected':''}>Sim</option></select></label><label class="v3-full">Visível para cargos<div style="display:flex;gap:8px;flex-wrap:wrap">${roleOpts.map(r=>`<label style="display:flex;align-items:center;gap:4px"><input class="edRole" type="checkbox" value="${r}" ${(x.roles||[]).includes(r)?'checked':''}> ${roleName(r)}</label>`).join('')}</div></label><label class="v3-full">Passos — uma linha por passo, formato Título | explicação<textarea id="edSteps">${(x.steps||[]).map(s=>`${s[0]} | ${s[1]}`).join('\n')}</textarea></label><label class="v3-full">Aviso de atenção<textarea id="edWarning">${esc(x.warning||'')}</textarea></label><label class="v3-full">Erros comuns — um por linha<textarea id="edErrors">${(x.errors||[]).join('\n')}</textarea></label><label class="v3-full">Imagens — uma URL por linha<textarea id="edImages">${(x.images||[]).join('\n')}</textarea></label><label class="v3-full">Pergunta do quiz<input id="edQuizQ" value="${esc(x.quiz?.q||'')}"></label><label class="v3-full">Opções do quiz — uma por linha<textarea id="edQuizOpts">${(x.quiz?.opts||[]).join('\n')}</textarea></label><label>Resposta correta (1, 2, 3... )<input id="edQuizCorrect" type="number" min="1" value="${x.quiz?x.quiz.correct+1:''}"></label></div><div class="actions"><button class="btn primary" onclick="saveLessonEditor('${x.id||''}',${isNew})">Salvar alterações</button>${!isNew?`<button class="btn" onclick="duplicateLesson('${x.id}')">Duplicar</button><button class="btn" onclick="toggleHideLesson('${x.id}')">${x.status==='Oculto'?'Reexibir':'Ocultar'}</button>${String(x.id).startsWith('custom-')?`<button class="btn" onclick="deleteCustomLesson('${x.id}')">Excluir aula personalizada</button>`:''}`:''}</div>${!isNew?renderHistory(x.id):''}`;
  }
  function renderHistory(id){const h=jget(K.history,{})[id]||[];return`<div class="v3-history"><b style="font-size:10px">Histórico de versões</b>${h.map((v,i)=>`<div class="v3-history-item"><span>${new Date(v.at).toLocaleString('pt-BR')} · ${esc(v.action)}</span><button class="btn" onclick="restoreVersion('${id}',${i})">Restaurar</button></div>`).join('')||'<p style="font-size:8px;color:var(--muted)">Nenhuma alteração local registrada.</p>'}</div>`}
  window.editLesson=function(id){const x=metaFor(id);if(x)formLesson(x,false)};
  window.newLesson=function(){formLesson({id:'',moduleId:moduleData[0].id,title:'',desc:'',steps:[],level:'Básico',status:'Rascunho',mandatory:false,roles:['geral'],warning:'',errors:[],images:[],quiz:null},true)};
  window.saveLessonEditor=function(id,isNew){
    const moduleId=document.getElementById('edModule').value,title=document.getElementById('edTitle').value.trim(),desc=document.getElementById('edDesc').value.trim();if(!title)return showToast('Informe o título.');
    const steps=document.getElementById('edSteps').value.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>{const p=x.split('|');return[p.shift().trim(),p.join('|').trim()||'Siga esta etapa conforme o procedimento.']});
    const roles=[...document.querySelectorAll('.edRole:checked')].map(x=>x.value);const opts=document.getElementById('edQuizOpts').value.split('\n').map(x=>x.trim()).filter(Boolean),q=document.getElementById('edQuizQ').value.trim(),correct=Math.max(0,Number(document.getElementById('edQuizCorrect').value||1)-1);
    const payload={title,desc,level:document.getElementById('edLevel').value,status:document.getElementById('edStatus').value,mandatory:document.getElementById('edMandatory').value==='true',roles:roles.length?roles:['geral'],steps,warning:document.getElementById('edWarning').value.trim(),errors:document.getElementById('edErrors').value.split('\n').map(x=>x.trim()).filter(Boolean),images:document.getElementById('edImages').value.split('\n').map(x=>x.trim()).filter(Boolean),quiz:q&&opts.length>=2?{q,opts,correct:Math.min(correct,opts.length-1)}:null};
    if(isNew){const nid='custom-'+Date.now();const arr=custom();arr.push({id:nid,moduleId,...payload});jset(K.custom,arr);const m=moduleData.find(x=>x.id===moduleId);m.lessons.push({id:nid,title,desc,steps});saveHistory(nid,{...payload,moduleId,id:nid},'Aula criada');showToast('Aula criada localmente como '+payload.status+'.');renderAdmin();setTimeout(()=>editLesson(nid),30);return}
    const before=snapshot(id);saveHistory(id,before,'Versão anterior antes da edição');const e=edits();e[id]={...(e[id]||{}),...payload};jset(K.edits,e);const r=rawLesson(id);if(r){r.l.title=title;r.l.desc=desc;r.l.steps=steps;if(r.m.id!==moduleId){r.m.lessons=r.m.lessons.filter(x=>x.id!==id);moduleData.find(x=>x.id===moduleId)?.lessons.push(r.l)}}showToast('Alterações salvas neste navegador.');renderAdmin();setTimeout(()=>editLesson(id),30);
  };
  window.duplicateLesson=function(id){const x=snapshot(id);if(!x)return;const nid='custom-'+Date.now(),arr=custom();arr.push({...x,id:nid,moduleId:x.moduleId,title:x.title+' · Cópia',status:'Rascunho'});jset(K.custom,arr);moduleData.find(m=>m.id===x.moduleId)?.lessons.push({id:nid,title:x.title+' · Cópia',desc:x.desc,steps:x.steps});saveHistory(nid,{...x,id:nid},'Duplicada');renderAdmin();setTimeout(()=>editLesson(nid),30);};
  window.toggleHideLesson=function(id){const e=edits(),x=metaFor(id);saveHistory(id,snapshot(id),x.status==='Oculto'?'Antes de reexibir':'Antes de ocultar');e[id]={...(e[id]||{}),status:x.status==='Oculto'?'Publicado':'Oculto'};jset(K.edits,e);renderAdmin();setTimeout(()=>editLesson(id),30);};
  window.deleteCustomLesson=function(id){if(!confirm('Excluir esta aula personalizada deste navegador?'))return;saveHistory(id,snapshot(id),'Excluída');jset(K.custom,custom().filter(x=>x.id!==id));moduleData.forEach(m=>m.lessons=m.lessons.filter(x=>x.id!==id));const e=edits();delete e[id];jset(K.edits,e);renderAdmin();};
  window.restoreVersion=function(id,index){const h=jget(K.history,{})[id]||[],v=h[index];if(!v?.snapshot)return;const e=edits();e[id]={...v.snapshot};jset(K.edits,e);const r=rawLesson(id);if(r){r.l.title=v.snapshot.title;r.l.desc=v.snapshot.desc;r.l.steps=v.snapshot.steps||r.l.steps}showToast('Versão restaurada localmente.');renderAdmin();setTimeout(()=>editLesson(id),30);};

  function bindDrag(){let drag=null;document.querySelectorAll('.v3-admin-item[draggable=true]').forEach(el=>{el.addEventListener('dragstart',()=>{drag=el});el.addEventListener('dragover',e=>e.preventDefault());el.addEventListener('drop',e=>{e.preventDefault();if(!drag||drag===el||drag.dataset.module!==el.dataset.module)return;const m=moduleData.find(x=>x.id===el.dataset.module),ids=m.lessons.map(x=>x.id),a=ids.indexOf(drag.dataset.id),b=ids.indexOf(el.dataset.id);ids.splice(b,0,ids.splice(a,1)[0]);const o=jget(K.order,{});o[m.id]=ids;jset(K.order,o);applyOrder();renderAdmin();showToast('Ordem das aulas atualizada localmente.');});});}

  window.newProcedure=function(){document.getElementById('adminEditor').innerHTML=`<div class="eyebrow">Novo procedimento rápido</div><h3>Adicionar à biblioteca local</h3><div class="v3-form-grid"><label class="v3-full">Título<input id="prTitle"></label><label>Módulo<input id="prModule"></label><label>Setor<select id="prRole">${['geral','suporte','comercial','financeiro','gestao','admin'].map(r=>`<option value="${r}">${roleName(r)}</option>`).join('')}</select></label><label class="v3-full">Passos — separe com →<textarea id="prSteps"></textarea></label></div><div class="actions"><button class="btn primary" onclick="saveProcedure()">Salvar procedimento</button></div>`};
  window.saveProcedure=function(){const t=document.getElementById('prTitle').value.trim();if(!t)return;const a=jget(K.procedures,[]);a.push([t,document.getElementById('prModule').value.trim()||'Geral',document.getElementById('prRole').value,document.getElementById('prSteps').value.trim(),'']);jset(K.procedures,a);procedures.push(a.at(-1));showToast('Procedimento adicionado localmente.');renderAdmin();};
  function applyCustomProcedures(){jget(K.procedures,[]).forEach(p=>{if(!procedures.some(x=>x[0]===p[0]&&x[3]===p[3]))procedures.push(p)})}

  window.newNews=function(){document.getElementById('adminEditor').innerHTML=`<div class="eyebrow">Nova novidade</div><h3>Publicação local do treinamento</h3><div class="v3-form-grid"><label>Data<input id="newsDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label class="v3-full">Título<input id="newsTitle"></label><label class="v3-full">Texto<textarea id="newsText"></textarea></label><label class="v3-full">IDs de aulas relacionadas — separados por vírgula<input id="newsLinks" placeholder="fin-ofx, fin-pay"></label></div><div class="actions"><button class="btn primary" onclick="saveNews()">Publicar novidade local</button></div>`};
  window.saveNews=function(){const t=document.getElementById('newsTitle').value.trim();if(!t)return;const n=news();n.push({id:'news-'+Date.now(),date:document.getElementById('newsDate').value,title:t,text:document.getElementById('newsText').value.trim(),links:document.getElementById('newsLinks').value.split(',').map(x=>x.trim()).filter(Boolean)});jset(K.news,n);showToast('Novidade publicada neste navegador.');renderAdmin();};

  function applyOverridesToData(){const e=edits();moduleData.forEach(m=>m.lessons.forEach(l=>{if(e[l.id]){l.title=e[l.id].title||l.title;l.desc=e[l.id].desc??l.desc;l.steps=e[l.id].steps||l.steps}}));}

  function decorateBase(){
    const oldRenderModules=window.renderModules;window.renderModules=function(){oldRenderModules();document.querySelectorAll('#moduleGrid .module').forEach((card,i)=>{const list=moduleData.filter(m=>moduleMatches(m,norm(document.getElementById('globalSearch').value.trim()),document.getElementById('roleFilter').value));const m=list[i];if(!m)return;const lv=[...new Set(m.lessons.map(l=>metaFor(l.id)?.level).filter(Boolean))];const target=card.querySelector('.tags');lv.forEach(x=>target?.insertAdjacentHTML('beforeend',`<span class="v3-level ${slug(x)}">${esc(x)}</span>`))});};
    const oldRenderCurrent=window.renderCurrent;window.renderCurrent=function(){oldRenderCurrent();if(['track','flows','favorites','news','admin'].includes(currentView))renderV3(currentView)};
  }

  function init(){
    if(typeof moduleData==='undefined'||typeof procedures==='undefined'){setTimeout(init,100);return}
    applyCustomLessons();applyCustomProcedures();applyOverridesToData();injectCSS();injectViews();decorateBase();
    const sideNote=document.querySelector('.side-note');if(sideNote)sideNote.innerHTML='<b>Central v3 · Preview seguro</b><br>Trilhas, quizzes, favoritos, fluxos e editor ADM funcionam apenas neste navegador. Nenhuma edição é enviada ao Supabase.';
    renderModules();renderNews();
  }
  init();
})();