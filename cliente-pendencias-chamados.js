/* Complemento isolado: chamados em aberto nas Pendências do Cliente. */
(function () {
  const STATUS_ENCERRADOS = new Set(['resolvido','fechado','encerrado','cancelado']);

  function normalizar(v) {
    return String(v || '').trim().toLocaleLowerCase('pt-BR');
  }

  function chamadoAberto(chamado) {
    return !STATUS_ENCERRADOS.has(normalizar(chamado?.status));
  }

  function prioridadeCritica(chamado) {
    return ['alta','urgente','crítica','critica'].includes(normalizar(chamado?.prioridade));
  }

  window.abrirChamadoPelaPendenciaCliente = function (protocolo) {
    if (typeof trocarAba !== 'function') return;
    trocarAba('dashboard');
    setTimeout(() => {
      const linha = [...document.querySelectorAll('#tabelaChamados tbody tr')]
        .find(tr => tr.querySelector('td')?.textContent?.trim() === String(protocolo));
      const botao = linha?.querySelector('button[title="Editar/Visualizar"],button[title*="Visualizar"],button[title*="Editar"]');
      if (botao) botao.click();
      else linha?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);
  };

  async function incluirChamadosAbertos() {
    const conteudo = document.getElementById('gcConteudo');
    const lista = conteudo?.querySelector('.gc-pendencias');
    if (!conteudo || !lista || typeof gcClientes === 'undefined' || typeof gcClienteAtualId === 'undefined') return;

    const cliente = gcClientes.find(x => Number(x.id) === Number(gcClienteAtualId));
    if (!cliente) return;

    const { data, error } = await supabaseClient
      .from('chamados')
      .select('id,protocolo,cliente,status,prioridade,modulo,abertura_em')
      .eq('cliente', cliente.nome)
      .order('abertura_em', { ascending: true });

    if (error) {
      console.warn('Não foi possível carregar chamados nas pendências do cliente:', error);
      return;
    }

    const chamados = (data || []).filter(chamadoAberto);
    lista.querySelectorAll('.gc-pendencia-chamado').forEach(el => el.remove());

    if (chamados.length) {
      lista.querySelector('.gc-empty')?.remove();
      const frag = document.createDocumentFragment();
      chamados.forEach(ch => {
        const critico = prioridadeCritica(ch);
        const botao = document.createElement('button');
        botao.className = `gc-pendencia gc-pendencia-chamado${critico ? ' perigo' : ''}`;
        botao.type = 'button';
        botao.onclick = () => window.abrirChamadoPelaPendenciaCliente(ch.protocolo);

        const icone = document.createElement('span');
        icone.innerHTML = '<i data-lucide="headphones"></i>';
        const info = document.createElement('div');
        const titulo = document.createElement('b');
        titulo.textContent = 'Chamado em aberto';
        const detalhe = document.createElement('small');
        detalhe.textContent = `${ch.protocolo} · ${ch.status}${ch.modulo ? ' · ' + ch.modulo : ''}`;
        info.append(titulo, detalhe);
        const dataEl = document.createElement('time');
        dataEl.textContent = ch.abertura_em ? new Date(ch.abertura_em).toLocaleDateString('pt-BR') : '';
        botao.append(icone, info, dataEl);
        frag.appendChild(botao);
      });
      lista.prepend(frag);
    }

    const kpis = [...conteudo.querySelectorAll('.gc-grid .gc-kpi strong')];
    const pendenciasOriginais = [...lista.querySelectorAll('.gc-pendencia:not(.gc-pendencia-chamado)')];
    if (kpis[0]) kpis[0].textContent = String(pendenciasOriginais.length + chamados.length);
    if (kpis[1]) {
      const criticasOriginais = pendenciasOriginais.filter(x => x.classList.contains('perigo')).length;
      kpis[1].textContent = String(criticasOriginais + chamados.filter(prioridadeCritica).length);
    }
    if (window.lucide) lucide.createIcons();
  }

  function instalar(tentativa = 0) {
    const base = window.gcRenderPendencias;
    if (typeof base !== 'function') {
      if (tentativa < 60) setTimeout(() => instalar(tentativa + 1), 100);
      return;
    }
    if (base.__chamadosPendenciasCliente) return;

    const wrapper = async function () {
      const resultado = await base.apply(this, arguments);
      await incluirChamadosAbertos();
      return resultado;
    };
    wrapper.__chamadosPendenciasCliente = true;
    window.gcRenderPendencias = wrapper;
  }

  instalar();
})();
