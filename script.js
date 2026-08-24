// ===== SUPABASE - BANCO DE DADOS NA NUVEM =====
const SUPABASE_URL = 'https://cdsdgijxsslmyhnqapiu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_49trKYxsMypJahHt9QtCIA_Ayg3gyml';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function salvarChamadoNaNuvem(chamado) {
  const { error } = await supabaseClient
    .from('chamados')
    .insert(chamado);

  if (error) throw error;
  return true;
}

async function atualizarChamadoNaNuvem(protocolo, alteracoes) {
  const { error } = await supabaseClient
    .from('chamados')
    .update(alteracoes)
    .eq('protocolo', protocolo);

  if (error) throw error;
}

async function excluirChamadoNaNuvem(protocolo) {
  const { error } = await supabaseClient
    .from('chamados')
    .delete()
    .eq('protocolo', protocolo);

  if (error) throw error;
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

function limparFormularioInteracao() {
  interacaoEditandoId = null;
  const descricao = document.getElementById('interacaoDescricao');
  if (descricao) descricao.value = '';
  const proximo = document.getElementById('interacaoProximoContato');
  if (proximo) proximo.value = '';
  const interna = document.getElementById('interacaoInterna');
  if (interna) interna.checked = false;
  const tipo = document.getElementById('interacaoTipo');
  if (tipo) tipo.value = 'WhatsApp';
  const botao = document.getElementById('btnRegistrarInteracao');
  if (botao) botao.textContent = '＋ Registrar';
  document.getElementById('btnCancelarEdicaoInteracao')?.classList.add('hidden');
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
  document.getElementById('interacaoProximoContato').value = dataParaInputLocal(item.proximo_contato);
  document.getElementById('interacaoInterna').checked = !!item.interna;
  document.getElementById('btnRegistrarInteracao').textContent = '✓ Salvar alteração';
  document.getElementById('btnCancelarEdicaoInteracao').classList.remove('hidden');
  document.getElementById('interacaoDescricao').focus();
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
    if (item.criado_por === usuarioLogado?.id || usuarioLogado?.perfil === 'admin') {
      const acoes = document.createElement('div'); acoes.className = 'interacao-acoes';
      const editar = document.createElement('button'); editar.type = 'button'; editar.className = 'interacao-editar'; editar.title = 'Editar interação'; editar.textContent = '✎'; editar.onclick = () => editarInteracaoChamado(item);
      const excluir = document.createElement('button'); excluir.type = 'button'; excluir.className = 'interacao-excluir'; excluir.title = 'Excluir interação'; excluir.textContent = '×'; excluir.onclick = () => excluirInteracaoChamado(item.id);
      acoes.append(editar, excluir); card.appendChild(acoes);
    }
    lista.appendChild(card);
  });
}

async function carregarInteracoesChamado() {
  const area = document.getElementById('areaInteracoesChamado');
  const lista = document.getElementById('listaInteracoesChamado');
  if (!linhaEdicaoChamado) { area?.classList.add('hidden'); return; }
  area?.classList.remove('hidden');
  if (lista) lista.innerHTML = '<div class="interacoes-estado">Carregando histórico...</div>';
  try {
    const chamadoId = await obterIdChamadoAtual();
    const { data, error } = await supabaseClient.from('chamado_interacoes').select('*').eq('chamado_id', chamadoId).order('criado_em', { ascending: false });
    if (error) throw error;
    renderizarInteracoesChamado(data || []);
  } catch (erro) {
    console.error('Erro ao carregar interações:', erro);
    if (lista) lista.innerHTML = '<div class="interacoes-estado">Não foi possível carregar as interações. Confirme se o SQL de instalação foi executado.</div>';
  }
}

