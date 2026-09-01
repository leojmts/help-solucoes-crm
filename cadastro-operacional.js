/* Cadastros operacionais: catálogo, estoque, equipamentos e garantias. */
let cadCatalogo=[],cadMovimentos=[],cadFornecedores=[],cadClientesFornecedores=[];
const cadHtml=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const cadMoeda=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const cadData=v=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR'):'—';
const cadPodeEditar=()=>usuarioLogado?.perfil==='admin'||usuarioLogado?.permissoes?.crm||usuarioLogado?.permissoes?.osCriar||usuarioLogado?.permissoes?.osEditar;
const cadPodeExcluir=()=>usuarioLogado?.perfil==='admin'||usuarioLogado?.permissoes?.crm||usuarioLogado?.permissoes?.osExcluir;

function instalarCadastroOperacional(){
  if(document.getElementById('cadModalCatalogo'))return;
  document.body.insertAdjacentHTML('beforeend',`<div id="cadModalCatalogo" class="crm-modal-overlay" onclick="if(event.target===this)cadFecharCatalogo()"><div class="crm-modal-content cad-modal"><div class="modal-header"><div><h2 id="cadCatalogoTitulo">Novo produto ou serviço</h2><p>Cadastre uma vez para reutilizar no atendimento e nas vendas.</p></div><button class="modal-close" onclick="cadFecharCatalogo()">×</button></div><input id="cadCatalogoId" type="hidden"><div class="gc-form"><label>Tipo *<select id="cadCatalogoTipo"><option>Produto</option><option>Serviço</option></select></label><label>Código *<input id="cadCatalogoCodigo" maxlength="40"></label><label class="full">Descrição *<input id="cadCatalogoDescricao" maxlength="180"></label><label>Categoria<input id="cadCatalogoCategoria" maxlength="80"></label><label>Unidade<input id="cadCatalogoUnidade" value="UN" maxlength="12"></label><label>Custo<input id="cadCatalogoCusto" type="number" min="0" step="0.01" value="0"></label><label>Preço de venda<input id="cadCatalogoPreco" type="number" min="0" step="0.01" value="0"></label><label class="full">Observações<textarea id="cadCatalogoObs" rows="3"></textarea></label><label class="full cad-check"><input id="cadCatalogoAtivo" type="checkbox" checked><span>Disponível para uso</span></label></div><div class="modal-footer"><button class="btn btn-secondary" onclick="cadFecharCatalogo()">Cancelar</button><button class="btn btn-primary" onclick="cadSalvarCatalogo()"><i data-lucide="save"></i>Salvar cadastro</button></div></div></div>`);
  document.body.insertAdjacentHTML('beforeend',`<div id="cadModalFornecedor" class="crm-modal-overlay" onclick="if(event.target===this)cadFecharFornecedor()"><div class="crm-modal-content cad-modal"><div class="modal-header"><div><h2 id="cadFornecedorTitulo">Vincular fornecedor</h2><p>Use os mesmos dados de pessoa ou empresa do cadastro de clientes.</p></div><button class="modal-close" onclick="cadFecharFornecedor()">×</button></div><input id="cadFornecedorId" type="hidden"><div class="gc-form"><label class="full">Pessoa ou empresa *<select id="cadFornecedorCliente"></select></label><label>Categoria<input id="cadFornecedorCategoria" maxlength="80" placeholder="Ex.: aluguel, insumos"></label><label class="full">Observações<textarea id="cadFornecedorObs" rows="3"></textarea></label><label class="full cad-check"><input id="cadFornecedorAtivo" type="checkbox" checked><span>Fornecedor ativo e disponível no Financeiro</span></label></div><div class="modal-footer"><button class="btn btn-secondary" onclick="cadFecharFornecedor()">Cancelar</button><button class="btn btn-primary" onclick="cadSalvarFornecedor()"><i data-lucide="save"></i>Salvar fornecedor</button></div></div></div>`);
  if(window.lucide)lucide.createIcons();
}

async function cadRenderFornecedores(){
  const el=document.getElementById('cadFornecedoresConteudo');if(!el)return;
  el.innerHTML='<div class="cad-loading">Carregando fornecedores...</div>';
  const[fornecedores,clientes]=await Promise.all([
    supabaseClient.from('financeiro_fornecedores').select('*,clientes(*)').order('nome'),
    supabaseClient.from('clientes').select('*').order('nome')
  ]);
  if(fornecedores.error||clientes.error){el.innerHTML=`<div class="cad-empty">Não foi possível carregar os fornecedores: ${cadHtml((fornecedores.error||clientes.error).message)}</div>`;return}
  cadFornecedores=fornecedores.data||[];cadClientesFornecedores=clientes.data||[];
  el.innerHTML=`<div class="cad-head"><div><span>CADASTRO ÚNICO</span><h2>Fornecedores</h2><p>Cliente e fornecedor compartilham nome, documento e contatos. Aqui ficam apenas a classificação e as condições comerciais.</p></div>${cadPodeEditar()?'<button class="btn btn-primary" onclick="cadAbrirFornecedor()"><i data-lucide="link-2"></i>Vincular fornecedor</button>':''}</div><div class="cad-busca cad-busca-unica"><i data-lucide="search"></i><input id="cadFornecedorBusca" placeholder="Buscar nome, documento ou categoria" oninput="cadFiltrarFornecedores()"></div><div id="cadFornecedoresTabela"></div>`;
  cadFiltrarFornecedores();
}

