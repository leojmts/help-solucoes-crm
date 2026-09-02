// ===== SUPABASE - BANCO DE DADOS NA NUVEM =====
const SUPABASE_URL = 'https://cdsdgijxsslmyhnqapiu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_49trKYxsMypJahHt9QtCIA_Ayg3gyml';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function renderizarIcones() {
  if (window.lucide) window.lucide.createIcons();
}

function definirIcone(botao, nome) {
  botao.innerHTML = `<i data-lucide="${nome}"></i>`;
}

function definirBadge(celula, classe, texto) {
  celula.innerHTML = '';
  const badge = document.createElement('span');
  badge.className = `badge ${classe}`;
  badge.textContent = texto ?? '';
  celula.appendChild(badge);
}

function aplicarRotulosTabelasMobile() {
  ['tabelaChamados', 'tabelaClientes'].forEach(id => {
    const tabela = document.getElementById(id);
    if (!tabela) return;
    const titulos = [...tabela.querySelectorAll('thead th')].map(th => th.textContent.trim());
    tabela.querySelectorAll('tbody tr').forEach(tr => {
      [...tr.children].forEach((td, i) => td.dataset.label = titulos[i] || 'Campo');
    });
  });
}

function finalizarInterfaceDinamica() {
  aplicarRotulosTabelasMobile();
  renderizarIcones();
}

async function salvarChamadoNaNuvem(chamado) {
  const { data, error } = await supabaseClient
    .from('chamados')
    .insert(chamado)
    .select('id, abertura_em, fechamento_em')
    .single();

  if (error) throw error;
  return data;
}

async function atualizarChamadoNaNuvem(protocolo, alteracoes) {
  const { data, error } = await supabaseClient
    .from('chamados')
    .update(alteracoes)
    .eq('protocolo', protocolo)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('O chamado não foi atualizado. Verifique sua permissão e tente novamente.');
}

async function excluirChamadoNaNuvem(protocolo) {
  const { data, error } = await supabaseClient
    .from('chamados')
    .delete()
    .eq('protocolo', protocolo)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('O chamado não foi excluído. Somente administradores podem realizar esta ação.');
}

async function obterIdChamadoAtual() {
  if (!linhaEdicaoChamado) return null;
  if (linhaEdicaoChamado.dataset.idNuvem) return linhaEdicaoChamado.dataset.idNuvem;
  const protocolo = linhaEdicaoChamado.querySelectorAll('td')[0].innerText.trim();
  const { data, error } = await supabaseClient.from('chamados').select('id').eq('protocolo', protocolo).single();
  if (error) throw error;
  linhaEdicaoChamado.dataset.idNuvem = data.id;
  return data.id;
}

let interacaoEditandoId = null;
let respostasModeloCache = [];
let conhecimentoCache = [];

function formatarCampoHora(input) {
  let valor = input.value.replace(/\D/g, '').slice(0, 4);
  if (valor.length > 2) valor = valor.slice(0, 2) + ':' + valor.slice(2);
  input.value = valor;
}

function horaValida(valor) {
  const partes = /^(\d{2}):(\d{2})$/.exec(valor);
  return !!partes && Number(partes[1]) <= 23 && Number(partes[2]) <= 59;
}

function proximoContatoParaIso(data, hora) {
  if (!data) return null;
  const local = new Date(`${data}T${hora}:00`);
  if (Number.isNaN(local.getTime())) throw new Error('Data ou horário de próximo contato inválido.');
  return local.toISOString();
}

