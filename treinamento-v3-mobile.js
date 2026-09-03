(() => {
  'use strict';
  if (document.getElementById('mobileTrainingNav')) return;

  const main = document.querySelector('main');
  const topbar = document.querySelector('.topbar');
  if (!main || !topbar) return;

  const brand = document.createElement('div');
  brand.className = 'mobile-compact-brand';
  brand.innerHTML = `
    <div><img src="help-logo-transparent.svg?v=20260827-3" alt="Help Soluções"><span><b>Central de Treinamento</b><small>Help Soluções Tecnológicas</small></span></div>
    <a href="./" title="Voltar ao sistema" aria-label="Voltar ao sistema">↗</a>`;
  main.insertBefore(brand, topbar);

  const nav = document.createElement('nav');
  nav.id = 'mobileTrainingNav';
  nav.className = 'mobile-training-nav';
  nav.setAttribute('aria-label', 'Navegação do treinamento');
  nav.innerHTML = `
    <button type="button" data-mobile-view="learn"><span class="mi">🎓</span><span>Trilhas</span></button>
    <button type="button" data-mobile-view="consult"><span class="mi">🔎</span><span>Consultar</span></button>
    <button type="button" data-mobile-view="track"><span class="mi">✅</span><span>Minha trilha</span></button>
    <button type="button" data-mobile-view="flows"><span class="mi">↔</span><span>Fluxos</span></button>
    <button type="button" data-mobile-more><span class="mi">•••</span><span>Mais</span></button>`;
  document.body.appendChild(nav);

  const backdrop = document.createElement('div');
  backdrop.className = 'mobile-sheet-backdrop';
  backdrop.id = 'mobileTrainingBackdrop';
  document.body.appendChild(backdrop);

  const sheet = document.createElement('aside');
  sheet.className = 'mobile-more-sheet';
  sheet.id = 'mobileTrainingMore';
  sheet.innerHTML = `
    <h4>Mais opções</h4>
    <div class="mobile-more-grid">
      <button type="button" data-mobile-view="favorites"><span class="mi">⭐</span>Favoritos</button>
      <button type="button" data-mobile-view="news"><span class="mi">🆕</span>Novidades</button>
      <button type="button" data-mobile-view="map"><span class="mi">🗺️</span>Mapa do sistema</button>
      <button type="button" data-mobile-view="planned"><span class="mi">🧩</span>Planejados</button>
      <button type="button" data-mobile-view="admin"><span class="mi">⚙️</span>Modo ADM</button>
      <button type="button" data-mobile-close><span class="mi">✕</span>Fechar menu</button>
    </div>`;
  document.body.appendChild(sheet);

  function setSheet(open) {
    sheet.classList.toggle('open', open);
    backdrop.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  function sync(view) {
    nav.querySelectorAll('[data-mobile-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.mobileView === view));
    nav.querySelector('[data-mobile-more]')?.classList.toggle('active', ['favorites','news','map','planned','admin'].includes(view));
  }

  const baseShowView = window.showView;
  if (typeof baseShowView === 'function' && !baseShowView.__mobileWrapped) {
    const wrapped = function(name) {
      const result = baseShowView.apply(this, arguments);
      sync(name);
      setSheet(false);
      if (window.matchMedia('(max-width:760px)').matches) window.scrollTo({top: 0, behavior: 'smooth'});
      return result;
    };
    wrapped.__mobileWrapped = true;
    window.showView = wrapped;
  }

  document.addEventListener('click', e => {
    const viewBtn = e.target.closest('[data-mobile-view]');
    if (viewBtn) {
      const name = viewBtn.dataset.mobileView;
      if (typeof window.showView === 'function') window.showView(name);
      return;
    }
    if (e.target.closest('[data-mobile-more]')) return setSheet(!sheet.classList.contains('open'));
    if (e.target.closest('[data-mobile-close]')) return setSheet(false);
  });
  backdrop.addEventListener('click', () => setSheet(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setSheet(false); });

  const role = document.getElementById('roleFilter');
  if (role) {
    const original = role.onchange;
    role.onchange = function() {
      if (typeof original === 'function') original.call(this);
      if (typeof window.renderCurrent === 'function') window.renderCurrent();
    };
  }

  sync(typeof currentView !== 'undefined' ? currentView : 'learn');
})();