function cadFiltrarFornecedores(){
  const busca=(document.getElementById('cadFornecedorBusca')?.value||'').trim().toLowerCase(),lista=cadFornecedores.filter(x=>!busca||`${x.clientes?.nome||x.nome} ${x.clientes?.documento||x.documento} ${x.categoria}`.toLowerCase().includes(busca)),el=document.getElementById('cadFornecedoresTabela');if(!el)return;
  el.innerHTML=`<div class="cad-table-wrap"><table class="cad-table"><thead><tr><th>Pessoa ou empresa</th><th>Contato</th><th>Categoria</th><th>Status</th><th>Ações</th></tr></thead><tbody>${lista.map(x=>`<tr><td><b>${cadHtml(x.clientes?.nome||x.nome)}</b><small>${cadHtml(x.clientes?.documento||x.documento||'Sem documento')}</small></td><td>${cadHtml(x.clientes?.telefone||x.clientes?.email||'—')}</td><td>${cadHtml(x.categoria||'Outros')}</td><td><span class="cad-status ${x.ativo?'ativo':'inativo'}">${x.ativo?'Ativo':'Inativo'}</span></td><td><div class="cad-acoes">${cadPodeEditar()?`<button title="Editar vínculo" onclick="cadAbrirFornecedor(${x.id})"><i data-lucide="pencil"></i></button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="5" class="cad-empty">Nenhum fornecedor vinculado.</td></tr>'}</tbody></table></div>`;
  if(window.lucide)lucide.createIcons();
}

function cadAbrirFornecedor(id=null){
  const x=cadFornecedores.find(a=>Number(a.id)===Number(id))||{},select=document.getElementById('cadFornecedorCliente');
  select.innerHTML=cadClientesFornecedores.map(c=>`<option value="${c.id}">${cadHtml(c.nome)} · ${cadHtml(c.documento||'sem documento')}</option>`).join('');
  document.getElementById('cadFornecedorId').value=x.id||'';select.value=x.cliente_id||'';select.disabled=!!x.id;
  document.getElementById('cadFornecedorTitulo').textContent=x.id?'Editar fornecedor':'Vincular fornecedor';
  document.getElementById('cadFornecedorCategoria').value=x.categoria||'Outros';document.getElementById('cadFornecedorObs').value=x.observacoes||'';document.getElementById('cadFornecedorAtivo').checked=x.ativo!==false;
  document.getElementById('cadModalFornecedor').classList.add('active');if(window.lucide)lucide.createIcons();
}
function cadFecharFornecedor(){document.getElementById('cadModalFornecedor')?.classList.remove('active')}

async function cadSalvarFornecedor(){
  if(!cadPodeEditar())return avisarModulo('Você não possui permissão para alterar fornecedores.');
  const clienteId=Number(document.getElementById('cadFornecedorCliente').value);if(!clienteId)return avisarModulo('Escolha uma pessoa ou empresa.');
  const{error}=await supabaseClient.rpc('definir_cliente_fornecedor',{p_cliente_id:clienteId,p_ativo:document.getElementById('cadFornecedorAtivo').checked,p_categoria:document.getElementById('cadFornecedorCategoria').value.trim()||'Outros',p_observacoes:document.getElementById('cadFornecedorObs').value.trim()});
  if(error)return avisarModulo(error.message);cadFecharFornecedor();await cadRenderFornecedores();avisarModulo('Fornecedor atualizado no cadastro único.');
}

async function cadCarregarFornecedorCliente(clienteId){
  const{data,error}=await supabaseClient.from('financeiro_fornecedores').select('id,categoria,observacoes,ativo').eq('cliente_id',clienteId).maybeSingle();if(error)throw error;
  const check=document.getElementById('cEhFornecedor');check.dataset.existente=data?'true':'false';check.checked=!!data?.ativo;
  document.getElementById('cFornecedorCategoria').value=data?.categoria||'';document.getElementById('cFornecedorObs').value=data?.observacoes||'';document.getElementById('cFornecedorCampos').classList.toggle('hidden',!check.checked);
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
  const{data,error}=await supabaseClient.from('catalogo_itens').delete().eq('id',id).select('id').maybeSingle();if(error)return avisarModulo(error.message);if(!data)return avisarModulo('O cadastro não foi excluído. Confira suas permissões.');await cadRenderCatalogo();avisarModulo('Cadastro ex