function mostrarAnexosSelecionados() {
  const input = document.getElementById('interacaoAnexos');
  const area = document.getElementById('interacaoAnexosSelecionados');
  if (!input || !area) return;
  area.textContent = [...input.files].map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`).join(' · ');
}

function nomeArquivoSeguro(nome) {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}

async function enviarAnexosInteracao(interacaoId, chamadoId) {
  const input = document.getElementById('interacaoAnexos');
  const arquivos = input ? [...input.files] : [];
  const permitidos = ['image/jpeg','image/png','image/webp','application/pdf','text/plain'];
  for (const arquivo of arquivos) {
    if (arquivo.size > 10485760) throw new Error(`${arquivo.name}: o limite é 10 MB.`);
    if (!permitidos.includes(arquivo.type)) throw new Error(`${arquivo.name}: formato não permitido.`);
    const caminho = `${chamadoId}/${interacaoId}/${crypto.randomUUID()}-${nomeArquivoSeguro(arquivo.name)}`;
    const { error: uploadError } = await supabaseClient.storage.from('chamado-anexos').upload(caminho, arquivo, { upsert: false, contentType: arquivo.type });
    if (uploadError) throw uploadError;
    const { error: metaError } = await supabaseClient.from('chamado_interacao_anexos').insert({ interacao_id: interacaoId, chamado_id: chamadoId, nome_arquivo: arquivo.name, caminho_storage: caminho, tipo_mime: arquivo.type, tamanho_bytes: arquivo.size, criado_por: usuarioLogado.id });
    if (metaError) { await supabaseClient.storage.from('chamado-anexos').remove([caminho]); throw metaError; }
  }
}

async function baixarAnexoInteracao(anexo) {
  const { data, error } = await supabaseClient.storage.from('chamado-anexos').download(anexo.caminho_storage);
  if (error) { alert('Não foi possível baixar o anexo.\n\n' + error.message); return; }
  const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = anexo.nome_arquivo; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function limparFormularioInteracao() {
  interacaoEditandoId = null;
  const descricao = document.getElementById('interacaoDescricao');
  if (descricao) descricao.value = '';
  const proximoData = document.getElementById('interacaoProximoData');
  if (proximoData) proximoData.value = '';
  const proximoHora = document.getElementById('interacaoProximoHora');
  if (proximoHora) proximoHora.value = '';
  const interna = document.getElementById('interacaoInterna');
  if (interna) interna.checked = false;
  const tipo = document.getElementById('interacaoTipo');
  if (tipo) tipo.value = 'WhatsApp';
  const anexos = document.getElementById('interacaoAnexos');
  if (anexos) anexos.value = '';
  const anexosArea = document.getElementById('interacaoAnexosSelecionados');
  if (anexosArea) anexosArea.textContent = '';
  const botao = document.getElementById('btnRegistrarInteracao');
  if (botao) botao.innerHTML = '<i data-lucide="plus"></i>Registrar';
  document.getElementById('btnCancelarEdicaoInteracao')?.classList.add('hidden');
  renderizarIcones();
}

function dataParaInputLocal(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function editarInteracaoChamado(item) {
  interacaoEditandoId = item.id;
  document.getElementById('interacaoTipo').value = item.tipo;
  document.getElementById('interacaoDescricao').value = item.descricao;
  const proximoLocal = dataParaInputLocal(item.proximo_contato);
  document.getElementById('interacaoProximoData').value = proximoLocal ? proximoLocal.slice(0,10) : '';
  document.getElementById('interacaoProximoHora').value = proximoLocal ? proximoLocal.slice(11,16) : '';
  document.getElementById('interacaoInterna').checked = !!item.interna;
  document.getElementById('btnRegistrarInteracao').innerHTML = '<i data-lucide="save"></i>Salvar alteração';
  document.getElementById('btnCancelarEdicaoInteracao').classList.remove('hidden');
  document.getElementById('interacaoDescricao').focus();
  document.querySelector('.interacao-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  renderizarIcones();
}

function formatarDataHoraInteracao(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function renderizarInteracoesChamado(interacoes) {
  const lista = document.getElementById('listaInteracoesChamado');
  const contador = document.getElementById('contadorInteracoesChamado');
  if (!lista || !contador) return;
  contador.textContent = `${interacoes.length} ${interacoes.length === 1 ? 'registro' : 'registros'}`;
  lista.innerHTML = '';
  if (!interacoes.length) {
    lista.innerHTML = '<div class="interacoes-estado">Nenhuma interação registrada neste chamado.</div>';
    return;
  }
  interacoes.forEach(item => {
    const card = document.createElement('article');
    card.className = 'interacao-item' + (item.interna ? ' interna' : '');
    const topo = document.createElement('div'); topo.className = 'interacao-item-topo';
    const tipo = document.createElement('span'); tipo.className = 'interacao-tipo'; tipo.textContent = item.tipo + (item.interna ? ' • Interna' : '');
    const meta = document.createElement('span'); meta.className = 'interacao-meta'; meta.textContent = `${item.criado_por_nome || 'Usuário'} • ${formatarDataHoraInteracao(item.criado_em)}`;
    const texto = document.createElement('div'); texto.className = 'interacao-texto'; texto.textContent = item.descricao;
    topo.append(tipo, meta); card.append(topo, texto);
    if (item.proximo_contato) {
      const proximo = document.createElement('span'); proximo.className = 'interacao-proximo'; proximo.textContent = `Próximo contato: ${formatarDataHoraInteracao(item.proximo_contato)}`; card.appendChild(proximo);
    }
    if (item.anexos?.length) {
      const anexos = document.createElement('div'); anexos.className = 'interacao-anexos';
      item.anexos.forEach(anexo => { const b = document.createElement('button'); b.type = 'button'; b.className = 'interacao-anexo-link'; b.innerHTML = '<i data-lucide="paperclip"></i>'; b.append(document.createTextNode(anexo.nome_arquivo)); b.onclick = () => baixarAnexoInteracao(anexo); anexos.appendChild(b); });
      card.appendChild(anexos);
    }
    if (item.criado_por === usuarioLogado?.id || usuarioLogado?.perfil === 'admin') {
      const acoes = document.createElement('div'); acoes.className = 'interacao-acoes';
      const editar = document.createElement('button'); editar.type = 'button'; editar.className = 'interacao-editar'; editar.title = 'Editar interação'; definirIcone(editar, 'pencil'); editar.append(document.createTextNode('Editar')); editar.onclick = () => editarInteracaoChamado(item);
      const excluir = document.createElement('button'); excluir.type = 'button'; excluir.className = 'interacao-excluir'; excluir.title = 'Excluir interação'; definirIcone(excluir, 'trash-2'); excluir.append(document.createTextNode('Excluir')); excluir.onclick = () => excluirInteracaoChamado(item.id);
      acoes.append(editar, excluir); card.appendChild(acoes);
    }
    lista.appendChild(card);
  });
  renderizarIcones();
}

async function carregarInteracoesChamado() {
  const area = document.getElementById('areaInteracoesChamado');
  const lista = document.getElementById('listaInteracoesChamado');
  if (!linhaEdicaoChamado) { area?.classList.add('hidden'); return; }
  area?.classList.remove('hidden');
  if (lista) lista.innerHTML = '<div class="interacoes-estado">Carregando histórico...</div>';
  try {
    if (!respostasModeloCache.length) await carregarFerramentasAtendimento();
    const chamadoId = await obterIdChamadoAtual();
    const { data, error } = await supabaseClient.from('chamado_interacoes').select('*').eq('chamado_id', chamadoId).order('criado_em', { ascending: false });
    if (error) throw error;
    const interacoes = data || [];
    if (interacoes.length) {
      const { data: anexos, error: anexosError } = await supabaseClient.from('chamado_interacao_anexos').select('*').in('interacao_id', interacoes.map(i => i.id)).order('criado_em');
      if (anexosError) throw anexosError;
      interacoes.forEach(i => { i.anexos = (anexos || []).filter(a => a.interacao_id === i.id); });
    }
    renderizarInteracoesChamado(interacoes);
  } catch (erro) {
    console.error('Erro ao carregar interações:', erro);
    if (lista) lista.innerHTML = '<div class="interacoes-estado">Não foi possível carregar as interações. Confirme se o SQL de instalação foi executado.</div>';
  }
}

async function adicionarInteracaoChamado() {
  const descricaoEl = document.getElementById('interacaoDescricao');
  const descricao = descricaoEl.value.trim();
  if (!descricao) { alert('Descreva a interação antes de registrar.'); descricaoEl.focus(); return; }
  const dataProximo = document.getElementById('interacaoProximoData').value;
  const horaProximo = document.getElementById('interacaoProximoHora').value.trim();
  if (!dataProximo && horaProximo) { alert('Selecione também a data do próximo contato.'); document.getElementById('interacaoProximoData').focus(); return; }
  if (dataProximo && !horaValida(horaProximo)) { alert('Informe um horário válido no formato HH:MM. Exemplo: 08:00.'); document.getElementById('interacaoProximoHora').focus(); return; }
  const botao = document.getElementById('btnRegistrarInteracao');
  botao.disabled = true; botao.textContent = 'Salvando...';
  try {
    const payload = {
      tipo: document.getElementById('interacaoTipo').value,
      descricao,
      proximo_contato: proximoContatoParaIso(dataProximo, horaProximo),
      interna: document.getElementById('interacaoInterna').checked
    };
    let error, interacaoId = interacaoEditandoId, chamadoId;
    if (interacaoEditandoId) {
      ({ error } = await supabaseClient.from('chamado_interacoes').update(payload).eq('id', interacaoEditandoId));
    } else {
      chamadoId = await obterIdChamadoAtual();
      let data;
      ({ data, error } = await supabaseClient.from('chamado_interacoes').insert({
        ...payload,
        chamado_id: chamadoId,
        criado_por: usuarioLogado.id,
        criado_por_nome: usuarioLogado.nome || usuarioLogado.email || 'Usuário'
      }).select('id').single());
      interacaoId = data?.id;
    }
    if (error) throw error;
    chamadoId = chamadoId || await obterIdChamadoAtual();
    if (interacaoId) await enviarAnexosInteracao(interacaoId, chamadoId);
    const protocolo = linhaEdicaoChamado.querySelectorAll('td')[0].innerText.trim();
    registrarLog(`${interacaoEditandoId ? 'editou' : 'registrou'} uma interação no chamado ${protocolo}`);
    if (!interacaoEditandoId) await processarMencoesInteracao(descricao, chamadoId, protocolo);
    limparFormularioInteracao();
    await carregarInteracoesChamado();
  } catch (erro) {
    console.error('Erro ao registrar interação:', erro);
    alert('Não foi possível registrar a interação.\n\nDetalhes: ' + erro.message);
  } finally {
    botao.disabled = false;
    botao.innerHTML = interacaoEditandoId ? '<i data-lucide="save"></i>Salvar alteração' : '<i data-lucide="plus"></i>Registrar';
    renderizarIcones();
  }
}

async function excluirInteracaoChamado(id) {
  if (!confirm('Deseja excluir esta interação?')) return;
  try {
    const { data: anexos, error: anexosError } = await supabaseClient.from('chamado_interacao_anexos').select('caminho_storage').eq('interacao_id', id);
    if (anexosError) throw anexosError;
    if (anexos?.length) { const { error: storageError } = await supabaseClient.storage.from('chamado-anexos').remove(anexos.map(a => a.caminho_storage)); if (storageError) throw storageError; }
    const { error } = await supabaseClient.from('chamado_interacoes').delete().eq('id', id);
    if (error) throw error;
    const protocolo = linhaEdicaoChamado.querySelectorAll('td')[0].innerText.trim();
    registrarLog(`excluiu uma interação do chamado ${protocolo}`);
    await carregarInteracoesChamado();
  } catch (erro) {
    console.error('Erro ao excluir interação:', erro);
    alert('Não foi possível excluir a interação.\n\nDetalhes: ' + erro.message);
  }
}

async function registrarEventosResponsabilidade(chamadoId, eventos) {
  if (!chamadoId || !eventos.length || !usuarioLogado) return;
  const registros = eventos.map(descricao => ({
    chamado_id: chamadoId, tipo: 'Observação interna', descricao,
    proximo_contato: null, interna: true, criado_por: usuarioLogado.id,
    criado_por_nome: usuarioLogado.nome || usuarioLogado.email || 'Usuário'
  }));
  const { error } = await supabaseClient.from('chamado_interacoes').insert(registros);
  if (error) console.warn('Chamado salvo, mas o histórico de responsabilidade não foi registrado:', error);
}

function formatarDataHoraBanco(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function adicionarChamadoNuvemNaTabela(chamado) {
  const tabela = document.getElementById('tabelaChamados').getElementsByTagName('tbody')[0];
  const novaLinha = tabela.insertRow(-1);

  const aberturaStr = formatarDataHoraBanco(chamado.abertura_em || chamado.criado_em);
  const fechamentoStr = formatarDataHoraBanco(chamado.fechamento_em);
  const status = chamado.status || 'Pendente';
  const prioridade = chamado.prioridade || 'Normal';
  const badgeStatusClass = status === 'Resolvido' ? 'badge-resolvido' : (status === 'Pendente' || status === 'Aberto' ? 'badge-pendente' : 'badge-andamento');
  const badgePrioridadeClass = prioridade === 'Alta Prioridade' || prioridade === 'Alta' ? 'badge-alta' : 'badge-normal';

  novaLinha.dataset.idNuvem = chamado.id || '';
  novaLinha.setAttribute('data-erro', chamado.erro || chamado.descricao || '');
  novaLinha.setAttribute('data-resolucao', chamado.resolucao || '');
  novaLinha.dataset.contatoConfirmado = chamado.contato_confirmado ? 'true' : 'false';
  novaLinha.setAttribute('data-abertura', aberturaStr);
  novaLinha.setAttribute('data-abertura-iso', chamado.abertura_em || chamado.criado_em || '');
  if (fechamentoStr) novaLinha.setAttribute('data-fechamento', fechamentoStr);
  if (chamado.fechamento_em) novaLinha.setAttribute('data-fechamento-iso', chamado.fechamento_em);

  const valores = [
    chamado.protocolo || '-',
    aberturaStr || '-',
    chamado.cliente || 'Não informado',
    chamado.unidade || '-',
    chamado.origem || '-',
    chamado.serial || '-',
    chamado.solicitante || '-',
    chamado.tecnico || '-',
    chamado.modulo || '-',
    chamado.tipo || '-'
  ];

  valores.forEach((valor, indice) => {
    const td = document.createElement('td');
    if (indice === 0) {
      const a = document.createElement('a');
      a.className = 'protocolo';
      a.textContent = valor;
      a.onclick = function () { visualizarChamado(this); };
      td.appendChild(a);
    } else if (indice === 4) {
      const span = document.createElement('span'); span.className = 'badge badge-origem'; span.textContent = valor; td.appendChild(span);
    } else if (indice === 7) {
      const span = document.createElement('span'); span.className = 'badge badge-tecnico'; span.textContent = valor; td.appendChild(span);
    } else {
      td.textContent = valor;
    }
    novaLinha.appendChild(td);
  });

  const tdPrioridade = document.createElement('td');
  const badgePrioridade = document.createElement('span'); badgePrioridade.className = 'badge ' + badgePrioridadeClass; badgePrioridade.textContent = prioridade; tdPrioridade.appendChild(badgePrioridade);
  novaLinha.appendChild(tdPrioridade);

  const tdStatus = document.createElement('td');
  const badgeStatus = document.createElement('span'); badgeStatus.className = 'badge ' + badgeStatusClass; badgeStatus.textContent = status; tdStatus.appendChild(badgeStatus);
  novaLinha.appendChild(tdStatus);

  const tdFechamento = document.createElement('td'); tdFechamento.textContent = fechamentoStr || '-'; novaLinha.appendChild(tdFechamento);

  const tdAcoes = document.createElement('td'); tdAcoes.className = 'actions-cell';
  const btnWhats = document.createElement('button'); btnWhats.title = 'Enviar WhatsApp'; definirIcone(btnWhats, 'message-circle'); btnWhats.onclick = function () { enviarWhatsappChamado(this); };
  const btnVer = document.createElement('button'); btnVer.title = 'Editar/Visualizar'; definirIcone(btnVer, 'eye'); btnVer.onclick = function () { visualizarChamado(this); };
  const btnExcluir = document.createElement('button'); btnExcluir.title = 'Excluir'; definirIcone(btnExcluir, 'trash-2'); btnExcluir.onclick = function () { excluirChamado(this); };
  tdAcoes.append(btnWhats, btnVer);
  if (usuarioLogado?.perfil === 'admin' || usuarioLogado?.permissoes?.usuarios === true) tdAcoes.append(btnExcluir);
  novaLinha.appendChild(tdAcoes);
  finalizarInterfaceDinamica();
}


async function carregarClientesDaNuvem() {
  const tbody = document.querySelector('#tabelaClientes tbody');
  if (!tbody) return;
  const { data, error } = await supabaseClient.from('clientes').select('*').order('nome', { ascending: true });
  if (error) throw error;
  tbody.innerHTML = '';
  (data || []).filter(c=>c.eh_cliente!==false).forEach(c => {
    const tr = tbody.insertRow(-1);
    tr.dataset.idNuvem = c.id;
    tr.setAttribute('data-ie', c.ie || '');
    tr.setAttribute('data-obs', c.observacoes_tecnicas || '');
    tr.dataset.endereco = c.endereco || '';
    tr.dataset.cidade = c.cidade || '';
    tr.dataset.uf = c.uf || '';
    tr.dataset.cep = c.cep || '';
    tr.dataset.representante = c.representante || '';
    tr.dataset.representanteCpf = c.representante_cpf || '';
    [c.nome || '-', c.unidade || '-', c.documento || '-', c.telefone || '-', c.email || '-', c.regime || '-'].forEach(v => {
      const td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
    });
    const tdAcoes = document.createElement('td'); tdAcoes.className = 'actions-cell';
    const btn360 = document.createElement('button'); btn360.title='Visão 360°'; definirIcone(btn360, 'contact-round'); btn360.onclick=()=>gcAbrir360(c.id);
    const btnEditar = document.createElement('button'); btnEditar.title='Editar Cliente'; definirIcone(btnEditar, 'pencil'); btnEditar.onclick=()=>editarCliente(btnEditar);
    const btnClonar = document.createElement('button'); btnClonar.title='Clonar Cliente'; definirIcone(btnClonar, 'copy'); btnClonar.onclick=()=>clonarCliente(btnClonar);
    const btnExcluir = document.createElement('button'); btnExcluir.title='Excluir'; definirIcone(btnExcluir, 'trash-2'); btnExcluir.onclick=()=>excluirLinha(btnExcluir);
    if(usuarioLogado?.perfil==='admin'||usuarioLogado?.permissoes?.crm)tdAcoes.append(btn360);
    tdAcoes.append(btnEditar, btnClonar, btnExcluir); tr.appendChild(tdAcoes);
  });
  atualizarDatalistClientes();
  finalizarInterfaceDinamica();
}

async function carregarTecnicosDaNuvem() {
  const select = document.getElementById('mTecnico');
  if (!select) return;
  const { data, error } = await supabaseClient.from('tecnicos').select('*').eq('ativo', true).order('nome', { ascending: true });
  if (error) throw error;
  tecnicosNuvem = data || [];
  select.innerHTML = '';
  (data || []).forEach(t => {
    const option = document.createElement('option'); option.value=t.nome; option.textContent=t.nome; option.dataset.idNuvem=t.id; select.appendChild(option);
  });
  renderizarTecnicos();
}
async function carregarChamadosDaNuvem() {
  const tbody = document.querySelector('#tabelaChamados tbody');
  if (!tbody) return;

  const { data, error } = await supabaseClient
    .from('chamados')
    .select('*')
    .order('abertura_em', { ascending: false });

  if (error) throw error;

  tbody.innerHTML = '';
  (data || []).forEach(adicionarChamadoNuvemNaTabela);
  filtrarChamados();
  atualizarOpcoesDossie();
  finalizarInterfaceDinamica();
}


    // Garante que todas as telas principais pertençam ao mesmo painel de conteúdo.
    (function organizarTelasPrincipais() {
      function mover() {
        const main = document.querySelector('main.content');
        if (!main) return;
        ['visaoDashboard','visaoMeuTrabalho','visaoKanban','visaoCRM','visaoCadastro','visaoProcessos','visaoRelatorios','visaoConfiguracoes'].forEach(id => {
          const tela = document.getElementById(id);
          if (tela && tela.parentElement !== main) main.appendChild(tela);
        });
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mover, { once:true });
      } else {
        mover();
      }
    })();


    let linhaEdicaoChamado = null;
    let linhaEdicaoCliente = null;
    let linhaEdicaoUsuario = null;
    let usuarioLogado = null;
    let tecnicosNuvem = [];
    let audioContextoNotificacao = null;
    let intervaloNotificacoes = null;

    const RECURSOS = ['dashboard', 'clientes', 'novoChamado', 'novoCliente', 'novoTecnico', 'usuarios', 'crm', 'os', 'osVisualizar', 'osCriar', 'osEditar', 'osExcluir', 'financeiro', 'financeiroVisualizar', 'financeiroCriar', 'financeiroBaixar', 'financeiroExcluir', 'financeiroRelatorios', 'contratos', 'contratosVisualizar', 'contratosCriar', 'contratosEditar', 'contratosGerarDocumentos', 'contratosCancelar', 'contratosExcluir', 'contratosFinanceiro', 'enviarEmail', 'backup', 'whatsapp', 'relatorios', 'configuracoes'];
    const PERFIS_PADRAO = {
      admin: RECURSOS.reduce((acc, r) => { acc[r] = true; return acc; }, {}),
      tecnico: { dashboard: true, clientes: true, novoChamado: true, novoCliente: false, novoTecnico: false, usuarios: false, crm: false, os: true, osVisualizar:true, osCriar:true, osEditar:true, osExcluir:true, financeiro: false, financeiroVisualizar:false, financeiroCriar:false, financeiroBaixar:false, financeiroExcluir:false, financeiroRelatorios:false, enviarEmail: false, backup: false, whatsapp: false, relatorios: false, configuracoes: false }
    };

    // ---- Perfis e permissões na nuvem ----
    async function carregarPerfilUsuario(user) {
      const { data, error } = await supabaseClient
        .from('perfis_usuarios')
        .select('user_id,email,nome,perfil,permissoes,ativo')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Perfil do usuário não encontrado.');
      return data;
    }

    async function carregarNomePessoaUsuario(userId) {
      const { data, error } = await supabaseClient
        .from('tecnicos')
        .select('nome')
        .eq('user_id', userId)
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Não foi possível carregar o nome pessoal vinculado ao usuário:', error);
        return '';
      }
      return (data?.nome || '').trim();
    }

    function registrarLog(acao) {
      const log = JSON.parse(localStorage.getItem('help_crm_log') || '[]');
      log.unshift({ usuario: usuarioLogado ? usuarioLogado.usuario : '-', acao, data: formatarDataHoraAtual() });
      localStorage.setItem('help_crm_log', JSON.stringify(log.slice(0, 200)));
      renderizarLog();
    }

    function renderizarLog() {
      const container = document.getElementById('listaLog');
      if (!container) return;
      const log = JSON.parse(localStorage.getItem('help_crm_log') || '[]');
      if (log.length === 0) { container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Nenhuma atividade registrada ainda.</p>'; return; }
      container.innerHTML = '';
      log.slice(0, 50).forEach(item => {
        const div = document.createElement('div');
        div.className = 'log-item';
        const acao = document.createElement('span'); acao.className = 'log-acao'; acao.textContent = `${item.usuario}: ${item.acao}`;
        const meta = document.createElement('span'); meta.className = 'log-meta'; meta.textContent = item.data;
        div.append(acao, meta);
        container.appendChild(div);
      });
    }

    // ---- Login / Logout (Supabase Auth + perfil no banco) ----
    async function entrarComUsuarioSupabase(user) {
      let perfilNuvem;
      try {
        perfilNuvem = await carregarPerfilUsuario(user);
      } catch (erro) {
        await supabaseClient.auth.signOut();
        throw erro;
      }

      if (!perfilNuvem.ativo) {
        await supabaseClient.auth.signOut();
        throw new Error('Sua conta existe, mas ainda não foi autorizada por um administrador.');
      }

      const nomePessoa = await carregarNomePessoaUsuario(user.id);
      const nomeExibicao = nomePessoa || perfilNuvem.nome || (user.email || 'Usuário').split('@')[0];
      usuarioLogado = {
        id: user.id,
        nome: nomeExibicao,
        usuario: nomeExibicao,
        email: user.email || perfilNuvem.email || '',
        perfil: perfilNuvem.perfil || 'personalizado',
        permissoes: { ...(PERFIS_PADRAO[perfilNuvem.perfil] || {}), ...(perfilNuvem.permissoes || {}) }
      };

      document.getElementById('telaLogin').classList.add('hidden');
      document.getElementById('appContainer').classList.remove('hidden');
      const du = document.getElementById('dashboardUserName'); if (du) du.textContent = nomeExibicao;
      if (localStorage.getItem('help_crm_sidebar_recolhida') === '1') document.getElementById('appContainer').classList.add('sidebar-collapsed');
      document.getElementById('loginSenha').value = '';
      aplicarPermissoesNaTela();
      registrarLog('fez login no sistema pela nuvem');

      try {
        await carregarEstado();
      } catch (erro) {
        console.error('Erro ao carregar dados da nuvem:', erro);
        alert('Login realizado, mas não foi possível carregar os dados da nuvem.\n\nDetalhes: ' + erro.message);
      }
    }

    async function fazerLogin() {
      const email = document.getElementById('loginUsuario').value.trim();
      const senha = document.getElementById('loginSenha').value;
      const erroEl = document.getElementById('loginErro');
      erroEl.style.color = '#f87171';
      erroEl.textContent = '';

      if (!email || !senha) { erroEl.textContent = 'Informe e-mail e senha.'; return; }

      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
      if (error) { erroEl.textContent = 'Não foi possível entrar: ' + error.message; return; }
      try {
        await entrarComUsuarioSupabase(data.user);
      } catch (erro) {
        erroEl.textContent = erro.message;
      }
    }

    async function criarContaNuvem() {
      const email = document.getElementById('loginUsuario').value.trim();
      const senha = document.getElementById('loginSenha').value;
      const erroEl = document.getElementById('loginErro');
      erroEl.style.color = '#f87171';
      erroEl.textContent = '';

      if (!email || !email.includes('@')) { erroEl.textContent = 'Digite seu e-mail no campo acima.'; return; }
      if (!senha || senha.length < 6) { erroEl.textContent = 'Use uma senha com pelo menos 6 caracteres.'; return; }

      const { data, error } = await supabaseClient.auth.signUp({ email, password: senha });
      if (error) { erroEl.textContent = 'Não foi possível criar a conta: ' + error.message; return; }

      if (data.session && data.user) {
        try { await entrarComUsuarioSupabase(data.user); }
        catch (erro) { erroEl.textContent = erro.message; }
      } else {
        erroEl.style.color = '#34d399';
        erroEl.textContent = 'Conta criada. Confirme o e-mail e depois clique em Entrar. Se você foi convidado, suas permissões serão aplicadas automaticamente.';
      }
    }

    async function logout() {
      registrarLog('saiu do sistema');
      if (canalProcessosEquipe) { await supabaseClient.removeChannel(canalProcessosEquipe); canalProcessosEquipe = null; }
      await supabaseClient.auth.signOut();
      usuarioLogado = null;
      document.getElementById('appContainer').classList.add('hidden');
      document.getElementById('telaLogin').classList.remove('hidden');
      document.getElementById('loginUsuario').value = '';
      document.getElementById('loginSenha').value = '';
    }

    async function tentarSessaoExistente() {
      const { data } = await supabaseClient.auth.getSession();
      if (!data.session || !data.session.user) return;
      try { await entrarComUsuarioSupabase(data.session.user); }
      catch (erro) {
        const erroEl = document.getElementById('loginErro');
        if (erroEl) erroEl.textContent = erro.message;
      }
    }

    function aplicarPermissoesNaTela() {
      if (!usuarioLogado) return;
      document.getElementById('userBoxNome').textContent = usuarioLogado.usuario;
      document.getElementById('userBoxPapel').textContent = usuarioLogado.perfil === 'admin' ? 'Administrador' : (usuarioLogado.perfil === 'tecnico' ? 'Técnico' : 'Personalizado');

      document.querySelectorAll('[data-permissao]').forEach(el => {
        const recurso = el.getAttribute('data-permissao');
        const liberado = !!(usuarioLogado.permissoes && usuarioLogado.permissoes[recurso]);
        el.style.display = liberado ? '' : 'none';
      });

      const abaCadastroAtiva = !document.getElementById('visaoCadastro').classList.contains('hidden');
      const abaRelatoriosAtiva = !document.getElementById('visaoRelatorios').classList.contains('hidden');
      const abaConfigAtiva = !document.getElementById('visaoConfiguracoes').classList.contains('hidden');
      const podeCadastro = !!(usuarioLogado.permissoes.clientes || usuarioLogado.permissoes.usuarios || usuarioLogado.permissoes.novoTecnico);
      if ((abaCadastroAtiva && !podeCadastro) || (abaRelatoriosAtiva && !usuarioLogado.permissoes.relatorios) || (abaConfigAtiva && !usuarioLogado.permissoes.configuracoes)) trocarAba('dashboard');
      renderizarLog();
      renderizarUsuarios();
    }

    // ---- Gestão de Usuários na nuvem ----
    function aplicarPerfilPadrao() {
      const perfil = document.getElementById('uPerfil').value;
      const padrao = PERFIS_PADRAO[perfil] || {};
      RECURSOS.forEach(r => {
        const cb = document.getElementById('perm' + r.charAt(0).toUpperCase() + r.slice(1));
        if (cb) cb.checked = !!padrao[r];
      });
    }

    function abrirModalUsuario() {
      linhaEdicaoUsuario = null;
      document.getElementById('modalUsuarioTitulo').innerText = 'Convidar Usuário';
      document.getElementById('uUsuario').value = '';
      document.getElementById('uUsuario').disabled = false;
      document.getElementById('uPerfil').value = 'tecnico';
      aplicarPerfilPadrao();
      document.getElementById('modalUsuario').classList.add('active');
    }

    async function buscarUsuariosNuvem() {
      if (!usuarioLogado || !usuarioLogado.permissoes?.usuarios) return { perfis: [], convites: [] };
      const [{ data: perfis, error: ep }, { data: convites, error: ec }] = await Promise.all([
        supabaseClient.from('perfis_usuarios').select('user_id,email,nome,perfil,permissoes,ativo,criado_em').order('criado_em'),
        supabaseClient.from('convites_usuarios').select('email,nome,perfil,permissoes,ativo,criado_em').order('criado_em')
      ]);
      if (ep) throw ep;
      if (ec) throw ec;
      return { perfis: perfis || [], convites: convites || [] };
    }

    async function editarUsuario(chave) {
      try {
        const { perfis, convites } = await buscarUsuariosNuvem();
        const u = perfis.find(x => x.user_id === chave) || convites.find(x => x.email === chave);
        if (!u) return;
        linhaEdicaoUsuario = { tipo: u.user_id ? 'perfil' : 'convite', chave: u.user_id || u.email };
        document.getElementById('modalUsuarioTitulo').innerText = u.user_id ? 'Editar Usuário' : 'Editar Convite';
        document.getElementById('uUsuario').value = u.email;
        document.getElementById('uUsuario').disabled = true;
        document.getElementById('uPerfil').value = u.perfil;
        RECURSOS.forEach(r => {
          const cb = document.getElementById('perm' + r.charAt(0).toUpperCase() + r.slice(1));
          if (cb) cb.checked = !!(u.permissoes && u.permissoes[r]);
        });
        document.getElementById('modalUsuario').classList.add('active');
      } catch (erro) { alert('Não foi possível abrir o usuário.\n\n' + erro.message); }
    }

    async function excluirUsuario(chave) {
      if (!usuarioLogado?.permissoes?.usuarios) return;
      try {
        const { perfis, convites } = await buscarUsuariosNuvem();
        const perfil = perfis.find(x => x.user_id === chave);
        const convite = convites.find(x => x.email === chave);
        if (perfil) {
          if (perfil.user_id === usuarioLogado.id) { alert('Você não pode desativar a própria conta.'); return; }
          if (!confirm(`Desativar o acesso de "${perfil.email}"?`)) return;
          const { error } = await supabaseClient.from('perfis_usuarios').update({ ativo:false, atualizado_em:new Date().toISOString() }).eq('user_id', perfil.user_id);
          if (error) throw error;
          registrarLog(`desativou o usuário ${perfil.email}`);
        } else if (convite) {
          if (!confirm(`Cancelar o convite de "${convite.email}"?`)) return;
          const { error } = await supabaseClient.from('convites_usuarios').delete().eq('email', convite.email);
          if (error) throw error;
          registrarLog(`cancelou o convite de ${convite.email}`);
        }
        await renderizarUsuarios();
      } catch (erro) { alert('Não foi possível alterar o usuário.\n\n' + erro.message); }
    }

    async function salvarUsuario() {
      const email = document.getElementById('uUsuario').value.trim().toLowerCase();
      const perfil = document.getElementById('uPerfil').value;
      if (!email || !email.includes('@')) { alert('Informe um e-mail válido.'); return; }

      const permissoes = {};
      RECURSOS.forEach(r => {
        const cb = document.getElementById('perm' + r.charAt(0).toUpperCase() + r.slice(1));
        permissoes[r] = !!(cb && cb.checked);
      });

      try {
        if (linhaEdicaoUsuario?.tipo === 'perfil') {
          const { error } = await supabaseClient.from('perfis_usuarios')
            .update({ perfil, permissoes, ativo:true, atualizado_em:new Date().toISOString() })
            .eq('user_id', linhaEdicaoUsuario.chave);
          if (error) throw error;
          registrarLog(`atualizou permissões do usuário ${email}`);
        } else if (linhaEdicaoUsuario?.tipo === 'convite') {
          const { error } = await supabaseClient.from('convites_usuarios')
            .update({ perfil, permissoes, ativo:true })
            .eq('email', linhaEdicaoUsuario.chave);
          if (error) throw error;
          registrarLog(`atualizou convite de ${email}`);
        } else {
          const { perfis, convites } = await buscarUsuariosNuvem();
          if (perfis.some(u => u.email.toLowerCase() === email) || convites.some(u => u.email.toLowerCase() === email)) {
            alert('Este e-mail já possui conta ou convite.'); return;
          }
          const { error } = await supabaseClient.from('convites_usuarios').insert({
            email, nome: email.split('@')[0], perfil, permissoes, ativo:true, criado_por: usuarioLogado.id
          });
          if (error) throw error;
          registrarLog(`convidou o usuário ${email}`);
          alert('Convite criado. Agora essa pessoa deve usar este e-mail na tela de login, clicar em "Criar primeira conta na nuvem", definir a própria senha e confirmar o e-mail.');
        }
        fecharModais();
        await renderizarUsuarios();
      } catch (erro) { alert('Não foi possível salvar o usuário.\n\n' + erro.message); }
    }

    async function renderizarUsuarios() {
      const tbody = document.querySelector('#tabelaUsuarios tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (!usuarioLogado || !usuarioLogado.permissoes?.usuarios) return;

      const rotulos = { dashboard: 'Dashboard', clientes: 'Clientes', novoChamado: 'Novo Chamado', novoCliente: 'Novo Cliente', novoTecnico: 'Novo Técnico', usuarios: 'Usuários', crm:'Sistema Comercial', os:'Ordens de serviço', osVisualizar:'OS: visualizar', osCriar:'OS: criar', osEditar:'OS: editar', osExcluir:'OS: excluir próprias', financeiro:'Financeiro', financeiroVisualizar:'Financeiro: visualizar', financeiroCriar:'Financeiro: criar/editar', financeiroBaixar:'Financeiro: dar baixa', financeiroExcluir:'Financeiro: excluir', financeiroRelatorios:'Financeiro: relatórios', enviarEmail:'Enviar dossiês', backup:'Backup', whatsapp:'WhatsApp', relatorios: 'Relatórios', configuracoes:'Configurações' };
      try {
        const { perfis, convites } = await buscarUsuariosNuvem();
        const itens = [
          ...perfis.map(u => ({...u, tipo:'perfil'})),
          ...convites.map(u => ({...u, tipo:'convite'}))
        ];

        itens.forEach(u => {
          const tr = document.createElement('tr');
          if (u.tipo === 'perfil' && !u.ativo) tr.style.opacity = '.55';

          const tdUsuario = document.createElement('td');
          const nomeUsuario = document.createElement('strong');
          nomeUsuario.textContent = u.nome || u.email.split('@')[0];
          const emailUsuario = document.createElement('small');
          emailUsuario.style.color = 'var(--text-muted)';
          emailUsuario.textContent = `${u.email}${u.tipo==='convite'?' · convite pendente':(!u.ativo?' · desativado':'')}`;
          tdUsuario.append(nomeUsuario, document.createElement('br'), emailUsuario);
          const tdPerfil = document.createElement('td');
          const badgePerfil = document.createElement('span');
          badgePerfil.className = 'badge badge-role' + (u.perfil === 'admin' ? ' admin' : '');
          badgePerfil.textContent = u.perfil === 'admin' ? 'Administrador' : (u.perfil === 'tecnico' ? 'Técnico' : 'Personalizado');
          tdPerfil.appendChild(badgePerfil);

          const tdRecursos = document.createElement('td');
          tdRecursos.textContent = RECURSOS.filter(r => u.permissoes && u.permissoes[r]).map(r => rotulos[r]).join(', ') || 'Nenhum';
          tdRecursos.style.color = '#94a3b8'; tdRecursos.style.fontSize = '0.82rem';

          const tdAcoes = document.createElement('td'); tdAcoes.className = 'actions-cell';
          const chave = u.tipo === 'perfil' ? u.user_id : u.email;
          const btnEditar = document.createElement('button'); btnEditar.title = 'Editar'; definirIcone(btnEditar, 'pencil'); btnEditar.onclick = () => editarUsuario(chave);
          const btnExcluir = document.createElement('button'); btnExcluir.title = u.tipo === 'perfil' ? 'Desativar' : 'Cancelar convite'; definirIcone(btnExcluir, 'trash-2'); btnExcluir.onclick = () => excluirUsuario(chave);
          tdAcoes.append(btnEditar, btnExcluir);
          tr.append(tdUsuario, tdPerfil, tdRecursos, tdAcoes);
          tbody.appendChild(tr);
        });
      } catch (erro) {
        console.error('Erro ao carregar usuários:', erro);
        tbody.innerHTML = '';
        const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent=`Não foi possível carregar usuários: ${erro.message}`;tr.appendChild(td);tbody.appendChild(tr);
      } finally {
        finalizarInterfaceDinamica();
      }
    }

    function alternarRevelarObs() {
      document.getElementById('wrapObsTecnicas').classList.toggle('revelado');
    }

    // ---- Backup real dos dados de negócio do Supabase ----
    const TABELAS_BACKUP = ['clientes','tecnicos','chamados','leads','lead_interacoes','chamado_interacoes','respostas_modelo','base_conhecimento','processos_internos','processo_execucoes','equipamentos','ordens_servico','os_itens','contratos','contrato_parcelas','contrato_documentos','contrato_anexos','contrato_historico','contrato_modelos','configuracoes_empresa','financeiro_lancamentos','financeiro_fornecedores','financeiro_recorrencias','financeiro_pagamentos','financeiro_anexos','financeiro_caixas','financeiro_caixa_movimentos','financeiro_contas','financeiro_transferencias','financeiro_ofx_importacoes','financeiro_ofx_movimentos','avisos_internos','chamado_tempos'];
    TABELAS_BACKUP.splice(TABELAS_BACKUP.indexOf('processo_execucoes'),0,'processo_responsaveis','processo_checklist_itens','processo_checklist_historico');
    function podeGerenciarBackup(){return usuarioLogado?.perfil==='admin'||usuarioLogado?.permissoes?.backup===true}
    async function exportarBackup() {
      if(!podeGerenciarBackup())return alert('Somente administradores autorizados podem exportar o backup.');
      const botao=typeof event!=='undefined'?event.currentTarget:null; if(botao)botao.disabled=true;
      try{
        const tabelas={};
        for(const tabela of TABELAS_BACKUP){const{data,error}=await supabaseClient.from(tabela).select('*').range(0,9999);if(error)throw new Error(`${tabela}: ${error.message}`);tabelas[tabela]=data||[]}
        const dados={formato:'help-crm-backup',versao:2,projeto:'cdsdgijxsslmyhnqapiu',exportado_em:new Date().toISOString(),tabelas,configuracoes:{valor_hora:localStorage.getItem('help_crm_valor_hora'),sla_critico:localStorage.getItem('help_crm_sla_critico'),sla_normal:localStorage.getItem('help_crm_sla_normal'),lembrete_horas:localStorage.getItem('help_crm_lembrete_horas'),nome_empresa:localStorage.getItem('help_crm_nome_empresa')}};
        const blob=new Blob([JSON.stringify(dados,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`backup-help-crm-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);
        await supabaseClient.from('auditoria_crm').insert({usuario_id:usuarioLogado.id,acao:'backup_exportado',detalhes:{versao:2,tabelas:TABELAS_BACKUP.length}});
        registrarLog('exportou um backup real dos dados do Supabase');
        alert('Backup concluído. O arquivo foi salvo na pasta Downloads.');
      }catch(err){alert('Não foi possível exportar o backup da nuvem.\n\n'+err.message)}finally{if(botao)botao.disabled=false}
    }

    function proximoProtocolo() {
      let seq = parseInt(localStorage.getItem('help_crm_protocolo_seq') || '5', 10);
      seq += 1;
      localStorage.setItem('help_crm_protocolo_seq', String(seq));
      return seq;
    }

    async function salvarNovoChamadoComProtocolo(dados) {
      const ano = new Date().getFullYear();
      const prefixo = `HELP-${ano}-`;
      const { data: ultimo, error: consultaError } = await supabaseClient
        .from('chamados').select('protocolo').like('protocolo', `${prefixo}%`)
        .order('protocolo', { ascending: false }).limit(1).maybeSingle();
      if (consultaError) throw consultaError;
      const numeroBanco = parseInt(String(ultimo?.protocolo || '').split('-').pop(), 10) || 0;
      const numeroLocal = parseInt(localStorage.getItem('help_crm_protocolo_seq') || '0', 10) || 0;
      let numero = Math.max(numeroBanco, numeroLocal) + 1;
      for (let tentativa = 0; tentativa < 8; tentativa++, numero++) {
        const protocolo = `${prefixo}${String(numero).padStart(4, '0')}`;
        try {
          const chamado = await salvarChamadoNaNuvem({ ...dados, protocolo });
          localStorage.setItem('help_crm_protocolo_seq', String(numero));
          return { chamado, protocolo };
        } catch (erro) {
          if (erro?.code !== '23505' && !String(erro?.message || '').includes('chamados_protocolo_key')) throw erro;
        }
      }
      throw new Error('Não foi possível gerar um protocolo livre após várias tentativas.');
    }

    // ---- Persistência: chamados na nuvem; cadastros auxiliares ainda locais nesta etapa ----
    function salvarEstado() {
      // Chamados, clientes e técnicos já são persistidos no Supabase.
      // Mantemos esta função por compatibilidade com partes antigas do sistema.
    }

    async function carregarEstado() {
      try {
        await Promise.all([
          carregarChamadosDaNuvem(),
          carregarClientesDaNuvem(),
          carregarTecnicosDaNuvem(),
          carregarCrmDaNuvem()
        ]);
        renderizarUsuarios();
        renderizarLog();
        await carregarProcessos(true);
        await iniciarProcessosTempoReal();
        await carregarDashboardPersonalizado();
        await iniciarNotificacoesTempoReal();
      } catch (e) {
        console.error('Não foi possível carregar os dados:', e);
        throw e;
      }
    }

    function trocarAba(aba) {
      const mapa = {
        dashboard: 'Dashboard',
        meuTrabalho: 'MeuTrabalho',
        kanban: 'Kanban',
        crm: 'CRM',
        gestaoCrm: 'GestaoCrm',
        cadastro: 'Cadastro',
        processos: 'Processos',
        contratos: 'Contratos',
        os: 'OrdensServico',
        financeiro: 'Financeiro',
        relatorios: 'Relatorios',
        configuracoes: 'Configuracoes'
      };

      const destino = mapa[aba] || 'Dashboard';

      Object.entries(mapa).forEach(([chave, nome]) => {
        const visao = document.getElementById('visao' + nome);
        const menu = document.getElementById('menu' + nome);
        if (visao) visao.classList.toggle('hidden', chave !== aba);
        if (menu) menu.classList.toggle('active', chave === aba);
      });

      try {
        if (aba === 'crm' && typeof renderizarCRM === 'function') renderizarCRM();
        if (aba === 'gestaoCrm' && typeof gcAtualizar === 'function') gcAtualizar();
        if (aba === 'cadastro') {
          if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
          if (typeof renderizarTecnicos === 'function') renderizarTecnicos();
          if (typeof trocarSubCadastro === 'function') trocarSubCadastro('clientes');
        }
        if (aba === 'relatorios' && typeof atualizarRelatorios === 'function') atualizarRelatorios();
        if (aba === 'processos' && typeof carregarProcessos === 'function') carregarProcessos();
        if (aba === 'contratos' && typeof carregarContratos === 'function') carregarContratos();
        if (aba === 'os' && typeof renderizarOrdensServico === 'function') renderizarOrdensServico();
        if (aba === 'financeiro' && typeof renderizarFinanceiro === 'function') renderizarFinanceiro();
        if (aba === 'configuracoes' && typeof carregarConfiguracoes === 'function') carregarConfiguracoes();
        if (aba === 'dashboard' && dashboardCarregado) renderizarDashboardPersonalizado();
        if (aba === 'meuTrabalho') renderizarMeuTrabalho();
        if (aba === 'kanban') renderizarKanban();
      } catch (erro) {
        console.error('Erro ao carregar a tela:', aba, erro);
      }
    }

    function trocarSubCadastro(aba) {
      ['clientes','catalogo','equipamentos','tecnicos','usuarios'].forEach(nome => {
        document.getElementById('cadastro' + nome.charAt(0).toUpperCase() + nome.slice(1)).classList.toggle('hidden', nome !== aba);
        document.getElementById('tabCadastro' + nome.charAt(0).toUpperCase() + nome.slice(1)).classList.toggle('active', nome === aba);
      });
      if (aba === 'usuarios') { renderizarUsuarios(); renderizarLog(); }
      if (aba === 'tecnicos') renderizarTecnicos();
      if (aba === 'catalogo' && typeof cadRenderCatalogo === 'function') cadRenderCatalogo();
      if (aba === 'equipamentos' && typeof cadRenderEquipamentos === 'function') cadRenderEquipamentos();
    }

    function alternarSidebar() {
      const app = document.getElementById('appContainer');
      app.classList.toggle('sidebar-collapsed');
      localStorage.setItem('help_crm_sidebar_recolhida', app.classList.contains('sidebar-collapsed') ? '1' : '0');
    }

    function renderizarTecnicos() {
      const tbody = document.querySelector('#tabelaTecnicos tbody');
      if (!tbody) return;
      const nomes = [...new Set([...document.querySelectorAll('#mTecnico option')].map(o => o.value).filter(Boolean))];
      tbody.innerHTML = '';
      nomes.forEach(nome=>{const tr=document.createElement('tr'),tdNome=document.createElement('td'),tdAcoes=document.createElement('td'),botao=document.createElement('button');tdNome.textContent=nome;tdAcoes.className='actions-cell';botao.type='button';botao.title='Excluir técnico';definirIcone(botao,'trash-2');botao.addEventListener('click',()=>excluirTecnico(nome));tdAcoes.appendChild(botao);tr.append(tdNome,tdAcoes);tbody.appendChild(tr)});
      finalizarInterfaceDinamica();
    }

    async function excluirTecnico(nome) {
      const options = [...document.querySelectorAll('#mTecnico option')];
      if (options.length <= 1) { alert('Mantenha pelo menos um técnico cadastrado.'); return; }
      if (!confirm(`Excluir o técnico ${nome}?`)) return;
      const { error } = await supabaseClient.from('tecnicos').delete().eq('nome', nome);
      if (error) { alert('Não foi possível excluir o técnico da nuvem.\n\n' + error.message); return; }
      await carregarTecnicosDaNuvem();
      registrarLog(`removeu o técnico ${nome}`);
    }

    function carregarConfiguracoes() {
      document.getElementById('cfgValorHora').value = localStorage.getItem('help_crm_valor_hora') || '80';
      document.getElementById('cfgSlaCritico').value = localStorage.getItem('help_crm_sla_critico') || '2';
      document.getElementById('cfgSlaNormal').value = localStorage.getItem('help_crm_sla_normal') || '24';
      document.getElementById('cfgLembreteHoras').value = localStorage.getItem('help_crm_lembrete_horas') || '4';
      document.getElementById('cfgNomeEmpresa').value = localStorage.getItem('help_crm_nome_empresa') || 'Help Soluções Tecnológicas';
      document.getElementById('cfgPix').value = localStorage.getItem('help_crm_pix') || '';
      carregarFerramentasAtendimento();
    }

    function salvarConfiguracoes() {
      const hora = document.getElementById('cfgValorHora').value || '80';
      const sla = document.getElementById('cfgSlaCritico').value || '2';
      const slaNormal = document.getElementById('cfgSlaNormal').value || '24';
      const lembrete = document.getElementById('cfgLembreteHoras').value || '4';
      const nome = document.getElementById('cfgNomeEmpresa').value.trim() || 'Help Soluções Tecnológicas';
      const pix = document.getElementById('cfgPix').value.trim();
      localStorage.setItem('help_crm_valor_hora', hora);
      localStorage.setItem('help_crm_sla_critico', sla);
      localStorage.setItem('help_crm_sla_normal', slaNormal);
      localStorage.setItem('help_crm_lembrete_horas', lembrete);
      localStorage.setItem('help_crm_nome_empresa', nome);
      localStorage.setItem('help_crm_pix', pix);
      document.getElementById('relatorioValorHora').value = hora;
      marcarChamadosCriticos();
      alert('Configurações salvas com sucesso!');
    }

    async function carregarFerramentasAtendimento() {
      if (!usuarioLogado) return;
      const [modelos, conhecimento] = await Promise.all([
        supabaseClient.from('respostas_modelo').select('*').eq('ativo', true).order('categoria').order('titulo'),
        supabaseClient.from('base_conhecimento').select('*').eq('ativo', true).order('categoria').order('titulo')
      ]);
      if (!modelos.error) respostasModeloCache = modelos.data || [];
      if (!conhecimento.error) conhecimentoCache = conhecimento.data || [];
      preencherRespostasModelo(); renderizarRespostasModelo(); renderizarConhecimento();
    }

    function preencherRespostasModelo() {
      const select = document.getElementById('interacaoModelo'); if (!select) return;
      select.innerHTML = '<option value="">Usar resposta pronta...</option>';
      respostasModeloCache.forEach(m => { const o=document.createElement('option');o.value=m.id;o.textContent=`${m.categoria} · ${m.titulo}`;select.appendChild(o); });
    }
    function aplicarRespostaModelo() { const m=respostasModeloCache.find(x=>x.id===document.getElementById('interacaoModelo')?.value); if(m) document.getElementById('interacaoDescricao').value=m.conteudo; }
    function criarAcoesFerramenta(item, excluirFn) { const a=document.createElement('div');a.className='crm-tool-actions';if(item.criado_por===usuarioLogado?.id||usuarioLogado?.perfil==='admin'){const b=document.createElement('button');b.type='button';b.title='Excluir';b.innerHTML='<i data-lucide="trash-2"></i>';b.onclick=()=>excluirFn(item);a.appendChild(b)}return a }
    function mostrarStatusFerramenta(id,texto,tipo='success'){const el=document.getElementById(id);if(!el)return;el.textContent=texto;el.className=`crm-tool-status ${tipo}`;clearTimeout(el._timer);el._timer=setTimeout(()=>el.className='crm-tool-status hidden',4000)}
    function limparBuscaRespostas(){const el=document.getElementById('buscaRespostasModelo');if(el){el.value='';renderizarRespostasModelo();el.focus()}}
    function limparBuscaConhecimento(){const el=document.getElementById('buscaConhecimento');if(el){el.value='';renderizarConhecimento();el.focus()}}
    function renderizarRespostasModelo() { const el=document.getElementById('listaRespostasModelo');if(!el)return;const q=(document.getElementById('buscaRespostasModelo')?.value||'').trim().toLowerCase();const lista=respostasModeloCache.filter(x=>`${x.titulo} ${x.categoria} ${x.conteudo}`.toLowerCase().includes(q));el.innerHTML='';if(!lista.length){el.innerHTML=`<div class="crm-tool-empty">${q?'Nenhuma resposta corresponde à pesquisa.':'Nenhuma resposta pronta cadastrada.'}</div>`;return}lista.forEach(m=>{const c=document.createElement('article');c.className='crm-tool-item';const d=document.createElement('div');const t=document.createElement('strong');t.textContent=m.titulo;const s=document.createElement('small');s.textContent=m.categoria;const p=document.createElement('p');p.textContent=m.conteudo;d.append(t,s,p);c.append(d,criarAcoesFerramenta(m,excluirRespostaModelo));el.appendChild(c)});renderizarIcones() }
    async function salvarRespostaModelo(){const tituloEl=document.getElementById('modeloTitulo'),conteudoEl=document.getElementById('modeloConteudo'),botao=document.getElementById('btnSalvarModelo'),titulo=tituloEl.value.trim(),categoria=document.getElementById('modeloCategoria').value.trim()||'Geral',conteudo=conteudoEl.value.trim();if(!titulo){mostrarStatusFerramenta('statusRespostasModelo','Informe um título para a resposta.','error');tituloEl.focus();return}if(!conteudo){mostrarStatusFerramenta('statusRespostasModelo','Digite o texto da resposta.','error');conteudoEl.focus();return}botao.disabled=true;botao.textContent='Salvando...';const{error}=await supabaseClient.from('respostas_modelo').insert({titulo,categoria,conteudo,criado_por:usuarioLogado.id});botao.disabled=false;botao.innerHTML='<i data-lucide="plus"></i>Salvar resposta';renderizarIcones();if(error){mostrarStatusFerramenta('statusRespostasModelo','Não foi possível salvar: '+error.message,'error');return}tituloEl.value='';conteudoEl.value='';document.getElementById('modeloContador').textContent='0';const busca=document.getElementById('buscaRespostasModelo');if(busca)busca.value='';await carregarFerramentasAtendimento();mostrarStatusFerramenta('statusRespostasModelo','Resposta pronta salva com sucesso.')}
    async function excluirRespostaModelo(m){if(!confirm(`Excluir a resposta "${m.titulo}"?`))return;const{error}=await supabaseClient.from('respostas_modelo').delete().eq('id',m.id);if(error)alert(error.message);else await carregarFerramentasAtendimento()}
    function renderizarConhecimento(){const el=document.getElementById('listaConhecimento');if(!el)return;const q=(document.getElementById('buscaConhecimento')?.value||'').trim().toLowerCase();const lista=conhecimentoCache.filter(x=>`${x.titulo} ${x.categoria} ${x.problema} ${x.solucao} ${x.palavras_chave}`.toLowerCase().includes(q));el.innerHTML='';if(!lista.length){el.innerHTML=`<div class="crm-tool-empty">${q?'Nenhuma solução corresponde à pesquisa. Limpe o campo para ver todas.':'Nenhuma solução cadastrada ainda.'}</div>`;return}lista.forEach(m=>{const c=document.createElement('article');c.className='crm-tool-item';const d=document.createElement('div');const t=document.createElement('strong');t.textContent=m.titulo;const s=document.createElement('small');s.textContent=`${m.categoria}${m.palavras_chave?' · '+m.palavras_chave:''}`;const p=document.createElement('p');p.textContent=`Problema: ${m.problema}\n\nSolução: ${m.solucao}`;d.append(t,s,p);c.append(d,criarAcoesFerramenta(m,excluirConhecimento));el.appendChild(c)});renderizarIcones()}
    async function salvarConhecimento(){const ids=['conhecimentoTitulo','conhecimentoProblema','conhecimentoSolucao'],valores=ids.map(id=>document.getElementById(id).value.trim());if(!valores[0]||!valores[1]||!valores[2]){mostrarStatusFerramenta('statusConhecimento','Preencha título, problema e solução — os campos marcados com * são obrigatórios.','error');document.getElementById(ids[valores.findIndex(v=>!v)]).focus();return}const botao=document.getElementById('btnSalvarConhecimento');botao.disabled=true;botao.textContent='Salvando...';const dados={titulo:valores[0],categoria:document.getElementById('conhecimentoCategoria').value.trim()||'Geral',palavras_chave:document.getElementById('conhecimentoPalavras').value.trim(),problema:valores[1],solucao:valores[2],criado_por:usuarioLogado.id};const{error}=await supabaseClient.from('base_conhecimento').insert(dados);botao.disabled=false;botao.innerHTML='<i data-lucide="plus"></i>Salvar solução';renderizarIcones();if(error){mostrarStatusFerramenta('statusConhecimento','Não foi possível salvar: '+error.message,'error');return}['conhecimentoTitulo','conhecimentoPalavras','conhecimentoProblema','conhecimentoSolucao'].forEach(id=>document.getElementById(id).value='');const busca=document.getElementById('buscaConhecimento');if(busca)busca.value='';await carregarFerramentasAtendimento();mostrarStatusFerramenta('statusConhecimento','Solução adicionada à base de conhecimento.')}
    async function excluirConhecimento(m){if(!confirm(`Excluir "${m.titulo}" da base?`))return;const{error}=await supabaseClient.from('base_conhecimento').delete().eq('id',m.id);if(error)alert(error.message);else await carregarFerramentasAtendimento()}

    function atualizarDatalistClientes() {
      const datalist = document.getElementById('listaClientesSugestao');
      datalist.innerHTML = '';
      
      const linhasClientes = document.querySelectorAll('#tabelaClientes tbody tr');
      const nomes = new Set();

      linhasClientes.forEach(tr => {
        const nome = tr.querySelectorAll('td')[0].innerText;
        nomes.add(nome);
      });

      nomes.forEach(nome => {
        const option = document.createElement('option');
        option.value = nome;
        datalist.appendChild(option);
      });
    }

    function autocompletarCliente(valorDigitado) {
      const linhasClientes = document.querySelectorAll('#tabelaClientes tbody tr');
      for (let tr of linhasClientes) {
        const td = tr.querySelectorAll('td');
        const nome = td[0].innerText;
        const unidade = td[1].innerText;
        const serial = tr.getAttribute('data-ie') || '';

        if (nome.toLowerCase() === valorDigitado.toLowerCase()) {
          document.getElementById('mUnidade').value = unidade;
          document.getElementById('mSerial').value = serial;
          break;
        }
      }
    }

    function abrirModalChamado() {
      linhaEdicaoChamado = null;
      document.getElementById('btnGerarOSChamado')?.classList.add('hidden');
      atualizarDatalistClientes();
      document.getElementById('modalChamadoTitulo').innerText = "Abrir Novo Chamado";
      
      document.getElementById('mCliente').value = '';
      document.getElementById('mUnidade').value = '';
      document.getElementById('mOrigem').value = 'Automação / PDV';
      document.getElementById('mSerial').value = '';
      document.getElementById('mSolicitante').value = '';
      document.getElementById('mModulo').value = '';
      document.getElementById('mTipo').value = 'Remoto';
      document.getElementById('mPrioridade').value = 'Normal';
      document.getElementById('mStatus').value = 'Pendente';
      document.getElementById('mErro').value = '';
      document.getElementById('mResolucao').value = '';
      document.getElementById('mContatoConfirmado').checked = false;
      document.getElementById('controleAtendimento').classList.add('hidden');
      atualizarChecklistEncerramento();
      document.getElementById('infoDatasChamado').classList.add('hidden');
      document.getElementById('infoDatasChamado').innerHTML = '';
      document.getElementById('areaInteracoesChamado').classList.add('hidden');
      limparFormularioInteracao();

      document.getElementById('modalChamado').classList.add('active');
    }

    function somenteDigitos(valor) {
      return String(valor || '').replace(/\D/g, '');
    }

    function formatarCpfCnpj(valor, tipo) {
      const limite = tipo === 'fisica' ? 11 : 14;
      const numeros = somenteDigitos(valor).slice(0, limite);
      if (tipo === 'fisica') {
        return numeros
          .replace(/^(\d{3})(\d)/, '$1.$2')
          .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
          .replace(/\.(\d{3})(\d)/, '.$1-$2');
      }
      return numeros
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }

    function cnpjValido(cnpj) {
      const numeros = somenteDigitos(cnpj);
      if (numeros.length !== 14 || /^(\d)\1{13}$/.test(numeros)) return false;
      const calcular = tamanho => {
        let soma = 0;
        let peso = tamanho - 7;
        for (let i = 0; i < tamanho; i += 1) {
          soma += Number(numeros[i]) * peso--;
          if (peso < 2) peso = 9;
        }
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
      };
      return calcular(12) === Number(numeros[12]) && calcular(13) === Number(numeros[13]);
    }

    function mostrarStatusConsultaCnpj(mensagem = '', tipo = '') {
      const status = document.getElementById('cCnpjStatus');
      if (!status) return;
      status.textContent = mensagem;
      status.className = `consulta-cnpj-status${tipo ? ` ${tipo}` : ''}${mensagem ? '' : ' hidden'}`;
    }

    function atualizarTipoPessoaCliente() {
      const tipo = document.getElementById('cTipoPessoa')?.value || 'juridica';
      const documento = document.getElementById('cDocumento');
      const botao = document.getElementById('btnConsultarCnpj');
      document.getElementById('cDocumentoLabel').textContent = tipo === 'fisica' ? 'CPF' : 'CNPJ';
      documento.placeholder = tipo === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00';
      documento.value = formatarCpfCnpj(documento.value, tipo);
      botao.classList.toggle('hidden', tipo === 'fisica');
      mostrarStatusConsultaCnpj();
      renderizarIcones();
    }

    function formatarDocumentoCliente() {
      const tipo = document.getElementById('cTipoPessoa')?.value || 'juridica';
      const documento = document.getElementById('cDocumento');
      documento.value = formatarCpfCnpj(documento.value, tipo);
      mostrarStatusConsultaCnpj();
    }

    async function localizarClientePorDocumento(documento) {
      const procurado = somenteDigitos(documento);
      if (!procurado) return null;
      const { data, error } = await supabaseClient.from('clientes').select('id,nome,unidade,documento');
      if (error) throw error;
      return (data || []).find(cliente => somenteDigitos(cliente.documento) === procurado) || null;
    }

    function montarEnderecoCnpj(empresa) {
      const logradouro = [empresa.descricao_tipo_de_logradouro, empresa.logradouro]
        .map(parte => String(parte || '').trim())
        .filter(Boolean)
        .join(' ');
      return [logradouro, empresa.numero, empresa.complemento, empresa.bairro]
        .map(parte => String(parte || '').trim())
        .filter(Boolean)
        .join(', ');
    }

    function formatarTelefoneCnpj(telefone) {
      const numeros = somenteDigitos(telefone).slice(0, 11);
      if (numeros.length === 11) return numeros.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
      if (numeros.length === 10) return numeros.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
      return telefone || '';
    }

    async function consultarCnpjCliente() {
      const documento = document.getElementById('cDocumento');
      const botao = document.getElementById('btnConsultarCnpj');
      const cnpj = somenteDigitos(documento.value);
      if (!cnpjValido(cnpj)) {
        mostrarStatusConsultaCnpj('Informe um CNPJ válido com 14 números.', 'erro');
        documento.focus();
        return;
      }

      botao.disabled = true;
      botao.innerHTML = '<span class="consulta-cnpj-spinner"></span><span>Consultando...</span>';
      mostrarStatusConsultaCnpj('Consultando os dados públicos da empresa...', 'carregando');

      try {
        const existente = await localizarClientePorDocumento(cnpj);
        const idEdicao = Number(linhaEdicaoCliente?.dataset.idNuvem || 0);
        if (existente && existente.id !== idEdicao) {
          mostrarStatusConsultaCnpj(`Este CNPJ já está cadastrado para ${existente.nome}${existente.unidade ? ` — ${existente.unidade}` : ''}.`, 'aviso');
          return;
        }

        const controle = new AbortController();
        const limite = setTimeout(() => controle.abort(), 12000);
        let resposta;
        try {
          resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: controle.signal });
        } finally {
          clearTimeout(limite);
        }
        const empresa = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(empresa.message || 'CNPJ não encontrado na base consultada.');

        document.getElementById('cNome').value = empresa.razao_social || empresa.nome_fantasia || '';
        document.getElementById('cEndereco').value = montarEnderecoCnpj(empresa);
        document.getElementById('cCidade').value = empresa.municipio || '';
        document.getElementById('cUf').value = String(empresa.uf || '').toUpperCase();
        document.getElementById('cCep').value = String(empresa.cep || '').replace(/^(\d{5})(\d{3})$/, '$1-$2');
        if (empresa.ddd_telefone_1) document.getElementById('cTelefone').value = formatarTelefoneCnpj(empresa.ddd_telefone_1);
        if (empresa.email) document.getElementById('cEmail').value = String(empresa.email).toLowerCase();
        if (empresa.opcao_pelo_mei) document.getElementById('cRegime').value = 'MEI';
        else if (empresa.opcao_pelo_simples) document.getElementById('cRegime').value = 'Simples Nacional';

        const situacao = empresa.descricao_situacao_cadastral || 'Situação não informada';
        const fantasia = empresa.nome_fantasia ? ` · Fantasia: ${empresa.nome_fantasia}` : '';
        mostrarStatusConsultaCnpj(`Dados encontrados · ${situacao}${fantasia}`, situacao.toUpperCase() === 'ATIVA' ? 'sucesso' : 'aviso');
        registrarLog(`consultou o CNPJ ${formatarCpfCnpj(cnpj, 'juridica')}`);
      } catch (erro) {
        const mensagem = erro.name === 'AbortError'
          ? 'A consulta demorou demais. Tente novamente ou preencha manualmente.'
          : `Não foi possível consultar o CNPJ: ${erro.message}`;
        mostrarStatusConsultaCnpj(mensagem, 'erro');
      } finally {
        botao.disabled = false;
        botao.innerHTML = '<i data-lucide="search"></i><span>Buscar CNPJ</span>';
        renderizarIcones();
      }
    }

    function abrirModalCliente() {
      linhaEdicaoCliente = null;
      document.getElementById('modalClienteTitulo').innerText = "Cadastrar Novo Cliente";
      document.getElementById('cNome').value = '';
      document.getElementById('cTipoPessoa').value = 'juridica';
      document.getElementById('cUnidade').value = '';
      document.getElementById('cDocumento').value = '';
      document.getElementById('cIe').value = '';
      document.getElementById('cRegime').value = 'Simples Nacional';
      document.getElementById('cTelefone').value = '';
      document.getElementById('cEmail').value = '';
      document.getElementById('cEndereco').value = '';
      document.getElementById('cCidade').value = '';
      document.getElementById('cUf').value = 'MS';
      document.getElementById('cCep').value = '';
      document.getElementById('cRepresentante').value = '';
      document.getElementById('cRepresentanteCpf').value = '';
      document.getElementById('cObsTecnicas').value = '';
      document.getElementById('cEhFornecedor').checked = false;
      document.getElementById('cEhFornecedor').dataset.existente = 'false';
      document.getElementById('cFornecedorCategoria').value = '';
      document.getElementById('cFornecedorObs').value = '';
      document.getElementById('cFornecedorCampos').classList.add('hidden');
      atualizarTipoPessoaCliente();
      document.getElementById('modalCliente').classList.add('active');
    }

    function abrirModalTecnico() {
      document.getElementById('tNome').value = '';
      document.getElementById('modalTecnico').classList.add('active');
    }

    function fecharModais() {
      document.querySelectorAll('.modal-overlay').forEach(modal => modal.classList.remove('active'));
    }

    function formatarDataHoraAtual() {
      const agora = new Date();
      const data = agora.toLocaleDateString('pt-BR');
      const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `${data} ${hora}`;
    }

    async function salvarChamado() {
      const cliente = document.getElementById('mCliente').value || 'Não informado';
      const unidade = document.getElementById('mUnidade').value || '-';
      const origem = document.getElementById('mOrigem').value;
      const serial = document.getElementById('mSerial').value || '-';
      const solicitante = document.getElementById('mSolicitante').value || '-';
      const tecnico = document.getElementById('mTecnico').value;
      const modulo = document.getElementById('mModulo').value || '-';
      const tipo = document.getElementById('mTipo').value;
      const prioridade = document.getElementById('mPrioridade').value;
      const status = document.getElementById('mStatus').value;
      const erro = document.getElementById('mErro').value || '';
      const resolucao = document.getElementById('mResolucao').value || '';
      const contatoConfirmado = document.getElementById('mContatoConfirmado')?.checked || false;

      if (status === 'Resolvido' && !linhaEdicaoChamado) {
        alert('Salve o chamado primeiro para registrar o atendimento e depois conclua pelo checklist.');
        return;
      }

      if (status === 'Resolvido' && linhaEdicaoChamado) {
        const tempoTotal = Number(linhaEdicaoChamado.dataset.tempoMinutos || 0);
        if (!resolucao.trim() || !contatoConfirmado || tempoTotal < 1) {
          document.getElementById('checklistEncerramento')?.classList.remove('hidden');
          atualizarChecklistEncerramento();
          alert('Para resolver o chamado, preencha a resolução, registre pelo menos 1 minuto de atendimento e confirme o contato com o cliente.');
          return;
        }
      }

      const badgeStatusClass = status === 'Resolvido' ? 'badge-resolvido' : (status === 'Pendente' ? 'badge-pendente' : 'badge-andamento');
      const badgePrioridadeClass = prioridade === 'Alta Prioridade' ? 'badge-alta' : 'badge-normal';
      const agoraStr = formatarDataHoraAtual();

      if (linhaEdicaoChamado) {
        const td = linhaEdicaoChamado.querySelectorAll('td');
        const protocoloAtual = td[0].innerText.trim();
        const tecnicoAnterior = td[7].innerText.trim();
        const statusAnterior = td[11].innerText.trim();
        let fechamentoISO = linhaEdicaoChamado.getAttribute('data-fechamento-iso') || null;
        if (status === 'Resolvido' && !fechamentoISO) fechamentoISO = new Date().toISOString();
        if (status !== 'Resolvido') fechamentoISO = null;

        try {
          await atualizarChamadoNaNuvem(protocoloAtual, {
            cliente, unidade, origem, serial, solicitante, tecnico, modulo, tipo,
            prioridade, status, erro, resolucao, contato_confirmado: contatoConfirmado, fechamento_em: fechamentoISO
          });
        } catch (erroSupabase) {
          console.error('Erro ao atualizar chamado no Supabase:', erroSupabase);
          alert('Não foi possível atualizar o chamado na nuvem.\n\nDetalhes: ' + erroSupabase.message);
          return;
        }

        const eventosResponsabilidade = [];
        if (tecnicoAnterior !== tecnico) eventosResponsabilidade.push(`Atendimento transferido de ${tecnicoAnterior || 'Não atribuído'} para ${tecnico}.`);
        if (statusAnterior !== 'Resolvido' && status === 'Resolvido') eventosResponsabilidade.push(`Chamado finalizado por ${usuarioLogado?.nome || usuarioLogado?.email || tecnico}. Técnico responsável no encerramento: ${tecnico}.`);
        if (statusAnterior === 'Resolvido' && status !== 'Resolvido') eventosResponsabilidade.push(`Chamado reaberto por ${usuarioLogado?.nome || usuarioLogado?.email || 'Usuário'}. Técnico responsável: ${tecnico}.`);
        try { await registrarEventosResponsabilidade(await obterIdChamadoAtual(), eventosResponsabilidade); } catch (historicoErro) { console.warn(historicoErro); }
        if (tecnicoAnterior !== tecnico) await notificarTecnicoAtribuido(tecnico, await obterIdChamadoAtual(), protocoloAtual);

        linhaEdicaoChamado.setAttribute('data-erro', erro);
        if (fechamentoISO) linhaEdicaoChamado.setAttribute('data-fechamento-iso', fechamentoISO); else linhaEdicaoChamado.removeAttribute('data-fechamento-iso');
        linhaEdicaoChamado.setAttribute('data-resolucao', resolucao);
        linhaEdicaoChamado.dataset.contatoConfirmado = contatoConfirmado ? 'true' : 'false';

        let fechamento = linhaEdicaoChamado.getAttribute('data-fechamento') || '';
        if (status === 'Resolvido' && !fechamento) {
          fechamento = agoraStr;
          linhaEdicaoChamado.setAttribute('data-fechamento', fechamento);
        } else if (status !== 'Resolvido') {
          fechamento = '';
          linhaEdicaoChamado.removeAttribute('data-fechamento');
        }

        td[2].innerText = cliente;
        td[3].innerText = unidade;
        definirBadge(td[4], 'badge-origem', origem);
        td[5].innerText = serial;
        td[6].innerText = solicitante;
        definirBadge(td[7], 'badge-tecnico', tecnico);
        td[8].innerText = modulo;
        td[9].innerText = tipo;
        definirBadge(td[10], badgePrioridadeClass, prioridade);
        definirBadge(td[11], badgeStatusClass, status);
        td[12].innerText = fechamento || '-';
        registrarLog(`editou o chamado ${td[0].innerText}`);
      } else {
        const tabela = document.getElementById('tabelaChamados').getElementsByTagName('tbody')[0];
        const novaLinha = tabela.insertRow(0);

        let protocoloStr = '';
        const aberturaStr = agoraStr;
        const fechamentoStr = status === 'Resolvido' ? agoraStr : '';

        // Primeiro salva no Supabase. Se falhar, o chamado não é criado somente localmente.
        let chamadoCriado;
        try {
          const resultadoCriacao = await salvarNovoChamadoComProtocolo({
            cliente,
            unidade,
            origem,
            serial,
            solicitante,
            tecnico,
            modulo,
            tipo,
            prioridade,
            status,
            erro,
            resolucao, contato_confirmado: contatoConfirmado,
            abertura_em: new Date().toISOString(),
            fechamento_em: status === 'Resolvido' ? new Date().toISOString() : null
          });
          chamadoCriado = resultadoCriacao.chamado;
          protocoloStr = resultadoCriacao.protocolo;
          await registrarEventosResponsabilidade(chamadoCriado.id, [`Chamado atribuído a ${tecnico} por ${usuarioLogado?.nome || usuarioLogado?.email || 'Usuário'}.`]);
          await notificarTecnicoAtribuido(tecnico, chamadoCriado.id, protocoloStr);
        } catch (erroSupabase) {
          console.error('Erro ao salvar chamado no Supabase:', erroSupabase);
          novaLinha.remove();
          alert('Não foi possível salvar o chamado na nuvem. Verifique sua conexão e tente novamente.\n\nDetalhes: ' + erroSupabase.message);
          return;
        }

        novaLinha.dataset.idNuvem = chamadoCriado.id;
        novaLinha.setAttribute('data-erro', erro);
        novaLinha.setAttribute('data-resolucao', resolucao);
        novaLinha.dataset.contatoConfirmado = contatoConfirmado ? 'true' : 'false';
        novaLinha.setAttribute('data-abertura', aberturaStr);
        novaLinha.setAttribute('data-abertura-iso', chamadoCriado.abertura_em || '');
        if (fechamentoStr) novaLinha.setAttribute('data-fechamento', fechamentoStr);
        if (chamadoCriado.fechamento_em) novaLinha.setAttribute('data-fechamento-iso', chamadoCriado.fechamento_em);

        const tdProtocolo = document.createElement('td');
        const linkProtocolo = document.createElement('a'); linkProtocolo.className = 'protocolo'; linkProtocolo.textContent = protocoloStr;
        linkProtocolo.onclick = function () { visualizarChamado(this); };
        tdProtocolo.appendChild(linkProtocolo);

        const tdAbertura = document.createElement('td'); tdAbertura.textContent = aberturaStr;
        const tdCliente = document.createElement('td'); tdCliente.textContent = cliente;
        const tdUnidade = document.createElement('td'); tdUnidade.textContent = unidade;

        const tdOrigem = document.createElement('td');
        const badgeOrigem = document.createElement('span'); badgeOrigem.className = 'badge badge-origem'; badgeOrigem.textContent = origem;
        tdOrigem.appendChild(badgeOrigem);

        const tdSerial = document.createElement('td'); tdSerial.textContent = serial;
        const tdSolicitante = document.createElement('td'); tdSolicitante.textContent = solicitante;

        const tdTecnico = document.createElement('td');
        const badgeTecnico = document.createElement('span'); badgeTecnico.className = 'badge badge-tecnico'; badgeTecnico.textContent = tecnico;
        tdTecnico.appendChild(badgeTecnico);

        const tdModulo = document.createElement('td'); tdModulo.textContent = modulo;
        const tdTipo = document.createElement('td'); tdTipo.textContent = tipo;

        const tdPrioridade = document.createElement('td');
        const badgePrioridade = document.createElement('span'); badgePrioridade.className = 'badge ' + badgePrioridadeClass; badgePrioridade.textContent = prioridade;
        tdPrioridade.appendChild(badgePrioridade);

        const tdStatus = document.createElement('td');
        const badgeStatus = document.createElement('span'); badgeStatus.className = 'badge ' + badgeStatusClass; badgeStatus.textContent = status;
        tdStatus.appendChild(badgeStatus);

        const tdFechamento = document.createElement('td'); tdFechamento.textContent = fechamentoStr || '-';

        const tdAcoes = document.createElement('td'); tdAcoes.className = 'actions-cell';
        const btnWhats = document.createElement('button'); btnWhats.title = 'Enviar WhatsApp'; definirIcone(btnWhats, 'message-circle'); btnWhats.onclick = function () { enviarWhatsappChamado(this); };
        const btnVer = document.createElement('button'); btnVer.title = 'Editar/Visualizar'; definirIcone(btnVer, 'eye'); btnVer.onclick = function () { visualizarChamado(this); };
        const btnExcluir = document.createElement('button'); btnExcluir.title = 'Excluir'; definirIcone(btnExcluir, 'trash-2'); btnExcluir.onclick = function () { excluirChamado(this); };
        tdAcoes.append(btnWhats, btnVer);
        if (usuarioLogado?.perfil === 'admin' || usuarioLogado?.permissoes?.usuarios === true) tdAcoes.append(btnExcluir);

        novaLinha.append(tdProtocolo, tdAbertura, tdCliente, tdUnidade, tdOrigem, tdSerial, tdSolicitante, tdTecnico, tdModulo, tdTipo, tdPrioridade, tdStatus, tdFechamento, tdAcoes);

        registrarLog(`abriu o chamado ${protocoloStr} para ${cliente}`);
      }

      fecharModais();
      atualizarMetricas();
      salvarEstado();
      atualizarOpcoesDossie();
      finalizarInterfaceDinamica();
    }

    function visualizarChamado(btn) {
      linhaEdicaoChamado = btn.closest('tr');
      document.getElementById('btnGerarOSChamado')?.classList.remove('hidden');
      const td = linhaEdicaoChamado.querySelectorAll('td');
      atualizarDatalistClientes();

      document.getElementById('modalChamadoTitulo').innerText = "Editar / Visualizar Chamado";
      document.getElementById('mCliente').value = td[2].innerText;
      document.getElementById('mUnidade').value = td[3].innerText;
      document.getElementById('mOrigem').value = td[4].innerText.trim();
      document.getElementById('mSerial').value = td[5].innerText;
      document.getElementById('mSolicitante').value = td[6].innerText;
      document.getElementById('mTecnico').value = td[7].innerText.trim();
      document.getElementById('mModulo').value = td[8].innerText;
      document.getElementById('mTipo').value = td[9].innerText;
      document.getElementById('mPrioridade').value = td[10].innerText.trim();
      document.getElementById('mStatus').value = td[11].innerText.trim();
      document.getElementById('mErro').value = linhaEdicaoChamado.getAttribute('data-erro') || '';
      document.getElementById('mResolucao').value = linhaEdicaoChamado.getAttribute('data-resolucao') || linhaEdicaoChamado.getAttribute('data-obs') || '';
      document.getElementById('mContatoConfirmado').checked = linhaEdicaoChamado.dataset.contatoConfirmado === 'true';

      const abertura = linhaEdicaoChamado.getAttribute('data-abertura') || td[1].innerText.trim();
      const fechamento = linhaEdicaoChamado.getAttribute('data-fechamento') || '';
      const infoDatas = document.getElementById('infoDatasChamado');
      infoDatas.innerHTML = `<span><i data-lucide="circle-dot"></i>Aberto em: <strong>${abertura || '-'}</strong></span>` +
        (fechamento ? `<span><i data-lucide="check-circle"></i>Fechado em: <strong>${fechamento}</strong></span>` : `<span><i data-lucide="clock"></i>Ainda em aberto</span>`);
      infoDatas.classList.remove('hidden');
      renderizarIcones();

      limparFormularioInteracao();
      carregarInteracoesChamado();
      atualizarControleAtendimento();
      preencherMencoesEquipe();
      atualizarChecklistEncerramento();

      document.getElementById('modalChamado').classList.add('active');
    }

    async function salvarCliente() {
      const nome = document.getElementById('cNome').value.trim();
      const unidade = document.getElementById('cUnidade').value || '-';
      const doc = document.getElementById('cDocumento').value || '-';
      const ie = document.getElementById('cIe').value || '-';
      const regime = document.getElementById('cRegime').value;
      const tel = document.getElementById('cTelefone').value || '-';
      const email = document.getElementById('cEmail').value || '-';
      const obsTecnicas = document.getElementById('cObsTecnicas').value || '';
      const endereco = document.getElementById('cEndereco').value.trim();
      const cidade = document.getElementById('cCidade').value.trim();
      const uf = document.getElementById('cUf').value.trim().toUpperCase();
      const cep = document.getElementById('cCep').value.trim();
      const representante = document.getElementById('cRepresentante').value.trim();
      const representanteCpf = document.getElementById('cRepresentanteCpf').value.trim();

      if (!nome) { alert('Informe o nome do cliente'); return; }
      const payload = { nome, unidade, documento: doc, ie, regime, telefone: tel, email, endereco, cidade, uf, cep, representante, representante_cpf: representanteCpf, observacoes_tecnicas: obsTecnicas, eh_cliente: true };

      try {
        const clienteDuplicado = await localizarClientePorDocumento(doc);
        const idEdicao = Number(linhaEdicaoCliente?.dataset.idNuvem || 0);
        if (clienteDuplicado && clienteDuplicado.id !== idEdicao) {
          alert(`Este documento já está cadastrado para ${clienteDuplicado.nome}${clienteDuplicado.unidade ? ` — ${clienteDuplicado.unidade}` : ''}.`);
          document.getElementById('cDocumento').focus();
          return;
        }
        let clienteId;
        if (linhaEdicaoCliente && linhaEdicaoCliente.dataset.idNuvem) {
          clienteId = Number(linhaEdicaoCliente.dataset.idNuvem);
          const { error } = await supabaseClient.from('clientes').update(payload).eq('id', clienteId);
          if (error) throw error;
          registrarLog(`editou o cliente ${nome}`);
        } else {
          const { data: novo, error } = await supabaseClient.from('clientes').insert(payload).select('id').single();
          if (error) throw error;
          clienteId = novo.id;
          registrarLog(`cadastrou o cliente ${nome}`);
        }
        const fornecedorCheck = document.getElementById('cEhFornecedor');
        if (fornecedorCheck.checked || fornecedorCheck.dataset.existente === 'true') {
          const { error } = await supabaseClient.rpc('definir_cliente_fornecedor', { p_cliente_id: clienteId, p_ativo: fornecedorCheck.checked, p_categoria: document.getElementById('cFornecedorCategoria').value.trim() || 'Outros', p_observacoes: document.getElementById('cFornecedorObs').value.trim() });
          if (error) throw error;
        }
        fecharModais();
        await carregarClientesDaNuvem();
      } catch (e) {
        alert('Não foi possível salvar o cliente na nuvem.\n\n' + e.message);
      }
    }

    function editarCliente(btn) {
      linhaEdicaoCliente = btn.closest('tr');
      const td = linhaEdicaoCliente.querySelectorAll('td');

      document.getElementById('modalClienteTitulo').innerText = "Editar Cliente";
      document.getElementById('cNome').value = td[0].innerText;
      document.getElementById('cUnidade').value = td[1].innerText;
      document.getElementById('cTipoPessoa').value = somenteDigitos(td[2].innerText).length === 11 ? 'fisica' : 'juridica';
      document.getElementById('cDocumento').value = td[2].innerText;
      document.getElementById('cIe').value = linhaEdicaoCliente.getAttribute('data-ie') || '';
      document.getElementById('cRegime').value = td[5].innerText;
      document.getElementById('cTelefone').value = td[3].innerText;
      document.getElementById('cEmail').value = td[4].innerText;
      document.getElementById('cObsTecnicas').value = linhaEdicaoCliente.getAttribute('data-obs') || '';
      document.getElementById('cEndereco').value = linhaEdicaoCliente.dataset.endereco || '';
      document.getElementById('cCidade').value = linhaEdicaoCliente.dataset.cidade || '';
      document.getElementById('cUf').value = linhaEdicaoCliente.dataset.uf || 'MS';
      document.getElementById('cCep').value = linhaEdicaoCliente.dataset.cep || '';
      document.getElementById('cRepresentante').value = linhaEdicaoCliente.dataset.representante || '';
      document.getElementById('cRepresentanteCpf').value = linhaEdicaoCliente.dataset.representanteCpf || '';
      atualizarTipoPessoaCliente();

      Promise.resolve(typeof cadCarregarFornecedorCliente === 'function' ? cadCarregarFornecedorCliente(Number(linhaEdicaoCliente.dataset.idNuvem)) : null).catch(console.warn);

      document.getElementById('modalCliente').classList.add('active');
    }

    function clonarCliente(btn) {
      const tr = btn.closest('tr');
      const td = tr.querySelectorAll('td');

      linhaEdicaoCliente = null;
      document.getElementById('modalClienteTitulo').innerText = "Cadastrar Novo Cliente (Clonado)";
      document.getElementById('cNome').value = td[0].innerText;
      document.getElementById('cUnidade').value = '';
      document.getElementById('cTipoPessoa').value = somenteDigitos(td[2].innerText).length === 11 ? 'fisica' : 'juridica';
      document.getElementById('cDocumento').value = td[2].innerText;
      document.getElementById('cIe').value = tr.getAttribute('data-ie') || '';
      document.getElementById('cRegime').value = td[5].innerText;
      document.getElementById('cTelefone').value = td[3].innerText;
      document.getElementById('cEmail').value = td[4].innerText;
      document.getElementById('cObsTecnicas').value = tr.getAttribute('data-obs') || '';
      document.getElementById('cEndereco').value = tr.dataset.endereco || '';
      document.getElementById('cCidade').value = tr.dataset.cidade || '';
      document.getElementById('cUf').value = tr.dataset.uf || 'MS';
      document.getElementById('cCep').value = tr.dataset.cep || '';
      document.getElementById('cRepresentante').value = tr.dataset.representante || '';
      document.getElementById('cRepresentanteCpf').value = tr.dataset.representanteCpf || '';
      document.getElementById('cEhFornecedor').checked = false;
      document.getElementById('cEhFornecedor').dataset.existente = 'false';
      document.getElementById('cFornecedorCategoria').value = '';
      document.getElementById('cFornecedorObs').value = '';
      document.getElementById('cFornecedorCampos').classList.add('hidden');
      atualizarTipoPessoaCliente();

      document.getElementById('modalCliente').classList.add('active');
    }

    function filtrarClientes() {
      const busca = document.getElementById('inputBuscaCliente').value.toLowerCase();
      const linhas = document.querySelectorAll('#tabelaClientes tbody tr');

      linhas.forEach(linha => {
        const texto = linha.innerText.toLowerCase();
        linha.style.display = texto.includes(busca) ? '' : 'none';
      });
    }

    async function salvarTecnico() {
      const nome = document.getElementById('tNome').value.trim();
      if (!nome) { alert('Informe o nome do técnico'); return; }
      try {
        const { error } = await supabaseClient.from('tecnicos').insert({ nome, ativo: true });
        if (error) throw error;
        alert(`Técnico ${nome} cadastrado com sucesso!`);
        fecharModais();
        await carregarTecnicosDaNuvem();
        registrarLog(`cadastrou o técnico ${nome}`);
      } catch (e) {
        alert('Não foi possível cadastrar o técnico na nuvem.\n\n' + e.message);
      }
    }

    async function excluirChamado(btn) {
      const tr = btn.closest('tr');
      const protocolo = tr.querySelectorAll('td')[0].innerText.trim();
      if (!confirm('Deseja realmente excluir este chamado?')) return;

      try {
        await excluirChamadoNaNuvem(protocolo);
      } catch (erroSupabase) {
        console.error('Erro ao excluir chamado no Supabase:', erroSupabase);
        alert('Não foi possível excluir o chamado da nuvem.\n\nDetalhes: ' + erroSupabase.message);
        return;
      }

      tr.remove();
      atualizarMetricas();
      registrarLog(`excluiu o chamado ${protocolo}`);
    }

    async function excluirLinha(btn) {
      const tr = btn.closest('tr');
      const nome = tr.querySelectorAll('td')[0].innerText;
      if (!confirm('Deseja remover este registro?')) return;
      const id = tr.dataset.idNuvem;
      if (!id) { alert('Este cliente não possui ID na nuvem.'); return; }
      const { error } = await supabaseClient.from('clientes').delete().eq('id', id);
      if (error) { alert('Não foi possível excluir o cliente da nuvem.\n\n' + error.message); return; }
      await carregarClientesDaNuvem();
      registrarLog(`removeu o cliente ${nome}`);
    }

    function enviarWhatsappChamado(btn) {
      const tr = btn.closest('tr');
      const td = tr.querySelectorAll('td');
      const protocolo = td[0].innerText;
      const cliente = td[2].innerText;
      const solicitante = td[6].innerText;
      const status = td[11].innerText.trim();
      const abertura = tr.getAttribute('data-abertura') || td[1].innerText.trim();
      const erro = tr.getAttribute('data-erro') || '';
      const resolucao = tr.getAttribute('data-resolucao') || tr.getAttribute('data-obs') || 'Sem observações.';

      const texto = `Olá *${solicitante}* (${cliente}), tudo bem?\n\nReferente ao seu chamado *${protocolo}* (aberto em ${abertura}):\nStatus: *${status}*${erro ? `\nProblema: ${erro}` : ''}\nResolução: ${resolucao}\n\nAtt, Help Soluções Tecnológicas.`;
      
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
    }

    function marcarChamadosCriticos() {
      const SLA_CRITICO = parseFloat(localStorage.getItem('help_crm_sla_critico') || '2');
      const SLA_NORMAL = parseFloat(localStorage.getItem('help_crm_sla_normal') || '24');
      const linhas = document.querySelectorAll('#tabelaChamados tbody tr');
      linhas.forEach(linha => {
        const td = linha.querySelectorAll('td');
        const status = td[11].innerText.trim();
        const prioridade = td[10].innerText.trim();
        const abertura = linha.getAttribute('data-abertura') || td[1].innerText.trim();

        let critico = false;
        if (status !== 'Resolvido') {
          const dataAbertura = parseDataBr(abertura);
          if (dataAbertura) {
            const decorrido = (Date.now() - dataAbertura.getTime()) / 36e5;
            const limite = prioridade === 'Alta Prioridade' ? SLA_CRITICO : SLA_NORMAL;
            critico = decorrido >= limite;
            linha.title = critico ? `SLA vencido: ${decorrido.toFixed(1)}h de ${limite}h` : `SLA: ${decorrido.toFixed(1)}h de ${limite}h`;
          }
        }
        linha.classList.toggle('linha-alerta', critico);
      });
    }

    function parseDataBr(str) {
      // Formato esperado: dd/mm/aaaa hh:mm
      const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
      if (!m) return null;
      return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
    }

    function atualizarMetricas() {
      const linhas = document.querySelectorAll('#tabelaChamados tbody tr');
      let total = 0, resolvidos = 0, pendentes = 0, alta = 0, hoje = 0;
      const hojeStr = new Date().toLocaleDateString('pt-BR');
      const porTecnico = {}, porStatus = {};

      linhas.forEach(linha => {
        total++;
        const td = linha.querySelectorAll('td');
        const status = td[11].innerText.trim();
        const prioridade = td[10].innerText.trim();
        const tecnico = td[7].innerText.trim();
        const abertura = linha.getAttribute('data-abertura') || td[1].innerText.trim();

        if (status === 'Resolvido') resolvidos++;
        if (status !== 'Resolvido') pendentes++;
        if (prioridade === 'Alta Prioridade') alta++;
        if (abertura.startsWith(hojeStr)) hoje++;

        porTecnico[tecnico] = (porTecnico[tecnico] || 0) + 1;
        porStatus[status] = (porStatus[status] || 0) + 1;
      });

      document.getElementById('totalChamados').innerText = total;
      document.getElementById('totalHoje').innerText = hoje;
      document.getElementById('totalResolvidos').innerText = resolvidos;
      document.getElementById('totalPendentes').innerText = pendentes;
      document.getElementById('totalAltaPrioridade').innerText = alta;

      marcarChamadosCriticos();
      atualizarGraficos(porTecnico, porStatus);
    }

    function abrirChamadosResolvidos(){
      const status=document.getElementById('filtroStatus'),periodo=document.getElementById('filtroData'),busca=document.getElementById('inputBusca');
      if(status)status.value='resolvido';
      if(periodo)periodo.value='todos';
      if(busca)busca.value='';
      filtrarChamados();
      document.querySelector('.table-container')?.scrollIntoView({behavior:'smooth',block:'start'});
    }

    function atualizarGraficos(porTecnico, porStatus) {
      renderizarGraficoBarras('graficoTecnico', porTecnico);
      renderizarGraficoRosca('graficoStatus', porStatus);
    }

    function renderizarGraficoBarras(containerId, dados) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';

      const entradas = Object.entries(dados);
      if (entradas.length === 0) {
        const vazio = document.createElement('p');
        vazio.className = 'chart-empty';
        vazio.textContent = 'Sem dados para exibir.';
        container.appendChild(vazio);
        return;
      }

      const max = Math.max(...entradas.map(([, v]) => v), 1);
      entradas.forEach(([nome, valor]) => {
        const col = document.createElement('div'); col.className = 'bar-col';
        const val = document.createElement('span'); val.className = 'bar-value'; val.textContent = valor;
        const bar = document.createElement('div'); bar.className = 'bar'; bar.style.height = Math.max((valor / max) * 100, 3) + '%';
        const label = document.createElement('span'); label.className = 'bar-label'; label.title = nome; label.textContent = nome;
        col.append(val, bar, label);
        container.appendChild(col);
      });
    }

    function renderizarGraficoRosca(containerId, dados) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';

      const entradas = Object.entries(dados);
      if (entradas.length === 0) {
        const vazio = document.createElement('p');
        vazio.className = 'chart-empty';
        vazio.textContent = 'Sem dados para exibir.';
        container.appendChild(vazio);
        return;
      }

      const coresStatus = { 'Resolvido': '#34d399', 'Pendente': '#fbbf24', 'Em Andamento': '#60a5fa' };
      const coresFallback = ['#a855f7', '#f472b6', '#38bdf8', '#f97316'];
      const total = entradas.reduce((soma, [, v]) => soma + v, 0) || 1;

      let acumulado = 0;
      const partesGradiente = entradas.map(([status, valor], i) => {
        const cor = coresStatus[status] || coresFallback[i % coresFallback.length];
        const inicio = (acumulado / total) * 360;
        acumulado += valor;
        const fim = (acumulado / total) * 360;
        return `${cor} ${inicio}deg ${fim}deg`;
      });

      const donut = document.createElement('div');
      donut.className = 'donut';
      donut.style.background = `conic-gradient(${partesGradiente.join(', ')})`;

      const legenda = document.createElement('div');
      legenda.className = 'donut-legend';
      entradas.forEach(([status, valor], i) => {
        const cor = coresStatus[status] || coresFallback[i % coresFallback.length];
        const item = document.createElement('div'); item.className = 'legend-item';
        const dot = document.createElement('span'); dot.className = 'legend-dot'; dot.style.background = cor;
        const label = document.createElement('span'); label.className = 'legend-label'; label.textContent = status;
        const count = document.createElement('span'); count.className = 'legend-count'; count.textContent = `(${valor})`;
        item.append(dot, label, count);
        legenda.appendChild(item);
      });

      container.append(donut, legenda);
    }

    // ---- Relatórios ----
    function coletarChamadosParaRelatorio(periodo) {
      const linhas = document.querySelectorAll('#tabelaChamados tbody tr');
      const hoje = new Date();
      const lista = [];
      linhas.forEach(linha => {
        const td = linha.querySelectorAll('td');
        const aberturaStr = linha.getAttribute('data-abertura') || td[1].innerText.trim();
        const fechamentoStr = linha.getAttribute('data-fechamento') || '';
        const dataAbertura = parseDataBr(aberturaStr);

        if (periodo === 'mes' && dataAbertura && !(dataAbertura.getMonth() === hoje.getMonth() && dataAbertura.getFullYear() === hoje.getFullYear())) {
          return;
        }

        lista.push({
          protocolo: td[0].innerText.trim(),
          cliente: td[2].innerText.trim(),
          tecnico: td[7].innerText.trim(),
          modulo: td[8].innerText.trim(),
          tipo: td[9].innerText.trim(),
          prioridade: td[10].innerText.trim(),
          status: td[11].innerText.trim(),
          dataAbertura,
          dataFechamento: fechamentoStr ? parseDataBr(fechamentoStr) : null
        });
      });
      return lista;
    }

    function formatarHoras(horasDecimal) {
      if (!isFinite(horasDecimal)) return '-';
      const h = Math.floor(horasDecimal);
      const m = Math.round((horasDecimal - h) * 60);
      return `${h}h ${String(m).padStart(2, '0')}min`;
    }

    function preencherTabela(idTabela, linhas) {
      const tbody = document.querySelector(`#${idTabela} tbody`);
      tbody.innerHTML = '';
      if (linhas.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = tbody.closest('table').querySelectorAll('thead th').length;
        td.textContent = 'Sem dados suficientes para este período.';
        td.style.color = 'var(--text-muted)'; td.style.textAlign = 'center';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
      linhas.forEach(valores => {
        const tr = document.createElement('tr');
        valores.forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
        tbody.appendChild(tr);
      });
    }

    function salvarValorHora() {
      const valor = document.getElementById('relatorioValorHora').value;
      localStorage.setItem('help_crm_valor_hora', valor);
      atualizarRelatorios();
    }

    function atualizarRelatorios() {
      const periodo = document.getElementById('relatorioPeriodo').value;
      const dados = coletarChamadosParaRelatorio(periodo);

      const valorHoraSalvo = localStorage.getItem('help_crm_valor_hora');
      if (valorHoraSalvo !== null) document.getElementById('relatorioValorHora').value = valorHoraSalvo;
      const valorHora = parseFloat(document.getElementById('relatorioValorHora').value) || 0;

      // 1) Tempo médio de atendimento por técnico + tipo
      const tempoGrupo = {};
      dados.forEach(c => {
        if (!c.dataFechamento) return;
        const chave = c.tecnico + '||' + c.tipo;
        if (!tempoGrupo[chave]) tempoGrupo[chave] = { tecnico: c.tecnico, tipo: c.tipo, total: 0, count: 0 };
        const horas = (c.dataFechamento.getTime() - c.dataAbertura.getTime()) / 36e5;
        if (horas >= 0) { tempoGrupo[chave].total += horas; tempoGrupo[chave].count++; }
      });
      const linhasTempo = Object.values(tempoGrupo)
        .sort((a, b) => (b.total / b.count) - (a.total / a.count))
        .map(g => [g.tecnico, g.tipo, g.count, formatarHoras(g.total / g.count)]);
      preencherTabela('tabelaRelTempo', linhasTempo);

      // 2) Chamados por cliente
      const clienteGrupo = {};
      dados.forEach(c => {
        if (!clienteGrupo[c.cliente]) clienteGrupo[c.cliente] = { total: 0, alta: 0, pendentes: 0 };
        clienteGrupo[c.cliente].total++;
        if (c.prioridade === 'Alta Prioridade') clienteGrupo[c.cliente].alta++;
        if (c.status === 'Pendente') clienteGrupo[c.cliente].pendentes++;
      });
      const linhasCliente = Object.entries(clienteGrupo)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([cliente, g]) => [cliente, g.total, g.alta, g.pendentes]);
      preencherTabela('tabelaRelClientes', linhasCliente);

      // 3) Ranking de produtividade por técnico
      const tecnicoGrupo = {};
      dados.forEach(c => {
        if (!tecnicoGrupo[c.tecnico]) tecnicoGrupo[c.tecnico] = { resolvidos: 0, abertos: 0 };
        if (c.status === 'Resolvido') tecnicoGrupo[c.tecnico].resolvidos++;
        else tecnicoGrupo[c.tecnico].abertos++;
      });
      const linhasProdutividade = Object.entries(tecnicoGrupo)
        .sort((a, b) => b[1].resolvidos - a[1].resolvidos)
        .map(([tecnico, g], i) => [i + 1, tecnico, g.resolvidos, g.abertos]);
      preencherTabela('tabelaRelProdutividade', linhasProdutividade);

      // 4) Reincidência (mesmo cliente + módulo, 2+ ocorrências no período)
      const reincGrupo = {};
      dados.forEach(c => {
        const chave = c.cliente + '||' + c.modulo;
        reincGrupo[chave] = (reincGrupo[chave] || 0) + 1;
      });
      const linhasReinc = Object.entries(reincGrupo)
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([chave, count]) => [...chave.split('||'), count]);
      preencherTabela('tabelaRelReincidencia', linhasReinc);

      // 5) Estimativa financeira por cliente (horas de chamados resolvidos × valor/hora)
      const financeiroGrupo = {};
      dados.forEach(c => {
        if (!c.dataFechamento) return;
        const horas = (c.dataFechamento.getTime() - c.dataAbertura.getTime()) / 36e5;
        if (horas < 0) return;
        financeiroGrupo[c.cliente] = (financeiroGrupo[c.cliente] || 0) + horas;
      });
      const linhasFinanceiro = Object.entries(financeiroGrupo)
        .sort((a, b) => b[1] - a[1])
        .map(([cliente, horas]) => [cliente, formatarHoras(horas), 'R$ ' + (horas * valorHora).toFixed(2).replace('.', ',')]);
      preencherTabela('tabelaRelFinanceiro', linhasFinanceiro);
      atualizarOpcoesDossie();
    }

    function filtrarChamados() {
      const statusFiltro = document.getElementById('filtroStatus').value.toLowerCase();
      const periodoFiltro = document.getElementById('filtroData').value;
      const busca = document.getElementById('inputBusca').value.toLowerCase();
      const linhas = document.querySelectorAll('#tabelaChamados tbody tr');
      const hojeStr = new Date().toLocaleDateString('pt-BR');

      linhas.forEach(linha => {
        const td = linha.querySelectorAll('td');
        const textoLinha = linha.innerText.toLowerCase();
        const statusTd = td[11].innerText.toLowerCase();
        const abertura = linha.getAttribute('data-abertura') || td[1].innerText.trim();

        const bateuStatus = (statusFiltro === 'todos') || (statusTd.includes(statusFiltro));
        const bateuBusca = textoLinha.includes(busca);
        const bateuPeriodo = (periodoFiltro !== 'hoje') || abertura.startsWith(hojeStr);

        if (bateuStatus && bateuBusca && bateuPeriodo) {
          linha.style.display = '';
        } else {
          linha.style.display = 'none';
        }
      });

      atualizarMetricas();
    }

    function gerarRelatorioPDF() {
      atualizarRelatorios();
      const periodo = document.getElementById('relatorioPeriodo');
      const periodoTexto = periodo.options[periodo.selectedIndex].text;
      const agora = new Date().toLocaleString('pt-BR');
      const secoes = [
        ['Tempo Médio de Atendimento', 'tabelaRelTempo'],
        ['Chamados por Cliente', 'tabelaRelClientes'],
        ['Ranking de Produtividade por Técnico', 'tabelaRelProdutividade'],
        ['Reincidência (mesmo cliente + módulo)', 'tabelaRelReincidencia'],
        ['Estimativa Financeira por Cliente', 'tabelaRelFinanceiro']
      ];
      const conteudo = secoes.map(([titulo,id]) => {
        const tabela = document.getElementById(id);
        return `<section><h2>${titulo}</h2>${tabela ? tabela.outerHTML : '<p>Sem dados disponíveis.</p>'}</section>`;
      }).join('');
      const janela = window.open('', '_blank', 'width=1100,height=800');
      if (!janela) { alert('Permita a abertura da janela para gerar o relatório.'); return; }
      janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Operacional - Help</title>
      <style>
        *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#172235;margin:42px;background:#fff} .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1768d4;padding-bottom:18px;margin-bottom:28px} h1{margin:0;color:#0b2b55;font-size:28px} .brand{color:#f28b18;font-weight:700} .meta{color:#667085;font-size:13px;text-align:right;line-height:1.6} section{margin:0 0 28px;page-break-inside:avoid} h2{font-size:17px;color:#0b2b55;margin:0 0 10px;border-left:4px solid #f28b18;padding-left:10px} table{width:100%;border-collapse:collapse;font-size:12px} th{background:#0b2b55;color:#fff;text-align:left;padding:10px} td{padding:9px 10px;border-bottom:1px solid #dce3ec} tr:nth-child(even) td{background:#f7f9fc} .footer{margin-top:34px;padding-top:14px;border-top:1px solid #dce3ec;color:#667085;font-size:11px;text-align:center}@media print{body{margin:22px}.top{break-after:avoid}}</style></head><body>
      <div class="top"><div><h1>Relatório Operacional <span class="brand">Help</span></h1><div style="margin-top:8px;color:#667085">Indicadores gerados a partir dos chamados cadastrados</div></div><div class="meta"><b>Período:</b> ${periodoTexto}<br><b>Gerado em:</b> ${agora}</div></div>
      ${conteudo}<div class="footer">Help Soluções Tecnológicas • Relatório operacional</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
      janela.document.close();
    }

    // ---- Dossiê detalhado do chamado ----
    let dossieChamadoAtual = null;

    function escaparHtml(valor) {
      return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      })[caractere]);
    }

    function atualizarOpcoesDossie() {
      const select = document.getElementById('dossieChamadoSelect');
      if (!select) return;
      const selecionado = select.value;
      const chamados = [...document.querySelectorAll('#tabelaChamados tbody tr')]
        .map(linha => ({
          id: linha.dataset.idNuvem || '',
          protocolo: linha.querySelector('td')?.innerText.trim() || '',
          cliente: linha.querySelectorAll('td')[2]?.innerText.trim() || ''
        }))
        .filter(item => item.id && item.protocolo);
      select.innerHTML = '<option value="">Selecione um protocolo</option>';
      chamados.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.protocolo} — ${item.cliente}`;
        select.appendChild(option);
      });
      if (chamados.some(item => item.id === selecionado)) select.value = selecionado;
      atualizarBotoesDossie();
    }

    function atualizarBotoesDossie(carregando = false) {
      const possuiChamado = !!document.getElementById('dossieChamadoSelect')?.value;
      ['btnVisualizarDossie', 'btnEmailDossie', 'btnPdfDossie'].forEach(id => {
        const botao = document.getElementById(id);
        if (botao) botao.disabled = !possuiChamado || carregando || (id==='btnEmailDossie'&&!(usuarioLogado?.perfil==='admin'||usuarioLogado?.permissoes?.enviarEmail===true));
      });
    }

    async function buscarDossieSelecionado() {
      const chamadoId = document.getElementById('dossieChamadoSelect')?.value;
      if (!chamadoId) return null;
      const incluirInternas = !!document.getElementById('dossieIncluirInternas')?.checked;
      const [resultadoChamado, resultadoInteracoes] = await Promise.all([
        supabaseClient.from('chamados').select('*').eq('id', chamadoId).single(),
        supabaseClient.from('chamado_interacoes').select('*').eq('chamado_id', chamadoId).order('criado_em', { ascending: true })
      ]);
      if (resultadoChamado.error) throw resultadoChamado.error;
      if (resultadoInteracoes.error) throw resultadoInteracoes.error;
      const todas = resultadoInteracoes.data || [];
      return {
        chamado: resultadoChamado.data,
        interacoes: incluirInternas ? todas : todas.filter(item => !item.interna),
        internasOcultas: incluirInternas ? 0 : todas.filter(item => item.interna).length,
        incluirInternas
      };
    }

    function camposDossie(chamado) {
      return [
        ['Protocolo', chamado.protocolo || '-'],
        ['Cliente / empresa', chamado.cliente || '-'],
        ['Unidade / filial', chamado.unidade || '-'],
        ['Solicitante', chamado.solicitante || '-'],
        ['Técnico responsável', chamado.tecnico || '-'],
        ['Origem / setor', chamado.origem || '-'],
        ['Módulo', chamado.modulo || '-'],
        ['Tipo de atendimento', chamado.tipo || '-'],
        ['Prioridade', chamado.prioridade || '-'],
        ['Status', chamado.status || '-'],
        ['Aberto em', formatarDataHoraInteracao(chamado.abertura_em || chamado.criado_em) || '-'],
        ['Fechado em', formatarDataHoraInteracao(chamado.fechamento_em) || 'Em aberto']
      ];
    }

    function htmlInteracoesDossie(dossie) {
      if (!dossie.interacoes.length) return '<div class="dossie-sem-interacoes">Nenhuma interação disponível para este documento.</div>';
      return dossie.interacoes.map(item => `
        <article class="dossie-interacao${item.interna ? ' interna' : ''}">
          <div class="dossie-interacao-topo"><strong>${escaparHtml(item.tipo || 'Interação')}${item.interna ? ' · Interna' : ''}</strong><span>${escaparHtml(formatarDataHoraInteracao(item.criado_em))}</span></div>
          <p>${escaparHtml(item.descricao || '').replace(/\n/g, '<br>')}</p>
          <div class="dossie-interacao-meta">Registrado por ${escaparHtml(item.criado_por_nome || 'Usuário')}${item.proximo_contato ? ` · Próximo contato: ${escaparHtml(formatarDataHoraInteracao(item.proximo_contato))}` : ''}</div>
        </article>`).join('');
    }

    function renderizarDossie(dossie) {
      const preview = document.getElementById('dossieChamadoPreview');
      const chamado = dossie.chamado;
      preview.innerHTML = `
        <div class="dossie-preview-head">
          <div><span>Dossiê do chamado</span><h4>${escaparHtml(chamado.protocolo || '-')}</h4></div>
          <span class="badge ${chamado.status === 'Resolvido' ? 'badge-resolvido' : 'badge-pendente'}">${escaparHtml(chamado.status || 'Pendente')}</span>
        </div>
        <div class="dossie-campos">${camposDossie(chamado).map(([rotulo, valor]) => `<div><span>${escaparHtml(rotulo)}</span><strong>${escaparHtml(valor)}</strong></div>`).join('')}</div>
        <div class="dossie-bloco"><span>Descrição do problema</span><p>${escaparHtml(chamado.erro || chamado.descricao || 'Não informada').replace(/\n/g, '<br>')}</p></div>
        <div class="dossie-bloco"><span>Resolução</span><p>${escaparHtml(chamado.resolucao || 'Ainda não registrada').replace(/\n/g, '<br>')}</p></div>
        <div class="dossie-historico-head"><div><span>Histórico</span><strong>${dossie.interacoes.length} ${dossie.interacoes.length === 1 ? 'interação' : 'interações'}</strong></div>${dossie.internasOcultas ? `<small>${dossie.internasOcultas} ${dossie.internasOcultas === 1 ? 'anotação interna foi ocultada' : 'anotações internas foram ocultadas'}</small>` : ''}</div>
        <div class="dossie-timeline">${htmlInteracoesDossie(dossie)}</div>`;
      renderizarIcones();
    }

    async function carregarDossieChamado() {
      const preview = document.getElementById('dossieChamadoPreview');
      if (!document.getElementById('dossieChamadoSelect')?.value) {
        dossieChamadoAtual = null;
        atualizarBotoesDossie();
        if (preview) preview.innerHTML = '<div class="dossie-vazio"><i data-lucide="clipboard-list"></i><strong>Selecione um chamado</strong><span>O resumo e as interações aparecerão aqui.</span></div>';
        renderizarIcones();
        return null;
      }
      atualizarBotoesDossie(true);
      if (preview) preview.innerHTML = '<div class="dossie-vazio"><i data-lucide="loader-circle"></i><strong>Carregando dossiê...</strong></div>';
      renderizarIcones();
      try {
        dossieChamadoAtual = await buscarDossieSelecionado();
        renderizarDossie(dossieChamadoAtual);
        return dossieChamadoAtual;
      } catch (erro) {
        console.error('Erro ao carregar dossiê:', erro);
        if (preview) preview.innerHTML = `<div class="dossie-vazio erro"><strong>Não foi possível carregar o dossiê</strong><span>${escaparHtml(erro.message)}</span></div>`;
        return null;
      } finally {
        atualizarBotoesDossie();
      }
    }

    function textoDossie(dossie) {
      const chamado = dossie.chamado;
      const campos = camposDossie(chamado).map(([rotulo, valor]) => `${rotulo}: ${valor}`).join('\n');
      const historico = dossie.interacoes.length ? dossie.interacoes.map((item, indice) =>
        `${indice + 1}. [${formatarDataHoraInteracao(item.criado_em)}] ${item.tipo}${item.interna ? ' (Interna)' : ''} — ${item.criado_por_nome || 'Usuário'}\n${item.descricao}${item.proximo_contato ? `\nPróximo contato: ${formatarDataHoraInteracao(item.proximo_contato)}` : ''}`
      ).join('\n\n') : 'Nenhuma interação disponível.';
      return `DOSSIÊ DO CHAMADO ${chamado.protocolo || ''}\n\n${campos}\n\nDESCRIÇÃO DO PROBLEMA\n${chamado.erro || chamado.descricao || 'Não informada'}\n\nRESOLUÇÃO\n${chamado.resolucao || 'Ainda não registrada'}\n\nHISTÓRICO DE INTERAÇÕES\n${historico}`;
    }

    function htmlEmailDossie(dossie) {
      const chamado=dossie.chamado, resolvido=chamado.status==='Resolvido';
      const campos=camposDossie(chamado).map(([r,v])=>`<td style="width:50%;padding:8px;vertical-align:top"><div style="border:1px solid #dce6f2;border-radius:8px;padding:10px 12px;background:#f8fafc"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b">${escaparHtml(r)}</div><div style="margin-top:4px;font-size:13px;font-weight:600;color:#172235">${escaparHtml(v)}</div></div></td>`).reduce((a,c,i)=>a+(i%2===0?'<tr>':'')+c+(i%2===1?'</tr>':''),'')+(camposDossie(chamado).length%2?'<td></td></tr>':'');
      const historico=dossie.interacoes.length?dossie.interacoes.map(item=>`<tr><td style="padding:0 0 10px"><div style="border-left:4px solid ${item.interna?'#f28b18':'#1768d4'};border-radius:7px;background:#f8fafc;padding:12px 14px"><table role="presentation" width="100%"><tr><td style="font-size:12px;font-weight:700;color:#1768d4">${escaparHtml(item.tipo||'Interação')}${item.interna?' · INTERNA':''}</td><td align="right" style="font-size:11px;color:#64748b">${escaparHtml(formatarDataHoraInteracao(item.criado_em))}</td></tr></table><div style="margin-top:8px;font-size:13px;line-height:1.55;color:#334155">${escaparHtml(item.descricao||'').replace(/\n/g,'<br>')}</div><div style="margin-top:8px;font-size:11px;color:#64748b">Registrado por ${escaparHtml(item.criado_por_nome||'Usuário')}${item.proximo_contato?` · Próximo contato: ${escaparHtml(formatarDataHoraInteracao(item.proximo_contato))}`:''}</div></div></td></tr>`).join(''):'<tr><td style="padding:20px;text-align:center;color:#64748b">Nenhuma interação disponível.</td></tr>';
      return `<!doctype html><html><body style="margin:0;padding:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f8"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(15,39,71,.10)"><tr><td style="padding:24px 28px;background:#0b2b55;border-bottom:4px solid #f28b18"><div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#8ec0ff;text-transform:uppercase">Help Soluções Tecnológicas</div><table role="presentation" width="100%"><tr><td><h1 style="margin:7px 0 0;font-size:23px;color:#fff">Dossiê do chamado</h1><div style="margin-top:5px;font-size:16px;color:#c8dcf5">${escaparHtml(chamado.protocolo||'')}</div></td><td align="right"><span style="display:inline-block;padding:7px 11px;border-radius:20px;background:${resolvido?'#d1fae5':'#fff1d6'};color:${resolvido?'#047857':'#a15c00'};font-size:11px;font-weight:700">${escaparHtml(chamado.status||'Pendente')}</span></td></tr></table></td></tr><tr><td style="padding:24px 24px 8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${campos}</table><div style="margin:18px 8px 8px;font-size:12px;font-weight:700;color:#0b2b55;text-transform:uppercase">Descrição do problema</div><div style="margin:0 8px;padding:14px;background:#f8fafc;border-radius:8px;font-size:13px;line-height:1.55;color:#334155">${escaparHtml(chamado.erro||chamado.descricao||'Não informada').replace(/\n/g,'<br>')}</div><div style="margin:18px 8px 8px;font-size:12px;font-weight:700;color:#0b2b55;text-transform:uppercase">Resolução</div><div style="margin:0 8px;padding:14px;background:#f8fafc;border-radius:8px;font-size:13px;line-height:1.55;color:#334155">${escaparHtml(chamado.resolucao||'Ainda não registrada').replace(/\n/g,'<br>')}</div><div style="margin:24px 8px 10px;font-size:16px;font-weight:700;color:#0b2b55">Histórico de interações</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:0 8px">${historico}</table>${dossie.internasOcultas?`<div style="margin:8px;padding:10px;border-radius:7px;background:#fff7e8;color:#8a5a16;font-size:11px">${dossie.internasOcultas} anotação(ões) interna(s) não incluída(s) neste e-mail.</div>`:''}</td></tr><tr><td align="center" style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e5edf5;font-size:11px;line-height:1.5;color:#64748b">Documento gerado pelo Sistema Help Soluções<br><span style="color:#94a3b8">${escaparHtml(new Date().toLocaleString('pt-BR'))}</span></td></tr></table></td></tr></table></body></html>`;
    }

    async function prepararEmailDossie() {
      const dossie = await carregarDossieChamado();
      if (!dossie) return;
      let destinatario = '';
      try {
        const { data } = await supabaseClient.from('clientes').select('email').eq('nome', dossie.chamado.cliente).limit(1).maybeSingle();
        if (data?.email && data.email !== '-') destinatario = data.email;
      } catch (erro) {
        console.warn('Não foi possível localizar o e-mail do cliente:', erro);
      }
      const assunto = `Dossiê do chamado ${dossie.chamado.protocolo || ''} — Help Soluções`;
      const corpo = `${textoDossie(dossie)}\n\nDocumento preparado pelo Sistema Help Soluções.`;
      window.location.href = `mailto:${encodeURIComponent(destinatario)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    }

    async function enviarEmailDossie() {
      if(!(usuarioLogado?.perfil==='admin'||usuarioLogado?.permissoes?.enviarEmail===true)){alert('Seu usuário não possui permissão para enviar dossiês.');return}
      const dossie = await carregarDossieChamado(); if (!dossie) return;
      let email = '';
      const { data: cliente } = await supabaseClient.from('clientes').select('email').eq('nome', dossie.chamado.cliente).limit(1).maybeSingle();
      email = prompt('Confirme o e-mail do destinatário:', cliente?.email && cliente.email !== '-' ? cliente.email : '')?.trim() || '';
      if (!email) return;
      if (!confirm(`Enviar o dossiê do chamado ${dossie.chamado.protocolo} para ${email}?`)) return;
      const botao=document.getElementById('btnEmailDossie');botao.disabled=true;botao.textContent='Enviando...';
      try {
        const { data: sessao } = await supabaseClient.auth.getSession();
        const resposta = await fetch('/api/send-dossie', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${sessao.session?.access_token||''}`}, body:JSON.stringify({to:email,chamadoId:Number(dossie.chamado.id)}) });
        const resultado=await resposta.json().catch(()=>({}));
        if(!resposta.ok) throw new Error(resultado.error||'Serviço de e-mail indisponível.');
        alert('E-mail enviado com sucesso!');
      } catch(erro) {
        if(confirm(`${erro.message}\n\nDeseja abrir seu aplicativo de e-mail como alternativa?`)) prepararEmailDossie();
      } finally {botao.innerHTML='<i data-lucide="send"></i>Enviar e-mail';atualizarBotoesDossie();renderizarIcones()}
    }

    async function gerarPdfDossie() {
      if (!document.getElementById('dossieChamadoSelect')?.value) return;
      const janela = window.open('', '_blank', 'width=1000,height=820');
      if (!janela) { alert('Permita a abertura da janela para gerar o PDF.'); return; }
      janela.document.write('<p style="font-family:Arial;padding:30px">Preparando dossiê...</p>');
      try {
        const dossie = await carregarDossieChamado();
        if (!dossie) { janela.close(); return; }
        const chamado = dossie.chamado;
        const campos = camposDossie(chamado).map(([rotulo, valor]) => `<div><span>${escaparHtml(rotulo)}</span><strong>${escaparHtml(valor)}</strong></div>`).join('');
        const historico = dossie.interacoes.length ? dossie.interacoes.map(item => `<article class="${item.interna ? 'interna' : ''}"><header><b>${escaparHtml(item.tipo || 'Interação')}${item.interna ? ' · Interna' : ''}</b><time>${escaparHtml(formatarDataHoraInteracao(item.criado_em))}</time></header><p>${escaparHtml(item.descricao || '').replace(/\n/g, '<br>')}</p><small>Registrado por ${escaparHtml(item.criado_por_nome || 'Usuário')}${item.proximo_contato ? ` · Próximo contato: ${escaparHtml(formatarDataHoraInteracao(item.proximo_contato))}` : ''}</small></article>`).join('') : '<p class="vazio">Nenhuma interação disponível.</p>';
        janela.document.open();
        janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Dossiê ${escaparHtml(chamado.protocolo || '')}</title><style>
          *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172235;margin:36px;background:#fff;line-height:1.45}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #1768d4;padding-bottom:18px;margin-bottom:24px}.top h1{margin:0;color:#0b2b55;font-size:26px}.top h1 span{color:#f28b18}.meta{text-align:right;color:#667085;font-size:12px}.campos{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}.campos div{border:1px solid #dce3ec;border-radius:7px;padding:9px}.campos span,.bloco>span{display:block;color:#667085;font-size:10px;text-transform:uppercase;font-weight:700;margin-bottom:4px}.campos strong{font-size:12px}.bloco{border:1px solid #dce3ec;border-radius:8px;padding:13px;margin-bottom:12px}.bloco p{font-size:12px;margin:0}h2{color:#0b2b55;font-size:17px;border-left:4px solid #f28b18;padding-left:9px;margin:25px 0 12px}article{position:relative;border-left:3px solid #1768d4;background:#f7f9fc;padding:12px 14px;margin-bottom:10px;page-break-inside:avoid}article.interna{border-left-color:#f28b18}article header{display:flex;justify-content:space-between;gap:16px;font-size:12px;color:#0b2b55}article time,article small{color:#667085;font-size:10px}article p{font-size:12px;margin:8px 0}.aviso{color:#8a5a16;background:#fff7e8;border:1px solid #f3d199;padding:9px;border-radius:7px;font-size:10px}.footer{margin-top:26px;padding-top:12px;border-top:1px solid #dce3ec;color:#667085;font-size:10px;text-align:center}@media print{body{margin:18px}.top{break-after:avoid}}
        </style></head><body><div class="top"><div><h1>Dossiê do chamado <span>${escaparHtml(chamado.protocolo || '')}</span></h1><div style="color:#667085;margin-top:5px">Help Soluções Tecnológicas</div></div><div class="meta"><b>Gerado em</b><br>${escaparHtml(new Date().toLocaleString('pt-BR'))}</div></div><div class="campos">${campos}</div><div class="bloco"><span>Descrição do problema</span><p>${escaparHtml(chamado.erro || chamado.descricao || 'Não informada').replace(/\n/g, '<br>')}</p></div><div class="bloco"><span>Resolução</span><p>${escaparHtml(chamado.resolucao || 'Ainda não registrada').replace(/\n/g, '<br>')}</p></div><h2>Histórico de interações</h2>${dossie.internasOcultas ? `<div class="aviso">${dossie.internasOcultas} ${dossie.internasOcultas === 1 ? 'anotação interna não foi incluída' : 'anotações internas não foram incluídas'} neste documento.</div>` : ''}<div>${historico}</div><div class="footer">Documento gerado pelo Sistema Help Soluções</div><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
        janela.document.close();
      } catch (erro) {
        janela.close();
        alert('Não foi possível gerar o PDF.\n\n' + erro.message);
      }
    }


    
