/* Destinatários específicos para avisos internos. */
(function () {
  let usuariosAvisoCache = [];

  function garantirAreaDestinatarios() {
    const form = document.querySelector('#modalAvisoInterno .dashboard-aviso-form');
    if (!form || document.getElementById('avisoDestinatariosWrap')) return;

    const area = document.createElement('div');
    area.id = 'avisoDestinatariosWrap';
    area.className = 'crm-field aviso-destinatarios-wrap';
    area.innerHTML = `
      <span>Quem pode ver este aviso?</span>
      <label class="aviso-todos-usuarios">
        <input id="avisoTodosUsuarios" type="checkbox" checked onchange="avisoAlternarTodosUsuarios()">
        <span><strong>Todos os usuários</strong><small>O aviso ficará visível para toda a equipe ativa.</small></span>
      </label>
      <div id="avisoUsuariosLista" class="aviso-usuarios-lista"><small>Carregando usuários...</small></div>
      <small class="aviso-destinatarios-nota">O autor do aviso sempre consegue visualizá-lo.</small>`;

    const expira = document.getElementById('avisoExpira')?.closest('label');
    if (expira) form.insertBefore(area, expira);
    else form.appendChild(area);
  }

  function renderizarUsuariosAviso() {
    const lista = document.getElementById('avisoUsuariosLista');
    if (!lista) return;
    lista.innerHTML = '';

    if (!usuariosAvisoCache.length) {
      const vazio = document.createElement('small');
      vazio.textContent = 'Nenhum outro usuário ativo encontrado.';
      lista.appendChild(vazio);
      return;
    }

    const todos = document.getElementById('avisoTodosUsuarios')?.checked !== false;
    usuariosAvisoCache.forEach(u => {
      const label = document.createElement('label');
      label.className = 'aviso-usuario-item';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'aviso-destinatario-check';
      input.value = u.user_id;
      input.checked = true;
      input.disabled = todos || u.user_id === usuarioLogado?.id;

      const texto = document.createElement('span');
      const nome = document.createElement('strong');
      const detalhe = document.createElement('small');
      nome.textContent = (u.user_id === usuarioLogado?.id ? 'Você · ' : '') + (u.nome || u.email || 'Usuário');
      detalhe.textContent = [u.email, u.perfil].filter(Boolean).join(' · ');
      texto.append(nome, detalhe);
      label.append(input, texto);
      lista.appendChild(label);
    });
  }

  async function carregarUsuariosAviso() {
    garantirAreaDestinatarios();
    const lista = document.getElementById('avisoUsuariosLista');
    if (lista) lista.innerHTML = '<small>Carregando usuários...</small>';
    try {
      const { data, error } = await supabaseClient
        .from('perfis_usuarios')
        .select('user_id,nome,email,perfil,ativo')
        .eq('ativo', true)
        .order('nome', { ascending: true });
      if (error) throw error;
      usuariosAvisoCache = data || [];
      renderizarUsuariosAviso();
    } catch (erro) {
      console.error('Destinatários dos avisos:', erro);
      usuariosAvisoCache = [];
      if (lista) lista.innerHTML = '<small>Não foi possível carregar os usuários. O aviso será enviado para todos.</small>';
      const todos = document.getElementById('avisoTodosUsuarios');
      if (todos) { todos.checked = true; todos.disabled = true; }
    }
  }

  window.avisoAlternarTodosUsuarios = function () {
    const todos = document.getElementById('avisoTodosUsuarios')?.checked !== false;
    document.querySelectorAll('.aviso-destinatario-check').forEach(input => {
      if (input.value === usuarioLogado?.id) {
        input.checked = true;
        input.disabled = true;
        return;
      }
      input.disabled = todos;
      if (todos) input.checked = true;
    });
  };

  window.abrirModalAviso = async function () {
    const modal = document.getElementById('modalAvisoInterno');
    if (!modal) return;
    modal.classList.add('active');
    garantirAreaDestinatarios();
    const todos = document.getElementById('avisoTodosUsuarios');
    if (todos) { todos.checked = true; todos.disabled = false; }
    await carregarUsuariosAviso();
    if (window.renderizarIcones) renderizarIcones();
    else if (window.lucide) lucide.createIcons();
  };

  window.salvarAvisoInterno = async function () {
    const titulo = document.getElementById('avisoTitulo')?.value.trim() || '';
    const mensagem = document.getElementById('avisoMensagem')?.value.trim() || '';
    const expira = document.getElementById('avisoExpira')?.value || '';
    if (!titulo || !mensagem) {
      alert('Informe o título e a mensagem.');
      return;
    }

    const todos = document.getElementById('avisoTodosUsuarios')?.checked !== false;
    const selecionados = [...document.querySelectorAll('.aviso-destinatario-check:checked')].map(x => x.value);
    const payload = {
      titulo,
      mensagem,
      expira_em: expira ? new Date(expira).toISOString() : null,
      criado_por: usuarioLogado.id,
      criado_por_nome: usuarioLogado.nome || usuarioLogado.usuario,
      destinatarios: todos ? null : selecionados
    };

    const { error } = await supabaseClient.from('avisos_internos').insert(payload);
    if (error) {
      alert('Não foi possível publicar.\n\n' + error.message);
      return;
    }

    document.getElementById('avisoTitulo').value = '';
    document.getElementById('avisoMensagem').value = '';
    document.getElementById('avisoExpira').value = '';
    const checkTodos = document.getElementById('avisoTodosUsuarios');
    if (checkTodos) checkTodos.checked = true;
    document.getElementById('modalAvisoInterno')?.classList.remove('active');
    await carregarDashboardPersonalizado();
  };

  const style = document.createElement('style');
  style.textContent = `
    .aviso-destinatarios-wrap{grid-column:1/-1;display:block!important}
    .aviso-destinatarios-wrap>span{display:block;margin-bottom:8px;font-weight:700}
    .aviso-todos-usuarios,.aviso-usuario-item{display:flex!important;align-items:center;gap:10px;padding:10px 11px;border:1px solid var(--border-color);border-radius:10px;background:rgba(53,117,203,.045);cursor:pointer}
    .aviso-todos-usuarios input,.aviso-usuario-item input{width:16px!important;height:16px!important;min-width:16px;margin:0;accent-color:#4f8ee8}
    .aviso-todos-usuarios span,.aviso-usuario-item span{display:flex;flex-direction:column;gap:2px;min-width:0}
    .aviso-todos-usuarios strong,.aviso-usuario-item strong{font-size:12px;color:var(--text-main);font-weight:700}
    .aviso-todos-usuarios small,.aviso-usuario-item small,.aviso-destinatarios-nota{font-size:10px;color:var(--text-muted);line-height:1.35}
    .aviso-usuarios-lista{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px;max-height:190px;overflow:auto;padding-right:3px}
    .aviso-usuario-item:has(input:disabled){opacity:.7;cursor:default}
    .aviso-destinatarios-nota{display:block;margin-top:7px}
    @media(max-width:620px){.aviso-usuarios-lista{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
})();