async function adicionarInteracaoChamado() {
  const descricaoEl = document.getElementById('interacaoDescricao');
  const descricao = descricaoEl.value.trim();
  if (!descricao) { alert('Descreva a interação antes de registrar.'); descricaoEl.focus(); return; }
  const botao = document.getElementById('btnRegistrarInteracao');
  botao.disabled = true; botao.textContent = 'Salvando...';
  try {
    const payload = {
      tipo: document.getElementById('interacaoTipo').value,
      descricao,
      proximo_contato: document.getElementById('interacaoProximoContato').value || null,
      interna: document.getElementById('interacaoInterna').checked
    };
    let error;
    if (interacaoEditandoId) {
      ({ error } = await supabaseClient.from('chamado_interacoes').update(payload).eq('id', interacaoEditandoId));
    } else {
      const chamadoId = await obterIdChamadoAtual();
      ({ error } = await supabaseClient.from('chamado_interacoes').insert({
        ...payload,
        chamado_id: chamadoId,
        criado_por: usuarioLogado.id,
        criado_por_nome: usuarioLogado.nome || usuarioLogado.email || 'Usuário'
      }));
    }
    if (error) throw error;
    const protocolo = linhaEdicaoChamado.querySelectorAll('td')[0].innerText.trim();
    registrarLog(`${interacaoEditandoId ? 'editou' : 'registrou'} uma interação no chamado ${protocolo}`);
    limparFormularioInteracao();
    await carregarInteracoesChamado();
  } catch (erro) {
    console.error('Erro ao registrar interação:', erro);
    alert('Não foi possível registrar a interação.\n\nDetalhes: ' + erro.message);
  } finally {
    botao.disabled = false;
    botao.textContent = interacaoEditandoId ? '✓ Salvar alteração' : '＋ Registrar';
  }
}

