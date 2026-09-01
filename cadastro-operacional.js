/* Cadastros operacionais: catálogo, estoque, equipamentos e garantias. */
let cadCatalogo=[],cadMovimentos=[];
const cadHtml=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const cadMoeda=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const cadData=v=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR'):'—';
const cadPodeEditar=()=>usuarioLogado?.perfil==='admin'||usuarioLogado?.permissoes?.crm||usuarioLogado?.permissoes?.osCriar||usuarioLogado?.permissoes?.osEditar;
const cadPodeExcluir=()=>usuarioLogado?.perfil==='admin'||usuarioLogado?.permissoes?.crm||usuarioLogado?.permissoes?.osExcluir;

function instalarCadastroOperacional(){
  if(document.getElementById('cadModalCatalogo'))return;
  document.body.insertAdjacentHTML('beforeend',`<div id="cadModalCatalogo" class="crm-modal-overlay" onclick="if(event.target===this)cadFecharCatalogo()"><div class="crm-modal-content cad-modal"><div class="modal-header"><div><h2 id="cadCatalogoTitulo">Novo produto ou serviço</h2><p>Cadastre uma vez para reutilizar no atendimento e nas vendas.</p></div><button class="modal-close" onclick="cadFecharCatalogo()">×</button></div><input id="cadCatalogoId" type="hidden"><div class="gc-form"><label>Tipo *<select id="cadCatalogoTipo"><option>Produto</option><option>Serviço</option></select></label><label>Código *<input id="cadCatalogoCodigo" maxlength="40"></label><label class="full">Descrição *<input id="cadCatalogoDescricao" maxlength="180"></label><label>Categoria<input id="cadCatalogoCategoria" maxlength="80"></label><label>Unidade<input id="cadCatalogoUnidade" value="UN" maxlength="12"></label><label>Custo<input id="cadCatalogoCusto" type="number" min="0" step="0.01" value="0"></label><label>Preço de venda<input id="cadCatalogoPreco" type="number" min="0" step="0.01" value="0"></label><label class="full">Observações<textarea id="cadCatalogoObs" rows="3"></textarea></label><label class="full cad-check"><input id="cadCatalogoAtivo" type="checkbox" checked><span>Disponível para uso</span></label></div><div class="modal-footer"><button class="btn btn-secondary" onclick="cadFecharCatalogo()">Cancelar</button><button class="btn btn-primary" onclick="cadSalvarCatalogo()"><i data-lucide="save"></i>Salvar cadastro</button></div></div></div>`);
  if(window.lucide)lucide.createIcons();
}

async function cadRenderCatalogo(){
  const el=document.getElementById('cadCatalogoConteudo');if(!el)return;
  el.innerHTML='<div class="cad-loading">Carregando produtos e serviços...</div>';
  const{data,error}=await supabaseClient.from('catalogo_itens').select('*').order('descricao');
  if(error){el.innerHTML=`<div class="cad-empty">Não foi possível carregar o catálogo: ${cadHtml(error.message)}</div>`;return}
  cadCatalogo=data||[];
  el.innerHTML=`<div class="cad-head"><div><span>CATÁLOGO</span><h2>Produtos e serviços</h2><p>Itens comerciais centralizados, com custo e preço de venda.</p></div>${cadPodeEditar()?'<button class="btn btn-primary" onclick="cadAbrirCatalogo()"><i data-lucide="plus"></i>Novo cadastro</button>':''}</div><div class="cad-filtros"><div class="cad-busca"><i data-lucide="search"></i><input id="cadCatalogoBusca" placeholder="Buscar código, descrição ou categoria" oninput="cadFiltrarCatalogo()"></div><select id="cadCatalogoFiltroTipo" onchange="cadFiltrarCatalogo()"><option value="">Produtos e serviços</option><option>Produto</option><option>Serviço</option></select><select id="cadCatalogoFiltroStatus" onchange="cadFiltrarCatalogo()"><option value="ativos">Ativos</option><option value="todos">Todos</option><option value="inativos">Inativos</option></select></div><div class="cad-kpis"><article><span>Produtos ativos</span><b>${cadCatalogo.filter(x=>x.tipo==='Produto'&&x.ativo).length}</b></article><article><span>Serviços ativos</span><b>${cadCatalogo.filter(x=>x.tipo==='Serviço'&&x.ativo).length}</b></article><article><span>Total cadastrado</span><b>${cadCatalogo.length}</b></article></div><div id="cadCatalogoTabela"></div>`;
  cadFiltrarCatalogo();
}

