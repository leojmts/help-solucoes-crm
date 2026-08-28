/* Gestão de Contratos integrada ao Financeiro e ao Supabase. */
let contratosRegistros = [], contratosClientes = [], contratosFornecedores = [], contratosUsuarios = [], contratosModelos = [];
let contratoEmpresa = null, contratoEditandoId = null, contratoRenovandoDe = null, contratoDetalheAtual = null;

const ctHtml = valor => String(valor ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
const ctPermissao = chave => usuarioLogado?.perfil === 'admin' || usuarioLogado?.permissoes?.[chave] === true;
const ctMoeda = valor => Number(valor || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const ctData = valor => valor ? new Date(`${String(valor).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';
const ctHoje = () => new Date().toISOString().slice(0,10);
const ctEl = id => document.getElementById(id);
const ctValor = id => ctEl(id)?.value?.trim() || '';
const ctNumero = id => Number(ctEl(id)?.value || 0);
const ctSeguro = nome => String(nome || 'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120);

function instalarInterfaceContratos() {
  if (ctEl('visaoContratos')) return;
  const main = document.querySelector('main.content');
  if (!main) return;
  main.insertAdjacentHTML('beforeend', `
    <div id="visaoContratos" class="view-section hidden contratos-view">
      <header class="header"><div><h1>Gestão de Contratos</h1><p>Contratos, documentos, parcelas e recebimentos em um só fluxo.</p></div><div class="actions"><button class="btn btn-secondary" data-permissao="configuracoes" onclick="abrirConfiguracaoEmpresa()"><i data-lucide="building-2"></i>Dados da contratada</button><button class="btn btn-primary" data-permissao="contratosCriar" onclick="abrirModalContrato()"><i data-lucide="plus"></i>Novo contrato</button></div></header>
      <section id="contratosKpis" class="contratos-kpis"></section>
      <section class="contratos-toolbar"><div class="crm-search-wrap"><i data-lucide="search"></i><input id="contratoBusca" placeholder="Buscar número, cliente, fornecedor ou sistema..." oninput="renderizarContratos()"></div><select id="contratoFiltroStatus" onchange="renderizarContratos()"><option value="">Todos os status</option><option>Rascunho</option><option>Ativo</option><option>Vencendo</option><option>Vencido</option><option>Cancelado</option><option>Encerrado</option><option>Renovado</option></select><select id="contratoFiltroParte" onchange="renderizarContratos()"><option value="">Clientes e fornecedores</option><option>Cliente</option><option>Fornecedor</option></select></section>
      <section id="contratosGrade" class="contratos-grade"><div class="contratos-vazio">Carregando contratos...</div></section>
    </div>`);
  document.body.insertAdjacentHTML('beforeend', interfaceModaisContrato());
  document.querySelectorAll('#modalContrato input[type=number]').forEach(i => i.addEventListener('input', atualizarTotalInicialContrato));
  renderizarIcones();
}

function interfaceModaisContrato() { return `
  <div id="modalContrato" class="crm-modal-overlay" onclick="if(event.target===this)fecharModalContrato()"><div class="crm-modal-content contrato-modal" role="dialog" aria-modal="true">
    <div class="modal-header"><div><h2 id="contratoModalTitulo">Novo contrato</h2><p>Preencha os dados comerciais, jurídicos e financeiros.</p></div><button class="modal-close" onclick="fecharModalContrato()">×</button></div>
    <section class="contrato-form-section"><h3><i data-lucide="link"></i>Vínculo e identificação</h3><div class="contrato-form-grid">
      <label class="crm-field"><span>Modelo *</span><select id="ctModelo"></select></label><label class="crm-field"><span>Tipo da parte *</span><select id="ctParteTipo" onchange="atualizarOpcoesParteContrato()"><option>Cliente</option><option>Fornecedor</option></select></label><label class="crm-field ct-span-2"><span>Cliente / fornecedor *</span><select id="ctParteId" onchange="preencherParteContrato()"></select></label>
      <label class="crm-field"><span>Tipo de contrato *</span><input id="ctTipo" value="Locação de software"></label><label class="crm-field"><span>Status inicial</span><select id="ctStatus"><option>Ativo</option><option>Rascunho</option></select></label><label class="crm-field"><span>Responsável *</span><select id="ctResponsavel"></select></label><label class="crm-field"><span>Representante comercial</span><input id="ctRepresentanteComercial"></label>
    </div></section>
    <section class="contrato-form-section"><h3><i data-lucide="building"></i>Dados atuais da contratante</h3><div class="contrato-form-grid">
      <label class="crm-field ct-span-2"><span>Razão social / nome *</span><input id="ctParteNome"></label><label class="crm-field"><span>CNPJ / CPF *</span><input id="ctParteDocumento"></label><label class="crm-field"><span>Telefone</span><input id="ctParteTelefone"></label>
      <label class="crm-field ct-span-2"><span>Endereço *</span><input id="ctParteEndereco"></label><label class="crm-field"><span>Cidade *</span><input id="ctParteCidade"></label><label class="crm-field"><span>UF *</span><input id="ctParteUf" maxlength="2"></label>
      <label class="crm-field"><span>CEP</span><input id="ctParteCep"></label><label class="crm-field"><span>E-mail</span><input id="ctParteEmail" type="email"></label><label class="crm-field"><span>Representante *</span><input id="ctParteRepresentante"></label><label class="crm-field"><span>CPF do representante</span><input id="ctParteRepresentanteCpf"></label>
      <p class="ct-parte-aviso">Esses dados serão atualizados no cadastro vinculado e usados na próxima geração do PDF.</p>
    </div></section>
    <section class="contrato-form-section"><h3><i data-lucide="boxes"></i>Objeto e escopo</h3><div class="contrato-form-grid">
      <label class="crm-field ct-span-4"><span>Objeto do contrato *</span><textarea id="ctObjeto" placeholder="Descreva o objeto específico da contratação"></textarea></label><label class="crm-field ct-span-2"><span>Sistemas contratados *</span><textarea id="ctSistemas" placeholder="ERP, PDV, emissão fiscal..."></textarea></label><label class="crm-field ct-span-2"><span>Serviços, licenças, manutenção e suporte</span><textarea id="ctServicos"></textarea></label>
    </div></section>
    <section class="contrato-form-section"><h3><i data-lucide="badge-dollar-sign"></i>Valores do acordo</h3><div class="contrato-form-grid">
      <label class="crm-field"><span>Implantação</span><input id="ctImplantacao" type="number" min="0" step="0.01"></label><label class="crm-field"><span>Equipamentos / kit</span><input id="ctEquipamentosValor" type="number" min="0" step="0.01"></label><label class="crm-field ct-span-2"><span>Descrição dos equipamentos</span><input id="ctEquipamentosDescricao"></label>
      <label class="crm-field"><span>Outros valores iniciais</span><input id="ctOutrosValores" type="number" min="0" step="0.01"></label><label class="crm-field ct-span-2"><span>Descrição de outros valores</span><input id="ctOutrosDescricao"></label><div class="ct-valor-total"><span>Total inicial</span><strong id="ctValorInicialResumo">R$ 0,00</strong></div>
      <label class="crm-field ct-check"><input id="ctGerarInicial" type="checkbox" checked><span>Gerar cobrança inicial</span></label><label class="crm-field"><span>Vencimento inicial</span><input id="ctVencimentoInicial" type="date"></label><label class="crm-field ct-span-2"><span>Observações comerciais</span><textarea id="ctObservacoesComerciais"></textarea></label>
    </div></section>
    <section class="contrato-form-section"><h3><i data-lucide="calendar-range"></i>Mensalidade e vigência</h3><div class="contrato-form-grid">
      <label class="crm-field"><span>Valor mensal *</span><input id="ctValorMensal" type="number" min="0" step="0.01"></label><label class="crm-field"><span>Início *</span><input id="ctInicio" type="date"></label><label class="crm-field"><span>Instalação prevista</span><input id="ctInstalacao" type="date"></label><label class="crm-field"><span>Duração em meses *</span><input id="ctDuracao" type="number" min="1" max="120" value="12"></label>
      <label class="crm-field"><span>Quantidade de parcelas *</span><input id="ctParcelas" type="number" min="1" max="240" value="12"></label><label class="crm-field"><span>Primeira mensalidade *</span><input id="ctPrimeiraMensalidade" type="date"></label><label class="crm-field"><span>Dia de vencimento *</span><input id="ctDiaVencimento" type="number" min="1" max="31" value="10"></label><label class="crm-field"><span>Periodicidade</span><select id="ctPeriodicidade"><option>Mensal</option><option>Bimestral</option><option>Trimestral</option><option>Semestral</option><option>Anual</option></select></label>
      <label class="crm-field ct-span-2"><span>Forma de pagamento comercial *</span><input id="ctFormaPagamento" placeholder="Ex.: PIX, boleto ou cartão"></label><label class="crm-field ct-span-2"><span>Formas válidas para mensalidades</span><input id="ctFormasValidas" value="PIX ou boleto bancário"></label>
    </div></section>
    <section class="contrato-form-section"><h3><i data-lucide="shield-alert"></i>Regras financeiras e rescisão</h3><div class="contrato-form-grid">
      <label class="crm-field"><span>Aviso prévio (dias)</span><input id="ctAvisoPrevio" type="number" min="0" value="30"></label><label class="crm-field"><span>Multa rescisória (%)</span><input id="ctMultaRescisoria" type="number" min="0" max="100" step="0.001" value="30"></label><label class="crm-field"><span>Multa por atraso (%)</span><input id="ctMultaAtraso" type="number" min="0" max="100" step="0.001" value="2"></label><label class="crm-field"><span>Juros ao dia (%)</span><input id="ctJurosDia" type="number" min="0" max="100" step="0.001" value="0.033"></label>
      <label class="crm-field"><span>Bloqueio após (dias)</span><input id="ctBloqueioDias" type="number" min="0" value="3"></label><label class="crm-field"><span>Rescisão por atraso (dias)</span><input id="ctRescisaoDias" type="number" min="1" value="30"></label><label class="crm-field"><span>Taxa de reativação</span><input id="ctTaxaReativacao" type="number" min="0" step="0.01"></label><label class="crm-field"><span>Índice de reajuste</span><input id="ctIndice" value="IGP-M"></label><label class="crm-field ct-check"><input id="ctAutoRenovacao" type="checkbox" checked><span>Renovação automática</span></label>
    </div></section>
    <section class="contrato-form-section"><h3><i data-lucide="signature"></i>Assinatura e observações</h3><div class="contrato-form-grid">
      <label class="crm-field"><span>Cidade da assinatura</span><input id="ctCidadeAssinatura" value="Jardim"></label><label class="crm-field"><span>Data da assinatura</span><input id="ctDataAssinatura" type="date"></label><label class="crm-field ct-span-2"><span>Observações / condições adicionais</span><textarea id="ctObservacoes"></textarea></label>
      <label class="crm-field"><span>Testemunha 1</span><input id="ctTestemunha1"></label><label class="crm-field"><span>CPF testemunha 1</span><input id="ctTestemunha1Cpf"></label><label class="crm-field"><span>Testemunha 2</span><input id="ctTestemunha2"></label><label class="crm-field"><span>CPF testemunha 2</span><input id="ctTestemunha2Cpf"></label>
    </div></section>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="fecharModalContrato()">Cancelar</button><button id="btnSalvarContrato" class="btn btn-primary" onclick="salvarContrato()"><i data-lucide="save"></i>Salvar contrato e parcelas</button></div>
  </div></div>
  <div id="modalContratoDetalhe" class="crm-modal-overlay" onclick="if(event.target===this)fecharDetalheContrato()"><div class="crm-modal-content contrato-detalhe"><button class="modal-close" onclick="fecharDetalheContrato()">×</button><div id="contratoDetalheConteudo"></div></div></div>
  <div id="modalContratoEmpresa" class="crm-modal-overlay" onclick="if(event.target===this)fecharConfiguracaoEmpresa()"><div class="crm-modal-content ct-modal-pequeno"><div class="modal-header"><div><h2>Dados da contratada</h2><p>Informações usadas automaticamente em todos os contratos.</p></div><button class="modal-close" onclick="fecharConfiguracaoEmpresa()">×</button></div><div class="ct-empresa-grid">
    <label class="crm-field full"><span>Razão social *</span><input id="cteRazao"></label><label class="crm-field"><span>Nome fantasia</span><input id="cteFantasia"></label><label class="crm-field"><span>CNPJ *</span><input id="cteCnpj"></label><label class="crm-field"><span>Inscrição Estadual</span><input id="cteIe"></label><label class="crm-field full"><span>Endereço *</span><input id="cteEndereco"></label><label class="crm-field"><span>Cidade *</span><input id="cteCidade"></label><label class="crm-field"><span>UF *</span><input id="cteUf" maxlength="2"></label><label class="crm-field"><span>CEP</span><input id="cteCep"></label><label class="crm-field"><span>Telefone</span><input id="cteTelefone"></label><label class="crm-field"><span>E-mail</span><input id="cteEmail" type="email"></label><label class="crm-field"><span>Representante legal</span><input id="cteRepresentante"></label><label class="crm-field"><span>CPF do representante</span><input id="cteRepresentanteCpf"></label><label class="crm-field"><span>Cidade do foro</span><input id="cteForoCidade"></label><label class="crm-field"><span>UF do foro</span><input id="cteForoUf" maxlength="2"></label><label class="crm-field full"><span>Chave PIX</span><input id="ctePix"></label>
  </div><div class="modal-footer"><button class="btn btn-secondary" onclick="fecharConfiguracaoEmpresa()">Cancelar</button><button class="btn btn-primary" onclick="salvarConfiguracaoEmpresa()">Salvar dados</button></div></div></div>`; }

function parteDoContrato(c) { return c.parte_tipo === 'Fornecedor' ? c.financeiro_fornecedores : c.clientes; }
function fimContrato(c) { const d = new Date(`${c.inicio}T12:00:00`); d.setMonth(d.getMonth() + Number(c.duracao_meses || 0)); return d; }
function statusExibidoContrato(c) {
  if (!['Ativo','Vencendo','Vencido'].includes(c.status)) return c.status;
  const hoje = new Date(`${ctHoje()}T12:00:00`), fim = fimContrato(c), dias = Math.ceil((fim - hoje) / 86400000);
  return dias < 0 ? 'Vencido' : dias <= 45 ? 'Vencendo' : 'Ativo';
}

async function carregarContratos() {
  if (!ctPermissao('contratosVisualizar')) return;
  instalarInterfaceContratos();
  ctEl('contratosGrade').innerHTML = '<div class="contratos-vazio">Carregando contratos...</div>';
  const [cr,cl,fo,us,mo,em] = await Promise.all([
    supabaseClient.from('contratos').select('*,clientes(*),financeiro_fornecedores(*),contrato_modelos(id,nome,titulo,clausulas)').order('criado_em',{ascending:false}),
    supabaseClient.from('clientes').select('*').order('nome'),
    supabaseClient.from('financeiro_fornecedores').select('*').eq('ativo',true).order('nome'),
    supabaseClient.rpc('listar_usuarios_ativos_processo'),
    supabaseClient.from('contrato_modelos').select('*').eq('ativo',true).order('nome'),
    supabaseClient.from('configuracoes_empresa').select('*').eq('id',true).maybeSingle()
  ]);
  if (cr.error) return avisarModulo(cr.error.message);
  contratosRegistros = cr.data || []; contratosClientes = cl.data || []; contratosFornecedores = fo.data || [];
  contratosUsuarios = us.data || []; contratosModelos = mo.data || []; contratoEmpresa = em.data || null;
  renderizarContratos();
}

function resumoLocalContrato(c) {
  const lista = c._lancamentos || [], validos = lista.filter(x => x.status !== 'Cancelado');
  const recebido = validos.reduce((s,x) => s + Number(x.valor_pago || 0), 0);
  const aberto = validos.reduce((s,x) => s + Math.max(0,Number(x.valor || 0)-Number(x.valor_pago || 0)), 0);
  const atrasadas = validos.filter(x => x.status === 'Pendente' && x.vencimento < ctHoje()).length;
  return { recebido, aberto, atrasadas };
}

async function carregarResumosContratos() {
  if (!ctPermissao('contratosFinanceiro') || !contratosRegistros.length) return;
  const { data } = await supabaseClient.from('financeiro_lancamentos').select('id,contrato_id,valor,valor_pago,vencimento,status').not('contrato_id','is',null);
  contratosRegistros.forEach(c => c._lancamentos = (data || []).filter(x => x.contrato_id === c.id));
}

async function renderizarContratos() {
  await carregarResumosContratos();
  const busca = (ctValor('contratoBusca') || '').toLowerCase(), status = ctValor('contratoFiltroStatus'), parte = ctValor('contratoFiltroParte');
  const lista = contratosRegistros.filter(c => {
    const p = parteDoContrato(c) || {}, sx = statusExibidoContrato(c);
    return (!busca || [c.numero,p.nome,c.tipo_contrato,c.objeto,c.sistemas_contratados].join(' ').toLowerCase().includes(busca)) && (!status || sx === status) && (!parte || c.parte_tipo === parte);
  });
  const ativos = contratosRegistros.filter(c => ['Ativo','Vencendo'].includes(statusExibidoContrato(c)));
  const vencendo = contratosRegistros.filter(c => statusExibidoContrato(c) === 'Vencendo').length;
  const atraso = contratosRegistros.reduce((s,c) => s + resumoLocalContrato(c).atrasadas,0);
  const receita = ativos.filter(c => c.parte_tipo === 'Cliente').reduce((s,c) => s + Number(c.valor_mensal || 0),0);
  const proximos = contratosRegistros.flatMap(c => c._lancamentos || []).filter(x => x.status==='Pendente' && x.vencimento>=ctHoje()).sort((a,b)=>a.vencimento.localeCompare(b.vencimento));
  ctEl('contratosKpis').innerHTML = [[ativos.length,'Contratos ativos',''],[vencendo,'Vencendo em 45 dias','alerta'],[atraso,'Parcelas atrasadas','atraso'],[ctMoeda(receita),'Receita mensal contratada',''],[proximos[0]?ctData(proximos[0].vencimento):'—','Próximo vencimento','']].map(([v,t,c])=>`<article class="contratos-kpi ${c}"><span>${t}</span><strong>${v}</strong></article>`).join('');
  ctEl('contratosGrade').innerHTML = lista.map(c => { const p=parteDoContrato(c)||{}, s=statusExibidoContrato(c), r=resumoLocalContrato(c); return `<article class="contrato-card"><div class="contrato-card-head"><span class="contrato-card-numero">${ctHtml(c.numero)}</span><span class="contrato-status ${s.toLowerCase()}">${ctHtml(s)}</span></div><div><h3>${ctHtml(p.nome||'Parte não encontrada')}</h3><p>${ctHtml(c.tipo_contrato)} · ${ctHtml(c.sistemas_contratados||c.objeto)}</p></div><div class="contrato-card-valores"><div><span>Mensalidade</span><b>${ctMoeda(c.valor_mensal)}</b></div><div><span>Vigência</span><b>${ctData(c.inicio)} - ${fimContrato(c).toLocaleDateString('pt-BR')}</b></div></div>${ctPermissao('contratosFinanceiro')?`<div class="contrato-card-resumo"><div><span>Recebido</span><b>${ctMoeda(r.recebido)}</b></div><div><span>Em aberto</span><b>${ctMoeda(r.aberto)}</b></div><div><span>Atrasadas</span><b>${r.atrasadas}</b></div></div>`:''}<footer class="contrato-card-foot"><small>${c.quantidade_parcelas} parcela(s) · dia ${c.dia_vencimento}</small><button onclick="abrirDetalheContrato('${c.id}')">Abrir contrato</button></footer></article>`; }).join('') || '<div class="contratos-vazio"><i data-lucide="file-check-2"></i><p>Nenhum contrato encontrado.</p></div>';
  renderizarIcones();
}

function preencherSelectsContrato() {
  ctEl('ctModelo').innerHTML = contratosModelos.map(x=>`<option value="${x.id}">${ctHtml(x.nome)}</option>`).join('');
  ctEl('ctResponsavel').innerHTML = contratosUsuarios.map(x=>`<option value="${x.user_id}">${ctHtml(x.nome)}</option>`).join('');
  atualizarOpcoesParteContrato();
}
function atualizarOpcoesParteContrato() {
  const tipo=ctValor('ctParteTipo'), lista=tipo==='Fornecedor'?contratosFornecedores:contratosClientes;
  ctEl('ctParteId').innerHTML='<option value="">Selecione...</option>'+lista.map(x=>`<option value="${x.id}">${ctHtml(x.nome)}</option>`).join('');
  preencherParteContrato();
}
function preencherParteContrato() {
  const tipo=ctValor('ctParteTipo'), id=Number(ctValor('ctParteId')), x=(tipo==='Fornecedor'?contratosFornecedores:contratosClientes).find(a=>Number(a.id)===id)||{};
  ctEl('ctParteNome').value=x.nome||''; ctEl('ctParteDocumento').value=x.documento||''; ctEl('ctParteEndereco').value=x.endereco||''; ctEl('ctParteCidade').value=x.cidade||''; ctEl('ctParteUf').value=x.uf||'MS'; ctEl('ctParteCep').value=x.cep||''; ctEl('ctParteTelefone').value=x.telefone||x.contato||''; ctEl('ctParteEmail').value=x.email||''; ctEl('ctParteRepresentante').value=x.representante||''; ctEl('ctParteRepresentanteCpf').value=x.representante_cpf||'';
}
function atualizarTotalInicialContrato(){ctEl('ctValorInicialResumo').textContent=ctMoeda(ctNumero('ctImplantacao')+ctNumero('ctEquipamentosValor')+ctNumero('ctOutrosValores'));}
function somarMes(data,meses){const d=new Date(`${data}T12:00:00`);d.setMonth(d.getMonth()+meses);return d.toISOString().slice(0,10)}

async function abrirModalContrato(id=null) {
  if (!contratosModelos.length) await carregarContratos();
  contratoEditandoId=id; contratoRenovandoDe=null; preencherSelectsContrato();
  ctEl('contratoModalTitulo').textContent=id?'Editar contrato':'Novo contrato';
  const hoje=ctHoje(), primeira=somarMes(hoje,1);
  const defaults={ctTipo:'Locação de software',ctObjeto:'Locação de licenças de uso de software, manutenção e suporte técnico.',ctSistemas:'',ctServicos:'Implantação, licenciamento, manutenção corretiva e suporte técnico em horário comercial.',ctImplantacao:'0',ctEquipamentosValor:'0',ctEquipamentosDescricao:'',ctOutrosValores:'0',ctOutrosDescricao:'',ctVencimentoInicial:hoje,ctObservacoesComerciais:'',ctValorMensal:'0',ctInicio:hoje,ctInstalacao:hoje,ctDuracao:'12',ctParcelas:'12',ctPrimeiraMensalidade:primeira,ctDiaVencimento:String(new Date(`${primeira}T12:00:00`).getDate()),ctPeriodicidade:'Mensal',ctFormaPagamento:'PIX ou boleto bancário',ctFormasValidas:'PIX ou boleto bancário',ctRepresentanteComercial:usuarioLogado?.usuario||'',ctAvisoPrevio:'30',ctMultaRescisoria:'30',ctMultaAtraso:'2',ctJurosDia:'0.033',ctBloqueioDias:'3',ctRescisaoDias:'30',ctTaxaReativacao:'0',ctIndice:'IGP-M',ctCidadeAssinatura:contratoEmpresa?.cidade||'Jardim',ctDataAssinatura:hoje,ctObservacoes:'',ctTestemunha1:'',ctTestemunha1Cpf:'',ctTestemunha2:'',ctTestemunha2Cpf:'',ctStatus:'Ativo'};
  Object.entries(defaults).forEach(([k,v])=>{if(ctEl(k))ctEl(k).value=v}); ctEl('ctGerarInicial').checked=true;ctEl('ctAutoRenovacao').checked=true;
  if(id){const c=contratosRegistros.find(x=>x.id===id);if(!c)return;const map={ctModelo:c.modelo_id,ctParteTipo:c.parte_tipo,ctTipo:c.tipo_contrato,ctObjeto:c.objeto,ctSistemas:c.sistemas_contratados,ctServicos:c.servicos_contratados,ctImplantacao:c.implantacao_valor,ctEquipamentosValor:c.equipamentos_valor,ctEquipamentosDescricao:c.equipamentos_descricao,ctOutrosValores:c.outros_valores,ctOutrosDescricao:c.outros_valores_descricao,ctVencimentoInicial:c.vencimento_valor_inicial,ctObservacoesComerciais:c.observacoes_comerciais,ctValorMensal:c.valor_mensal,ctInicio:c.inicio,ctInstalacao:c.data_instalacao,ctDuracao:c.duracao_meses,ctParcelas:c.quantidade_parcelas,ctPrimeiraMensalidade:c.primeira_mensalidade,ctDiaVencimento:c.dia_vencimento,ctPeriodicidade:c.periodicidade,ctFormaPagamento:c.forma_pagamento,ctFormasValidas:c.formas_validas_pagamento,ctResponsavel:c.responsavel_id,ctRepresentanteComercial:c.representante_comercial,ctAvisoPrevio:c.aviso_previo_dias,ctMultaRescisoria:c.multa_rescisoria_percentual,ctMultaAtraso:c.multa_atraso_percentual,ctJurosDia:c.juros_dia_percentual,ctBloqueioDias:c.bloqueio_dias,ctRescisaoDias:c.rescisao_inadimplencia_dias,ctTaxaReativacao:c.taxa_reativacao,ctIndice:c.indice_reajuste,ctCidadeAssinatura:c.cidade_assinatura,ctDataAssinatura:c.data_assinatura,ctObservacoes:c.observacoes,ctTestemunha1:c.testemunha_1_nome,ctTestemunha1Cpf:c.testemunha_1_cpf,ctTestemunha2:c.testemunha_2_nome,ctTestemunha2Cpf:c.testemunha_2_cpf};Object.entries(map).forEach(([k,v])=>{if(ctEl(k))ctEl(k).value=v??''});atualizarOpcoesParteContrato();ctEl('ctParteId').value=c.cliente_id||c.fornecedor_id;preencherParteContrato();ctEl('ctGerarInicial').checked=c.gerar_cobranca_inicial;ctEl('ctAutoRenovacao').checked=c.auto_renovacao;ctEl('ctStatus').value=c.status;ctEl('ctStatus').disabled=true;} else {ctEl('ctStatus').disabled=false;ctEl('ctParteTipo').value='Cliente';atualizarOpcoesParteContrato();ctEl('ctResponsavel').value=usuarioLogado?.id||contratosUsuarios[0]?.user_id||'';}
  atualizarTotalInicialContrato();ctEl('modalContrato').classList.add('active');renderizarIcones();
}
function fecharModalContrato(){ctEl('modalContrato')?.classList.remove('active');contratoEditandoId=null;contratoRenovandoDe=null;}

async function salvarDadosParteContrato(tipo,id) {
  const comum={nome:ctValor('ctParteNome'),documento:ctValor('ctParteDocumento'),endereco:ctValor('ctParteEndereco'),cidade:ctValor('ctParteCidade'),uf:ctValor('ctParteUf').toUpperCase(),cep:ctValor('ctParteCep'),telefone:ctValor('ctParteTelefone'),email:ctValor('ctParteEmail'),representante:ctValor('ctParteRepresentante'),representante_cpf:ctValor('ctParteRepresentanteCpf')};
  if(tipo==='Cliente')return supabaseClient.from('clientes').update(comum).eq('id',id);
  const fornecedor={...comum,contato:comum.telefone};return supabaseClient.from('financeiro_fornecedores').update(fornecedor).eq('id',id);
}

function payloadContrato() {
  const parteTipo=ctValor('ctParteTipo'),parteId=Number(ctValor('ctParteId'));
  return {modelo_id:ctValor('ctModelo'),parte_tipo:parteTipo,cliente_id:parteTipo==='Cliente'?parteId:null,fornecedor_id:parteTipo==='Fornecedor'?parteId:null,tipo_contrato:ctValor('ctTipo'),objeto:ctValor('ctObjeto'),sistemas_contratados:ctValor('ctSistemas'),servicos_contratados:ctValor('ctServicos'),implantacao_valor:ctNumero('ctImplantacao'),equipamentos_descricao:ctValor('ctEquipamentosDescricao'),equipamentos_valor:ctNumero('ctEquipamentosValor'),outros_valores_descricao:ctValor('ctOutrosDescricao'),outros_valores:ctNumero('ctOutrosValores'),valor_inicial:ctNumero('ctImplantacao')+ctNumero('ctEquipamentosValor')+ctNumero('ctOutrosValores'),gerar_cobranca_inicial:ctEl('ctGerarInicial').checked,vencimento_valor_inicial:ctValor('ctVencimentoInicial')||null,observacoes_comerciais:ctValor('ctObservacoesComerciais'),valor_mensal:ctNumero('ctValorMensal'),inicio:ctValor('ctInicio'),data_instalacao:ctValor('ctInstalacao')||null,duracao_meses:ctNumero('ctDuracao'),quantidade_parcelas:ctNumero('ctParcelas'),primeira_mensalidade:ctValor('ctPrimeiraMensalidade'),dia_vencimento:ctNumero('ctDiaVencimento'),periodicidade:ctValor('ctPeriodicidade'),forma_pagamento:ctValor('ctFormaPagamento'),formas_validas_pagamento:ctValor('ctFormasValidas'),responsavel_id:ctValor('ctResponsavel'),representante_comercial:ctValor('ctRepresentanteComercial'),auto_renovacao:ctEl('ctAutoRenovacao').checked,aviso_previo_dias:ctNumero('ctAvisoPrevio'),multa_rescisoria_percentual:ctNumero('ctMultaRescisoria'),multa_atraso_percentual:ctNumero('ctMultaAtraso'),juros_dia_percentual:ctNumero('ctJurosDia'),bloqueio_dias:ctNumero('ctBloqueioDias'),rescisao_inadimplencia_dias:ctNumero('ctRescisaoDias'),taxa_reativacao:ctNumero('ctTaxaReativacao'),indice_reajuste:ctValor('ctIndice'),observacoes:ctValor('ctObservacoes'),cidade_assinatura:ctValor('ctCidadeAssinatura'),data_assinatura:ctValor('ctDataAssinatura'),testemunha_1_nome:ctValor('ctTestemunha1'),testemunha_1_cpf:ctValor('ctTestemunha1Cpf'),testemunha_2_nome:ctValor('ctTestemunha2'),testemunha_2_cpf:ctValor('ctTestemunha2Cpf')};
}

async function salvarContrato() {
  if(!ctPermissao(contratoEditandoId?'contratosEditar':'contratosCriar'))return avisarModulo('Sem permissão para esta ação.');
  const p=payloadContrato();
  if(!p.modelo_id||!(p.cliente_id||p.fornecedor_id)||!p.objeto||!p.sistemas_contratados||!p.valor_mensal||!p.inicio||!p.primeira_mensalidade||!p.forma_pagamento||!p.responsavel_id)return avisarModulo('Preencha os campos obrigatórios do contrato.');
  if(!ctValor('ctParteNome')||!ctValor('ctParteDocumento')||!ctValor('ctParteEndereco')||!ctValor('ctParteCidade')||!ctValor('ctParteUf')||!ctValor('ctParteRepresentante'))return avisarModulo('Complete os dados cadastrais obrigatórios da contratante.');
  const botao=ctEl('btnSalvarContrato');botao.disabled=true;
  try{
    const parteId=p.cliente_id||p.fornecedor_id,parte=await salvarDadosParteContrato(p.parte_tipo,parteId);if(parte.error)throw parte.error;
    let salvo;
    if(contratoEditandoId){const r=await supabaseClient.from('contratos').update({...p,atualizado_em:new Date().toISOString()}).eq('id',contratoEditandoId).select('id,numero,status').single();if(r.error)throw r.error;salvo=r.data;}
    else{const status=ctValor('ctStatus')||'Ativo';const r=await supabaseClient.from('contratos').insert({...p,status,renovado_de_id:contratoRenovandoDe||null,criado_por:usuarioLogado.id}).select('id,numero,status').single();if(r.error)throw r.error;salvo=r.data;}
    if(salvo.status!=='Rascunho'){const sync=await supabaseClient.rpc('sincronizar_parcelas_contrato',{p_contrato_id:salvo.id});if(sync.error)throw sync.error;}
    if(contratoRenovandoDe){const rr=await supabaseClient.rpc('marcar_contrato_renovado',{p_anterior_id:contratoRenovandoDe,p_novo_id:salvo.id});if(rr.error)throw rr.error;}
    fecharModalContrato();await carregarContratos();avisarModulo(`Contrato ${salvo.numero} salvo e integrado ao Financeiro.`);setTimeout(()=>abrirDetalheContrato(salvo.id),120);
  }catch(e){avisarModulo(e.message)}finally{botao.disabled=false;}
}

async function abrirDetalheContrato(id) {
  const c=contratosRegistros.find(x=>x.id===id);if(!c)return;contratoDetalheAtual=c;
  const consultas=[supabaseClient.from('contrato_documentos').select('*').eq('contrato_id',id).order('versao',{ascending:false}),supabaseClient.from('contrato_anexos').select('*').eq('contrato_id',id).order('criado_em',{ascending:false}),supabaseClient.from('contrato_historico').select('*').eq('contrato_id',id).order('criado_em',{ascending:false})];
  if(ctPermissao('contratosFinanceiro'))consultas.push(supabaseClient.from('financeiro_lancamentos').select('*,financeiro_pagamentos(*)').eq('contrato_id',id).order('vencimento'));
  const [dr,ar,hr,fr]=await Promise.all(consultas);c._documentos=dr.data||[];c._anexos=ar.data||[];c._historico=hr.data||[];c._financeiro=fr?.data||[];
  renderizarDetalheContrato(c);ctEl('modalContratoDetalhe').classList.add('active');renderizarIcones();
}
function fecharDetalheContrato(){ctEl('modalContratoDetalhe')?.classList.remove('active');contratoDetalheAtual=null;}
function resumoFinanceiroDetalhe(c){const l=(c._financeiro||[]).filter(x=>x.status!=='Cancelado'),total=l.reduce((s,x)=>s+Number(x.valor),0),recebido=l.reduce((s,x)=>s+Number(x.valor_pago||0),0),pagas=l.filter(x=>x.status==='Pago').length,pend=l.filter(x=>x.status==='Pendente'),atras=pend.filter(x=>x.vencimento<ctHoje()),prox=pend.filter(x=>x.vencimento>=ctHoje()).sort((a,b)=>a.vencimento.localeCompare(b.vencimento))[0];return{total,recebido,aberto:total-recebido,pagas,pendentes:pend.length,atrasadas:atras.length,proximo:prox?.vencimento};}

function renderizarDetalheContrato(c) {
  const p=parteDoContrato(c)||{},s=statusExibidoContrato(c),r=resumoFinanceiroDetalhe(c),podeFin=ctPermissao('contratosFinanceiro');
  const acao=(perm,html)=>ctPermissao(perm)?html:'';
  ctEl('contratoDetalheConteudo').innerHTML=`<div class="ct-detalhe-top"><div><span class="contrato-card-numero">${ctHtml(c.numero)}</span><h2>${ctHtml(p.nome||'Contratante')}</h2><p>${ctHtml(c.tipo_contrato)} · <span class="contrato-status ${s.toLowerCase()}">${ctHtml(s)}</span></p></div><div class="ct-acoes">${acao('contratosEditar',`<button class="btn btn-secondary" onclick="fecharDetalheContrato();abrirModalContrato('${c.id}')"><i data-lucide="pencil"></i>Editar</button>`)}${c.status==='Rascunho'?acao('contratosEditar',`<button class="btn btn-primary" onclick="ativarContrato('${c.id}')"><i data-lucide="play"></i>Ativar</button>`):''}${acao('contratosGerarDocumentos',`<button class="btn btn-primary" onclick="gerarDocumentoContrato('${c.id}')"><i data-lucide="file-down"></i>Gerar contrato PDF</button>`)}<button class="btn btn-secondary" onclick="visualizarDocumentoContrato('${c.id}')"><i data-lucide="eye"></i>Visualizar PDF</button><button class="btn btn-secondary" onclick="enviarDocumentoContrato('${c.id}')"><i data-lucide="send"></i>Enviar contrato</button>${acao('contratosCriar',`<button class="btn btn-secondary" onclick="renovarContrato('${c.id}')"><i data-lucide="refresh-cw"></i>Renovar</button>`)}${acao('contratosCancelar',`<button class="btn btn-secondary" onclick="cancelarContrato('${c.id}')"><i data-lucide="ban"></i>Cancelar</button>`)}${acao('contratosEditar',`<button class="btn btn-secondary" onclick="encerrarContrato('${c.id}')"><i data-lucide="circle-stop"></i>Encerrar</button>`)}${podeFin?`<button class="btn btn-secondary" onclick="abrirFinanceiroContrato('${c.id}')"><i data-lucide="wallet-cards"></i>Abrir Financeiro</button>`:''}${acao('contratosExcluir',`<button class="btn btn-secondary" onclick="excluirContrato('${c.id}')"><i data-lucide="trash-2"></i>Excluir</button>`)}</div></div>
  ${podeFin?`<section class="ct-resumo-fin"><article><span>Valor contratado</span><b>${ctMoeda(r.total)}</b></article><article><span>Recebido</span><b>${ctMoeda(r.recebido)}</b></article><article><span>Em aberto</span><b>${ctMoeda(r.aberto)}</b></article><article><span>Pagas / pendentes</span><b>${r.pagas} / ${r.pendentes}</b></article><article><span>Atrasadas</span><b>${r.atrasadas}</b></article><article><span>Próximo vencimento</span><b>${ctData(r.proximo)}</b></article></section>`:''}
  <div class="ct-detalhe-grid"><section class="ct-painel"><h3>Dados do contrato</h3>${[['Contratante',p.nome],['Documento',p.documento],['Objeto',c.objeto],['Sistemas',c.sistemas_contratados],['Mensalidade',ctMoeda(c.valor_mensal)],['Vigência',`${ctData(c.inicio)} - ${fimContrato(c).toLocaleDateString('pt-BR')}`],['Responsável',contratosUsuarios.find(u=>u.user_id===c.responsavel_id)?.nome],['Pagamento',c.forma_pagamento]].map(x=>`<div class="ct-lista-linha"><span>${x[0]}</span><b>${ctHtml(x[1]||'—')}</b></div>`).join('')}</section><section class="ct-painel"><h3>Regras contratuais</h3>${[['Aviso prévio',`${c.aviso_previo_dias} dias`],['Multa rescisória',`${c.multa_rescisoria_percentual}%`],['Multa por atraso',`${c.multa_atraso_percentual}%`],['Juros ao dia',`${c.juros_dia_percentual}%`],['Bloqueio',`${c.bloqueio_dias} dias`],['Rescisão por atraso',`${c.rescisao_inadimplencia_dias} dias`],['Reajuste',c.indice_reajuste],['Renovação',c.auto_renovacao?'Automática':'Mediante novo acordo']].map(x=>`<div class="ct-lista-linha"><span>${x[0]}</span><b>${ctHtml(x[1])}</b></div>`).join('')}</section></div>
  ${podeFin?`<section class="ct-painel ct-parcelas"><h3>Parcelas e lançamentos financeiros</h3><div class="financeiro-table-wrap"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Pago</th><th>Status</th></tr></thead><tbody>${(c._financeiro||[]).map(x=>`<tr class="${x.status==='Pendente'&&x.vencimento<ctHoje()?'ct-parcela-atrasada':''}"><td>${x.parcela_numero?`${x.parcela_numero}/${x.parcelas_total}`:'Inicial'}</td><td>${ctData(x.vencimento)}</td><td>${ctMoeda(x.valor)}</td><td>${ctMoeda(x.valor_pago)}</td><td>${x.status==='Pendente'&&x.vencimento<ctHoje()?'Atrasada':ctHtml(x.status)}</td></tr>`).join('')||'<tr><td colspan="5">Nenhuma parcela gerada.</td></tr>'}</tbody></table></div></section>`:''}
  <div class="ct-detalhe-grid"><section class="ct-painel"><h3>Contratos PDF</h3>${(c._documentos||[]).map(x=>`<div class="ct-doc-item"><span>Versão ${x.versao} · ${new Date(x.gerado_em).toLocaleString('pt-BR')}</span><button onclick="abrirArquivoContrato('${x.caminho_storage}')">Abrir</button></div>`).join('')||'<p class="fin-vazio">Nenhum PDF gerado.</p>'}</section><section class="ct-painel"><h3>Anexos</h3>${(c._anexos||[]).map(x=>`<div class="ct-anexo-item"><span>${ctHtml(x.nome_arquivo)}</span><button onclick="abrirArquivoContrato('${x.caminho_storage}')">Abrir</button></div>`).join('')||'<p class="fin-vazio">Nenhum anexo.</p>'}${ctPermissao('contratosEditar')?`<div class="ct-upload"><input id="ctAnexoArquivo" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx"><button class="btn btn-secondary" onclick="enviarAnexoContrato('${c.id}')">Anexar</button></div>`:''}</section></div>
  <section class="ct-painel" style="margin-top:14px"><h3>Histórico</h3>${(c._historico||[]).map(x=>`<div class="ct-historico-item"><span><b>${ctHtml(x.acao)}</b><br>${ctHtml(x.descricao)}</span><small>${ctHtml(x.usuario_nome)} · ${new Date(x.criado_em).toLocaleString('pt-BR')}</small></div>`).join('')||'<p class="fin-vazio">Sem movimentações registradas.</p>'}</section>`;
}

async function dadosAtuaisContrato(id) {
  const r=await supabaseClient.from('contratos').select('*,clientes(*),financeiro_fornecedores(*),contrato_modelos(*)').eq('id',id).single();if(r.error)throw r.error;
  const e=await supabaseClient.from('configuracoes_empresa').select('*').eq('id',true).single();if(e.error)throw e.error;
  return{contrato:r.data,parte:r.data.parte_tipo==='Fornecedor'?r.data.financeiro_fornecedores:r.data.clientes,empresa:e.data,modelo:r.data.contrato_modelos};
}
function mostrarGerandoContrato(texto='Gerando contrato em PDF...'){document.body.insertAdjacentHTML('beforeend',`<div id="ctGerando" class="ct-gerando"><div><i data-lucide="loader-circle"></i>${ctHtml(texto)}</div></div>`);renderizarIcones()}
function ocultarGerandoContrato(){ctEl('ctGerando')?.remove()}
async function bytesLogoContrato(){const r=await fetch('help-logo.png');return r.ok?new Uint8Array(await r.arrayBuffer()):null}
async function hashPdf(bytes){const h=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}

async function gerarDocumentoContrato(id) {
  if(!ctPermissao('contratosGerarDocumentos'))return avisarModulo('Sem permissão para gerar documentos.');mostrarGerandoContrato();
  try{const dados=await dadosAtuaisContrato(id),bytes=await ContratosPDF.gerarContratoPdf(dados,{logoBytes:await bytesLogoContrato()}),blob=new Blob([bytes],{type:'application/pdf'});const {data:ult}=await supabaseClient.from('contrato_documentos').select('versao').eq('contrato_id',id).order('versao',{ascending:false}).limit(1);const versao=Number(ult?.[0]?.versao||0)+1,nome=`${dados.contrato.numero}-${ctSeguro(dados.parte.nome)}-v${versao}.pdf`,caminho=`${id}/documentos/${Date.now()}-${nome}`;const up=await supabaseClient.storage.from('contratos-documentos').upload(caminho,blob,{contentType:'application/pdf',upsert:false});if(up.error)throw up.error;const meta=await supabaseClient.from('contrato_documentos').insert({contrato_id:id,versao,nome_arquivo:nome,caminho_storage:caminho,tamanho_bytes:blob.size,hash_sha256:await hashPdf(bytes),dados_snapshot:dados,gerado_por:usuarioLogado.id});if(meta.error){await supabaseClient.storage.from('contratos-documentos').remove([caminho]);throw meta.error}const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000);avisarModulo(`Contrato PDF versão ${versao} gerado com sucesso.`);if(contratoDetalheAtual?.id===id)await abrirDetalheContrato(id);}catch(e){avisarModulo(`Não foi possível gerar o contrato: ${e.message}`)}finally{ocultarGerandoContrato()}
}
async function documentoMaisRecente(id){const r=await supabaseClient.from('contrato_documentos').select('*').eq('contrato_id',id).order('versao',{ascending:false}).limit(1).maybeSingle();if(r.error)throw r.error;return r.data}
async function abrirArquivoContrato(caminho){const r=await supabaseClient.storage.from('contratos-documentos').createSignedUrl(caminho,3600);if(r.error)return avisarModulo(r.error.message);window.open(r.data.signedUrl,'_blank','noopener')}
async function visualizarDocumentoContrato(id){try{const d=await documentoMaisRecente(id);if(!d)return avisarModulo('Gere o primeiro contrato PDF antes de visualizar.');await abrirArquivoContrato(d.caminho_storage)}catch(e){avisarModulo(e.message)}}
async function enviarDocumentoContrato(id){try{const c=contratosRegistros.find(x=>x.id===id),p=parteDoContrato(c)||{},d=await documentoMaisRecente(id);if(!d)return avisarModulo('Gere o contrato PDF antes de enviar.');const s=await supabaseClient.storage.from('contratos-documentos').createSignedUrl(d.caminho_storage,604800);if(s.error)throw s.error;const msg=`Olá, ${p.representante||p.nome}! Segue o contrato ${c.numero} da Help Soluções Tecnológicas para conferência e assinatura:\n\n${s.data.signedUrl}\n\nO link ficará disponível por 7 dias.`;const tel=String(p.telefone||p.contato||'').replace(/\D/g,'');window.open(`https://wa.me/${tel.length>=10?'55'+tel.replace(/^55/,''):''}?text=${encodeURIComponent(msg)}`,'_blank','noopener')}catch(e){avisarModulo(e.message)}}

async function enviarAnexoContrato(id){const arquivo=ctEl('ctAnexoArquivo')?.files?.[0];if(!arquivo)return avisarModulo('Escolha um arquivo.');if(arquivo.size>20971520)return avisarModulo('O limite é 20 MB.');const caminho=`${id}/anexos/${Date.now()}-${ctSeguro(arquivo.name)}`;const up=await supabaseClient.storage.from('contratos-documentos').upload(caminho,arquivo,{contentType:arquivo.type||'application/octet-stream'});if(up.error)return avisarModulo(up.error.message);const m=await supabaseClient.from('contrato_anexos').insert({contrato_id:id,nome_arquivo:arquivo.name,caminho_storage:caminho,tipo_mime:arquivo.type||'application/octet-stream',tamanho_bytes:arquivo.size,criado_por:usuarioLogado.id});if(m.error){await supabaseClient.storage.from('contratos-documentos').remove([caminho]);return avisarModulo(m.error.message)}await abrirDetalheContrato(id)}

async function renovarContrato(id){const c=contratosRegistros.find(x=>x.id===id);if(!c)return;fecharDetalheContrato();await abrirModalContrato();contratoRenovandoDe=id;ctEl('contratoModalTitulo').textContent=`Renovar ${c.numero}`;ctEl('ctParteTipo').value=c.parte_tipo;atualizarOpcoesParteContrato();ctEl('ctParteId').value=c.cliente_id||c.fornecedor_id;preencherParteContrato();const campos={ctModelo:c.modelo_id,ctTipo:c.tipo_contrato,ctObjeto:c.objeto,ctSistemas:c.sistemas_contratados,ctServicos:c.servicos_contratados,ctImplantacao:0,ctEquipamentosValor:0,ctEquipamentosDescricao:'',ctOutrosValores:0,ctOutrosDescricao:'',ctValorMensal:c.valor_mensal,ctInicio:fimContrato(c).toISOString().slice(0,10),ctDuracao:c.duracao_meses,ctParcelas:c.quantidade_parcelas,ctPeriodicidade:c.periodicidade,ctFormaPagamento:c.forma_pagamento,ctFormasValidas:c.formas_validas_pagamento,ctResponsavel:c.responsavel_id,ctRepresentanteComercial:c.representante_comercial,ctAvisoPrevio:c.aviso_previo_dias,ctMultaRescisoria:c.multa_rescisoria_percentual,ctMultaAtraso:c.multa_atraso_percentual,ctJurosDia:c.juros_dia_percentual,ctBloqueioDias:c.bloqueio_dias,ctRescisaoDias:c.rescisao_inadimplencia_dias,ctTaxaReativacao:c.taxa_reativacao,ctIndice:c.indice_reajuste};Object.entries(campos).forEach(([k,v])=>ctEl(k).value=v??'');ctEl('ctPrimeiraMensalidade').value=somarMes(ctEl('ctInicio').value,1);ctEl('ctDataAssinatura').value=ctHoje();ctEl('ctGerarInicial').checked=false;atualizarTotalInicialContrato()}
async function ativarContrato(id){if(!confirm('Ativar este contrato e gerar as cobranças no Financeiro?'))return;const r=await supabaseClient.rpc('ativar_contrato',{p_contrato_id:id});if(r.error)return avisarModulo(r.error.message);fecharDetalheContrato();await carregarContratos();avisarModulo(`Contrato ativado com ${r.data||0} cobrança(s).`)}
async function cancelarContrato(id){const motivo=prompt('Informe o motivo do cancelamento:');if(!motivo)return;const r=await supabaseClient.rpc('cancelar_contrato',{p_contrato_id:id,p_motivo:motivo});if(r.error)return avisarModulo(r.error.message);fecharDetalheContrato();await carregarContratos();avisarModulo('Contrato cancelado. Cobranças futuras pendentes foram canceladas; pagamentos históricos foram preservados.')}
async function encerrarContrato(id){if(!confirm('Encerrar este contrato? O histórico financeiro será preservado.'))return;const r=await supabaseClient.rpc('encerrar_contrato',{p_contrato_id:id});if(r.error)return avisarModulo(r.error.message);fecharDetalheContrato();await carregarContratos();avisarModulo('Contrato encerrado.')}
async function excluirContrato(id){if(!confirm('Excluir este contrato? Contratos com lançamentos financeiros não podem ser excluídos.'))return;const r=await supabaseClient.from('contratos').delete().eq('id',id);if(r.error)return avisarModulo(r.error.message.includes('foreign key')?'Este contrato possui parcelas ou lançamentos e deve ser cancelado, não excluído.':r.error.message);fecharDetalheContrato();await carregarContratos()}
function abrirFinanceiroContrato(id){const c=contratosRegistros.find(x=>x.id===id);fecharDetalheContrato();trocarAba('financeiro');setTimeout(()=>{if(ctEl('financeiroBusca')){ctEl('financeiroBusca').value=c?.numero||'';renderizarTabelaFinanceiro()}},500)}

function abrirConfiguracaoEmpresa(){if(!contratoEmpresa)return avisarModulo('Carregue o módulo de contratos primeiro.');const m={cteRazao:'razao_social',cteFantasia:'nome_fantasia',cteCnpj:'cnpj',cteIe:'inscricao_estadual',cteEndereco:'endereco',cteCidade:'cidade',cteUf:'uf',cteCep:'cep',cteTelefone:'telefone',cteEmail:'email',cteRepresentante:'representante_legal',cteRepresentanteCpf:'representante_cpf',cteForoCidade:'foro_cidade',cteForoUf:'foro_uf',ctePix:'pix'};Object.entries(m).forEach(([id,k])=>ctEl(id).value=contratoEmpresa[k]||'');ctEl('modalContratoEmpresa').classList.add('active')}
function fecharConfiguracaoEmpresa(){ctEl('modalContratoEmpresa')?.classList.remove('active')}
async function salvarConfiguracaoEmpresa(){const p={razao_social:ctValor('cteRazao'),nome_fantasia:ctValor('cteFantasia'),cnpj:ctValor('cteCnpj'),inscricao_estadual:ctValor('cteIe'),endereco:ctValor('cteEndereco'),cidade:ctValor('cteCidade'),uf:ctValor('cteUf').toUpperCase(),cep:ctValor('cteCep'),telefone:ctValor('cteTelefone'),email:ctValor('cteEmail'),representante_legal:ctValor('cteRepresentante'),representante_cpf:ctValor('cteRepresentanteCpf'),foro_cidade:ctValor('cteForoCidade'),foro_uf:ctValor('cteForoUf').toUpperCase(),pix:ctValor('ctePix'),atualizado_por:usuarioLogado.id,atualizado_em:new Date().toISOString()};if(!p.razao_social||!p.cnpj||!p.endereco||!p.cidade||!p.uf)return avisarModulo('Complete os dados obrigatórios da contratada.');const r=await supabaseClient.from('configuracoes_empresa').update(p).eq('id',true).select().single();if(r.error)return avisarModulo(r.error.message);contratoEmpresa=r.data;localStorage.setItem('help_crm_pix',p.pix);fecharConfiguracaoEmpresa();avisarModulo('Dados da contratada atualizados.')}

document.addEventListener('DOMContentLoaded', instalarInterfaceContratos);