// Sistema comercial — Supabase
const crmEtapas=['Novo','Contato','Demonstração','Proposta','Negociação','Fechado'];
const crmTiposProximaAcao=['Follow-up','Visita','Ligação','Reunião','Demonstração','WhatsApp','Proposta','Outro'];
let crmEditandoId=null;
let crmCache=[];

function prepararCamposAgendaCRM(){
  const dataCampo=document.getElementById('crmProximaAcao')?.closest('div');
  const grade=dataCampo?.parentElement;
  if(!dataCampo||!grade||document.getElementById('crmProximaTipo'))return;
  const tipoCampo=document.createElement('div'),tipoLabel=document.createElement('label'),tipoSelect=document.createElement('select');
  tipoLabel.textContent='Tipo da próxima ação';tipoSelect.id='crmProximaTipo';
  crmTiposProximaAcao.forEach(tipo=>{const option=document.createElement('option');option.value=tipo;option.textContent=tipo;tipoSelect.appendChild(option)});
  tipoCampo.append(tipoLabel,tipoSelect);
  const horaCampo=document.createElement('div'),horaLabel=document.createElement('label'),horaInput=document.createElement('input');
  horaLabel.textContent='Horário';horaInput.id='crmProximaHora';horaInput.type='time';
  horaCampo.append(horaLabel,horaInput);
  grade.insertBefore(tipoCampo,dataCampo);dataCampo.after(horaCampo);
}

