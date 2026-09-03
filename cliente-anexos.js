/* Anexos do cadastro de clientes — módulo isolado. */
(function () {
  const BUCKET = 'cliente-anexos';
  const TIPOS = ['image/jpeg','image/png','image/webp','application/pdf','text/plain'];
  const LIMITE = 10 * 1024 * 1024;
  let clienteAtualId = null;

  function html(v) {
    if (typeof escaparHtml === 'function') return escaparHtml(String(v ?? ''));
    return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  function nomeSeguro(nome) {
    return String(nome || 'arquivo')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(-120);
  }

  function tamanho(bytes) {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  function dataHora(valor) {
    if (!valor) return '';
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function podeExcluir(anexo) {
    return !!usuarioLogado && (
      usuarioLogado.perfil === 'admin' ||
      usuarioLogado.permissoes?.usuarios === true ||
      anexo.criado_por === usuarioLogado.id
    );
  }

  function instalarInterface() {
    if (document.getElementById('clienteAnexosBloco')) return;
    const obs = document.getElementById('cObsTecnicas')?.closest('.form-group');
    if (!obs) return;

    const bloco = document.createElement('div');
    bloco.id = 'clienteAnexosBloco';
    bloco.className = 'form-group full cliente-anexos-bloco';
    bloco.innerHTML = `
      <div class="cliente-anexos-topo">
        <div><label>Arquivos anexos</label><small>PDF, imagem ou texto · máximo 10 MB por arquivo.</small></div>
        <label class="interacao-anexo cliente-anexos-escolher">
          <i data-lucide="paperclip"></i><span>Anexar arquivos</span>
          <input id="clienteAnexosInput" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain">
        </label>
      </div>
      <div id="clienteAnexosSelecionados" class="anexos-selecionados"></div>
      <div id="clienteAnexosLista" class="cliente-anexos-lista"><div class="cliente-anexos-estado">Salve o cliente para vincular arquivos ao cadastro.</div></div>`;
    obs.insertAdjacentElement('afterend', bloco);

    document.getElementById('clienteAnexosInput').addEventListener('change', validarSelecao);
    const style = document.createElement('style');
    style.id = 'clienteAnexosStyle';
    style.textContent = `
      .cliente-anexos-bloco{padding:14px;border:1px solid var(--border-color,var(--border));border-radius:12px;background:rgba(59,130,246,.035)}
      .cliente-anexos-topo{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .cliente-anexos-topo>div{display:grid;gap:3px}.cliente-anexos-topo small{color:var(--text-muted)}
      .cliente-anexos-escolher{margin:0;cursor:pointer}.cliente-anexos-escolher input{display:none}
      .cliente-anexos-lista{display:grid;gap:7px;margin-top:10px}
      .cliente-anexo-item{display:flex;align-items:center;gap:9px;padding:9px 10px;border:1px solid var(--border-color,var(--border));border-radius:9px;background:var(--bg-card,rgba(8,20,35,.45))}
      .cliente-anexo-item>svg{width:17px;flex:0 0 auto;color:#72abff}.cliente-anexo-info{display:grid;gap:2px;min-width:0;flex:1}
      .cliente-anexo-info b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.cliente-anexo-info small{color:var(--text-muted);font-size:10px}
      .cliente-anexo-acoes{display:flex;gap:5px}.cliente-anexo-acoes button{display:grid;place-items:center;width:31px;height:31px;border:1px solid var(--border-color,var(--border));border-radius:8px;background:transparent;color:var(--text-muted);cursor:pointer}
      .cliente-anexo-acoes button:hover{color:#72abff;border-color:#72abff}.cliente-anexo-acoes .excluir:hover{color:#fb7185;border-color:#fb7185}
      .cliente-anexo-acoes svg{width:15px}.cliente-anexos-estado{padding:10px 0;color:var(--text-muted);font-size:12px}
      @media(max-width:650px){.cliente-anexos-topo{align-items:stretch}.cliente-anexos-escolher{justify-content:center}.cliente-anexo-item{align-items:flex-start}}
    `;
    document.head.appendChild(style);
    if (window.lucide) lucide.createIcons();
  }

  function validarSelecao() {
    const input = document.getElementById('clienteAnexosInput');
    const area = document.getElementById('clienteAnexosSelecionados');
    if (!input || !area) return true;
    const arquivos = [...input.files];
    const invalido = arquivos.find(a => a.size > LIMITE || !TIPOS.includes(a.type));
    if (invalido) {
      const motivo = invalido.size > LIMITE ? 'o limite é 10 MB' : 'formato não permitido';
      alert(`${invalido.name}: ${motivo}.`);
      input.value = '';
      area.textContent = '';
      return false;
    }
    area.textContent = arquivos.map(a => `${a.name} (${tamanho(a.size)})`).join(' · ');
    return true;
  }

  async function carregar(clienteId) {
    instalarInterface();
    clienteAtualId = clienteId ? Number(clienteId) : null;
    const lista = document.getElementById('clienteAnexosLista');
    const input = document.getElementById('clienteAnexosInput');
    const selecionados = document.getElementById('clienteAnexosSelecionados');
    if (input) input.value = '';
    if (selecionados) selecionados.textContent = '';
    if (!lista) return;
    if (!clienteAtualId) {
      lista.innerHTML = '<div class="cliente-anexos-estado">Os arquivos selecionados serão enviados quando o cliente for salvo.</div>';
      return;
    }
    lista.innerHTML = '<div class="cliente-anexos-estado">Carregando anexos...</div>';
    const { data, error } = await supabaseClient
      .from('cliente_anexos')
      .select('*')
      .eq('cliente_id', clienteAtualId)
      .order('criado_em', { ascending: false });
    if (error) {
      console.error('Erro ao carregar anexos do cliente:', error);
      lista.innerHTML = '<div class="cliente-anexos-estado">Não foi possível carregar os anexos.</div>';
      return;
    }
    renderizar(data || []);
  }

  function renderizar(anexos) {
    const lista = document.getElementById('clienteAnexosLista');
    if (!lista) return;
    if (!anexos.length) {
      lista.innerHTML = '<div class="cliente-anexos-estado">Nenhum arquivo anexado a este cliente.</div>';
      return;
    }
    lista.innerHTML = anexos.map(a => `
      <div class="cliente-anexo-item">
        <i data-lucide="${String(a.tipo_mime || '').startsWith('image/') ? 'image' : a.tipo_mime === 'application/pdf' ? 'file-text' : 'file'}"></i>
        <div class="cliente-anexo-info"><b>${html(a.nome_arquivo)}</b><small>${tamanho(a.tamanho_bytes)}${a.criado_em ? ` · ${dataHora(a.criado_em)}` : ''}</small></div>
        <div class="cliente-anexo-acoes">
          <button type="button" title="Baixar" onclick="baixarAnexoCliente('${a.id}')"><i data-lucide="download"></i></button>
          ${podeExcluir(a) ? `<button type="button" class="excluir" title="Excluir" onclick="excluirAnexoCliente('${a.id}')"><i data-lucide="trash-2"></i></button>` : ''}
        </div>
      </div>`).join('');
    window.__clienteAnexosCache = anexos;
    if (window.lucide) lucide.createIcons();
  }

  async function enviar(clienteId, arquivos) {
    for (const arquivo of arquivos) {
      if (arquivo.size > LIMITE) throw new Error(`${arquivo.name}: o limite é 10 MB.`);
      if (!TIPOS.includes(arquivo.type)) throw new Error(`${arquivo.name}: formato não permitido.`);
      const caminho = `${clienteId}/${crypto.randomUUID()}-${nomeSeguro(arquivo.name)}`;
      const { error: uploadError } = await supabaseClient.storage
        .from(BUCKET)
        .upload(caminho, arquivo, { upsert: false, contentType: arquivo.type });
      if (uploadError) throw uploadError;
      const { error: metaError } = await supabaseClient.from('cliente_anexos').insert({
        cliente_id: Number(clienteId),
        nome_arquivo: arquivo.name,
        caminho_storage: caminho,
        tipo_mime: arquivo.type,
        tamanho_bytes: arquivo.size,
        criado_por: usuarioLogado.id
      });
      if (metaError) {
        await supabaseClient.storage.from(BUCKET).remove([caminho]);
        throw metaError;
      }
    }
  }

  window.baixarAnexoCliente = async function(id) {
    const anexo = (window.__clienteAnexosCache || []).find(a => String(a.id) === String(id));
    if (!anexo) return;
    const { data, error } = await supabaseClient.storage.from(BUCKET).download(anexo.caminho_storage);
    if (error) return alert('Não foi possível baixar o anexo.\n\n' + error.message);
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = anexo.nome_arquivo;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  window.excluirAnexoCliente = async function(id) {
    const anexo = (window.__clienteAnexosCache || []).find(a => String(a.id) === String(id));
    if (!anexo || !confirm(`Excluir o anexo "${anexo.nome_arquivo}"?`)) return;
    const { error: storageError } = await supabaseClient.storage.from(BUCKET).remove([anexo.caminho_storage]);
    if (storageError) return alert('Não foi possível excluir o arquivo.\n\n' + storageError.message);
    const { error } = await supabaseClient.from('cliente_anexos').delete().eq('id', anexo.id);
    if (error) return alert('O arquivo foi removido do armazenamento, mas o registro não pôde ser atualizado.\n\n' + error.message);
    await carregar(clienteAtualId);
  };

  async function localizarIdAposSalvar(nome, documento) {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select('id')
      .eq('nome', nome)
      .eq('documento', documento)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.id || null;
  }

  function instalarIntegracao() {
    instalarInterface();

    const abrirBase = window.abrirModalCliente;
    if (typeof abrirBase === 'function' && !abrirBase.__clienteAnexos) {
      const fn = function() {
        const r = abrirBase.apply(this, arguments);
        setTimeout(() => carregar(null), 0);
        return r;
      };
      fn.__clienteAnexos = true;
      window.abrirModalCliente = fn;
    }

    const editarBase = window.editarCliente;
    if (typeof editarBase === 'function' && !editarBase.__clienteAnexos) {
      const fn = function(btn) {
        const r = editarBase.apply(this, arguments);
        const id = Number(btn?.closest('tr')?.dataset.idNuvem || 0) || null;
        setTimeout(() => carregar(id), 0);
        return r;
      };
      fn.__clienteAnexos = true;
      window.editarCliente = fn;
    }

    const clonarBase = window.clonarCliente;
    if (typeof clonarBase === 'function' && !clonarBase.__clienteAnexos) {
      const fn = function() {
        const r = clonarBase.apply(this, arguments);
        setTimeout(() => carregar(null), 0);
        return r;
      };
      fn.__clienteAnexos = true;
      window.clonarCliente = fn;
    }

    const salvarBase = window.salvarCliente;
    if (typeof salvarBase === 'function' && !salvarBase.__clienteAnexos) {
      const fn = async function() {
        instalarInterface();
        if (!validarSelecao()) return;
        const arquivos = [...(document.getElementById('clienteAnexosInput')?.files || [])];
        const nome = document.getElementById('cNome')?.value.trim() || '';
        const documento = document.getElementById('cDocumento')?.value || '-';
        const idAntes = (typeof linhaEdicaoCliente !== 'undefined' && linhaEdicaoCliente?.dataset?.idNuvem)
          ? Number(linhaEdicaoCliente.dataset.idNuvem) : null;

        await salvarBase.apply(this, arguments);

        const modal = document.getElementById('modalCliente');
        if (modal?.classList.contains('active')) return;
        if (!arquivos.length) return;

        try {
          const clienteId = idAntes || await localizarIdAposSalvar(nome, documento);
          if (!clienteId) throw new Error('Cliente salvo, mas não foi possível localizar o cadastro para vincular os arquivos.');
          await enviar(clienteId, arquivos);
          if (typeof avisarModulo === 'function') avisarModulo(`${arquivos.length} anexo(s) adicionado(s) ao cliente.`);
        } catch (erro) {
          console.error('Erro ao salvar anexos do cliente:', erro);
          alert('O cliente foi salvo, mas não foi possível enviar todos os anexos.\n\n' + erro.message);
        }
      };
      fn.__clienteAnexos = true;
      window.salvarCliente = fn;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalarIntegracao, { once: true });
  else instalarIntegracao();
})();
