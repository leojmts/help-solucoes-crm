(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const revealGroups = [
    ['.intro-grid > *', 'reveal-up'],
    ['.section-heading > *', 'reveal-up'],
    ['.segment-card', 'reveal-up'],
    ['.segment-row', 'reveal-up'],
    ['.reach-heading > *', 'reveal-up'],
    ['.reach-place', 'reveal-up'],
    ['.reach-footer > *', 'reveal-up'],
    ['.contact-final-inner > .eyebrow', 'reveal-up'],
    ['.contact-final-inner > h2', 'reveal-up'],
    ['.contact-final-inner > p', 'reveal-up'],
    ['.contact-final-actions > *', 'reveal-up'],
    ['.contact-strip > *', 'reveal-up'],
    ['.location-head > *', 'reveal-up'],
    ['.location-map', 'reveal-up'],
    ['.diagnosis-copy > *', 'reveal-up'],
    ['.diagnosis-tool', 'reveal-up'],
    ['.solution-card', 'reveal-up'],
    ['.process-step', 'reveal-up'],
    ['.why-grid > article', 'reveal-up'],
    ['.owner-grid > *', 'reveal-up'],
    ['.faq-item', 'reveal-up'],
    ['.lead-grid > *', 'reveal-up'],
    ['.map-card > *', 'reveal-up'],
    ['.presence-copy > *', 'reveal-left'],
    ['.presence-card', 'reveal-right'],
    ['.contact-copy > *', 'reveal-left'],
    ['.contact-details', 'reveal-right'],
    ['.contact-item', 'reveal-up'],
    ['.footer-wrap > *', 'reveal-up']
  ];

  let order = 0;
  revealGroups.forEach(([selector, variant]) => {
    document.querySelectorAll(selector).forEach((el, index) => {
      el.classList.add('reveal', variant);
      el.style.setProperty('--reveal-delay', Math.min(index * 70, 280) + 'ms');
      el.dataset.revealOrder = String(order++);
    });
  });

  const heroItems = [
    '.hero .eyebrow',
    '.hero h1',
    '.hero-copy > p',
    '.hero-actions',
    '.hero-trust',
    '.hero-network'
  ];
  heroItems.forEach((selector, index) => {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('hero-enter');
    el.style.setProperty('--hero-delay', (90 + index * 90) + 'ms');
  });

  requestAnimationFrame(() => document.body.classList.add('site-ready'));

  if (reduceMotion) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.13, rootMargin: '0px 0px -7% 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  // Barra superior: ganha profundidade quando a página começa a rolar.
  const header = document.querySelector('.site-header');
  const syncHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 18);
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });

  // Parallax/tilt bem leve no desktop. Nenhum efeito em telas touch.
  if (finePointer && !reduceMotion) {
    const panel = document.querySelector('.hero-network');
    if (panel) {
      panel.addEventListener('pointermove', (event) => {
        const rect = panel.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        panel.style.setProperty('--network-tilt-x', (x * 2.6).toFixed(2) + 'deg');
        panel.style.setProperty('--network-tilt-y', (y * -2.6).toFixed(2) + 'deg');
        panel.style.setProperty('--glow-x', ((x + .5) * 100).toFixed(1) + '%');
        panel.style.setProperty('--glow-y', ((y + .5) * 100).toFixed(1) + '%');
      });
      panel.addEventListener('pointerleave', () => {
        panel.style.setProperty('--network-tilt-x', '0deg');
        panel.style.setProperty('--network-tilt-y', '0deg');
        panel.style.setProperty('--glow-x', '72%');
        panel.style.setProperty('--glow-y', '12%');
      });
    }

    document.querySelectorAll('.segment-card').forEach(card => {
      card.addEventListener('pointermove', event => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((event.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((event.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
      });
    });
  }

  // Destaque do item do menu conforme a seção visível.
  const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
  const sections = navLinks
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if (sections.length) {
    const navObserver = new IntersectionObserver(entries => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach(link => {
        link.classList.toggle('is-active', link.getAttribute('href') === '#' + visible.target.id);
      });
    }, { threshold: [0.15, 0.35, 0.6], rootMargin: '-20% 0px -55% 0px' });
    sections.forEach(section => navObserver.observe(section));
  }

  // Feedback de clique nos CTAs sem bloquear navegação.
  document.querySelectorAll('.btn, .nav-cta, .mobile-wa-cta').forEach(el => {
    el.addEventListener('pointerdown', () => el.classList.add('is-pressed'));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(evt => {
      el.addEventListener(evt, () => el.classList.remove('is-pressed'));
    });
  });
})();