async function crmUsuarioId(){
  const { data } = await supabaseClient.auth.getUser();
  return data?.user?.id || null;
}

async function carregarCrmDaNuvem(){
  const { data, error } = await supabaseClient.from('leads').select('*').order('criado_em',{ascending:false});
  if(error) throw error;
  crmCache=data||[];
  return crmCache;
}

async function migrarLeadsLocaisSeExistirem(){
  let locais=[];
  try{locais=JSON.parse(localStorage.getItem('help_crm_leads')||'[]')||[]}catch(e){locais=[]}
  if(!locais.length) return;
  const uid=await crmUsuarioId();
  for(const x of locais){
    const payload={
      id:x.id||('lead-'+Date.now()), nome:x.nome||'Lead sem nome', responsavel:x.responsavel||'', telefone:x.telefone||'',
      cidade:x.cidade||'', interesse:x.interesse||'ERP / Gestão', etapa:x.etapa||'Novo', proxima:x.proxima||null,
      proxima_tipo:x.proxima_tipo||'Follow-up', proxima_hora:x.proxima_hora||null,
      valor:Number(x.valor)||0, obs:x.obs||'', convertido:!!x.convertido, criado_por:uid, atualizado_em:new Date().toISOString()
    };
    const { error }=await supabaseClient.from('leads').upsert(payload,{onConflict:'id'});
    if(error) throw error;
    for(const h of (x.historico||[])){
      await supabaseClient.from('lead_interacoes').insert({lead_id:payload.id,texto:h.texto||String(h),criado_por:uid});
    }
  }
  localStorage.removeItem('help_crm_leads');
}