function cadFiltrarCatalogo(){
  const busca=(document.getElementById('cadCatalogoBusca')?.value||'').trim().toLowerCase(),tipo=document.getElementById('cadCatalogoFiltroTipo')?.value||'',status=document.getElementById('cadCatalogoFiltroStatus')?.value||'ativos';
  const lista=cadCatalogo.filter(x=>(!tipo||x.tipo===tipo)&&(status==='todos'||(status==='ativos'&&x.ativo)||(status==='inativos'&&!x.ativo))&&(!busca||`${x.codigo} ${x.descricao} ${x.categoria}`.toLowerCase().includes(busca)));
  const el=document.getElementById('cadCatalogoTabela');if(!el)return;
  el.innerHTML=`<div class="cad-table-wrap"><table class="cad-table"><thead><tr><th>Item</th><th>Tipo</th><th>Categoria</th><th>Custo</th><th>Venda</th><th>Status</th><th>Ações</th></tr></thead><tbody>${lista.map(x=>`<tr><td><b>${cadHtml(x.codigo)} · ${cadHtml(x.descricao)}</b><small>${cadHtml(x.unidade||'UN')}</small></td><td><span class="cad-badge ${x.tipo.toLowerCase()}">${cadHtml(x.tipo)}</span></td><td>${cadHtml(x.categoria||'—')}</td><td>${cadMoeda(x.custo)}</td><td><b>${cadMoeda(x.preco_venda)}</b></td><td><span class="cad-status ${x.ativo?'ativo':'inativo'}">${x.ativo?'Ativo':'Inativo'}</span></td><td><div class="cad-acoes">${cadPodeEditar()?`<button title="Editar" onclick="cadAbrirCatalogo(${x.id})"><i data-lucide="pencil"></i></button>`:''}${cadPodeExcluir()?`<button class="perigo" title="Excluir" onclick="cadExcluirCatalogo(${x.id})"><i data-lucide="trash-2"></i></button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="7" class="cad-empty">Nenhum item encontrado.</td></tr>'}</tbody></table></div>`;
  if(window.lucide)lucide.createIcons();
}

function cadAbrirCatalogo(id=null){
  const x=cadCatalogo.find(a=>Number(a.id)===Number(id))||{};
  document.getElementById('cadCatalogoTitulo').textContent=x.id?'Editar produto ou serviço':'Novo produto ou serviço';
  document.getElementById('cadCatalogoId').value=x.id||'';
  document.getElementById('cadCatalogoTipo').value=x.tipo||'Produto';
  document.getElementById('cadCatalogoCodigo').value=x.codigo||'';
  document.getElementById('cadCatalogoDescricao').value=x.descricao||'';
  document.getElementById('cadCatalogoCategoria').value=x.categoria||'';
  document.getElementById('cadCatalogoUnidade').value=x.unidade||'UN';
  document.getElementById('cadCatalogoCusto').value=x.custo??0;
  document.getElementById('cadCatalogoPreco').value=x.preco_venda??0;
  document.getElementById('cadCatalogoObs').value=x.observacoes||'';
  document.getElementById('cadCatalogoAtivo').checked=x.ativo!==false;
  document.getElementById('cadModalCatalogo').classList.add('active');
}
function cadFecharCatalogo(){document.getElementById('cadModalCatalogo')?.classList.remove('active')}

async function cadSalvarCatalogo(){
  if(!cadPodeEditar())return avisarModulo('Você não possui permissão para alterar o catálogo.');
  const id=Number(document.getElementById('cadCatalogoId').value)||null,p={tipo:document.getElementById('cadCatalogoTipo').value,codigo:document.getElementById('cadCatalogoCodigo').value.trim().toUpperCase(),descricao:document.getElementById('cadCatalogoDescricao').value.trim(),categoria:document.getElementById('cadCatalogoCategoria').value.trim(),unidade:document.getElementById('cadCatalogoUnidade').value.trim().toUpperCase()||'UN',custo:Number(document.getElementById('cadCatalogoCusto').value)||0,preco_venda:Number(document.getElementById('cadCatalogoPreco').value)||0,observacoes:document.getElementById('cadCatalogoObs').value.trim(),ativo:document.getElementById('cadCatalogoAtivo').checked,atualizado_em:new Date().toISOString()};
  if(!p.codigo||!p.descricao)return avisarModulo('Informe o código e a descrição.');
  const q=id?supabaseClient.from('catalogo_itens').update(p).eq('id',id):supabaseClient.from('catalogo_itens').insert({...p,criado_por:usuarioLogado.id}),{data,error}=await q.select('id').maybeSingle();
  if(error)return avisarModulo('Não foi possível salvar: '+error.message);if(!data)return avisarModulo('O cadastro não foi salvo. Confira suas permissões.');
  cadFecharCatalogo();await cadRenderCatalogo();avisarModulo('Produto ou serviço salvo com sucesso.');
}

async function cadExcluirCatalogo(id){
  if(!cadPodeExcluir())return avisarModulo('Você não possui permissão para excluir este cadastro.');const x=cadCatalogo.find(a=>Number(a.id)===Number(id));if(!x||!confirm(`Excluir "${x.descricao}" do catálogo?`))return;
  const{data,error}=await supabaseClient.from('catalogo_itens').delete().eq('id',id).select('id').maybeSingle();if(error)return avisarModulo(error.message);if(!data)return avisarModulo('O cadastro não foi excluído. Confira suas permissões.');await cadRenderCatalogo();avisarModulo('Cadastro excluído.');
}

async function cadRenderEstoque(){
  const el=document.getElementById('cadEstoqueConteudo');if(!el)return;el.innerHTML='<div class="cad-loading">Carregando estoque...</div>';
  const[itens,movs]=await Promise.all([supabaseClient.from('estoque_itens').select('*').eq('ativo',true).order('descricao'),supabaseClient.from('estoque_movimentos').select('*,estoque_itens(codigo,descricao)').order('criado_em',{ascending:false}).limit(30)]);
  if(itens.error){el.innerHTML=`<div class="cad-empty">Não foi possível carregar o estoque: ${cadHtml(itens.error.message)}</div>`;return}
  gcEstoque=itens.data||[];cadMovimentos=movs.data||[];const baixos=gcEstoque.filter(x=>Number(x.quantidade)<=Number(x.estoque_minimo));
  el.innerHTML=`<div class="cad-head"><div><span>CONTROLE</span><h2>Estoque</h2><p>Produtos físicos, saldos e movimentações.</p></div><div class="actions">${cadPodeEditar()?'<button class="btn btn-secondary" onclick="gcAbrirModalMovimento()"><i data-lucide="arrow-left-right"></i>Movimentar</button><button class="btn btn-primary" onclick="gcAbrirModalEstoque()"><i data-lucide="package-plus"></i>Novo item</button>':''}</div></div><div class="cad-kpis"><article><span>Itens ativos</span><b>${gcEstoque.length}</b></article><article class="${baixos.length?'alerta':''}"><span>Abaixo do mínimo</span><b>${baixos.length}</b></article><article><span>Unidades em estoque</span><b>${gcEstoque.reduce((s,x)=>s+Number(x.quantidade),0).toLocaleString('pt-BR')}</b></article></div><div class="cad-busca cad-busca-unica"><i data-lucide="search"></i><input id="cadEstoqueBusca" placeholder="Buscar código, descrição ou categoria" oninput="cadFiltrarEstoque()"></div><div id="cadEstoqueTabela"></div><div class="cad-subhead"><h3>Últimas movimentações</h3></div><div class="cad-table-wrap"><table class="cad-table"><thead><tr><th>Data</th><th>Item</th><th>Movimento</th><th>Quantidade</th><th>Motivo</th></tr></thead><tbody>${cadMovimentos.map(x=>`<tr><td>${new Date(x.criado_em).toLocaleString('pt-BR')}</td><td>${cadHtml(x.estoque_itens?.codigo)} · ${cadHtml(x.estoque_itens?.descricao)}</td><td><span class="cad-badge ${x.direcao==='Entrada'?'produto':'serviço'}">${cadHtml(x.direcao)}</span></td><td>${x.quantidade}</td><td>${cadHtml(x.motivo||'—')}</td></tr>`).join('')||'<tr><td colspan="5" class="cad-empty">Nenhuma movimentação registrada.</td></tr>'}</tbody></table></div>`;
  cadFiltrarEstoque();
}

function cadFiltrarEstoque(){
  const busca=(document.getElementById('cadEstoqueBusca')?.value||'').trim().toLowerCase(),lista=gcEstoque.filter(x=>!busca||`${x.codigo} ${x.descricao} ${x.categoria}`.toLowerCase().includes(busca)),el=document.getElementById('cadEstoqueTabela');if(!el)return;
  el.innerHTML=`<div class="cad-table-wrap"><table class="cad-table"><thead><tr><th>Item</th><th>Categoria</th><th>Saldo</th><th>Mínimo</th><th>Custo médio</th><th>Venda</th></tr></thead><tbody>${lista.map(x=>`<tr><td><b>${cadHtml(x.codigo)} · ${cadHtml(x.descricao)}</b></td><td>${cadHtml(x.categoria)}</td><td><b class="${Number(x.quantidade)<=Number(x.estoque_minimo)?'cad-baixo':''}">${x.quantidade} ${cadHtml(x.unidade)}</b></td><td>${x.estoque_minimo} ${cadHtml(x.unidade)}</td><td>${cadMoeda(x.custo_medio)}</td><td>${cadMoeda(x.preco_venda)}</td></tr>`).join('')||'<tr><td colspan="6" class="cad-empty">Nenhum item encontrado.</td></tr>'}</tbody></table></div>`;if(window.lucide)lucide.createIcons();
}

async function cadRenderEquipamentos(){
  const el=document.getElementById('cadEquipamentosConteudo');if(!el)return;el.innerHTML='<div class="cad-loading">Carregando equipamentos e garantias...</div>';
  const[e,c]=await Promise.all([supabaseClient.from('equipamentos').select('*,clientes(nome)').eq('ativo',true).order('criado_em',{ascending:false}),supabaseClient.from('clientes').select('*').order('nome')]);
  if(e.error){el.innerHTML=`<div class="cad-empty">Não foi possível carregar os equipamentos: ${cadHtml(e.error.message)}</div>`;return}
  gcEquipamentos=e.data||[];if(!c.error)gcClientes=c.data||[];const hoje=gcHoje(),limite=new Date();limite.setDate(limite.getDate()+30);const limiteData=limite.toISOString().slice(0,10),vencidas=gcEquipamentos.filter(x=>x.garantia_ate&&x.garantia_ate<hoje),vencendo=gcEquipamentos.filter(x=>x.garantia_ate&&x.garantia_ate>=hoje&&x.garantia_ate<=limiteData);
  el.innerHTML=`<div class="cad-head"><div><span>PATRIMÔNIO</span><h2>Equipamentos e garantias</h2><p>Equipamentos por cliente, localização, série e vencimento da garantia.</p></div>${cadPodeEditar()?'<button class="btn btn-primary" onclick="gcAbrirModalEquipamento()"><i data-lucide="monitor-up"></i>Novo equipamento</button>':''}</div><div class="cad-kpis"><article><span>Equipamentos ativos</span><b>${gcEquipamentos.length}</b></article><article class="${vencendo.length?'alerta':''}"><span>Garantias vencendo</span><b>${vencendo.length}</b></article><article class="${vencidas.length?'perigo':''}"><span>Garantias vencidas</span><b>${vencidas.length}</b></article></div><div class="cad-busca cad-busca-unica"><i data-lucide="search"></i><input id="cadEquipBusca" placeholder="Buscar cliente, tipo, marca, modelo ou série" oninput="cadFiltrarEquipamentos()"></div><div id="cadEquipTabela"></div>`;
  cadFiltrarEquipamentos();
}

function cadFiltrarEquipamentos(){
  const busca=(document.getElementById('cadEquipBusca')?.value||'').trim().toLowerCase(),lista=gcEquipamentos.filter(x=>!busca||`${x.clientes?.nome||x.cliente_nome} ${x.tipo} ${x.marca} ${x.modelo} ${x.serial} ${x.patrimonio}`.toLowerCase().includes(busca)),el=document.getElementById('cadEquipTabela'),hoje=gcHoje();if(!el)return;
  el.innerHTML=`<div class="cad-table-wrap"><table class="cad-table"><thead><tr><th>Equipamento</th><th>Cliente</th><th>Identificação</th><th>Localização</th><th>Status</th><th>Garantia</th></tr></thead><tbody>${lista.map(x=>`<tr><td><b>${cadHtml([x.tipo,x.marca,x.modelo].filter(Boolean).join(' · '))}</b></td><td>${x.cliente_id?`<button class="cad-link" onclick="gcAbrir360(${x.cliente_id})">${cadHtml(x.clientes?.nome||x.cliente_nome)}</button>`:cadHtml(x.cliente_nome||'Estoque interno')}</td><td>${cadHtml(x.serial||x.patrimonio||'—')}</td><td>${cadHtml(x.localizacao||'—')}</td><td><span class="cad-status ativo">${cadHtml(x.status)}</span></td><td><span class="cad-garantia ${x.garantia_ate&&x.garantia_ate<hoje?'vencida':''}">${x.garantia_ate?cadData(x.garantia_ate):'Sem garantia'}</span></td></tr>`).join('')||'<tr><td colspan="6" class="cad-empty">Nenhum equipamento encontrado.</td></tr>'}</tbody></table></div>`;if(window.lucide)lucide.createIcons();
}

document.addEventListener('DOMContentLoaded',()=>setTimeout(instalarCadastroOperacional,0));
