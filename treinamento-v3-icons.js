(() => {
  'use strict';

  const moduleIcons = {
    fundamentos: 'compass',
    meutrabalho: 'clipboard-list',
    chamados: 'headset',
    comercial: 'handshake',
    gestaocomercial: 'chart-no-axes-combined',
    clientes: 'users',
    catalogo: 'package',
    equipamentos: 'monitor-cog',
    processos: 'list-checks',
    os: 'wrench',
    financeiro: 'circle-dollar-sign',
    contratos: 'file-text',
    relatorios: 'chart-column-big',
    administracao: 'settings'
  };

  const flowIcons = {
    'Atendimento técnico completo': 'headset',
    'Venda até implantação': 'handshake',
    'Receita até conciliação bancária': 'landmark',
    'Equipamento recebido para manutenção': 'monitor-cog',
    'Rotina interna recorrente': 'refresh-cw'
  };

  const iconHtml = (name, cls = '') => `<i data-lucide="${name}"${cls ? ` class="${cls}"` : ''}></i>`;

  function configureDataIcons() {
    try {
      if (typeof moduleData !== 'undefined') {
        moduleData.forEach(m => {
          const name = moduleIcons[m.id];
          if (name) m.icon = iconHtml(name, 'training-lucide');
        });
      }
      if (typeof flows !== 'undefined') {
        flows.forEach(f => {
          const name = flowIcons[f.title];
          if (name) f.icon = iconHtml(name, 'training-lucide');
        });
      }
    } catch (e) {
      console.warn('Ícones do treinamento:', e);
    }
  }

  function setIcon(el, name, label, filled = false) {
    if (!el || el.dataset.iconified === name + (filled ? '-filled' : '')) return;
    el.dataset.iconified = name + (filled ? '-filled' : '');
    if (label) el.setAttribute('aria-label', label);
    el.innerHTML = iconHtml(name, filled ? 'training-lucide is-filled' : 'training-lucide');
  }

  function upgradeStatic(root = document) {
    const q = (sel) => [...(root.matches?.(sel) ? [root] : []), ...root.querySelectorAll?.(sel) || []];

    q('.audit-mark').forEach(el => setIcon(el, 'badge-check', 'Conteúdo auditado'));
    q('.search > span').forEach(el => setIcon(el, 'search', 'Pesquisar'));
    q('.close').forEach(el => setIcon(el, 'x', 'Fechar'));
    q('.arrow').forEach(el => setIcon(el, 'arrow-right', 'Abrir'));
    q('.mobile-compact-brand > a').forEach(el => setIcon(el, 'external-link', 'Voltar ao sistema'));

    q('.mobile-training-nav [data-mobile-view="learn"] .mi').forEach(el => setIcon(el, 'graduation-cap'));
    q('.mobile-training-nav [data-mobile-view="consult"] .mi').forEach(el => setIcon(el, 'search'));
    q('.mobile-training-nav [data-mobile-view="track"] .mi').forEach(el => setIcon(el, 'badge-check'));
    q('.mobile-training-nav [data-mobile-view="flows"] .mi').forEach(el => setIcon(el, 'route'));
    q('.mobile-training-nav [data-mobile-more] .mi').forEach(el => setIcon(el, 'ellipsis'));

    q('.mobile-more-grid [data-mobile-view="favorites"] .mi').forEach(el => setIcon(el, 'star'));
    q('.mobile-more-grid [data-mobile-view="news"] .mi').forEach(el => setIcon(el, 'newspaper'));
    q('.mobile-more-grid [data-mobile-view="map"] .mi').forEach(el => setIcon(el, 'map'));
    q('.mobile-more-grid [data-mobile-view="planned"] .mi').forEach(el => setIcon(el, 'puzzle'));
    q('.mobile-more-grid [data-mobile-view="admin"] .mi').forEach(el => setIcon(el, 'settings'));
    q('.mobile-more-grid [data-mobile-close] .mi').forEach(el => setIcon(el, 'x'));

    q('.v3-alert.warn b').forEach(el => {
      if (el.dataset.iconifiedAlert) return;
      el.dataset.iconifiedAlert = '1';
      el.innerHTML = `${iconHtml('triangle-alert', 'training-inline-icon')}<span>Atenção</span>`;
    });

    q('.v3-media-empty').forEach(el => {
      if (!el.textContent.includes('📷') || el.dataset.iconifiedMedia) return;
      el.dataset.iconifiedMedia = '1';
      el.innerHTML = `${iconHtml('image', 'training-inline-icon')}<span>${el.textContent.replace('📷', '').trim()}</span>`;
    });

    q('.v3-fav').forEach(el => {
      const txt = el.textContent.trim();
      const filled = txt === '★' || txt.includes('Favoritada');
      if (txt === '★' || txt === '☆') setIcon(el, 'star', filled ? 'Remover dos favoritos' : 'Adicionar aos favoritos', filled);
    });
  }

  function renderLucide() {
    if (!window.lucide?.createIcons) return;
    window.lucide.createIcons({ attrs: { 'stroke-width': 1.9 } });
  }

  function refreshVisuals() {
    upgradeStatic(document);
    renderLucide();
  }

  configureDataIcons();

  try {
    if (typeof renderCurrent === 'function') renderCurrent();
    if (typeof currentView !== 'undefined' && ['track','flows','favorites','news','admin'].includes(currentView) && typeof renderV3 === 'function') renderV3(currentView);
  } catch (e) {
    console.warn('Atualização visual do treinamento:', e);
  }

  refreshVisuals();

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      refreshVisuals();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const style = document.createElement('style');
  style.id = 'trainingLucideStyles';
  style.textContent = `
    .training-lucide{width:20px;height:20px;display:block;stroke-width:1.9}
    .module-icon .training-lucide{width:21px;height:21px;color:var(--accent)}
    .map-module-head h3{display:flex;align-items:center;gap:8px}.map-module-head h3>.training-lucide{width:17px;height:17px;color:var(--accent);flex:0 0 auto}
    .v3-flow-icon .training-lucide{width:21px;height:21px;color:var(--accent)}
    .mobile-training-nav .mi,.mobile-more-grid .mi{display:grid;place-items:center}
    .mobile-training-nav .mi .training-lucide{width:20px;height:20px}
    .mobile-more-grid .mi .training-lucide{width:19px;height:19px}
    .mobile-compact-brand>a .training-lucide{width:19px;height:19px}
    .audit-mark .training-lucide{width:16px;height:16px}
    .search>span .training-lucide{width:17px;height:17px}
    .close .training-lucide,.arrow .training-lucide{width:17px;height:17px}
    .v3-fav .training-lucide{width:17px;height:17px}
    .training-lucide.is-filled{fill:currentColor}
    .v3-alert.warn b,.v3-media-empty{display:flex;align-items:flex-start;gap:7px}
    .training-inline-icon{width:15px;height:15px;flex:0 0 auto;margin-top:1px}
    .v3-media-empty .training-inline-icon{color:var(--accent)}
    @media(max-width:760px){
      .mobile-training-nav .mi .training-lucide{width:21px;height:21px}
      .module-icon .training-lucide{width:22px;height:22px}
    }
  `;
  document.head.appendChild(style);
  renderLucide();
})();