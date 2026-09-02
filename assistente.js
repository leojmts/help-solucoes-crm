(function () {
  'use strict';

  const guia = (titulo, resumo, passos, palavras = '') => ({ titulo, resumo, passos, palavras });
  const MODULOS = {
    visaoDashboard: { nome: 'Dashboard', intro: 'Acompanhe números, agenda, atalhos e os indicadores mais importantes da operação.', guias: [
      guia('Personalizar o painel', 'Escolha quais informações aparecem primeiro.', [
        ['Clique em Personalizar painel.', '.dashboard-customize-btn'],
        ['Marque ou desmarque os cartões que deseja acompanhar.', '#dashboardWidgets'],
        ['Salve a organização para manter o painel do seu jeito.']
      ], 'widget cartão indicador'),
      guia('Usar os atalhos', 'Abra rapidamente as ações mais frequentes.', [
        ['Localize a área de atalhos do Dashboard.', '.dashboard-shortcuts'],
        ['Clique na ação desejada para abrir diretamente o módulo correspondente.']
      ], 'agenda acesso rápido')
    ]},
    visaoMeuTrabalho: { nome: 'Meu trabalho', intro: 'Centralize seus chamados, compromissos e atividades pendentes.', guias: [
      guia('Acompanhar meus atendimentos', 'Encontre rapidamente o que exige sua atenção.', [
        ['Use o filtro para escolher o tipo ou status do trabalho.', '#meuTrabalhoFiltro'],
        ['Selecione um item na lista para abrir os detalhes.', '#meuTrabalhoLista'],
        ['Atualize o andamento ou conclua o atendimento no detalhe.']
      ], 'chamado tarefa pendente concluir')
    ]},
    visaoKanban: { nome: 'Kanban', intro: 'Visualize e mova os chamados entre as etapas de atendimento.', guias: [
      guia('Atualizar um chamado', 'Mude o status do atendimento pelo quadro.', [
        ['Filtre pelo técnico, se necessário.', '#kanbanTecnico'],
        ['Busque o chamado pelo cliente, protocolo ou assunto.', '#kanbanBusca'],
        ['Abra o cartão e altere o status desejado. Você pode concluir qualquer chamado sem depender de outro.', '#kanbanChamados']
      ], 'finalizar fechar mover status técnico')
    ]},
    visaoCRM: { nome: 'CRM Comercial', intro: 'Gerencie oportunidades, próximas ações, clientes ganhos e negócios perdidos.', guias: [
      guia('Cadastrar uma oportunidade', 'Inclua um novo lead no funil comercial.', [
        ['Clique em Novo lead.', '[onclick="abrirModalLead()"]'],
        ['Preencha empresa, contato, interesse e próxima ação.'],
        ['Salve e acompanhe o cartão no funil.', '#crmBoard']
      ], 'lead prospect venda'),
      guia('Concluir uma próxima ação', 'Retire da lista uma ação que já foi realizada.', [
        ['Localize a ação no quadro Próximas ações.', '#crmProximas'],
        ['Abra a oportunidade relacionada.'],
        ['Marque a próxima ação como concluída; ela deixará de aparecer na lista.']
      ], 'follow-up tarefa'),
      guia('Excluir um cliente perdido', 'Remova definitivamente uma oportunidade perdida.', [
        ['Abra o cartão na etapa Perdido.'],
        ['Clique em Excluir e confirme a remoção.'],
        ['Use esta opção apenas quando não precisar manter o histórico.']
      ], 'perdido apagar remover')
    ]},
    cadastroClientes: { nome: 'Cadastro de clientes', intro: 'Cadastre pessoas e empresas; o mesmo registro também pode atuar como fornecedor.', guias: [
      guia('Cadastrar uma empresa pelo CNPJ', 'Consulte o CNPJ e aproveite os dados preenchidos automaticamente.', [
        ['Clique em Novo cliente.', '[onclick="abrirModalCliente()"]'],
        ['Selecione pessoa jurídica e informe o CNPJ.'],
        ['Use Consultar CNPJ para preencher razão social, endereço e outros dados.'],
        ['Revise os campos e salve o cadastro.']
      ], 'receita federal empresa cliente fornecedor'),
      guia('Definir cliente como fornecedor', 'Evite cadastros duplicados usando o mesmo registro.', [
        ['Abra a edição do cliente na coluna Ações.'],
        ['Ative a opção Este cadastro também é fornecedor.'],
        ['Salve. O registro ficará disponível nos lançamentos a pagar.']
      ], 'pagar prestador parceiro'),
      guia('Abrir o perfil 360°', 'Veja contratos, pendências, vendas e histórico de um cliente.', [
        ['Use a busca para localizar o cliente.', '#inputBuscaCliente'],
        ['Clique no ícone de perfil na coluna Ações.'],
        ['Para retornar, use Voltar para clientes no alto da tela.']
      ], 'gestão integrada perfil')
    ]},
    cadastroCatalogo: { nome: 'Produtos, serviços e estoque', intro: 'Mantenha o catálogo e controle as quantidades do almoxarifado.', guias: [
      guia('Cadastrar produto ou serviço', 'Inclua itens que serão usados em OS, vendas e estoque.', [
        ['Escolha Produtos, serviços e estoque.', '#tabCadastroCatalogo'],
        ['Clique no botão de novo produto ou serviço.'],
        ['Informe código, descrição, tipo, custos e preço.'],
        ['Para produtos físicos, defina a quantidade e o estoque mínimo.']
      ], 'peça catálogo preço'),
      guia('Movimentar o estoque', 'Registre entradas, saídas e ajustes com histórico.', [
        ['Localize o produto na lista.'],
        ['Abra Movimentar estoque.'],
        ['Escolha entrada, saída ou ajuste, informe quantidade e motivo.'],
        ['Confirme para atualizar o saldo.']
      ], 'almoxarifado saldo entrada saída')
    ]},
    cadastroEquipamentos: { nome: 'Equipamentos e garantias', intro: 'Controle máquinas próprias, equipamentos de clientes, garantias e empréstimos.', guias: [
      guia('Emprestar uma máquina reserva', 'Registre quem recebeu, onde está e quando deve devolver.', [
        ['Abra Equipamentos e garantias.', '#tabCadastroEquipamentos'],
        ['Cadastre ou edite a máquina reserva.'],
        ['Defina o status como Emprestado e selecione o cliente e a unidade.'],
        ['Informe responsável, data prevista de devolução e observações.']
      ], 'comodato reserva filial patrimônio'),
      guia('Registrar equipamento para conserto', 'Acompanhe a máquina do cliente enquanto ela está na matriz.', [
        ['Cadastre o equipamento com serial ou patrimônio.'],
        ['Vincule cliente e unidade de origem.'],
        ['Abra uma OS e associe o equipamento.'],
        ['Atualize localização e status durante o atendimento.']
      ], 'manutenção garantia oficina')
    ]},
    cadastroTecnicos: { nome: 'Técnicos', intro: 'Organize os profissionais disponíveis para chamados e ordens de serviço.', guias: [
      guia('Cadastrar um técnico', 'Inclua o profissional e suas informações de atendimento.', [
        ['Clique no botão de novo técnico.'],
        ['Preencha nome, contato e especialidade.'],
        ['Salve para disponibilizá-lo nas atribuições de chamados e OS.']
      ], 'colaborador responsável')
    ]},
    cadastroUsuarios: { nome: 'Usuários', intro: 'Controle o acesso da equipe e as permissões de cada módulo.', guias: [
      guia('Configurar permissões', 'Defina exatamente o que cada usuário pode visualizar e alterar.', [
        ['Abra ou edite o usuário.'],
        ['Marque as permissões de leitura, criação, edição e exclusão necessárias.'],
        ['Salve e peça ao usuário para entrar novamente se o acesso não atualizar.']
      ], 'acesso excluir administrador')
    ]},
    visaoProcessos: { nome: 'Processos', intro: 'Crie rotinas, checklists e responsabilidades compartilhadas.', guias: [
      guia('Criar um processo', 'Organize uma atividade recorrente ou pontual.', [
        ['Clique em Novo processo.', '[onclick="abrirModalProcesso()"]'],
        ['Informe título, responsáveis, prioridade, frequência e prazo.'],
        ['Adicione as etapas do checklist e salve.']
      ], 'rotina checklist responsáveis'),
      guia('Concluir etapas', 'Atualize o progresso sem depender de uma ordem fixa.', [
        ['Busque e abra o processo.', '#buscaProcessos'],
        ['Marque qualquer etapa que já foi realizada.'],
        ['Quando todas estiverem concluídas, finalize o processo.']
      ], 'atividade tarefa')
    ]},
    visaoContratos: { nome: 'Contratos', intro: 'Gerencie documentos, unidades atendidas, vigência e parcelas.', guias: [
      guia('Criar um contrato anual', 'Cadastre um contrato único que pode cobrir várias unidades.', [
        ['Clique em Novo contrato.', '[onclick="abrirModalContrato()"]'],
        ['Escolha o cliente principal e o modelo Serviços de T.I.'],
        ['Selecione todas as unidades atendidas.'],
        ['Informe valor, início, vencimento e renovação anual.'],
        ['Salve o contrato e as parcelas.']
      ], '36 mil filial prestação ti'),
      guia('Cancelar contrato ou parcelas', 'Interrompa cobranças futuras preservando o histórico.', [
        ['Abra o contrato desejado.'],
        ['Use Cancelar para cancelar o contrato e suas parcelas pendentes.'],
        ['A exclusão só deve ser usada em cadastro incorreto e sem movimentação.']
      ], 'excluir lançamento financeiro')
    ]},
    visaoOrdensServico: { nome: 'Ordens de serviço', intro: 'Controle diagnóstico, peças, execução, cobrança e entrega.', guias: [
      guia('Criar uma OS', 'Abra um atendimento técnico completo.', [
        ['Clique em Nova OS.', '[onclick="abrirModalOS()"]'],
        ['Selecione cliente, equipamento, técnico e descreva o defeito.'],
        ['Adicione serviços e peças utilizadas.'],
        ['Salve a OS e atualize o status durante o atendimento.']
      ], 'ordem chamado conserto'),
      guia('Excluir uma OS', 'Remova uma OS quando seu usuário tiver essa permissão.', [
        ['Abra a OS desejada.'],
        ['Clique em Excluir no conjunto de ações.'],
        ['Confirme a exclusão. Se houver financeiro vinculado, cancele ou remova o lançamento primeiro.']
      ], 'apagar permissão erro')
    ]},
    visaoFinanceiro: { nome: 'Financeiro', intro: 'Controle contas a receber, contas a pagar, baixas, recorrências e fluxo de caixa.', guias: [
      guia('Criar um lançamento', 'Registre uma receita ou despesa vinculada à pessoa correta.', [
        ['Clique em Novo lançamento.', '[onclick="abrirModalFinanceiro()"]'],
        ['Escolha Receber ou Pagar e selecione cliente ou fornecedor.'],
        ['Informe descrição, valor, vencimento e forma de pagamento.'],
        ['Salve o lançamento.']
      ], 'pix receita despesa conta'),
      guia('Dar baixa em uma conta', 'Marque uma cobrança como paga ou recebida.', [
        ['Localize a conta usando a busca.', '#financeiroBusca'],
        ['Na coluna Ações, clique no ícone de confirmação com o título Dar baixa.', '#financeiroTabela'],
        ['Informe os dados do pagamento quando solicitado e confirme.']
      ], 'pagar receber quitar pagamento'),
      guia('Excluir uma recorrência', 'Remova a série completa e os lançamentos relacionados.', [
        ['Abra a aba Recorrências.'],
        ['Localize a recorrência e clique em Excluir.'],
        ['Confirme a exclusão da recorrência e de todos os lançamentos gerados por ela.']
      ], 'cancelar parcelas duplicadas série'),
      guia('Pesquisar lançamentos', 'Use a descrição, categoria ou número da OS.', [
        ['Digite na barra de busca.', '#financeiroBusca'],
        ['Use o filtro ao lado para restringir por tipo ou status.', '#financeiroFiltro'],
        ['Abra as ações da linha encontrada.', '#financeiroTabela']
      ], 'filtro vencimento atrasado')
    ]},
    visaoRelatorios: { nome: 'Relatórios', intro: 'Analise períodos, indicadores e gere documentos para conferência.', guias: [
      guia('Gerar um relatório', 'Filtre o período antes de exportar.', [
        ['Escolha o período desejado.', '#relatorioPeriodo'],
        ['Confira os indicadores atualizados.'],
        ['Clique em PDF / Imprimir para gerar o documento.', '[onclick="gerarRelatorioPDF()"]']
      ], 'exportar imprimir csv'),
      guia('Gerar dossiê de chamado', 'Reúna os dados completos de um atendimento.', [
        ['Selecione o chamado.', '#dossieChamadoSelect'],
        ['Confira o conteúdo e gere o dossiê.']
      ], 'protocolo atendimento')
    ]},
    visaoConfiguracoes: { nome: 'Configurações', intro: 'Ajuste identidade, dados financeiros e preferências do sistema.', guias: [
      guia('Alterar o nome exibido', 'Troque o nome usado na saudação e na identificação do usuário.', [
        ['Abra os dados do usuário ou da operação.'],
        ['Altere o campo Nome, sem modificar o e-mail de acesso.'],
        ['Salve e atualize a página.']
      ], 'olá saudação email pessoa'),
      guia('Configurar PIX e cobrança', 'Mantenha os dados usados nos documentos financeiros.', [
        ['Localize as configurações financeiras.', '.settings-grid'],
        ['Revise chave PIX, dados da empresa e valor da hora.', '#cfgPix'],
        ['Salve as alterações.']
      ], 'empresa pagamento')
    ]},
    visaoGestaoCrm: { nome: 'Perfil do cliente', intro: 'Veja o relacionamento completo sem misturar dados de outros clientes.', guias: [
      guia('Voltar para a lista de clientes', 'Retorne ao cadastro para escolher outro perfil.', [
        ['Clique em Voltar para clientes no alto da página.', '[onclick="gcVoltarClientes()"]']
      ], 'gestão integrada 360'),
      guia('Consultar pendências do cliente', 'Veja somente itens vinculados ao cliente aberto.', [
        ['Clique na aba Pendências.', '[data-gc="pendencias"]'],
        ['Confira follow-ups, financeiro e alertas relacionados a este cliente.'],
        ['Alertas gerais de estoque não devem ser tratados como pendência individual.']
      ], 'chamado financeiro alerta')
    ]}
  };

  let moduloAtual = 'visaoDashboard';
  let guiaAberto = null;
  let tour = null;
  let observer = null;

  const $ = (s, root = document) => root.querySelector(s);
  const normalizar = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visivel = (el) => !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';

  function detectarModulo() {
    const views = [...document.querySelectorAll('.view-section')];
    const ativa = views.find(visivel);
    if (!ativa) return moduloAtual;
    if (ativa.id === 'visaoCadastro') {
      const sub = ['Clientes', 'Catalogo', 'Equipamentos', 'Tecnicos', 'Usuarios'].find(n => visivel(document.getElementById('cadastro' + n)));
      return sub ? 'cadastro' + sub : 'cadastroClientes';
    }
    return MODULOS[ativa.id] ? ativa.id : moduloAtual;
  }

  function icones() { if (window.lucide) window.lucide.createIcons(); }

  function criarInterface() {
    if ($('#helpAssistantFab')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <button id="helpAssistantFab" class="help-assistant-fab" type="button" aria-label="Abrir assistente" aria-controls="helpAssistantPanel"><i data-lucide="circle-help"></i><span>Precisa de ajuda?</span></button>
      <aside id="helpAssistantPanel" class="help-assistant-panel" role="dialog" aria-label="Assistente do CRM" aria-hidden="true">
        <header class="help-assistant-head"><div class="help-assistant-mark"><i data-lucide="sparkles"></i></div><div class="help-assistant-title"><strong>Assistente Help</strong><small id="helpAssistantContext">Ajuda do módulo atual</small></div><button class="help-assistant-close" type="button" aria-label="Fechar"><i data-lucide="x"></i></button></header>
        <div id="helpAssistantBody" class="help-assistant-body"></div>
      </aside>
      <div id="helpTourMask" class="help-tour-mask"></div>
      <div id="helpTourCard" class="help-tour-card" hidden></div>`);
    $('#helpAssistantFab').addEventListener('click', alternarPainel);
    $('.help-assistant-close').addEventListener('click', fecharPainel);
    atualizarVisibilidade();
    renderInicio();
    icones();
  }

  function appAberto() {
    const app = $('#appContainer');
    return app && !app.classList.contains('hidden') && getComputedStyle(app).display !== 'none';
  }

  function atualizarVisibilidade() {
    const fab = $('#helpAssistantFab');
    if (!fab) return;
    fab.classList.toggle('is-visible', appAberto());
    if (!appAberto()) fecharPainel();
    const novo = detectarModulo();
    if (novo !== moduloAtual) {
      moduloAtual = novo;
      guiaAberto = null;
      if ($('#helpAssistantPanel')?.classList.contains('open')) renderInicio();
    }
    const modulo = MODULOS[moduloAtual];
    const ctx = $('#helpAssistantContext');
    if (ctx && modulo) ctx.textContent = `Você está em: ${modulo.nome}`;
  }

  function abrirPainel() {
    if (!appAberto()) return;
    atualizarVisibilidade();
    $('#helpAssistantPanel').classList.add('open');
    $('#helpAssistantPanel').setAttribute('aria-hidden', 'false');
    $('#helpAssistantFab').setAttribute('aria-expanded', 'true');
    setTimeout(() => $('#helpAssistantSearch')?.focus(), 80);
  }
  function fecharPainel() {
    $('#helpAssistantPanel')?.classList.remove('open');
    $('#helpAssistantPanel')?.setAttribute('aria-hidden', 'true');
    $('#helpAssistantFab')?.setAttribute('aria-expanded', 'false');
  }
  function alternarPainel() { $('#helpAssistantPanel')?.classList.contains('open') ? fecharPainel() : abrirPainel(); }

  function cartaoGuia(item, chave, indice) {
    return `<button class="help-guide-card" type="button" data-help-module="${chave}" data-help-guide="${indice}"><span class="help-guide-icon"><i data-lucide="book-open-check"></i></span><span class="help-guide-copy"><strong>${item.titulo}</strong><span>${item.resumo}</span></span><i data-lucide="chevron-right"></i></button>`;
  }

  function renderInicio(termo = '') {
    const body = $('#helpAssistantBody');
    if (!body) return;
    const modulo = MODULOS[moduloAtual] || MODULOS.visaoDashboard;
    const busca = normalizar(termo);
    let conteudo = '';
    if (busca) {
      const resultados = [];
      Object.entries(MODULOS).forEach(([chave, dados]) => dados.guias.forEach((g, i) => {
        if (normalizar(`${dados.nome} ${g.titulo} ${g.resumo} ${g.palavras} ${g.passos.map(p => p[0]).join(' ')}`).includes(busca)) resultados.push({ chave, i, g, modulo: dados.nome });
      }));
      conteudo = `<div class="help-section-title">${resultados.length} resultado(s)</div><div class="help-guide-list">${resultados.map(r => cartaoGuia({...r.g, resumo:`${r.modulo} · ${r.g.resumo}`}, r.chave, r.i)).join('') || '<p class="help-empty">Não encontrei esse assunto. Tente palavras como “baixa”, “contrato”, “OS”, “estoque” ou “cliente”.</p>'}</div>`;
    } else {
      conteudo = `<section class="help-context"><small>Módulo atual</small><h3>${modulo.nome}</h3><p>${modulo.intro}</p></section><div class="help-section-title">O que você quer fazer?</div><div class="help-guide-list">${modulo.guias.map((g, i) => cartaoGuia(g, moduloAtual, i)).join('')}</div><div class="help-section-title">Dica</div><p class="help-empty">Você também pode pesquisar uma dúvida de qualquer módulo do CRM.</p>`;
    }
    body.innerHTML = `<div class="help-search"><i data-lucide="search"></i><input id="helpAssistantSearch" autocomplete="off" placeholder="Ex.: como dar baixa em uma conta?" value="${String(termo).replace(/"/g, '&quot;')}"></div>${conteudo}`;
    $('#helpAssistantSearch')?.addEventListener('input', e => renderInicio(e.target.value));
    body.querySelectorAll('[data-help-guide]').forEach(btn => btn.addEventListener('click', () => abrirGuia(btn.dataset.helpModule, Number(btn.dataset.helpGuide))));
    icones();
  }

  function abrirGuia(chave, indice) {
    const dados = MODULOS[chave], g = dados?.guias[indice];
    if (!g) return;
    guiaAberto = { chave, indice };
    const possuiAlvo = g.passos.some(p => p[1] && $(p[1]));
    $('#helpAssistantBody').innerHTML = `<div class="help-detail-head"><button class="help-back" type="button" aria-label="Voltar"><i data-lucide="arrow-left"></i></button><h3>${g.titulo}</h3></div><p class="help-detail-summary">${dados.nome} · ${g.resumo}</p><div class="help-steps">${g.passos.map((p, i) => `<div class="help-step"><span class="help-step-number">${i + 1}</span><p>${p[0]}</p></div>`).join('')}</div>${possuiAlvo ? '<button class="help-tour-start" type="button"><i data-lucide="mouse-pointer-click"></i>Mostrar onde clicar</button>' : ''}<div class="help-note">Os nomes dos botões podem variar conforme as permissões do seu usuário.</div>`;
    $('.help-back')?.addEventListener('click', () => renderInicio());
    $('.help-tour-start')?.addEventListener('click', () => iniciarTour(chave, indice));
    icones();
  }

  function iniciarTour(chave, indice) {
    const dados = MODULOS[chave], g = dados?.guias[indice];
    const passos = (g?.passos || []).map(p => ({ texto:p[0], alvo:p[1] ? $(p[1]) : null })).filter(p => p.alvo && visivel(p.alvo));
    if (!passos.length) return;
    fecharPainel();
    tour = { titulo:g.titulo, passos, indice:0 };
    $('#helpTourMask').classList.add('active');
    mostrarPassoTour();
  }

  function mostrarPassoTour() {
    if (!tour) return;
    document.querySelectorAll('.help-tour-target').forEach(el => el.classList.remove('help-tour-target'));
    const passo = tour.passos[tour.indice], alvo = passo.alvo;
    alvo.scrollIntoView({ behavior:'smooth', block:'center', inline:'nearest' });
    alvo.classList.add('help-tour-target');
    const card = $('#helpTourCard');
    card.hidden = false;
    card.innerHTML = `<small>PASSO ${tour.indice + 1} DE ${tour.passos.length}</small><h4>${tour.titulo}</h4><p>${passo.texto}</p><div class="help-tour-actions"><button type="button" data-tour="close">Sair</button>${tour.indice ? '<button type="button" data-tour="prev">Voltar</button>' : ''}<button type="button" class="primary" data-tour="next">${tour.indice === tour.passos.length - 1 ? 'Concluir' : 'Próximo'}</button></div>`;
    card.querySelector('[data-tour="close"]').onclick = encerrarTour;
    card.querySelector('[data-tour="prev"]')?.addEventListener('click', () => { tour.indice--; mostrarPassoTour(); });
    card.querySelector('[data-tour="next"]').onclick = () => { if (tour.indice >= tour.passos.length - 1) encerrarTour(); else { tour.indice++; mostrarPassoTour(); } };
    setTimeout(posicionarTour, 360);
  }

  function posicionarTour() {
    if (!tour) return;
    const alvo = tour.passos[tour.indice].alvo, card = $('#helpTourCard');
    const r = alvo.getBoundingClientRect(), largura = Math.min(330, innerWidth - 24), altura = card.offsetHeight;
    let left = Math.max(12, Math.min(innerWidth - largura - 12, r.left));
    let top = r.bottom + 14;
    if (top + altura > innerHeight - 12) top = Math.max(12, r.top - altura - 14);
    card.style.left = `${left}px`; card.style.top = `${top}px`;
  }

  function encerrarTour() {
    document.querySelectorAll('.help-tour-target').forEach(el => el.classList.remove('help-tour-target'));
    $('#helpTourMask')?.classList.remove('active');
    const card = $('#helpTourCard'); if (card) card.hidden = true;
    tour = null;
    abrirPainel();
    if (guiaAberto) abrirGuia(guiaAberto.chave, guiaAberto.indice);
  }

  function observar() {
    observer = new MutationObserver(() => requestAnimationFrame(atualizarVisibilidade));
    observer.observe(document.body, { subtree:true, attributes:true, attributeFilter:['class','style'] });
    window.addEventListener('resize', posicionarTour);
    window.addEventListener('scroll', posicionarTour, true);
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (tour) encerrarTour(); else fecharPainel();
    });
  }

  window.abrirAssistenteHelp = abrirPainel;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { criarInterface(); observar(); });
  else { criarInterface(); observar(); }
})();