async function excluirInteracaoChamado(id) {
  if (!confirm('Deseja excluir esta interação?')) return;
  try {
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
  const btnWhats = document.createElement('button'); btnWhats.title = 'Enviar WhatsApp'; btnWhats.textContent = '💬'; btnWhats.onclick = function () { enviarWhatsappChamado(this); };
  const btnVer = document.createElement('button'); btnVer.title = 'Editar/Visualizar'; btnVer.textContent = '👁️'; btnVer.onclick = function () { visualizarChamado(this); };
  const btnExcluir = document.createElement('button'); btnExcluir.title = 'Excluir'; btnExcluir.textContent = '🗑️'; btnExcluir.onclick = function () { excluirChamado(this); };
  tdAcoes.append(btnWhats, btnVer, btnExcluir);
  novaLinha.appendChild(tdAcoes);
}


async function carregarClientesDaNuvem() {
  const tbody = document.querySelector('#tabelaClientes tbody');
  if (!tbody) return;
  const { data, error } = await supabaseClient.from('clientes').select('*').order('nome', { ascending: true });
  if (error) throw error;
  tbody.innerHTML = '';
  (data || []).forEach(c => {
    const tr = tbody.insertRow(-1);
    tr.dataset.idNuvem = c.id;
    tr.setAttribute('data-ie', c.ie || '');
    tr.setAttribute('data-obs', c.observacoes_tecnicas || '');
    [c.nome || '-', c.unidade || '-', c.documento || '-', c.telefone || '-', c.email || '-', c.regime || '-'].forEach(v => {
      const td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
    });
    const tdAcoes = document.createElement('td'); tdAcoes.className = 'actions-cell';
    const btnEditar = document.createElement('button'); btnEditar.title='Editar Cliente'; btnEditar.textContent='✏️'; btnEditar.onclick=()=>editarCliente(btnEditar);
    const btnClonar = document.createElement('button'); btnClonar.title='Clonar Cliente'; btnClonar.textContent='📋'; btnClonar.onclick=()=>clonarCliente(btnClonar);
    const btnExcluir = document.createElement('button'); btnExcluir.title='Excluir'; btnExcluir.textContent='🗑️'; btnExcluir.onclick=()=>excluirLinha(btnExcluir);
    tdAcoes.append(btnEditar, btnClonar, btnExcluir); tr.appendChild(tdAcoes);
  });
  atualizarDatalistClientes();
}

async function carregarTecnicosDaNuvem() {
  const select = document.getElementById('mTecnico');
  if (!select) return;
  const { data, error } = await supabaseClient.from('tecnicos').select('*').eq('ativo', true).order('nome', { ascending: true });
  if (error) throw error;
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
}


    // Garante que todas as telas principais pertençam ao mesmo painel de conteúdo.
    (function organizarTelasPrincipais() {
      function mover() {
        const main = document.querySelector('main.content');
        if (!main) return;
        ['visaoDashboard','visaoCRM','visaoCadastro','visaoRelatorios','visaoConfiguracoes'].forEach(id => {
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

    const RECURSOS = ['dashboard', 'clientes', 'novoChamado', 'novoCliente', 'novoTecnico', 'usuarios', 'relatorios', 'configuracoes'];
    const PERFIS_PADRAO = {
      admin: RECURSOS.reduce((acc, r) => { acc[r] = true; return acc; }, {}),
      tecnico: { dashboard: true, clientes: true, novoChamado: true, novoCliente: false, novoTecnico: false, usuarios: false, relatorios: false, configuracoes: false }
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

      const nomeExibicao = perfilNuvem.nome || (user.email || 'Usuário').split('@')[0];
      usuarioLogado = {
        id: user.id,
        usuario: nomeExibicao,
        email: user.email || perfilNuvem.email || '',
        perfil: perfilNuvem.perfil || 'personalizado',
        permissoes: perfilNuvem.permissoes || {}
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

      const rotulos = { dashboard: 'Dashboard', clientes: 'Clientes', novoChamado: 'Novo Chamado', novoCliente: 'Novo Cliente', novoTecnico: 'Novo Técnico', usuarios: 'Usuários', relatorios: 'Relatórios', configuracoes:'Configurações' };
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
          tdUsuario.innerHTML = `<strong>${u.nome || u.email.split('@')[0]}</strong><br><small style="color:var(--text-muted)">${u.email}${u.tipo==='convite'?' · convite pendente':(!u.ativo?' · desativado':'')}</small>`;
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
          const btnEditar = document.createElement('button'); btnEditar.title = 'Editar'; btnEditar.textContent = '✏️'; btnEditar.onclick = () => editarUsuario(chave);
          const btnExcluir = document.createElement('button'); btnExcluir.title = u.tipo === 'perfil' ? 'Desativar' : 'Cancelar convite'; btnExcluir.textContent = '🗑️'; btnExcluir.onclick = () => excluirUsuario(chave);
          tdAcoes.append(btnEditar, btnExcluir);
          tr.append(tdUsuario, tdPerfil, tdRecursos, tdAcoes);
          tbody.appendChild(tr);
        });
      } catch (erro) {
        console.error('Erro ao carregar usuários:', erro);
        tbody.innerHTML = `<tr><td colspan="4">Não foi possível carregar usuários: ${erro.message}</td></tr>`;
      }
    }

    function alternarRevelarObs() {
      document.getElementById('wrapObsTecnicas').classList.toggle('revelado');
    }

    // ---- Backup (exportar/importar) ----
    function exportarBackup() {
      const dados = {
        chamados: document.querySelector('#tabelaChamados tbody').innerHTML,
        clientes: document.querySelector('#tabelaClientes tbody').innerHTML,
        tecnicos: document.getElementById('mTecnico').innerHTML,
        usuarios: localStorage.getItem('help_crm_usuarios'),
        log: localStorage.getItem('help_crm_log'),
        protocoloSeq: localStorage.getItem('help_crm_protocolo_seq'),
        exportadoEm: formatarDataHoraAtual()
      };
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-help-crm-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      registrarLog('exportou um backup dos dados');
    }

    function importarBackup(arquivo) {
      if (!arquivo) return;
      if (!confirm('Importar este backup vai substituir os dados atuais. Continuar?')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const dados = JSON.parse(e.target.result);
          if (dados.chamados !== undefined) localStorage.setItem('help_crm_chamados', dados.chamados);
          if (dados.clientes !== undefined) localStorage.setItem('help_crm_clientes', dados.clientes);
          if (dados.tecnicos !== undefined) localStorage.setItem('help_crm_tecnicos', dados.tecnicos);
          if (dados.usuarios) localStorage.setItem('help_crm_usuarios', dados.usuarios);
          if (dados.log) localStorage.setItem('help_crm_log', dados.log);
          if (dados.protocoloSeq) localStorage.setItem('help_crm_protocolo_seq', dados.protocoloSeq);
          registrarLog('importou um backup de dados');
          alert('Backup importado com sucesso! A página será recarregada.');
          location.reload();
        } catch (err) {
          alert('Não foi possível ler este arquivo de backup.');
        }
      };
      reader.readAsText(arquivo);
    }

    function proximoProtocolo() {
      let seq = parseInt(localStorage.getItem('help_crm_protocolo_seq') || '5', 10);
      seq += 1;
      localStorage.setItem('help_crm_protocolo_seq', String(seq));
      return seq;
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
      } catch (e) {
        console.error('Não foi possível carregar os dados:', e);
        throw e;
      }
    }

    function trocarAba(aba) {
      const mapa = {
        dashboard: 'Dashboard',
        crm: 'CRM',
        cadastro: 'Cadastro',
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
        if (aba === 'cadastro') {
          if (typeof renderizarUsuarios === 'function') renderizarUsuarios();
          if (typeof renderizarTecnicos === 'function') renderizarTecnicos();
          if (typeof trocarSubCadastro === 'function') trocarSubCadastro('clientes');
        }
        if (aba === 'relatorios' && typeof atualizarRelatorios === 'function') atualizarRelatorios();
        if (aba === 'configuracoes' && typeof carregarConfiguracoes === 'function') carregarConfiguracoes();
      } catch (erro) {
        console.error('Erro ao carregar a tela:', aba, erro);
      }
    }

    function trocarSubCadastro(aba) {
      ['clientes','tecnicos','usuarios'].forEach(nome => {
        document.getElementById('cadastro' + nome.charAt(0).toUpperCase() + nome.slice(1)).classList.toggle('hidden', nome !== aba);
        document.getElementById('tabCadastro' + nome.charAt(0).toUpperCase() + nome.slice(1)).classList.toggle('active', nome === aba);
      });
      if (aba === 'usuarios') { renderizarUsuarios(); renderizarLog(); }
      if (aba === 'tecnicos') renderizarTecnicos();
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
      tbody.innerHTML = nomes.map(nome => `<tr><td>${nome}</td><td class="actions-cell"><button title="Excluir técnico" onclick="excluirTecnico('${nome.replace(/'/g, "\'")}')">🗑️</button></td></tr>`).join('');
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
      document.getElementById('cfgNomeEmpresa').value = localStorage.getItem('help_crm_nome_empresa') || 'Help Soluções Tecnológicas';
    }

    function salvarConfiguracoes() {
      const hora = document.getElementById('cfgValorHora').value || '80';
      const sla = document.getElementById('cfgSlaCritico').value || '2';
      const nome = document.getElementById('cfgNomeEmpresa').value.trim() || 'Help Soluções Tecnológicas';
      localStorage.setItem('help_crm_valor_hora', hora);
      localStorage.setItem('help_crm_sla_critico', sla);
      localStorage.setItem('help_crm_nome_empresa', nome);
      document.getElementById('relatorioValorHora').value = hora;
      marcarChamadosCriticos();
      alert('Configurações salvas com sucesso!');
    }

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
      document.getElementById('infoDatasChamado').classList.add('hidden');
      document.getElementById('infoDatasChamado').innerHTML = '';
      document.getElementById('areaInteracoesChamado').classList.add('hidden');
      limparFormularioInteracao();

      document.getElementById('modalChamado').classList.add('active');
    }

    function abrirModalCliente() {
      linhaEdicaoCliente = null;
      document.getElementById('modalClienteTitulo').innerText = "Cadastrar Novo Cliente";
      document.getElementById('cNome').value = '';
      document.getElementById('cUnidade').value = '';
      document.getElementById('cDocumento').value = '';
      document.getElementById('cIe').value = '';
      document.getElementById('cRegime').value = 'Simples Nacional';
      document.getElementById('cTelefone').value = '';
      document.getElementById('cEmail').value = '';
      document.getElementById('cObsTecnicas').value = '';
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

      const badgeStatusClass = status === 'Resolvido' ? 'badge-resolvido' : (status === 'Pendente' ? 'badge-pendente' : 'badge-andamento');
      const badgePrioridadeClass = prioridade === 'Alta Prioridade' ? 'badge-alta' : 'badge-normal';
      const agoraStr = formatarDataHoraAtual();

      if (linhaEdicaoChamado) {
        const td = linhaEdicaoChamado.querySelectorAll('td');
        const protocoloAtual = td[0].innerText.trim();
        let fechamentoISO = linhaEdicaoChamado.getAttribute('data-fechamento-iso') || null;
        if (status === 'Resolvido' && !fechamentoISO) fechamentoISO = new Date().toISOString();
        if (status !== 'Resolvido') fechamentoISO = null;

        try {
          await atualizarChamadoNaNuvem(protocoloAtual, {
            cliente, unidade, origem, serial, solicitante, tecnico, modulo, tipo,
            prioridade, status, erro, resolucao, fechamento_em: fechamentoISO
          });
        } catch (erroSupabase) {
          console.error('Erro ao atualizar chamado no Supabase:', erroSupabase);
          alert('Não foi possível atualizar o chamado na nuvem.\n\nDetalhes: ' + erroSupabase.message);
          return;
        }

        linhaEdicaoChamado.setAttribute('data-erro', erro);
        if (fechamentoISO) linhaEdicaoChamado.setAttribute('data-fechamento-iso', fechamentoISO); else linhaEdicaoChamado.removeAttribute('data-fechamento-iso');
        linhaEdicaoChamado.setAttribute('data-resolucao', resolucao);

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
        td[4].innerHTML = `<span class="badge badge-origem">${origem}</span>`;
        td[5].innerText = serial;
        td[6].innerText = solicitante;
        td[7].innerHTML = `<span class="badge badge-tecnico">${tecnico}</span>`;
        td[8].innerText = modulo;
        td[9].innerText = tipo;
        td[10].innerHTML = `<span class="badge ${badgePrioridadeClass}">${prioridade}</span>`;
        td[11].innerHTML = `<span class="badge ${badgeStatusClass}">${status}</span>`;
        td[12].innerText = fechamento || '-';
        registrarLog(`editou o chamado ${td[0].innerText}`);
      } else {
        const tabela = document.getElementById('tabelaChamados').getElementsByTagName('tbody')[0];
        const novaLinha = tabela.insertRow(0);

        const numProtocolo = proximoProtocolo();
        const protocoloStr = `HELP-2026-${String(numProtocolo).padStart(4, '0')}`;
        const aberturaStr = agoraStr;
        const fechamentoStr = status === 'Resolvido' ? agoraStr : '';

        // Primeiro salva no Supabase. Se falhar, o chamado não é criado somente localmente.
        try {
          await salvarChamadoNaNuvem({
            protocolo: protocoloStr,
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
            resolucao,
            abertura_em: new Date().toISOString(),
            fechamento_em: status === 'Resolvido' ? new Date().toISOString() : null
          });
        } catch (erroSupabase) {
          console.error('Erro ao salvar chamado no Supabase:', erroSupabase);
          novaLinha.remove();
          alert('Não foi possível salvar o chamado na nuvem. Verifique sua conexão e tente novamente.\n\nDetalhes: ' + erroSupabase.message);
          return;
        }

        novaLinha.setAttribute('data-erro', erro);
        novaLinha.setAttribute('data-resolucao', resolucao);
        novaLinha.setAttribute('data-abertura', aberturaStr);
        if (fechamentoStr) novaLinha.setAttribute('data-fechamento', fechamentoStr);

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
        const btnWhats = document.createElement('button'); btnWhats.title = 'Enviar WhatsApp'; btnWhats.textContent = '💬'; btnWhats.onclick = function () { enviarWhatsappChamado(this); };
        const btnVer = document.createElement('button'); btnVer.title = 'Editar/Visualizar'; btnVer.textContent = '👁️'; btnVer.onclick = function () { visualizarChamado(this); };
        const btnExcluir = document.createElement('button'); btnExcluir.title = 'Excluir'; btnExcluir.textContent = '🗑️'; btnExcluir.onclick = function () { excluirChamado(this); };
        tdAcoes.append(btnWhats, btnVer, btnExcluir);

        novaLinha.append(tdProtocolo, tdAbertura, tdCliente, tdUnidade, tdOrigem, tdSerial, tdSolicitante, tdTecnico, tdModulo, tdTipo, tdPrioridade, tdStatus, tdFechamento, tdAcoes);

        registrarLog(`abriu o chamado ${protocoloStr} para ${cliente}`);
      }

      fecharModais();
      atualizarMetricas();
      salvarEstado();
    }

    function visualizarChamado(btn) {
      linhaEdicaoChamado = btn.closest('tr');
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

      const abertura = linhaEdicaoChamado.getAttribute('data-abertura') || td[1].innerText.trim();
      const fechamento = linhaEdicaoChamado.getAttribute('data-fechamento') || '';
      const infoDatas = document.getElementById('infoDatasChamado');
      infoDatas.innerHTML = `<span>🟢 Aberto em: <strong>${abertura || '-'}</strong></span>` +
        (fechamento ? `<span>🔴 Fechado em: <strong>${fechamento}</strong></span>` : `<span>⏳ Ainda em aberto</span>`);
      infoDatas.classList.remove('hidden');

      limparFormularioInteracao();
      carregarInteracoesChamado();

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

      if (!nome) { alert('Informe o nome do cliente'); return; }
      const payload = { nome, unidade, documento: doc, ie, regime, telefone: tel, email, observacoes_tecnicas: obsTecnicas };

      try {
        if (linhaEdicaoCliente && linhaEdicaoCliente.dataset.idNuvem) {
          const { error } = await supabaseClient.from('clientes').update(payload).eq('id', linhaEdicaoCliente.dataset.idNuvem);
          if (error) throw error;
          registrarLog(`editou o cliente ${nome}`);
        } else {
          const { error } = await supabaseClient.from('clientes').insert(payload);
          if (error) throw error;
          registrarLog(`cadastrou o cliente ${nome}`);
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
      document.getElementById('cDocumento').value = td[2].innerText;
      document.getElementById('cIe').value = linhaEdicaoCliente.getAttribute('data-ie') || '';
      document.getElementById('cRegime').value = td[5].innerText;
      document.getElementById('cTelefone').value = td[3].innerText;
      document.getElementById('cEmail').value = td[4].innerText;
      document.getElementById('cObsTecnicas').value = linhaEdicaoCliente.getAttribute('data-obs') || '';

      document.getElementById('modalCliente').classList.add('active');
    }

    function clonarCliente(btn) {
      const tr = btn.closest('tr');
      const td = tr.querySelectorAll('td');

      linhaEdicaoCliente = null;
      document.getElementById('modalClienteTitulo').innerText = "Cadastrar Novo Cliente (Clonado)";
      document.getElementById('cNome').value = td[0].innerText;
      document.getElementById('cUnidade').value = '';
      document.getElementById('cDocumento').value = td[2].innerText;
      document.getElementById('cIe').value = tr.getAttribute('data-ie') || '';
      document.getElementById('cRegime').value = td[5].innerText;
      document.getElementById('cTelefone').value = td[3].innerText;
      document.getElementById('cEmail').value = td[4].innerText;
      document.getElementById('cObsTecnicas').value = tr.getAttribute('data-obs') || '';

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
      const LIMITE_HORAS = parseFloat(localStorage.getItem('help_crm_sla_critico') || '2');
      const linhas = document.querySelectorAll('#tabelaChamados tbody tr');
      linhas.forEach(linha => {
        const td = linha.querySelectorAll('td');
        const status = td[11].innerText.trim();
        const prioridade = td[10].innerText.trim();
        const abertura = linha.getAttribute('data-abertura') || td[1].innerText.trim();

        let critico = false;
        if (prioridade === 'Alta Prioridade' && status !== 'Resolvido') {
          const dataAbertura = parseDataBr(abertura);
          if (dataAbertura && (Date.now() - dataAbertura.getTime()) / 36e5 >= LIMITE_HORAS) {
            critico = true;
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
        if (linha.style.display !== 'none') {
          total++;
          const td = linha.querySelectorAll('td');
          const status = td[11].innerText.trim();
          const prioridade = td[10].innerText.trim();
          const tecnico = td[7].innerText.trim();
          const abertura = linha.getAttribute('data-abertura') || td[1].innerText.trim();

          if (status === 'Resolvido') resolvidos++;
          if (status === 'Pendente') pendentes++;
          if (prioridade === 'Alta Prioridade') alta++;
          if (abertura.startsWith(hojeStr)) hoje++;

          porTecnico[tecnico] = (porTecnico[tecnico] || 0) + 1;
          porStatus[status] = (porStatus[status] || 0) + 1;
        }
      });

      document.getElementById('totalChamados').innerText = total;
      document.getElementById('totalHoje').innerText = hoje;
      document.getElementById('totalResolvidos').innerText = resolvidos;
      document.getElementById('totalPendentes').innerText = pendentes;
      document.getElementById('totalAltaPrioridade').innerText = alta;

      marcarChamadosCriticos();
      atualizarGraficos(porTecnico, porStatus);
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


    
// CRM comercial — Supabase
const crmEtapas=['Novo','Contato','Demonstração','Proposta','Negociação','Fechado'];
let crmEditandoId=null;
let crmCache=[];

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
    await migrarLeadsLocaisSeExistirem();
    const a=await carregarCrmDaNuvem();
    const hoje=new Date().toISOString().slice(0,10);
    document.getElementById('crmTotalAtivos').textContent=a.filter(x=>x.etapa!=='Fechado'&&!x.convertido).length;
    document.getElementById('crmNegociacao').textContent=a.filter(x=>x.etapa==='Negociação').length;
    document.getElementById('crmFollowups').textContent=a.filter(x=>x.proxima&&x.proxima<=hoje&&!x.convertido).length;
    document.getElementById('crmConvertidos').textContent=a.filter(x=>x.convertido||x.etapa==='Fechado').length;
    document.getElementById('crmBoard').innerHTML=crmEtapas.map(e=>{
      const ls=a.filter(x=>x.etapa===e&&!x.convertido);
      return `<div class="crm-stage"><div class="crm-stage-head"><span>${e}</span><span>${ls.length}</span></div>${ls.map(x=>`<div class="crm-lead-card" onclick="editarLead('${x.id}')"><strong>${x.nome}</strong><small>${x.responsavel||x.cidade||'Sem contato'}</small><span class="crm-tag">${x.interesse||'-'}</span></div>`).join('')||'<small>Sem oportunidades</small>'}</div>`;
    }).join('');
    const p=a.filter(x=>x.proxima&&!x.convertido).sort((x,y)=>String(x.proxima).localeCompare(String(y.proxima)));
    document.getElementById('crmProximas').innerHTML=p.length?p.map(x=>`<div class="crm-next"><strong>${x.nome}</strong><span>${new Date(x.proxima+'T12:00:00').toLocaleDateString('pt-BR')} · ${x.interesse||'-'}</span></div>`).join(''):'<div class="crm-next">Nenhuma ação pendente ✓</div>';
  }catch(e){
    console.error('Erro ao carregar CRM:',e);
    alert('Não foi possível carregar o CRM da nuvem.\n\n'+e.message);
  }
}

function abrirModalLead(){
  crmEditandoId=null;
  document.getElementById('crmModalTitulo').textContent='Novo lead';
  ['crmNome','crmResponsavel','crmTelefone','crmCidade','crmProximaAcao','crmValor','crmObs','crmNovaInteracao'].forEach(i=>{const el=document.getElementById(i);if(el)el.value=''});
  document.getElementById('crmInteresse').selectedIndex=0;
  document.getElementById('crmEtapa').value='Novo';
  document.getElementById('crmHistoricoArea').style.display='none';
  document.getElementById('modalLead').classList.add('active');
  setTimeout(()=>document.getElementById('crmNome').focus(),50);
}
function fecharModalLead(){document.getElementById('modalLead').classList.remove('active')}

async function editarLead(id){
  const x=crmCache.find(a=>a.id===id) || (await supabaseClient.from('leads').select('*').eq('id',id).single()).data;
  if(!x)return;
  crmEditandoId=id;
  document.getElementById('crmModalTitulo').textContent='Editar lead';
  for(const [k,v] of Object.entries({crmNome:x.nome,crmResponsavel:x.responsavel,crmTelefone:x.telefone,crmCidade:x.cidade,crmInteresse:x.interesse,crmEtapa:x.etapa,crmProximaAcao:x.proxima,crmValor:x.valor,crmObs:x.obs}))document.getElementById(k).value=v||'';
  const {data:hist,error}=await supabaseClient.from('lead_interacoes').select('*').eq('lead_id',id).order('criado_em',{ascending:false});
  if(error){alert('Não foi possível carregar o histórico do lead.\n\n'+error.message);return}
  document.getElementById('crmHistoricoArea').style.display='block';
  document.getElementById('crmHistorico').innerHTML=(hist||[]).map(h=>`<div class="crm-next">${h.texto}<span>${new Date(h.criado_em).toLocaleString('pt-BR')}</span></div>`).join('')||'<div class="crm-next">Sem interações registradas.</div>';
  document.getElementById('modalLead').classList.add('active');
}

async function salvarLead(){
  const nome=document.getElementById('crmNome').value.trim();
  if(!nome)return alert('Informe o nome do lead');
  try{
    const uid=await crmUsuarioId();
    const id=crmEditandoId||('lead-'+Date.now());
    const payload={
      id,nome,responsavel:document.getElementById('crmResponsavel').value,telefone:document.getElementById('crmTelefone').value,
      cidade:document.getElementById('crmCidade').value,interesse:document.getElementById('crmInteresse').value,
      etapa:document.getElementById('crmEtapa').value,proxima:document.getElementById('crmProximaAcao').value||null,
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
    if(!existente?.length){
      const {error:cErr}=await supabaseClient.from('clientes').insert({nome:x.nome,unidade:x.cidade||'-',documento:'-',ie:'-',regime:'-',telefone:x.telefone||'-',email:'-',observacoes_tecnicas:'Lead convertido pelo CRM'});
      if(cErr)throw cErr;
    }
    const {error:lErr}=await supabaseClient.from('leads').update({convertido:true,etapa:'Fechado',atualizado_em:new Date().toISOString()}).eq('id',x.id); if(lErr)throw lErr;
    await supabaseClient.from('lead_interacoes').insert({lead_id:x.id,texto:'Convertido em cliente.',criado_por:uid});
    await carregarClientesDaNuvem();
    fecharModalLead();
    await renderizarCRM();
    alert('Lead convertido em cliente!');
  }catch(e){alert('Não foi possível converter o lead em cliente.\n\n'+e.message)}
}

// ===== CENTRAL DE NOTIFICAÇÕES =====
    const notificacoesPadrao = [
      {id:'sla-001', tipo:'danger', titulo:'SLA próximo do vencimento', texto:'O chamado #20250513-003 está próximo do limite de atendimento.', tempo:'Agora'},
      {id:'novo-001', tipo:'info', titulo:'Novo chamado recebido', texto:'Um novo chamado foi aberto e aguarda direcionamento técnico.', tempo:'Há 18 min'},
      {id:'cliente-001', tipo:'warning', titulo:'Aguardando retorno do cliente', texto:'Existe um chamado parado aguardando uma resposta do cliente.', tempo:'Há 42 min'}
    ];
    function getNotificacoes(){try{return JSON.parse(localStorage.getItem('help_crm_notificacoes')) || notificacoesPadrao}catch(e){return notificacoesPadrao}}
    function salvarNotificacoes(lista){localStorage.setItem('help_crm_notificacoes',JSON.stringify(lista))}
    function renderizarNotificacoes(){
      const lista=getNotificacoes(), el=document.getElementById('notificationList'), badge=document.getElementById('notificationBadge'), sub=document.getElementById('notificationSub');
      if(!el||!badge||!sub)return;
      badge.textContent=lista.length; badge.style.display=lista.length?'grid':'none';
      sub.textContent=lista.length===1?'1 pendente':`${lista.length} pendentes`;
      el.innerHTML='';
      if(!lista.length){el.innerHTML='<div class="notification-empty"><b>Tudo em dia ✓</b>Você não possui notificações pendentes.</div>';return}
      lista.forEach(n=>{const item=document.createElement('div');item.className='notification-item';item.innerHTML=`<span class="notification-dot ${n.tipo==='info'?'':n.tipo}"></span><div><strong>${n.titulo}</strong><p>${n.texto}</p><time>${n.tempo}</time></div><button class="notification-dismiss" title="Marcar como lida" aria-label="Marcar como lida" onclick="marcarNotificacaoLida('${n.id}')">×</button>`;el.appendChild(item)});
    }
    function alternarNotificacoes(){const panel=document.getElementById('notificationPanel');if(!panel)return;panel.classList.toggle('hidden');if(!panel.classList.contains('hidden'))renderizarNotificacoes()}
    function fecharNotificacoes(){const panel=document.getElementById('notificationPanel');if(panel)panel.classList.add('hidden')}
    function marcarNotificacaoLida(id){const lista=getNotificacoes().filter(n=>n.id!==id);salvarNotificacoes(lista);renderizarNotificacoes()}
    function marcarTodasLidas(){salvarNotificacoes([]);renderizarNotificacoes()}
    document.addEventListener('keydown',function(e){if(e.key==='Escape')fecharModalLead()});
    document.addEventListener('click',function(e){const wrap=document.querySelector('.notification-wrap');if(wrap&&!wrap.contains(e.target))fecharNotificacoes()});

    // Ao abrir a página, verifica se já existe login ativo e restaura os dados salvos
    tentarSessaoExistente();