async function renderizarCRM(){
  try{
    prepararCamposAgendaCRM();
    if(typeof prepararCamposGestaoComercial==='function')await prepararCamposGestaoComercial();
    await migrarLeadsLocaisSeExistirem();
    const a=await carregarCrmDaNuvem();
    const hoje=new Date().toISOString().slice(0,10);
    document.getElementById('crmTotalAtivos').textContent=a.filter(x=>x.etapa!=='Fechado'&&!x.convertido).length;
    document.getElementById('crmNegociacao').textContent=a.filter(x=>x.etapa==='Negociação').length;
    document.getElementById('crmFollowups').textContent=a.filter(x=>x.proxima&&x.proxima<=hoje&&!x.convertido).length;
    document.getElementById('crmConvertidos').textContent=a.filter(x=>x.convertido||x.etapa==='Fechado').length;
    document.getElementById('crmBoard').innerHTML=crmEtapas.map(e=>{
      const ls=a.filter(x=>x.etapa===e&&!x.convertido);
      const valor=ls.reduce((s,x)=>s+(Number(x.valor)||0),0);
      return `<section class="crm-stage" data-etapa="${e}" ondragover="permitirSoltarLead(event)" ondragleave="sairDestinoLead(event)" ondrop="soltarLeadComercial(event,'${e}')"><div class="crm-stage-head"><div><span>${e}</span><small>${valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</small></div><b>${ls.length}</b></div><div class="crm-stage-list">${ls.map(x=>`<article class="crm-lead-card" draggable="true" data-lead-id="${x.id}" ondragstart="iniciarArrastoLead(event,'${x.id}')" ondragend="finalizarArrastoLead(event)" onclick="editarLead('${x.id}')"><div class="crm-lead-top"><strong>${escaparHtml(x.nome)}</strong><i data-lucide="grip-vertical"></i></div><small>${escaparHtml(x.responsavel||x.cidade||'Sem contato')}</small><span class="crm-tag">${escaparHtml(x.interesse||'-')}</span><span class="crm-tag">${Number(x.probabilidade||0)}% · ${Number(x.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>${x.fechamento_previsto?`<span class="crm-lead-date"><i data-lucide="target"></i>Fechamento ${new Date(x.fechamento_previsto+'T12:00:00').toLocaleDateString('pt-BR')}</span>`:''}${x.proxima?`<span class="crm-lead-date"><i data-lucide="calendar"></i>${escaparHtml(x.proxima_tipo||'Follow-up')} · ${new Date(x.proxima+'T12:00:00').toLocaleDateString('pt-BR')}${x.proxima_hora?' às '+String(x.proxima_hora).slice(0,5):''}</span>`:''}<select class="crm-mobile-stage" aria-label="Mover ${escaparHtml(x.nome)} para outra etapa" onclick="event.stopPropagation()" onchange="moverLeadParaEtapa('${x.id}',this.value);event.stopPropagation()">${crmEtapas.map(et=>`<option value="${et}" ${et===e?'selected':''}>${et}</option>`).join('')}</select></article>`).join('')||'<div class="crm-stage-empty">Solte uma oportunidade aqui</div>'}</div></section>`;
    }).join('');
    const p=a.filter(x=>x.proxima&&!x.convertido&&!x.motivo_perda).sort((x,y)=>String(x.proxima).localeCompare(String(y.proxima)));
    document.getElementById('crmProximas').innerHTML=p.length?p.map(x=>`<div class="crm-next crm-next-action"><div><strong>${escaparHtml(x.proxima_tipo||'Follow-up')} · ${escaparHtml(x.nome)}</strong><span>${new Date(x.proxima+'T12:00:00').toLocaleDateString('pt-BR')}${x.proxima_hora?' às '+String(x.proxima_hora).slice(0,5):''} · ${escaparHtml(x.cidade||x.interesse||'-')}</span></div><button type="button" onclick="crmConcluirProximaAcao('${x.id}')">✓ Concluir</button></div>`).join(''):'<div class="crm-next">Nenhuma ação pendente</div>';
    renderizarIcones();
  }catch(e){
    console.error('Erro ao carregar Sistema:',e);
    alert('Não foi possível carregar o Sistema da nuvem.\n\n'+e.message);
  }
}

async function crmConcluirProximaAcao(id){
  const lead=crmCache.find(x=>String(x.id)===String(id));
  if(!lead||!confirm(`Marcar a próxima ação de ${lead.nome} como concluída?`))return;
  const quando=lead.proxima?new Date(lead.proxima+'T12:00:00').toLocaleDateString('pt-BR'):'';
  const texto=`Ação concluída: ${lead.proxima_tipo||'Follow-up'}${quando?' agendada para '+quando:''}${lead.proxima_hora?' às '+String(lead.proxima_hora).slice(0,5):''}.`;
  const {error}=await supabaseClient.from('leads').update({proxima:null,proxima_hora:null,atualizado_em:new Date().toISOString()}).eq('id',id);
  if(error)return alert('Não foi possível concluir a ação.\n\n'+error.message);
  const uid=await crmUsuarioId();
  const {error:historicoErro}=await supabaseClient.from('lead_interacoes').insert({lead_id:id,texto,criado_por:uid});
  if(historicoErro)console.warn('A ação foi concluída, mas o histórico não foi registrado:',historicoErro);
  await renderizarCRM();
}

function iniciarArrastoLead(event,id){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);event.currentTarget.classList.add('arrastando')}
function finalizarArrastoLead(event){event.currentTarget.classList.remove('arrastando');document.querySelectorAll('.crm-stage.destino').forEach(x=>x.classList.remove('destino'))}
function permitirSoltarLead(event){event.preventDefault();event.dataTransfer.dropEffect='move';event.currentTarget.classList.add('destino')}
function sairDestinoLead(event){if(!event.currentTarget.contains(event.relatedTarget))event.currentTarget.classList.remove('destino')}
async function soltarLeadComercial(event,etapa){event.preventDefault();event.currentTarget.classList.remove('destino');const id=event.dataTransfer.getData('text/plain');await moverLeadParaEtapa(id,etapa)}
async function moverLeadParaEtapa(id,novaEtapa){
  const lead=crmCache.find(x=>String(x.id)===String(id));
  if(!lead||!crmEtapas.includes(novaEtapa)||lead.etapa===novaEtapa)return;
  const etapaAnterior=lead.etapa;lead.etapa=novaEtapa;
  try{
    const uid=await crmUsuarioId(),agora=new Date().toISOString(),probabilidades={Novo:10,Contato:20,'Demonstração':40,Proposta:60,'Negociação':80,Fechado:100};
    const{error}=await supabaseClient.from('leads').update({etapa:novaEtapa,probabilidade:probabilidades[novaEtapa]??lead.probabilidade,atualizado_em:agora}).eq('id',id);if(error)throw error;
    const{error:histErro}=await supabaseClient.from('lead_interacoes').insert({lead_id:id,texto:`Etapa alterada de ${etapaAnterior} para ${novaEtapa}.`,criado_por:uid});if(histErro)console.warn('Etapa salva, mas o histórico não foi registrado:',histErro);
    await renderizarCRM();
  }catch(e){lead.etapa=etapaAnterior;await renderizarCRM();alert('Não foi possível mover a oportunidade.\n\n'+e.message)}
}

function abrirModalLead(){
  prepararCamposAgendaCRM();
  if(typeof prepararCamposGestaoComercial==='function')prepararCamposGestaoComercial();
  crmEditandoId=null;
  document.getElementById('crmModalTitulo').textContent='Novo lead';
  ['crmNome','crmResponsavel','crmTelefone','crmCidade','crmProximaAcao','crmProximaHora','crmFechamentoPrevisto','crmValor','crmObs','crmNovaInteracao'].forEach(i=>{const el=document.getElementById(i);if(el)el.value=''});
  if(document.getElementById('crmResponsavel'))document.getElementById('crmResponsavel').value=usuarioLogado?.id||'';
  if(document.getElementById('crmProbabilidade'))document.getElementById('crmProbabilidade').value='10';
  document.getElementById('crmProximaTipo').value='Follow-up';
  document.getElementById('crmInteresse').selectedIndex=0;
  document.getElementById('crmEtapa').value='Novo';
  document.getElementById('crmHistoricoArea').style.display='none';
  document.getElementById('btnLeadPerdido')?.classList.remove('hidden');
  document.getElementById('btnExcluirLeadPerdido')?.classList.add('hidden');
  document.getElementById('modalLead').classList.add('active');
  setTimeout(()=>document.getElementById('crmNome').focus(),50);
}
function fecharModalLead(){document.getElementById('modalLead').classList.remove('active')}

async function editarLead(id){
  prepararCamposAgendaCRM();
  if(typeof prepararCamposGestaoComercial==='function')await prepararCamposGestaoComercial();
  const x=crmCache.find(a=>a.id===id) || (await supabaseClient.from('leads').select('*').eq('id',id).single()).data;
  if(!x)return;
  crmEditandoId=id;
  document.getElementById('crmModalTitulo').textContent='Editar lead';
  for(const [k,v] of Object.entries({crmNome:x.nome,crmResponsavel:x.responsavel_id||'',crmTelefone:x.telefone,crmCidade:x.cidade,crmInteresse:x.interesse,crmEtapa:x.etapa,crmProbabilidade:x.probabilidade||10,crmFechamentoPrevisto:x.fechamento_previsto,crmProximaTipo:x.proxima_tipo||'Follow-up',crmProximaAcao:x.proxima,crmProximaHora:x.proxima_hora?String(x.proxima_hora).slice(0,5):'',crmValor:x.valor,crmObs:x.obs,crmMotivoPerda:x.motivo_perda}))if(document.getElementById(k))document.getElementById(k).value=v||'';
  const perdaBox=document.getElementById('crmMotivoPerdaBox');if(perdaBox)perdaBox.style.display=x.motivo_perda?'block':'none';
  const excluirPerdido=document.getElementById('btnExcluirLeadPerdido');if(excluirPerdido)excluirPerdido.classList.toggle('hidden',!x.motivo_perda);
  const marcarPerdido=document.getElementById('btnLeadPerdido');if(marcarPerdido)marcarPerdido.classList.toggle('hidden',!!x.motivo_perda);
  const {data:hist,error}=await supabaseClient.from('lead_interacoes').select('*').eq('lead_id',id).order('criado_em',{ascending:false});
  if(error){alert('Não foi possível carregar o histórico do lead.\n\n'+error.message);return}
  document.getElementById('crmHistoricoArea').style.display='block';
  const historicoEl=document.getElementById('crmHistorico');historicoEl.innerHTML='';
  if(!(hist||[]).length){const vazio=document.createElement('div');vazio.className='crm-next';vazio.textContent='Sem interações registradas.';historicoEl.appendChild(vazio)}
  else (hist||[]).forEach(h=>{const item=document.createElement('div'),texto=document.createTextNode(h.texto||''),data=document.createElement('span');item.className='crm-next';data.textContent=new Date(h.criado_em).toLocaleString('pt-BR');item.append(texto,data);historicoEl.appendChild(item)});
  document.getElementById('modalLead').classList.add('active');
}

async function salvarLead(){
  const nome=document.getElementById('crmNome').value.trim();
  if(!nome)return alert('Informe o nome do lead');
  try{
    const uid=await crmUsuarioId();
    const id=crmEditandoId||('lead-'+Date.now());
    const responsavelEl=document.getElementById('crmResponsavel'),responsavelId=responsavelEl?.value||null,responsavelNome=responsavelEl?.selectedOptions?.[0]?.textContent||'';
    const payload={
      id,nome,responsavel_id:responsavelId,responsavel:responsavelNome==='Selecione'?'':responsavelNome,telefone:document.getElementById('crmTelefone').value,
      cidade:document.getElementById('crmCidade').value,interesse:document.getElementById('crmInteresse').value,
      etapa:document.getElementById('crmEtapa').value,proxima:document.getElementById('crmProximaAcao').value||null,
      proxima_tipo:document.getElementById('crmProximaTipo').value||'Follow-up',proxima_hora:document.getElementById('crmProximaHora').value||null,
      probabilidade:Number(document.getElementById('crmProbabilidade')?.value)||10,fechamento_previsto:document.getElementById('crmFechamentoPrevisto')?.value||null,
      valor:Number(document.getElementById('crmValor').value)||0,obs:document.getElementById('crmObs').value,
      atualizado_em:new Date().toISOString()
    };
    if(crmEditandoId){
      const {error}=await supabaseClient.from('leads').update(payload).eq('id',id); if(error)throw error;
    }else{
      payload.convertido=false; payload.criado_por=uid;
      const {error}=await supabaseClient.from('leads').insert(payload); if(error)throw error;
      const {error:hErr}=await supabaseClient.from('lead_interacoes').insert({lead_id:id,texto:'Lead cadastrado.',criado_por:uid}); if(hErr)throw hErr;
    }
    fecharModalLead();
    await renderizarCRM();
  }catch(e){alert('Não foi possível salvar o lead na nuvem.\n\n'+e.message)}
}

async function adicionarInteracao(){
  const t=document.getElementById('crmNovaInteracao').value.trim();
  if(!t||!crmEditandoId)return;
  try{
    const uid=await crmUsuarioId();
    const {error}=await supabaseClient.from('lead_interacoes').insert({lead_id:crmEditandoId,texto:t,criado_por:uid});
    if(error)throw error;
    document.getElementById('crmNovaInteracao').value='';
    await editarLead(crmEditandoId);
    await renderizarCRM();
  }catch(e){alert('Não foi possível registrar a interação.\n\n'+e.message)}
}

async function moverLeadEtapa(){
  const x=crmCache.find(y=>y.id===crmEditandoId); if(!x)return;
  const i=crmEtapas.indexOf(x.etapa); if(i>=5)return;
  const nova=crmEtapas[i+1];
  try{
    const uid=await crmUsuarioId();
    const {error}=await supabaseClient.from('leads').update({etapa:nova,atualizado_em:new Date().toISOString()}).eq('id',x.id); if(error)throw error;
    await supabaseClient.from('lead_interacoes').insert({lead_id:x.id,texto:'Avançou para '+nova,criado_por:uid});
    await renderizarCRM();
    await editarLead(x.id);
  }catch(e){alert('Não foi possível avançar a etapa.\n\n'+e.message)}
}

async function converterLeadCliente(){
  const x=crmCache.find(y=>y.id===crmEditandoId); if(!x||!confirm('Converter em cliente?'))return;
  try{
    const uid=await crmUsuarioId();
    const {data:existente,error:buscaErr}=await supabaseClient.from('clientes').select('id').ilike('nome',x.nome).limit(1);
    if(buscaErr)throw buscaErr;
    let clienteId=existente?.[0]?.id||null;
    if(!clienteId){
      const {data:novo,error:cErr}=await supabaseClient.from('clientes').insert({nome:x.nome,unidade:x.cidade||'-',documento:'-',ie:'-',regime:'-',telefone:x.telefone||'-',email:'-',observacoes_tecnicas:'Lead convertido pelo Sistema'}).select('id').single();
      if(cErr)throw cErr;
      clienteId=novo.id;
    }
    const {error:lErr}=await supabaseClient.from('leads').update({convertido:true,cliente_id:clienteId,etapa:'Fechado',probabilidade:100,motivo_perda:'',atualizado_em:new Date().toISOString()}).eq('id',x.id); if(lErr)throw lErr;
    await supabaseClient.from('lead_interacoes').insert({lead_id:x.id,texto:'Convertido em cliente.',criado_por:uid});
    await carregarClientesDaNuvem();
    fecharModalLead();
    await renderizarCRM();
    alert('Lead convertido em cliente!');
  }catch(e){alert('Não foi possível converter o lead em cliente.\n\n'+e.message)}
}

// ===== CENTRAL DE NOTIFICAÇÕES =====
    let notificacoesOperacionais = [];
    function idsNotificacoesLidas(){try{return JSON.parse(localStorage.getItem('help_crm_notificacoes_lidas'))||[]}catch(e){return[]}}
    function getNotificacoes(){const lidas=idsNotificacoesLidas();return notificacoesOperacionais.filter(n=>!lidas.includes(n.id))}
    function salvarNotificacoesLidas(ids){localStorage.setItem('help_crm_notificacoes_lidas',JSON.stringify(ids.slice(-300)))}
    async function atualizarAlertasOperacionais(){
      if(!usuarioLogado)return;
      const agora=Date.now(), antecedencia=(parseFloat(localStorage.getItem('help_crm_lembrete_horas'))||4)*3600000;
      const [{data:interacoes},{data:persistidas},{data:processos}]=await Promise.all([supabaseClient.from('chamado_interacoes').select('id,chamado_id,proximo_contato,descricao').not('proximo_contato','is',null).lte('proximo_contato',new Date(agora+antecedencia).toISOString()).order('proximo_contato').limit(30),supabaseClient.from('notificacoes_usuarios').select('*').eq('destinatario_id',usuarioLogado.id).eq('lida',false).order('criado_em',{ascending:false}).limit(40),supabaseClient.from('processos_internos').select('id,titulo,proxima_execucao,responsavel_nome,status').neq('status','Concluída').lte('proxima_execucao',new Date(agora+antecedencia).toISOString()).limit(20)]);
      const ids=[...new Set((interacoes||[]).map(i=>i.chamado_id))];let protocolos={};
      if(ids.length){const{data:chamados}=await supabaseClient.from('chamados').select('id,protocolo').in('id',ids);(chamados||[]).forEach(c=>protocolos[c.id]=c.protocolo)}
      const retornos=(interacoes||[]).map(i=>{const vencido=new Date(i.proximo_contato).getTime()<agora;return{id:`retorno-${i.id}-${i.proximo_contato}`,tipo:vencido?'danger':'warning',titulo:vencido?'Retorno atrasado':'Próximo contato',texto:`Chamado ${protocolos[i.chamado_id]||'#'+i.chamado_id}: ${i.descricao.slice(0,100)}`,tempo:formatarDataHoraInteracao(i.proximo_contato),chamado_id:i.chamado_id}});
      const tarefas=(processos||[]).filter(p=>processoAtribuidoAoUsuario(processosInternos.find(x=>x.id===p.id))||podeAdministrarProcessos()).map(p=>{const vencido=new Date(p.proxima_execucao).getTime()<agora;return{id:`processo-${p.id}-${p.proxima_execucao}`,tipo:vencido?'danger':'warning',titulo:vencido?'Processo atrasado':'Processo próximo',texto:p.titulo,tempo:formatarDataHoraInteracao(p.proxima_execucao)}});
      const sla=todosChamadosOperacionais().filter(c=>c.status!=='Resolvido'&&c.abertura&&(pertenceAoUsuario(c.tecnico)||usuarioLogado.perfil==='admin')).map(c=>{const horas=(agora-new Date(c.abertura).getTime())/36e5,limite=c.prioridade.toLowerCase().includes('alta')?(Number(localStorage.getItem('help_crm_sla_critico'))||4):(Number(localStorage.getItem('help_crm_sla_normal'))||24);return{c,horas,limite}}).filter(x=>x.horas>=x.limite).map(x=>({id:`sla-${x.c.id}-${x.limite}`,tipo:'danger',titulo:'SLA ultrapassado',texto:`${x.c.protocolo} · ${x.c.cliente} está há ${Math.floor(x.horas)}h em aberto.`,tempo:'Ação necessária',chamado_id:x.c.id}));
      const nuvem=(persistidas||[]).map(n=>({id:n.id,tipo:n.tipo==='atribuicao'?'info':'warning',titulo:n.titulo,texto:n.mensagem,tempo:formatarDataHoraInteracao(n.criado_em),chamado_id:n.chamado_id,persistida:true}));
      notificacoesOperacionais=[...nuvem,...sla,...retornos,...tarefas];
      renderizarNotificacoes();
    }
    function renderizarNotificacoes(){
      const lista=getNotificacoes(), el=document.getElementById('notificationList'), badge=document.getElementById('notificationBadge'), sub=document.getElementById('notificationSub');
      if(!el||!badge||!sub)return;
      badge.textContent=lista.length; badge.style.display=lista.length?'grid':'none';
      sub.textContent=lista.length===1?'1 pendente':`${lista.length} pendentes`;
      el.innerHTML='';
      if(!lista.length){el.innerHTML='<div class="notification-empty"><b>Tudo em dia</b>Você não possui notificações pendentes.</div>';return}
      lista.forEach(n=>{const item=document.createElement('div'),dot=document.createElement('span'),corpo=document.createElement('div'),titulo=document.createElement('strong'),texto=document.createElement('p'),tempo=document.createElement('time'),fechar=document.createElement('button');item.className='notification-item';dot.className=`notification-dot ${n.tipo==='info'?'':n.tipo}`;titulo.textContent=n.titulo||'';texto.textContent=n.texto||'';tempo.textContent=n.tempo||'';corpo.append(titulo,texto,tempo);fechar.className='notification-dismiss';fechar.type='button';fechar.title='Marcar como lida';fechar.setAttribute('aria-label','Marcar como lida');fechar.textContent='×';fechar.addEventListener('click',()=>marcarNotificacaoLida(n.id));item.append(dot,corpo,fechar);el.appendChild(item)});
    }
    function alternarNotificacoes(){const panel=document.getElementById('notificationPanel');if(!panel)return;panel.classList.toggle('hidden');if(!panel.classList.contains('hidden'))atualizarAlertasOperacionais()}
    function fecharNotificacoes(){const panel=document.getElementById('notificationPanel');if(panel)panel.classList.add('hidden')}
    async function marcarNotificacaoLida(id){const n=notificacoesOperacionais.find(x=>String(x.id)===String(id));if(n?.persistida)await supabaseClient.from('notificacoes_usuarios').update({lida:true}).eq('id',id);const ids=idsNotificacoesLidas();if(!ids.includes(id))ids.push(id);salvarNotificacoesLidas(ids);renderizarNotificacoes()}
    async function marcarTodasLidas(){await supabaseClient.from('notificacoes_usuarios').update({lida:true}).eq('destinatario_id',usuarioLogado.id).eq('lida',false);salvarNotificacoesLidas([...idsNotificacoesLidas(),...notificacoesOperacionais.map(n=>n.id)]);renderizarNotificacoes()}
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', function (event) {
        if (event.target === modal) fecharModais();
      });
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'){
        fecharModais();
        fecharModalLead();
        fecharModalProcesso();
      }
    });
    document.addEventListener('click',function(e){const wrap=document.querySelector('.notification-wrap');if(wrap&&!wrap.contains(e.target))fecharNotificacoes()});

    // ---- Processos internos recorrentes e colaborativos ----
    let processosInternos = [];
    let execucoesProcessos = [];
    let usuariosAtivosProcessos = [];
    let historicoChecklistProcessos = [];
    let processoEditandoId = null;
    let responsaveisProcessoSelecionados = new Set();
    let responsaveisProcessoOriginais = [];
    let checklistProcessoOriginal = '';
    let processosCarregados = false;
    let canalProcessosEquipe = null;
    let recarregarProcessosTimer = null;

    function dataLocalParaInput(valor) {
      if (!valor) return '';
      const d = new Date(valor), z = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
    }
    function formatarExecucaoProcesso(valor) {
      return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(valor));
    }
    function podeAdministrarProcessos(){return usuarioLogado?.perfil==='admin'||usuarioLogado?.permissoes?.usuarios===true}
    function idsResponsaveisProcesso(p){return (p?.responsaveis||[]).map(r=>r.usuario_id)}
    function processoAtribuidoAoUsuario(p){return idsResponsaveisProcesso(p).includes(usuarioLogado?.id)}
    function podeEditarProcesso(p){return !!p&&(p.criado_por===usuarioLogado?.id||podeAdministrarProcessos())}
    function podeInteragirChecklistProcesso(p){return !!p&&(processoAtribuidoAoUsuario(p)||podeAdministrarProcessos())}
    function nomesResponsaveisProcesso(p){const nomes=(p?.responsaveis||[]).map(r=>r.nome).filter(Boolean);return nomes.length?nomes:(p?.responsavel_nome?[p.responsavel_nome]:[])}
    function preencherResponsaveisProcessos() {
      const filtro=document.getElementById('filtroProcessosResponsavel');
      if(filtro){
        const atual=filtro.value;
        filtro.innerHTML='<option value="">Todos os responsáveis</option>'+usuariosAtivosProcessos.map(u=>`<option value="${u.user_id}">${escaparHtml(u.nome)}</option>`).join('');
        if(usuariosAtivosProcessos.some(u=>u.user_id===atual))filtro.value=atual;
      }
      renderizarSeletorResponsaveisProcesso();
    }
    function renderizarSeletorResponsaveisProcesso(){
      const lista=document.getElementById('processoResponsaveisLista'),resumo=document.getElementById('processoResponsaveisResumo');if(!lista||!resumo)return;
      lista.innerHTML=usuariosAtivosProcessos.map(u=>`<label class="processo-responsavel-opcao"><input type="checkbox" value="${u.user_id}" ${responsaveisProcessoSelecionados.has(u.user_id)?'checked':''} onchange="alternarResponsavelProcesso('${u.user_id}',this.checked)"><span>${escaparHtml(u.nome)}</span></label>`).join('')||'<span>Nenhum usuário ativo encontrado.</span>';
      const nomes=usuariosAtivosProcessos.filter(u=>responsaveisProcessoSelecionados.has(u.user_id)).map(u=>u.nome);
      resumo.textContent=nomes.length?`Selecionados: ${nomes.join(' • ')}`:'Selecione pelo menos um usuário ativo.';
      const todos=usuariosAtivosProcessos.length>0&&nomes.length===usuariosAtivosProcessos.length,soEu=nomes.length===1&&responsaveisProcessoSelecionados.has(usuarioLogado?.id);
      document.querySelectorAll('[data-responsaveis-rapido]').forEach(b=>b.classList.toggle('ativo',(b.dataset.responsaveisRapido==='eu'&&soEu)||(b.dataset.responsaveisRapido==='equipe'&&todos)||(b.dataset.responsaveisRapido==='selecionar'&&!soEu&&!todos&&nomes.length>0)));
      renderizarIcones();
    }
    function alternarResponsavelProcesso(id,selecionado){if(selecionado)responsaveisProcessoSelecionados.add(id);else responsaveisProcessoSelecionados.delete(id);renderizarSeletorResponsaveisProcesso()}
    function selecionarResponsaveisRapido(tipo){
      if(tipo==='eu')responsaveisProcessoSelecionados=new Set(usuarioLogado?.id?[usuarioLogado.id]:[]);
      else if(tipo==='equipe')responsaveisProcessoSelecionados=new Set(usuariosAtivosProcessos.map(u=>u.user_id));
      else if(tipo==='selecionar'&&!responsaveisProcessoSelecionados.size)responsaveisProcessoSelecionados=new Set();
      renderizarSeletorResponsaveisProcesso();
      if(tipo==='selecionar')document.getElementById('processoResponsaveisLista')?.scrollIntoView({block:'nearest'});
    }
    function agendarRecargaProcessos(){clearTimeout(recarregarProcessosTimer);recarregarProcessosTimer=setTimeout(async()=>{await carregarProcessos(true);if(!document.getElementById('visaoMeuTrabalho')?.classList.contains('hidden'))renderizarMeuTrabalho()},180)}
    async function iniciarProcessosTempoReal(){
      if(!usuarioLogado)return;if(canalProcessosEquipe)await supabaseClient.removeChannel(canalProcessosEquipe);
      canalProcessosEquipe=supabaseClient.channel(`processos-equipe-${usuarioLogado.id}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'processo_checklist_itens'},agendarRecargaProcessos)
        .on('postgres_changes',{event:'*',schema:'public',table:'processo_responsaveis'},agendarRecargaProcessos)
        .subscribe();
    }
    async function carregarProcessos(silencioso=false) {
      const lista=document.getElementById('listaProcessos');if(lista&&!silencioso)lista.innerHTML='<div class="processos-vazio">Carregando processos...</div>';
      try{
        const [{data:p,error:ep},{data:e,error:ee},{data:r,error:er},{data:i,error:ei},{data:h,error:eh},{data:u,error:eu}]=await Promise.all([
          supabaseClient.from('processos_internos').select('*').order('proxima_execucao'),
          supabaseClient.from('processo_execucoes').select('*').order('concluido_em',{ascending:false}),
          supabaseClient.from('processo_responsaveis').select('processo_id,usuario_id,atribuido_em'),
          supabaseClient.from('processo_checklist_itens').select('*').order('ordem'),
          supabaseClient.from('processo_checklist_historico').select('*').order('ocorrido_em',{ascending:false}).limit(500),
          supabaseClient.rpc('listar_usuarios_ativos_processo')
        ]);
        if(ep)throw ep;if(ee)throw ee;if(er)throw er;if(ei)throw ei;if(eh)throw eh;if(eu)throw eu;
        usuariosAtivosProcessos=u||[];const usuariosPorId=Object.fromEntries(usuariosAtivosProcessos.map(x=>[x.user_id,x]));
        processosInternos=(p||[]).map(processo=>({
          ...processo,
          responsaveis:(r||[]).filter(x=>x.processo_id===processo.id).map(x=>({...x,nome:usuariosPorId[x.usuario_id]?.nome||'Usuário inativo'})),
          checklistItens:(i||[]).filter(x=>x.processo_id===processo.id)
        }));
        execucoesProcessos=e||[];historicoChecklistProcessos=h||[];processosCarregados=true;preencherResponsaveisProcessos();renderizarProcessos();
      }catch(erro){console.error(erro);if(lista)lista.innerHTML=`<div class="processos-vazio erro">Não foi possível carregar os processos: ${escaparHtml(erro.message)}</div>`}
    }
    function atualizarResumoProcessos(){
      const agora=new Date(), inicioHoje=new Date(agora.getFullYear(),agora.getMonth(),agora.getDate()),fimHoje=new Date(inicioHoje);fimHoje.setDate(fimHoje.getDate()+1);
      const ativos=processosInternos.filter(p=>!['Concluída','Pausada'].includes(p.status));
      document.getElementById('processosPendentes').textContent=ativos.length;
      document.getElementById('processosAtrasados').textContent=ativos.filter(p=>new Date(p.proxima_execucao)<agora).length;
      document.getElementById('processosHoje').textContent=ativos.filter(p=>{const d=new Date(p.proxima_execucao);return d>=inicioHoje&&d<fimHoje}).length;
      document.getElementById('processosExecutadosMes').textContent=execucoesProcessos.filter(e=>{const d=new Date(e.concluido_em);return d.getMonth()===agora.getMonth()&&d.getFullYear()===agora.getFullYear()}).length;
    }
    function rotuloRecorrencia(p){
      if(p.frequencia==='Semanal'&&p.dias_semana?.length){const ds=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];return `Semanal · ${p.dias_semana.map(d=>ds[d]).join(', ')}`}
      if(p.frequencia==='Personalizada')return `A cada ${p.intervalo_dias} dias`;return p.frequencia;
    }
    function renderizarProcessos(){
      const lista=document.getElementById('listaProcessos');if(!lista)return;atualizarResumoProcessos();
      const termo=(document.getElementById('buscaProcessos')?.value||'').trim().toLowerCase(),status=document.getElementById('filtroProcessosStatus')?.value||'',resp=document.getElementById('filtroProcessosResponsavel')?.value||'';
      const itens=processosInternos.filter(p=>{const nomes=nomesResponsaveisProcesso(p);return(!termo||`${p.titulo} ${p.descricao} ${nomes.join(' ')}`.toLowerCase().includes(termo))&&(!status||p.status===status)&&(!resp||idsResponsaveisProcesso(p).includes(resp))});
      if(!itens.length){lista.innerHTML='<div class="processos-vazio"><i data-lucide="clipboard-list"></i><strong>Nenhum processo encontrado</strong><span>Crie uma rotina ou ajuste os filtros.</span></div>';renderizarIcones();return}
      lista.innerHTML='';itens.forEach(p=>{
        const agora=new Date(), prazo=new Date(p.proxima_execucao), atrasado=!['Concluída','Pausada'].includes(p.status)&&prazo<agora, podeInteragir=podeInteragirChecklistProcesso(p),podeEditar=podeEditarProcesso(p),atribuido=processoAtribuidoAoUsuario(p);
        const eventos=[...execucoesProcessos.filter(e=>e.processo_id===p.id).map(e=>({tipo:'execucao',data:e.concluido_em,nome:e.executado_por_nome,texto:e.observacao||'Execução concluída'})),...historicoChecklistProcessos.filter(e=>e.processo_id===p.id).map(e=>({tipo:'checklist',data:e.ocorrido_em,nome:e.usuario_nome,texto:`${e.acao==='marcou'?'Marcou':'Desmarcou'}: ${e.item_texto}`}))].sort((a,b)=>new Date(b.data)-new Date(a.data));
        const card=document.createElement('article');card.className=`processo-card ${atrasado?'atrasado':''}`;
        const checklist=(p.checklistItens||[]).map(item=>`<label class="processo-check ${podeInteragir?'':'bloqueado'}"><input type="checkbox" ${item.concluido?'checked':''} ${podeInteragir?'':'disabled'} onchange="alternarItemChecklistProcesso('${item.id}',this.checked,this)"><span>${escaparHtml(item.texto)}${item.concluido&&item.marcado_por_nome?`<small class="processo-check-detalhe">Marcado por ${escaparHtml(item.marcado_por_nome)} · ${formatarExecucaoProcesso(item.marcado_em)}</small>`:''}</span></label>`).join('');
        const chips=nomesResponsaveisProcesso(p).map(n=>`<span class="processo-responsavel-chip"><i data-lucide="user"></i>${escaparHtml(n)}</span>`).join('');
        card.innerHTML=`<div class="processo-card-top"><div><div class="processo-badges"><span class="processo-status status-${p.status.replaceAll(' ','-').toLowerCase()}">${escaparHtml(p.status)}</span><span class="processo-prioridade prioridade-${p.prioridade.toLowerCase()}">${escaparHtml(p.prioridade)}</span>${atrasado?'<span class="processo-atrasado">Atrasado</span>':''}${atribuido?'<span class="processo-status processo-atribuido-mim">Atribuído a mim</span>':''}</div><h3>${escaparHtml(p.titulo)}</h3><p>${escaparHtml(p.descricao||'Sem descrição')}</p></div>${podeEditar?`<div class="processo-card-acoes"><button title="Editar" onclick="abrirModalProcesso('${p.id}')"><i data-lucide="pencil"></i></button><button title="Excluir" onclick="excluirProcesso('${p.id}')"><i data-lucide="trash-2"></i></button></div>`:''}</div><div class="processo-meta"><span class="processo-responsaveis-chips"><strong>Responsáveis:</strong>${chips}</span><span><i data-lucide="calendar-clock"></i>${formatarExecucaoProcesso(p.proxima_execucao)}</span><span><i data-lucide="repeat-2"></i>${escaparHtml(rotuloRecorrencia(p))}</span></div>${checklist?`<div class="processo-checklist">${checklist}</div>`:''}${p.observacoes?`<div class="processo-observacoes"><i data-lucide="sticky-note"></i>${escaparHtml(p.observacoes)}</div>`:''}${podeInteragir?`<div class="processo-card-rodape"><button class="btn btn-secondary" onclick="alterarStatusProcesso('${p.id}','${p.status==='Pausada'?'Pendente':'Pausada'}')"><i data-lucide="${p.status==='Pausada'?'play':'pause'}"></i>${p.status==='Pausada'?'Retomar':'Pausar'}</button><button class="btn btn-primary" onclick="concluirProcesso('${p.id}')"><i data-lucide="check"></i>Concluir execução</button></div>`:''}${eventos.length?`<details class="processo-historico"><summary>Histórico recente (${eventos.length})</summary>${eventos.slice(0,8).map(e=>`<div class="${e.tipo==='checklist'?'evento-checklist':''}"><i data-lucide="${e.tipo==='checklist'?'list-checks':'check-circle'}"></i><span><strong>${escaparHtml(e.nome)}</strong><small>${formatarExecucaoProcesso(e.data)} · ${escaparHtml(e.texto)}</small></span></div>`).join('')}</details>`:''}`;
        lista.appendChild(card);
      });renderizarIcones();
    }
    function atualizarCamposRecorrencia(){const f=document.getElementById('processoFrequencia').value;document.getElementById('processoDiasWrap').classList.toggle('hidden',f!=='Semanal');document.getElementById('processoIntervaloWrap').classList.toggle('hidden',f!=='Personalizada')}
    function abrirModalProcesso(id=null){
      const p=processosInternos.find(x=>x.id===id);if(p&&!podeEditarProcesso(p)){alert('Somente o criador ou um administrador pode editar os dados deste processo.');return}
      processoEditandoId=id;responsaveisProcessoOriginais=idsResponsaveisProcesso(p);responsaveisProcessoSelecionados=new Set(p?responsaveisProcessoOriginais:(usuarioLogado?.id?[usuarioLogado.id]:[]));preencherResponsaveisProcessos();
      document.getElementById('processoModalTitulo').textContent=p?'Editar processo interno':'Novo processo interno';
      checklistProcessoOriginal=(p?.checklistItens||[]).map(i=>i.texto).join('\n');document.getElementById('processoTitulo').value=p?.titulo||'';document.getElementById('processoPrioridade').value=p?.prioridade||'Normal';document.getElementById('processoFrequencia').value=p?.frequencia||'Única';document.getElementById('processoProximaExecucao').value=dataLocalParaInput(p?.proxima_execucao||new Date(Date.now()+3600000));document.getElementById('processoIntervalo').value=p?.intervalo_dias||7;document.getElementById('processoDescricao').value=p?.descricao||'';document.getElementById('processoChecklist').value=checklistProcessoOriginal;document.getElementById('processoObservacoes').value=p?.observacoes||'';
      document.querySelectorAll('#processoDiasWrap input').forEach(c=>c.checked=(p?.dias_semana||[]).includes(Number(c.value)));atualizarCamposRecorrencia();document.getElementById('modalProcesso').classList.add('active');renderizarIcones();
    }
    function fecharModalProcesso(){document.getElementById('modalProcesso')?.classList.remove('active');processoEditandoId=null;responsaveisProcessoSelecionados=new Set();responsaveisProcessoOriginais=[];checklistProcessoOriginal=''}
    async function sincronizarResponsaveisProcesso(id,novos,atuais=[]){
      const adicionar=novos.filter(x=>!atuais.includes(x)),remover=atuais.filter(x=>!novos.includes(x));
      if(adicionar.length){const{error}=await supabaseClient.from('processo_responsaveis').insert(adicionar.map(usuario_id=>({processo_id:id,usuario_id,atribuido_por:usuarioLogado.id})));if(error)throw error}
      if(remover.length){const{error}=await supabaseClient.from('processo_responsaveis').delete().eq('processo_id',id).in('usuario_id',remover);if(error)throw error}
    }
    async function substituirChecklistProcesso(id,textos){
      const{error:ed}=await supabaseClient.from('processo_checklist_itens').delete().eq('processo_id',id);if(ed)throw ed;
      if(textos.length){const{error:ei}=await supabaseClient.from('processo_checklist_itens').insert(textos.map((texto,ordem)=>({processo_id:id,ordem,texto})));if(ei)throw ei}
    }
    async function salvarProcesso(){
      const titulo=document.getElementById('processoTitulo').value.trim(),responsaveis=[...responsaveisProcessoSelecionados],valorData=document.getElementById('processoProximaExecucao').value,frequencia=document.getElementById('processoFrequencia').value;
      if(!titulo||!responsaveis.length||!valorData){alert('Preencha título, escolha ao menos um responsável e informe a próxima execução.');return}
      const dias=[...document.querySelectorAll('#processoDiasWrap input:checked')].map(c=>Number(c.value));if(frequencia==='Semanal'&&!dias.length){alert('Escolha pelo menos um dia da semana.');return}
      const textosChecklist=document.getElementById('processoChecklist').value.split('\n').map(x=>x.trim()).filter(Boolean),textoChecklistNormalizado=textosChecklist.join('\n');
      const nomes=usuariosAtivosProcessos.filter(u=>responsaveis.includes(u.user_id)).map(u=>u.nome),dados={titulo,descricao:document.getElementById('processoDescricao').value.trim(),prioridade:document.getElementById('processoPrioridade').value,frequencia,dias_semana:dias,intervalo_dias:frequencia==='Personalizada'?Number(document.getElementById('processoIntervalo').value):null,proxima_execucao:new Date(valorData).toISOString(),observacoes:document.getElementById('processoObservacoes').value.trim(),atualizado_em:new Date().toISOString()};
      const botao=document.getElementById('btnSalvarProcesso');botao.disabled=true;
      let id=processoEditandoId,criadoAgora=false;
      try{
        if(id){const{error}=await supabaseClient.from('processos_internos').update(dados).eq('id',id);if(error)throw error}
        else{const legado=textosChecklist.map(texto=>({texto,concluido:false})),{data,error}=await supabaseClient.from('processos_internos').insert({...dados,responsavel_nome:nomes.join(' • '),checklist:legado,criado_por:usuarioLogado.id}).select('id').single();if(error)throw error;id=data.id;criadoAgora=true}
        await sincronizarResponsaveisProcesso(id,responsaveis,criadoAgora?[]:responsaveisProcessoOriginais);
        if(criadoAgora||textoChecklistNormalizado!==checklistProcessoOriginal)await substituirChecklistProcesso(id,textosChecklist);
        registrarLog(`${processoEditandoId?'editou':'criou'} o processo ${titulo}`);fecharModalProcesso();await carregarProcessos();
      }
      catch(erro){alert('Não foi possível salvar o processo.\n\n'+erro.message)}finally{botao.disabled=false}
    }
    function calcularProximaExecucao(p,base){
      const d=new Date(base),dias=p.dias_semana||[];
      if(p.frequencia==='Diária')d.setDate(d.getDate()+1);else if(p.frequencia==='Quinzenal')d.setDate(d.getDate()+15);else if(p.frequencia==='Mensal')d.setMonth(d.getMonth()+1);else if(p.frequencia==='Personalizada')d.setDate(d.getDate()+(p.intervalo_dias||1));else if(p.frequencia==='Semanal'){do{d.setDate(d.getDate()+1)}while(!dias.includes(d.getDay()))}return d;
    }
    async function concluirProcesso(id){
      const p=processosInternos.find(x=>x.id===id);if(!p||!podeInteragirChecklistProcesso(p))return;const checklist=(p.checklistItens||[]).map(item=>({id:item.id,texto:item.texto,concluido:item.concluido,marcado_por:item.marcado_por,marcado_por_nome:item.marcado_por_nome,marcado_em:item.marcado_em}));if(checklist.length&&checklist.some(i=>!i.concluido)&&!confirm('Ainda existem itens não marcados. Deseja concluir mesmo assim?'))return;
      const observacao=prompt('Observação desta execução (opcional):','');if(observacao===null)return;const agora=new Date(),unica=p.frequencia==='Única',atualizacao={ultima_execucao:agora.toISOString(),status:unica?'Concluída':'Pendente',atualizado_em:agora.toISOString()};if(!unica)atualizacao.proxima_execucao=calcularProximaExecucao(p,new Date(Math.max(agora,new Date(p.proxima_execucao)))).toISOString();
      try{const{error:e1}=await supabaseClient.from('processo_execucoes').insert({processo_id:id,executado_por:usuarioLogado.id,executado_por_nome:usuarioLogado.usuario,observacao,checklist});if(e1)throw e1;const{error:e2}=await supabaseClient.from('processos_internos').update(atualizacao).eq('id',id);if(e2)throw e2;if(!unica){const{error:e3}=await supabaseClient.from('processo_checklist_itens').update({concluido:false}).eq('processo_id',id).eq('concluido',true);if(e3)throw e3}registrarLog(`concluiu o processo ${p.titulo}`);await carregarProcessos()}catch(erro){alert('Não foi possível concluir o processo.\n\n'+erro.message)}
    }
    async function alternarItemChecklistProcesso(id,concluido,input){
      if(input)input.disabled=true;const{data,error}=await supabaseClient.from('processo_checklist_itens').update({concluido}).eq('id',id).select('id').maybeSingle();
      if(error||!data){if(input){input.checked=!concluido;input.disabled=false}alert(error?.message||'Você não tem permissão para alterar este checklist.');return}
      await carregarProcessos(true);if(!document.getElementById('visaoMeuTrabalho')?.classList.contains('hidden'))renderizarMeuTrabalho();
    }
    async function alterarStatusProcesso(id,status){const p=processosInternos.find(x=>x.id===id);if(!podeInteragirChecklistProcesso(p))return;const{error}=await supabaseClient.from('processos_internos').update({status,atualizado_em:new Date().toISOString()}).eq('id',id);if(error)alert(error.message);else await carregarProcessos()}
    async function excluirProcesso(id){const p=processosInternos.find(x=>x.id===id);if(!p||!podeEditarProcesso(p)||!confirm(`Excluir o processo "${p.titulo}" e todo o histórico dele?`))return;const{error}=await supabaseClient.from('processos_internos').delete().eq('id',id);if(error)alert('Não foi possível excluir.\n\n'+error.message);else{registrarLog(`excluiu o processo ${p.titulo}`);await carregarProcessos()}}

    // Fluxo diário: Meu trabalho, Kanban, cronômetro, menções e alertas nativos
    let canalNotificacoesEquipe=null, cronometroIntervalo=null;
    function todosChamadosOperacionais(){return [...document.querySelectorAll('#tabelaChamados tbody tr')].filter(l=>l.cells?.length>=13).map(l=>({el:l,id:l.dataset.idNuvem||'',protocolo:l.cells[0].innerText.trim(),abertura:l.dataset.aberturaIso||'',cliente:l.cells[2].innerText.trim(),unidade:l.cells[3].innerText.trim(),tecnico:l.cells[7].innerText.trim(),modulo:l.cells[8].innerText.trim(),prioridade:l.cells[10].innerText.trim(),status:l.cells[11].innerText.trim(),erro:l.dataset.erro||''}))}
    function pertenceAoUsuario(nome){const tecnico=tecnicosNuvem.find(t=>(t.nome||'').toLowerCase().trim()===(nome||'').toLowerCase().trim());if(tecnico?.user_id)return tecnico.user_id===usuarioLogado?.id;const alvo=(nome||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),eu=(usuarioLogado?.usuario||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return alvo.split(/\W+/).filter(x=>x.length>=4).some(x=>eu.includes(x)||x.includes(eu.replace(/\d/g,'')))}
    function cardOperacionalChamado(c){return `<article class="trabalho-card ${c.prioridade.toLowerCase().includes('alta')?'alta':''}" onclick="abrirChamadoDashboard('${c.id}')"><div><span>${escaparHtml(c.protocolo)}</span><b class="badge ${c.status==='Resolvido'?'badge-resolvido':c.status==='Em Andamento'?'badge-andamento':'badge-pendente'}">${escaparHtml(c.status)}</b></div><h3>${escaparHtml(c.cliente)}</h3><p>${escaparHtml(c.erro||c.modulo)}</p><footer><span><i data-lucide="box"></i>${escaparHtml(c.modulo)}</span><span><i data-lucide="calendar"></i>${c.abertura?formatarExecucaoProcesso(c.abertura):'—'}</span></footer></article>`}
    function cardOperacionalProcesso(p){return `<article class="trabalho-card processo-trabalho ${p.prioridade.toLowerCase()==='alta'?'alta':''}" onclick="trocarAba('processos')"><div><span>PROCESSO INTERNO</span><b class="badge ${p.status==='Concluída'?'badge-resolvido':p.status==='Em andamento'?'badge-andamento':'badge-pendente'}">${escaparHtml(p.status)}</b></div><h3>${escaparHtml(p.titulo)}</h3><p>${escaparHtml(p.descricao||nomesResponsaveisProcesso(p).join(' • '))}</p><footer><span class="atribuido-mim"><i data-lucide="user-check"></i>Atribuído a mim</span><span><i data-lucide="calendar"></i>${formatarExecucaoProcesso(p.proxima_execucao)}</span></footer></article>`}
    async function renderizarMeuTrabalho(){
      const lista=document.getElementById('meuTrabalhoLista'),resumo=document.getElementById('meuTrabalhoResumo');if(!lista||!resumo)return;if(!processosCarregados)await carregarProcessos(true);
      const filtro=document.getElementById('meuTrabalhoFiltro')?.value||'abertos',chamados=todosChamadosOperacionais().filter(c=>pertenceAoUsuario(c.tecnico)),processos=processosInternos.filter(processoAtribuidoAoUsuario);
      const chamadosFiltrados=chamados.filter(c=>filtro==='todos'||(filtro==='resolvidos'?c.status==='Resolvido':c.status!=='Resolvido')),processosFiltrados=processos.filter(p=>filtro==='todos'||(filtro==='resolvidos'?p.status==='Concluída':p.status!=='Concluída'));
      const abertosChamados=chamados.filter(c=>c.status!=='Resolvido'),abertosProcessos=processos.filter(p=>p.status!=='Concluída'),alta=abertosChamados.filter(c=>c.prioridade.toLowerCase().includes('alta')).length+abertosProcessos.filter(p=>p.prioridade.toLowerCase()==='alta').length,andamento=chamados.filter(c=>c.status==='Em Andamento').length+processos.filter(p=>p.status==='Em andamento').length;
      let minutos=0;try{const ids=chamados.map(c=>c.id).filter(Boolean);if(ids.length){const{data}=await supabaseClient.from('chamado_tempos').select('minutos').in('chamado_id',ids).eq('usuario_id',usuarioLogado.id);minutos=(data||[]).reduce((s,x)=>s+(x.minutos||0),0)}}catch(e){console.warn(e)}
      resumo.innerHTML=`<div><span>Minha fila</span><strong>${abertosChamados.length+abertosProcessos.length}</strong></div><div><span>Em andamento</span><strong>${andamento}</strong></div><div class="alerta"><span>Alta prioridade</span><strong>${alta}</strong></div><div><span>Tempo registrado</span><strong>${formatarMinutos(minutos)}</strong></div>`;
      const cards=[...chamadosFiltrados.map(cardOperacionalChamado),...processosFiltrados.map(cardOperacionalProcesso)];lista.innerHTML=cards.length?cards.join(''):'<div class="operacional-vazio"><i data-lucide="check-circle-2"></i><strong>Tudo em dia</strong><span>Nenhum chamado ou processo nesta visualização.</span></div>';renderizarIcones();
    }
    function preencherFiltroKanban(){const s=document.getElementById('kanbanTecnico');if(!s)return;const atual=s.value,nomes=[...new Set(todosChamadosOperacionais().map(c=>c.tecnico).filter(x=>x&&x!=='-'))].sort();s.innerHTML='<option value="">Todos os técnicos</option>'+nomes.map(n=>`<option>${escaparHtml(n)}</option>`).join('');s.value=atual}
    function renderizarKanban(){const board=document.getElementById('kanbanChamados');if(!board)return;preencherFiltroKanban();const tecnico=document.getElementById('kanbanTecnico')?.value||'',busca=(document.getElementById('kanbanBusca')?.value||'').toLowerCase(),colunas=['Pendente','Em Andamento','Aguardando Cliente','Resolvido'];const chamados=todosChamadosOperacionais().filter(c=>(!tecnico||c.tecnico===tecnico)&&(!busca||`${c.protocolo} ${c.cliente} ${c.modulo}`.toLowerCase().includes(busca)));board.innerHTML=colunas.map(status=>{const itens=chamados.filter(c=>c.status===status||(status==='Pendente'&&c.status==='Aberto'));return `<section class="kanban-coluna" data-status="${status}" ondragover="event.preventDefault()" ondrop="soltarChamadoKanban(event,'${status}')"><header><span class="kanban-status-dot status-${status.toLowerCase().replaceAll(' ','-')}"></span><h3>${status}</h3><b>${itens.length}</b></header><div>${itens.map(c=>`<article class="kanban-card" draggable="true" data-id="${c.id}" ondragstart="event.dataTransfer.setData('text/plain','${c.id}')" onclick="abrirChamadoDashboard('${c.id}')"><span>${escaparHtml(c.protocolo)}</span><h4>${escaparHtml(c.cliente)}</h4><p>${escaparHtml(c.modulo)}</p><footer><small>${escaparHtml(c.tecnico)}</small><b class="${c.prioridade.toLowerCase().includes('alta')?'alta':''}">${escaparHtml(c.prioridade)}</b></footer></article>`).join('')||'<div class="kanban-vazio">Solte um chamado aqui</div>'}</div></section>`}).join('');renderizarIcones()}
    async function soltarChamadoKanban(event,status){const permitidos=['Pendente','Em Andamento','Aguardando Cliente','Resolvido'];if(!permitidos.includes(status))return;const id=event.dataTransfer.getData('text/plain'),c=todosChamadosOperacionais().find(x=>String(x.id)===String(id));if(!c||c.status===status)return;event.preventDefault();if(status==='Resolvido'){abrirChamadoDashboard(id);document.getElementById('mStatus').value='Resolvido';atualizarChecklistEncerramento();alert('Complete o checklist de encerramento antes de resolver.');return}const{error}=await supabaseClient.from('chamados').update({status,fechamento_em:null}).eq('id',id);if(error){alert(error.message);return}definirBadge(c.el.cells[11],status==='Em Andamento'?'badge-andamento':'badge-pendente',status);c.el.cells[12].innerText='-';c.el.dataset.fechamentoIso='';renderizarKanban();atualizarMetricas()}
    function formatarMinutos(m){m=Math.max(0,Math.round(m||0));return m>=60?`${Math.floor(m/60)}h ${m%60}min`:`${m}min`}
    async function atualizarControleAtendimento(){if(!linhaEdicaoChamado)return;const area=document.getElementById('controleAtendimento'),id=await obterIdChamadoAtual();area.classList.remove('hidden');const{data,error}=await supabaseClient.from('chamado_tempos').select('*').eq('chamado_id',id).order('iniciado_em',{ascending:false});if(error)return;const total=(data||[]).reduce((s,x)=>s+(x.minutos||0),0),aberto=(data||[]).find(x=>!x.finalizado_em&&x.usuario_id===usuarioLogado.id);linhaEdicaoChamado.dataset.tempoMinutos=String(total);linhaEdicaoChamado.dataset.tempoAbertoId=aberto?.id||'';linhaEdicaoChamado.dataset.tempoIniciado=aberto?.iniciado_em||'';atualizarCronometroVisual();atualizarChecklistEncerramento()}
    function atualizarCronometroVisual(){if(!linhaEdicaoChamado)return;const total=Number(linhaEdicaoChamado.dataset.tempoMinutos||0),inicio=linhaEdicaoChamado.dataset.tempoIniciado,rodando=!!inicio,decorrido=rodando?Math.floor((Date.now()-new Date(inicio).getTime())/60000):0;document.getElementById('tempoChamadoResumo').textContent=`${formatarMinutos(total+decorrido)} ${rodando?'· em andamento':''}`;const b=document.getElementById('btnCronometroChamado');b.innerHTML=rodando?'<i data-lucide="square"></i>Finalizar atendimento':'<i data-lucide="play"></i>Iniciar atendimento';b.classList.toggle('cronometro-ativo',rodando);clearInterval(cronometroIntervalo);if(rodando)cronometroIntervalo=setInterval(atualizarCronometroVisual,30000);renderizarIcones()}
    function prepararResolucaoAoFinalizarAtendimento(observacao){
      const campoResolucao=document.getElementById('mResolucao'),campoStatus=document.getElementById('mStatus');
      const texto=(observacao||'').trim();
      if(campoResolucao&&texto){
        const atual=campoResolucao.value.trim();
        if(!atual)campoResolucao.value=texto;
        else if(!atual.split('\n').map(x=>x.trim()).includes(texto))campoResolucao.value=`${atual}\n${texto}`;
        campoResolucao.dispatchEvent(new Event('input',{bubbles:true}));
      }
      if(campoStatus){
        campoStatus.value='Resolvido';
        campoStatus.dispatchEvent(new Event('change',{bubbles:true}));
      }
      atualizarChecklistEncerramento();
    }
    async function alternarCronometroChamado(){
      if(!linhaEdicaoChamado)return;
      const id=await obterIdChamadoAtual(),registro=linhaEdicaoChamado.dataset.tempoAbertoId;
      if(registro){
        const inicio=new Date(linhaEdicaoChamado.dataset.tempoIniciado),fim=new Date(),minutos=Math.max(1,Math.round((fim-inicio)/60000));
        const obs=prompt('O que foi feito neste período? (opcional)','');
        if(obs===null)return;
        const{data,error}=await supabaseClient.from('chamado_tempos').update({finalizado_em:fim.toISOString(),minutos,observacao:obs}).eq('id',registro).select('id').maybeSingle();
        if(error){alert(error.message);return}
        if(!data){alert('O atendimento não foi finalizado. Verifique sua permissão e tente novamente.');return}
        prepararResolucaoAoFinalizarAtendimento(obs);
        await atualizarControleAtendimento();
        const resolucaoPreenchida=!!document.getElementById('mResolucao')?.value.trim();
        const contatoConfirmado=!!document.getElementById('mContatoConfirmado')?.checked;
        if(resolucaoPreenchida&&contatoConfirmado)await salvarChamado();
      }else{
        const{error}=await supabaseClient.from('chamado_tempos').insert({chamado_id:id,usuario_id:usuarioLogado.id,usuario_nome:usuarioLogado.usuario});
        if(error){alert('Não foi possível iniciar este atendimento.\n\n'+error.message);return}
        await atualizarControleAtendimento();
      }
    }
    function atualizarChecklistEncerramento(){const status=document.getElementById('mStatus')?.value,box=document.getElementById('checklistEncerramento');if(!box)return;box.classList.toggle('hidden',status!=='Resolvido');const resolucao=!!document.getElementById('mResolucao')?.value.trim(),tempo=Number(linhaEdicaoChamado?.dataset.tempoMinutos||0)>0;document.getElementById('checkResolucao').classList.toggle('ok',resolucao);document.getElementById('checkResolucao').querySelector('i')?.setAttribute('data-lucide',resolucao?'check-circle-2':'circle');document.getElementById('checkTempo').classList.toggle('ok',tempo);document.getElementById('checkTempo').querySelector('i')?.setAttribute('data-lucide',tempo?'check-circle-2':'circle');renderizarIcones()}
    function preencherMencoesEquipe(){const d=document.getElementById('listaMencoesEquipe');if(!d)return;const nomes=[...document.querySelectorAll('#mTecnico option')].map(o=>o.value).filter(Boolean);d.innerHTML=nomes.map(n=>`<option value="@${escaparHtml(n)} ">`).join('')}
    async function perfilPorNome(nome){const limpo=nome.replace(/^@/,'').trim().toLowerCase(),tecnico=tecnicosNuvem.find(t=>(t.nome||'').toLowerCase()===limpo);if(tecnico?.user_id)return{user_id:tecnico.user_id,nome:tecnico.nome};const{data}=await supabaseClient.from('perfis_usuarios').select('user_id,nome').eq('ativo',true);return(data||[]).find(p=>(p.nome||'').toLowerCase()===limpo||(p.nome||'').toLowerCase().startsWith(limpo))}
    async function criarNotificacao(destinatario,tipo,titulo,mensagem,chamadoId=null){if(!destinatario||destinatario===usuarioLogado.id)return;await supabaseClient.from('notificacoes_usuarios').insert({destinatario_id:destinatario,remetente_id:usuarioLogado.id,tipo,titulo,mensagem,chamado_id:chamadoId})}
    async function processarMencoesInteracao(texto,chamadoId,protocolo){const nomes=[...texto.matchAll(/@([\p{L}\d._-]+(?:\s+[\p{L}\d._-]+)?)/gu)].map(x=>x[1]);for(const nome of [...new Set(nomes)]){const p=await perfilPorNome(nome);if(p)await criarNotificacao(p.user_id,'mencao',`Você foi mencionado em ${protocolo}`,texto.slice(0,500),chamadoId)}}
    async function notificarTecnicoAtribuido(nome,chamadoId,protocolo){const p=await perfilPorNome(nome);if(p)await criarNotificacao(p.user_id,'atribuicao',`Novo chamado atribuído: ${protocolo}`,`O chamado ${protocolo} foi atribuído a você.`,chamadoId)}
    function tocarSomNotificacao(){try{const A=window.AudioContext||window.webkitAudioContext;audioContextoNotificacao=audioContextoNotificacao||new A();const ctx=audioContextoNotificacao;if(ctx.state==='suspended')ctx.resume();[[0,880,.12],[.16,1174,.15]].forEach(([t,f,d])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,ctx.currentTime+t);g.gain.exponentialRampToValueAtTime(.16,ctx.currentTime+t+.015);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+t+d);o.connect(g);g.connect(ctx.destination);o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+d+.02)})}catch(e){console.warn(e)}}
    async function ativarNotificacoesNativas(){if(!('Notification'in window)){alert('Este navegador não oferece notificações.');return}const p=await Notification.requestPermission();if(p==='granted'){localStorage.setItem('help_crm_notificacoes_nativas','1');tocarSomNotificacao();new Notification('Alertas ativados',{body:'O Sistema avisará sobre atribuições, menções, retornos e prazos.'});document.getElementById('btnAtivarNotificacoes').classList.add('ativo')}else alert('Permissão não concedida. Libere as notificações nas configurações do navegador.')}
    function exibirNotificacaoNativa(n){if(localStorage.getItem('help_crm_notificacoes_nativas')!=='1'||Notification.permission!=='granted')return;tocarSomNotificacao();const x=new Notification(n.titulo,{body:n.mensagem||n.texto,tag:n.id,renotify:true});x.onclick=()=>{window.focus();if(n.chamado_id)abrirChamadoDashboard(String(n.chamado_id));x.close()}}
    async function iniciarNotificacoesTempoReal(){if(!usuarioLogado)return;if(canalNotificacoesEquipe)await supabaseClient.removeChannel(canalNotificacoesEquipe);canalNotificacoesEquipe=supabaseClient.channel(`notificacoes-${usuarioLogado.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'notificacoes_usuarios',filter:`destinatario_id=eq.${usuarioLogado.id}`},payload=>{const n=payload.new;exibirNotificacaoNativa(n);atualizarAlertasOperacionais()}).subscribe();if(intervaloNotificacoes)clearInterval(intervaloNotificacoes);intervaloNotificacoes=setInterval(()=>{atualizarAlertasOperacionais();verificarPrazosNativos()},60000);atualizarAlertasOperacionais()}
    async function verificarPrazosNativos(){const novas=getNotificacoes().filter(n=>!idsNotificacoesLidas().includes(n.id));const avisadas=JSON.parse(localStorage.getItem('help_crm_notificacoes_avisadas')||'[]');novas.forEach(n=>{if(!avisadas.includes(n.id)){exibirNotificacaoNativa(n);avisadas.push(n.id)}});localStorage.setItem('help_crm_notificacoes_avisadas',JSON.stringify(avisadas.slice(-300)))}
    document.getElementById('mStatus')?.addEventListener('change',atualizarChecklistEncerramento);document.getElementById('mResolucao')?.addEventListener('input',atualizarChecklistEncerramento);

    // Dashboard operacional personalizável
    const DASHBOARD_WIDGETS = {
      sla: { titulo:'SLA atrasado', icone:'alarm-clock', tamanho:'pequeno' },
      contatos: { titulo:'Próximos contatos', icone:'phone-forwarded', tamanho:'medio' },
      processos: { titulo:'Processos de hoje', icone:'list-checks', tamanho:'medio' },
      minhaFila: { titulo:'Minha fila', icone:'inbox', tamanho:'medio' },
      semTecnico: { titulo:'Sem técnico', icone:'user-x', tamanho:'pequeno' },
      prioridade: { titulo:'Alta prioridade', icone:'triangle-alert', tamanho:'pequeno' },
      recentes: { titulo:'Atendimentos recentes', icone:'history', tamanho:'medio' },
      recorrentes: { titulo:'Clientes recorrentes', icone:'repeat-2', tamanho:'medio' },
      desempenho: { titulo:'Desempenho da equipe', icone:'chart-no-axes-combined', tamanho:'grande' },
      agenda: { titulo:'Agenda operacional', icone:'calendar-clock', tamanho:'grande' },
      crmAgenda: { titulo:'Agenda comercial', icone:'handshake', tamanho:'medio' },
      avisos: { titulo:'Avisos internos', icone:'megaphone', tamanho:'medio' },
      atalhos: { titulo:'Atalhos rápidos', icone:'zap', tamanho:'medio' },
      graficoTecnico: { titulo:'Chamados por técnico', icone:'bar-chart-3', tamanho:'medio' },
      graficoStatus: { titulo:'Chamados por status', icone:'pie-chart', tamanho:'medio' },
      contratosAtivos: { titulo:'Contratos ativos', icone:'file-check-2', tamanho:'pequeno' },
      contratosVencendo: { titulo:'Contratos vencendo', icone:'calendar-warning', tamanho:'pequeno' },
      contratosAtraso: { titulo:'Contratos em atraso', icone:'badge-alert', tamanho:'pequeno' },
      receitaContratada: { titulo:'Receita mensal contratada', icone:'circle-dollar-sign', tamanho:'pequeno' },
      contratosVencimentos: { titulo:'Próximos vencimentos de contratos', icone:'calendar-clock', tamanho:'medio' },
      contratosRenovar: { titulo:'Contratos para renovar', icone:'refresh-cw', tamanho:'medio' }
    };
    const DASHBOARD_PADRAO = ['sla','contatos','processos','minhaFila','semTecnico','prioridade','agenda','recentes','avisos','atalhos','desempenho','recorrentes'];
    let dashboardConfig = DASHBOARD_PADRAO.map(id=>({id,visivel:true,tamanho:DASHBOARD_WIDGETS[id].tamanho}));
    let dashboardPeriodoAtual = 'hoje', dashboardInteracoes = [], dashboardProcessos = [], dashboardLeads = [], dashboardAvisos = [], dashboardContratos = [], dashboardContratosLancamentos = [], dashboardCarregado = false;

    function normalizarDashboardConfig(widgets){
      const recebidos=Array.isArray(widgets)?widgets:[], usados=new Set(), saida=[];
      recebidos.forEach(item=>{const id=typeof item==='string'?item:item?.id;if(!DASHBOARD_WIDGETS[id]||usados.has(id))return;usados.add(id);saida.push({id,visivel:item?.visivel!==false,tamanho:['pequeno','medio','grande'].includes(item?.tamanho)?item.tamanho:DASHBOARD_WIDGETS[id].tamanho})});
      Object.keys(DASHBOARD_WIDGETS).forEach(id=>{if(!usados.has(id))saida.push({id,visivel:false,tamanho:DASHBOARD_WIDGETS[id].tamanho})});return saida;
    }
    function dataNoPeriodo(data,periodo=dashboardPeriodoAtual){
      if(!data)return false;const d=new Date(data);if(Number.isNaN(d.getTime()))return false;if(periodo==='todos')return true;
      const agora=new Date(),inicioHoje=new Date(agora.getFullYear(),agora.getMonth(),agora.getDate()),fimHoje=new Date(inicioHoje);fimHoje.setDate(fimHoje.getDate()+1);
      if(periodo==='hoje')return d>=inicioHoje&&d<fimHoje;
      if(periodo==='semana'){const inicio=new Date(inicioHoje);inicio.setDate(inicio.getDate()-6);return d>=inicio}
      if(periodo==='mes')return d.getMonth()===agora.getMonth()&&d.getFullYear()===agora.getFullYear();return true;
    }
    function todosChamadosDashboard(){return [...document.querySelectorAll('#tabelaChamados tr')].filter(l=>l.cells?.length>=13).map(l=>({
      el:l,id:l.dataset.idNuvem||'',protocolo:l.cells[0]?.innerText.trim()||'',abertura:l.dataset.aberturaIso||'',fechamento:l.dataset.fechamentoIso||'',cliente:l.cells[2]?.innerText.trim()||'-',unidade:l.cells[3]?.innerText.trim()||'-',tecnico:l.cells[7]?.innerText.trim()||'-',modulo:l.cells[8]?.innerText.trim()||'-',prioridade:l.cells[10]?.innerText.trim()||'',status:l.cells[11]?.innerText.trim()||''
    }))}
    function linhasDashboard(){return todosChamadosDashboard().filter(x=>dataNoPeriodo(x.abertura))}
    function dashboardVazio(texto){return `<div class="dashboard-widget-vazio"><i data-lucide="check-circle-2"></i><span>${escaparHtml(texto)}</span></div>`}
    function abrirChamadoDashboard(id){const linha=[...document.querySelectorAll('#tabelaChamados tr')].find(l=>l.dataset.idNuvem===id);const alvo=linha?.querySelector('.protocolo, [onclick*="visualizarChamado"], td:first-child');if(alvo)visualizarChamado(alvo)}
    function abrirLeadDashboard(id){trocarAba('crm');setTimeout(()=>editarLead(id),160)}
    function abrirEventoAgendaDashboard(tipo,id){if(tipo==='chamado')abrirChamadoDashboard(id);else if(tipo==='crm')abrirLeadDashboard(id);else if(tipo==='processo')trocarAba('processos')}
    function podeUsarCrmDashboard(){return usuarioLogado?.perfil==='admin'||!!usuarioLogado?.permissoes?.crm}
    function widgetDashboardPermitido(id){return id!=='crmAgenda'||podeUsarCrmDashboard()}
    function normalizarTextoDashboard(valor){return String(valor||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()}
    function leadPertenceAoUsuarioDashboard(lead){
      if(usuarioLogado?.perfil==='admin')return true;
      if(String(lead.criado_por||'')===String(usuarioLogado?.id||''))return true;
      const responsavel=normalizarTextoDashboard(lead.responsavel),nomes=[usuarioLogado?.nome,usuarioLogado?.usuario].map(normalizarTextoDashboard).filter(Boolean);
      return !!responsavel&&nomes.some(nome=>responsavel===nome||nome.split(/\s+/).filter(p=>p.length>=3).some(parte=>responsavel.split(/\s+/).includes(parte)));
    }
    function dataHoraLeadDashboard(lead){return lead?.proxima?`${lead.proxima}T${String(lead.proxima_hora||'12:00:00').slice(0,8)}`:''}
    function iconeAcaoComercial(tipo){const t=normalizarTextoDashboard(tipo);return t==='visita'?'map-pin':t==='ligacao'?'phone':t==='reuniao'?'users-round':t==='demonstracao'?'monitor-play':t==='whatsapp'?'message-circle':'briefcase-business'}
    function resumoClienteLeadDashboard(lead){return [lead.cidade,lead.interesse,lead.telefone].filter(Boolean).join(' · ')||'Sem informações adicionais'}
    function itemChamadoDashboard(c,extra=''){return `<button class="dashboard-list-item" type="button" onclick="abrirChamadoDashboard('${c.id}')"><span><strong>${escaparHtml(c.protocolo)}</strong><small>${escaparHtml(c.cliente)} · ${escaparHtml(c.modulo)}</small></span>${extra||`<b>${escaparHtml(c.status)}</b>`}</button>`}
    function tituloWidget(id,acoes=''){const w=DASHBOARD_WIDGETS[id];return `<div class="dashboard-widget-head"><div><span class="dashboard-widget-icon"><i data-lucide="${w.icone}"></i></span><h3>${w.titulo}</h3></div>${acoes}</div>`}
    function widgetSla(chamados){const agora=Date.now(),limiteNormal=Number(localStorage.getItem('help_crm_sla_normal')||24),limiteCritico=Number(localStorage.getItem('help_crm_sla_critico')||4);const atrasados=chamados.filter(c=>!c.status.toLowerCase().includes('resolvido')&&c.abertura).map(c=>{const h=(agora-new Date(c.abertura).getTime())/36e5,lim=c.prioridade.toLowerCase().includes('alta')?limiteCritico:limiteNormal;return {...c,horas:h}}).filter(c=>c.horas>(c.prioridade.toLowerCase().includes('alta')?limiteCritico:limiteNormal)).sort((a,b)=>b.horas-a.horas);return tituloWidget('sla')+`<div class="dashboard-kpi ${atrasados.length?'danger':'success'}"><strong>${atrasados.length}</strong><span>chamado${atrasados.length===1?'':'s'} fora do prazo</span></div>`+(atrasados.length?atrasados.slice(0,3).map(c=>itemChamadoDashboard(c,`<b>${Math.floor(c.horas)}h</b>`)).join(''):dashboardVazio('Nenhum SLA estourado.'))}
    function widgetContatos(){const itens=dashboardInteracoes.filter(i=>i.proximo_contato&&dataNoPeriodo(i.proximo_contato)).sort((a,b)=>new Date(a.proximo_contato)-new Date(b.proximo_contato));return tituloWidget('contatos')+(itens.length?itens.slice(0,5).map(i=>{const c=todosChamadosDashboard().find(x=>x.id===String(i.chamado_id))||{id:String(i.chamado_id),protocolo:'Chamado',cliente:'Cliente não localizado',modulo:i.tipo||'Próximo contato'};return itemChamadoDashboard(c,`<b>${formatarExecucaoProcesso(i.proximo_contato)}</b>`)}).join(''):dashboardVazio('Nenhum retorno agendado no período.'))}
    function widgetProcessos(){const itens=dashboardProcessos.filter(p=>!['Concluída','Pausada'].includes(p.status)&&dataNoPeriodo(p.proxima_execucao)).sort((a,b)=>new Date(a.proxima_execucao)-new Date(b.proxima_execucao));return tituloWidget('processos',`<button class="dashboard-head-action" onclick="trocarAba('processos')">Ver todos</button>`)+(itens.length?itens.slice(0,5).map(p=>`<button class="dashboard-list-item" onclick="trocarAba('processos')"><span><strong>${escaparHtml(p.titulo)}</strong><small>${escaparHtml(p.responsavel_nome)} · ${escaparHtml(p.prioridade)}</small></span><b>${formatarExecucaoProcesso(p.proxima_execucao)}</b></button>`).join(''):dashboardVazio('Nenhum processo previsto no período.'))}
    function widgetFila(chamados){const nome=(usuarioLogado?.nome||usuarioLogado?.usuario||'').toLowerCase(),tokens=nome.split(/\s+/).filter(x=>x.length>2),itens=chamados.filter(c=>!c.status.toLowerCase().includes('resolvido')&&(c.tecnico.toLowerCase()===nome||tokens.some(t=>c.tecnico.toLowerCase().includes(t))));return tituloWidget('minhaFila')+(itens.length?itens.slice(0,5).map(c=>itemChamadoDashboard(c)).join(''):dashboardVazio('Nenhum chamado atribuído a você.'))}
    function widgetSemTecnico(chamados){const itens=chamados.filter(c=>['','-','não atribuído','sem técnico'].includes(c.tecnico.toLowerCase())&&!c.status.toLowerCase().includes('resolvido'));return tituloWidget('semTecnico')+`<div class="dashboard-kpi ${itens.length?'warning':'success'}"><strong>${itens.length}</strong><span>aguardando atribuição</span></div>`+(itens.length?itens.slice(0,3).map(c=>itemChamadoDashboard(c)).join(''):dashboardVazio('Todos os chamados têm responsável.'))}
    function widgetPrioridade(chamados){const itens=chamados.filter(c=>c.prioridade.toLowerCase().includes('alta')&&!c.status.toLowerCase().includes('resolvido'));return tituloWidget('prioridade')+`<div class="dashboard-kpi ${itens.length?'danger':'success'}"><strong>${itens.length}</strong><span>em aberto</span></div>`+(itens.length?itens.slice(0,3).map(c=>itemChamadoDashboard(c)).join(''):dashboardVazio('Nenhuma urgência em aberto.'))}
    function widgetRecentes(chamados){const itens=[...chamados].sort((a,b)=>new Date(b.fechamento||b.abertura)-new Date(a.fechamento||a.abertura));return tituloWidget('recentes')+(itens.length?itens.slice(0,5).map(c=>itemChamadoDashboard(c,`<b>${formatarExecucaoProcesso(c.fechamento||c.abertura)}</b>`)).join(''):dashboardVazio('Nenhum atendimento no período.'))}
    function widgetRecorrentes(chamados){const mapa={};chamados.forEach(c=>{const k=c.cliente.toLowerCase();if(!mapa[k])mapa[k]={nome:c.cliente,total:0,abertos:0};mapa[k].total++;if(!c.status.toLowerCase().includes('resolvido'))mapa[k].abertos++});const itens=Object.values(mapa).filter(x=>x.total>=2).sort((a,b)=>b.total-a.total);return tituloWidget('recorrentes')+(itens.length?itens.slice(0,6).map(x=>`<div class="dashboard-rank-item"><span><strong>${escaparHtml(x.nome)}</strong><small>${x.abertos} em aberto</small></span><b>${x.total}</b></div>`).join(''):dashboardVazio('Sem clientes reincidentes no período.'))}
    function widgetDesempenho(chamados){const mapa={};chamados.forEach(c=>{if(!mapa[c.tecnico])mapa[c.tecnico]={nome:c.tecnico,total:0,resolvidos:0,horas:0,medidos:0};const x=mapa[c.tecnico];x.total++;if(c.status.toLowerCase().includes('resolvido'))x.resolvidos++;if(c.abertura&&c.fechamento){x.horas+=(new Date(c.fechamento)-new Date(c.abertura))/36e5;x.medidos++}});const itens=Object.values(mapa).filter(x=>x.nome&&x.nome!=='-').sort((a,b)=>b.resolvidos-a.resolvidos);return tituloWidget('desempenho')+(itens.length?`<div class="dashboard-performance-table"><div class="performance-row header"><span>Técnico</span><span>Resolvidos</span><span>Em aberto</span><span>Tempo médio</span></div>${itens.map(x=>`<div class="performance-row"><strong>${escaparHtml(x.nome)}</strong><span>${x.resolvidos}</span><span>${x.total-x.resolvidos}</span><span>${x.medidos?(x.horas/x.medidos).toFixed(1)+'h':'—'}</span></div>`).join('')}</div>`:dashboardVazio('Sem dados suficientes para comparar.'))}
    function leadsAgendaDashboard(){return dashboardLeads.filter(l=>l.proxima&&!l.convertido&&leadPertenceAoUsuarioDashboard(l)&&dataNoPeriodo(dataHoraLeadDashboard(l))).sort((a,b)=>new Date(dataHoraLeadDashboard(a))-new Date(dataHoraLeadDashboard(b)))}
    function widgetCrmAgenda(){
      const itens=leadsAgendaDashboard();
      return tituloWidget('crmAgenda',`<button class="dashboard-head-action" onclick="trocarAba('crm')">Abrir Sistema</button>`)+(itens.length?itens.slice(0,6).map(l=>`<button class="dashboard-list-item dashboard-crm-item" type="button" onclick="abrirLeadDashboard('${l.id}')"><span><strong>${escaparHtml(l.proxima_tipo||'Follow-up')} · ${escaparHtml(l.nome)}</strong><small>${escaparHtml(resumoClienteLeadDashboard(l))}</small></span><b>${String(l.proxima_hora||'').slice(0,5)||new Date(`${l.proxima}T12:00:00`).toLocaleDateString('pt-BR')}</b></button>`).join(''):dashboardVazio('Nenhuma ação comercial prevista no período.'))
    }
    function widgetAgenda(){
      const eventos=[],chamados=todosChamadosDashboard();
      dashboardInteracoes.filter(i=>i.proximo_contato&&dataNoPeriodo(i.proximo_contato)).forEach(i=>{
        const c=chamados.find(x=>x.id===String(i.chamado_id));
        eventos.push({data:i.proximo_contato,titulo:c?.protocolo||'Retorno de chamado',sub:c?`Chamado · ${c.cliente} · ${c.modulo}`:`Chamado · ${i.tipo||'Próximo contato'}`,icone:'phone',tipo:'chamado',id:String(i.chamado_id)});
      });
      dashboardProcessos.filter(p=>!['Concluída','Pausada'].includes(p.status)&&dataNoPeriodo(p.proxima_execucao)).forEach(p=>eventos.push({data:p.proxima_execucao,titulo:p.titulo,sub:`Processo · ${p.responsavel_nome}`,icone:'list-checks',tipo:'processo',id:p.id}));
      leadsAgendaDashboard().forEach(l=>eventos.push({data:dataHoraLeadDashboard(l),titulo:`${l.proxima_tipo||'Follow-up'} · ${l.nome}`,sub:`Sistema · ${resumoClienteLeadDashboard(l)}`,icone:iconeAcaoComercial(l.proxima_tipo),tipo:'crm',id:l.id}));
      eventos.sort((a,b)=>new Date(a.data)-new Date(b.data));
      return tituloWidget('agenda')+(eventos.length?`<div class="dashboard-agenda">${eventos.slice(0,10).map(e=>`<button class="dashboard-agenda-item tipo-${e.tipo}" type="button" onclick="abrirEventoAgendaDashboard('${e.tipo}','${e.id}')"><i data-lucide="${e.icone}"></i><span><strong>${escaparHtml(e.titulo)}</strong><small>${escaparHtml(e.sub)}</small></span><time>${formatarExecucaoProcesso(e.data)}</time></button>`).join('')}</div>`:dashboardVazio('Sua agenda está livre neste período.'))
    }
    function widgetAvisos(){const pode=usuarioLogado?.perfil==='admin';return tituloWidget('avisos',pode?`<button class="dashboard-head-action" onclick="abrirModalAviso()"><i data-lucide="plus"></i>Novo</button>`:'')+(dashboardAvisos.length?dashboardAvisos.map(a=>`<article class="dashboard-aviso"><div><strong>${escaparHtml(a.titulo)}</strong>${(pode||a.criado_por===usuarioLogado?.id)?`<button onclick="excluirAvisoInterno('${a.id}')" title="Excluir"><i data-lucide="trash-2"></i></button>`:''}</div><p>${escaparHtml(a.mensagem)}</p><small>${escaparHtml(a.criado_por_nome)} · ${formatarExecucaoProcesso(a.criado_em)}</small></article>`).join(''):dashboardVazio('Nenhum comunicado ativo.'))}
    function widgetAtalhos(){return tituloWidget('atalhos')+`<div class="dashboard-shortcuts"><button onclick="abrirModalChamado()"><i data-lucide="plus-circle"></i><span>Novo chamado</span></button><button onclick="abrirModalCliente()"><i data-lucide="building-2"></i><span>Novo cliente</span></button><button onclick="trocarAba('processos');setTimeout(()=>abrirModalProcesso(),80)"><i data-lucide="list-plus"></i><span>Novo processo</span></button><button onclick="trocarAba('configuracoes');setTimeout(()=>document.getElementById('buscaConhecimento')?.focus(),80)"><i data-lucide="book-open"></i><span>Base de conhecimento</span></button></div>`}
    function fimDashboardContrato(c){const d=new Date(`${c.inicio}T12:00:00`);d.setMonth(d.getMonth()+Number(c.duracao_meses||0));return d}
    function contratosDashboardAtivos(){return dashboardContratos.filter(c=>['Ativo','Vencendo'].includes(c.status)&&fimDashboardContrato(c)>=new Date())}
    function widgetContratoKpi(id,valor,rotulo,classe=''){return tituloWidget(id)+`<div class="dashboard-kpi ${classe}"><strong>${valor}</strong><span>${rotulo}</span></div><button class="dashboard-head-action" onclick="trocarAba('contratos')">Ver contratos</button>`}
    function widgetContratosAtivos(){const n=contratosDashboardAtivos().length;return widgetContratoKpi('contratosAtivos',n,`contrato${n===1?'':'s'} em vigência`,n?'success':'')}
    function widgetContratosVencendo(){const agora=new Date(),limite=new Date();limite.setDate(limite.getDate()+45);const n=contratosDashboardAtivos().filter(c=>fimDashboardContrato(c)>=agora&&fimDashboardContrato(c)<=limite).length;return widgetContratoKpi('contratosVencendo',n,'vencem em até 45 dias',n?'warning':'success')}
    function widgetContratosAtraso(){const n=dashboardContratosLancamentos.filter(x=>x.status==='Pendente'&&x.vencimento<new Date().toISOString().slice(0,10)).length;return widgetContratoKpi('contratosAtraso',n,'parcela(s) atrasada(s)',n?'danger':'success')}
    function widgetReceitaContratada(){const v=contratosDashboardAtivos().filter(c=>c.parte_tipo==='Cliente').reduce((s,c)=>s+Number(c.valor_mensal||0),0);return widgetContratoKpi('receitaContratada',v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),'por mês em contratos ativos','success')}
    function widgetContratosVencimentos(){const itens=dashboardContratosLancamentos.filter(x=>x.status==='Pendente'&&x.vencimento>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.vencimento.localeCompare(b.vencimento)).slice(0,6);return tituloWidget('contratosVencimentos',`<button class="dashboard-head-action" onclick="trocarAba('contratos')">Ver todos</button>`)+(itens.length?itens.map(x=>`<button class="dashboard-list-item" onclick="trocarAba('contratos')"><span><strong>${escaparHtml(x.contratos?.numero||'Contrato')}</strong><small>${escaparHtml(x.descricao)}</small></span><b>${new Date(`${x.vencimento}T12:00:00`).toLocaleDateString('pt-BR')}</b></button>`).join(''):dashboardVazio('Nenhum vencimento futuro.'))}
    function widgetContratosRenovar(){const agora=new Date(),limite=new Date();limite.setDate(limite.getDate()+45);const itens=dashboardContratos.filter(c=>['Ativo','Vencendo'].includes(c.status)&&fimDashboardContrato(c)>=agora&&fimDashboardContrato(c)<=limite).sort((a,b)=>fimDashboardContrato(a)-fimDashboardContrato(b));return tituloWidget('contratosRenovar',`<button class="dashboard-head-action" onclick="trocarAba('contratos')">Abrir módulo</button>`)+(itens.length?itens.slice(0,6).map(c=>`<button class="dashboard-list-item" onclick="trocarAba('contratos')"><span><strong>${escaparHtml(c.numero)}</strong><small>${escaparHtml(c.tipo_contrato)}</small></span><b>${fimDashboardContrato(c).toLocaleDateString('pt-BR')}</b></button>`).join(''):dashboardVazio('Nenhuma renovação próxima.'))}
    function widgetGrafico(id){const tecnico=id==='graficoTecnico';return tituloWidget(id)+`<div class="dashboard-chart-box"><div id="${tecnico?'graficoTecnico':'graficoStatus'}" class="${tecnico?'bar-chart':'donut-chart'}"></div></div>`}
    function renderizarDashboardPersonalizado(){
      const alvo=document.getElementById('dashboardWidgets');if(!alvo)return;const chamados=linhasDashboard();
      const renderers={sla:()=>widgetSla(chamados),contatos:widgetContatos,processos:widgetProcessos,minhaFila:()=>widgetFila(chamados),semTecnico:()=>widgetSemTecnico(chamados),prioridade:()=>widgetPrioridade(chamados),recentes:()=>widgetRecentes(chamados),recorrentes:()=>widgetRecorrentes(chamados),desempenho:()=>widgetDesempenho(chamados),agenda:widgetAgenda,crmAgenda:widgetCrmAgenda,avisos:widgetAvisos,atalhos:widgetAtalhos,graficoTecnico:()=>widgetGrafico('graficoTecnico'),graficoStatus:()=>widgetGrafico('graficoStatus'),contratosAtivos:widgetContratosAtivos,contratosVencendo:widgetContratosVencendo,contratosAtraso:widgetContratosAtraso,receitaContratada:widgetReceitaContratada,contratosVencimentos:widgetContratosVencimentos,contratosRenovar:widgetContratosRenovar};
      alvo.innerHTML=dashboardConfig.filter(x=>x.visivel&&widgetDashboardPermitido(x.id)).map(x=>`<article class="dashboard-widget tamanho-${x.tamanho}" data-widget="${x.id}">${renderers[x.id]()}</article>`).join('')||dashboardVazio('Escolha ao menos um bloco em Personalizar painel.');renderizarIcones();
      if(dashboardConfig.some(x=>x.visivel&&x.id.startsWith('grafico'))){const porTecnico={},porStatus={};chamados.forEach(c=>{porTecnico[c.tecnico]=(porTecnico[c.tecnico]||0)+1;porStatus[c.status]=(porStatus[c.status]||0)+1});setTimeout(()=>atualizarGraficos(porTecnico,porStatus),0)}
    }
    async function carregarDashboardPersonalizado(){
      if(!usuarioLogado)return;const periodo=document.getElementById('dashboardPeriodo');
      const consultaLeads=podeUsarCrmDashboard()?supabaseClient.from('leads').select('id,nome,responsavel,telefone,cidade,interesse,etapa,proxima,proxima_tipo,proxima_hora,convertido,criado_por').not('proxima','is',null).eq('convertido',false).order('proxima'):Promise.resolve({data:[],error:null});
      try{const [{data:pref},{data:interacoes},{data:processos},{data:leads},{data:avisos},{data:contratos},{data:lancamentosContrato}]=await Promise.all([
        supabaseClient.from('dashboard_preferencias').select('widgets,periodo').eq('user_id',usuarioLogado.id).maybeSingle(),
        supabaseClient.from('chamado_interacoes').select('chamado_id,proximo_contato,descricao,tipo').not('proximo_contato','is',null).order('proximo_contato'),
        supabaseClient.from('processos_internos').select('id,titulo,responsavel_nome,prioridade,status,proxima_execucao,criado_por').order('proxima_execucao'),
        consultaLeads,
        supabaseClient.from('avisos_internos').select('*').or(`expira_em.is.null,expira_em.gt.${new Date().toISOString()}`).order('criado_em',{ascending:false}),
        supabaseClient.from('contratos').select('id,numero,parte_tipo,tipo_contrato,valor_mensal,inicio,duracao_meses,status'),
        supabaseClient.from('financeiro_lancamentos').select('id,contrato_id,descricao,valor,valor_pago,vencimento,status,contratos(numero)').not('contrato_id','is',null)
      ]);dashboardConfig=normalizarDashboardConfig(pref?.widgets||dashboardConfig);dashboardPeriodoAtual=pref?.periodo||'hoje';dashboardInteracoes=interacoes||[];dashboardProcessos=(processos||[]).filter(p=>processoAtribuidoAoUsuario(processosInternos.find(x=>x.id===p.id))||podeAdministrarProcessos());dashboardLeads=leads||[];dashboardAvisos=avisos||[];dashboardContratos=contratos||[];dashboardContratosLancamentos=lancamentosContrato||[];dashboardCarregado=true;if(periodo)periodo.value=dashboardPeriodoAtual;renderizarDashboardPersonalizado()}catch(erro){console.error('Dashboard:',erro);renderizarDashboardPersonalizado()}
    }
    async function alterarPeriodoDashboard(valor){dashboardPeriodoAtual=valor;renderizarDashboardPersonalizado();if(usuarioLogado)await supabaseClient.from('dashboard_preferencias').upsert({user_id:usuarioLogado.id,widgets:dashboardConfig,periodo:valor,atualizado_em:new Date().toISOString()})}
    function abrirPersonalizacaoDashboard(){const modal=document.getElementById('modalDashboardPersonalizar');if(!modal)return;modal.classList.add('active');renderizarConfigDashboard();renderizarIcones()}
    function fecharPersonalizacaoDashboard(){document.getElementById('modalDashboardPersonalizar')?.classList.remove('active')}
    function renderizarConfigDashboard(){const lista=document.getElementById('dashboardConfigLista');if(!lista)return;lista.innerHTML=dashboardConfig.map((x,i)=>widgetDashboardPermitido(x.id)?`<div class="dashboard-config-item" draggable="true" data-index="${i}"><span class="dashboard-drag"><i data-lucide="grip-vertical"></i></span><label class="dashboard-config-toggle"><input type="checkbox" ${x.visivel?'checked':''} onchange="dashboardConfig[${i}].visivel=this.checked"><span></span></label><div class="dashboard-config-name"><i data-lucide="${DASHBOARD_WIDGETS[x.id].icone}"></i><strong>${DASHBOARD_WIDGETS[x.id].titulo}</strong></div><select onchange="dashboardConfig[${i}].tamanho=this.value"><option value="pequeno" ${x.tamanho==='pequeno'?'selected':''}>Pequeno</option><option value="medio" ${x.tamanho==='medio'?'selected':''}>Médio</option><option value="grande" ${x.tamanho==='grande'?'selected':''}>Grande</option></select><div class="dashboard-order-buttons"><button ${i===0?'disabled':''} onclick="moverWidgetDashboard(${i},-1)"><i data-lucide="chevron-up"></i></button><button ${i===dashboardConfig.length-1?'disabled':''} onclick="moverWidgetDashboard(${i},1)"><i data-lucide="chevron-down"></i></button></div></div>`:'').join('');ativarDragDashboard();renderizarIcones()}
    function moverWidgetDashboard(i,d){const n=i+d;if(n<0||n>=dashboardConfig.length)return;[dashboardConfig[i],dashboardConfig[n]]=[dashboardConfig[n],dashboardConfig[i]];renderizarConfigDashboard()}
    function ativarDragDashboard(){let origem=null;document.querySelectorAll('.dashboard-config-item').forEach(item=>{item.addEventListener('dragstart',()=>{origem=Number(item.dataset.index);item.classList.add('dragging')});item.addEventListener('dragend',()=>item.classList.remove('dragging'));item.addEventListener('dragover',e=>e.preventDefault());item.addEventListener('drop',e=>{e.preventDefault();const destino=Number(item.dataset.index);if(origem===null||origem===destino)return;const [movido]=dashboardConfig.splice(origem,1);dashboardConfig.splice(destino,0,movido);renderizarConfigDashboard()})})}
    function restaurarDashboardPadrao(){dashboardConfig=normalizarDashboardConfig(DASHBOARD_PADRAO.map(id=>({id,visivel:true,tamanho:DASHBOARD_WIDGETS[id].tamanho})));renderizarConfigDashboard()}
    async function salvarPersonalizacaoDashboard(){const botao=document.getElementById('btnSalvarDashboard');botao.disabled=true;try{const{error}=await supabaseClient.from('dashboard_preferencias').upsert({user_id:usuarioLogado.id,widgets:dashboardConfig,periodo:dashboardPeriodoAtual,atualizado_em:new Date().toISOString()});if(error)throw error;renderizarDashboardPersonalizado();fecharPersonalizacaoDashboard()}catch(e){alert('Não foi possível salvar o painel.\n\n'+e.message)}finally{botao.disabled=false}}
    function abrirModalAviso(){document.getElementById('modalAvisoInterno')?.classList.add('active');renderizarIcones()}
    function fecharModalAviso(){document.getElementById('modalAvisoInterno')?.classList.remove('active')}
    async function salvarAvisoInterno(){const titulo=document.getElementById('avisoTitulo').value.trim(),mensagem=document.getElementById('avisoMensagem').value.trim(),expira=document.getElementById('avisoExpira').value;if(!titulo||!mensagem){alert('Informe o título e a mensagem.');return}const{error}=await supabaseClient.from('avisos_internos').insert({titulo,mensagem,expira_em:expira?new Date(expira).toISOString():null,criado_por:usuarioLogado.id,criado_por_nome:usuarioLogado.nome||usuarioLogado.usuario});if(error){alert('Não foi possível publicar.\n\n'+error.message);return}document.getElementById('avisoTitulo').value='';document.getElementById('avisoMensagem').value='';document.getElementById('avisoExpira').value='';fecharModalAviso();await carregarDashboardPersonalizado()}
    async function excluirAvisoInterno(id){if(!confirm('Excluir este aviso?'))return;const{error}=await supabaseClient.from('avisos_internos').delete().eq('id',id);if(error)alert(error.message);else await carregarDashboardPersonalizado()}

    // Ao abrir a página, verifica se já existe login ativo e restaura os dados salvos
    tentarSessaoExistente();
    finalizarInterfaceDinamica();
