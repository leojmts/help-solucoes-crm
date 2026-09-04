(() => {
  'use strict';

  const WHATSAPP = '5567996717896';

  document.querySelectorAll('.faq-item button').forEach(button => {
    button.addEventListener('click', () => {
      const item = button.closest('.faq-item');
      const wasOpen = item.classList.contains('open');

      document.querySelectorAll('.faq-item.open').forEach(openItem => {
        openItem.classList.remove('open');
        const openButton = openItem.querySelector('button');
        openButton?.setAttribute('aria-expanded', 'false');
        const icon = openButton?.querySelector('svg');
        if (icon) icon.outerHTML = '<i data-lucide="plus"></i>';
      });

      if (!wasOpen) {
        item.classList.add('open');
        button.setAttribute('aria-expanded', 'true');
        const icon = button.querySelector('svg');
        if (icon) icon.outerHTML = '<i data-lucide="minus"></i>';
      }

      if (window.lucide) lucide.createIcons();
    });
  });

  const form = document.getElementById('leadForm');
  if (form) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const data = new FormData(form);
      const nome = String(data.get('nome') || '').trim();
      const empresa = String(data.get('empresa') || '').trim();
      const cidade = String(data.get('cidade') || '').trim();
      const segmento = String(data.get('segmento') || '').trim();
      const necessidade = String(data.get('necessidade') || '').trim();

      const lines = [
        'Olá! Vim pelo site da Help Soluções Tecnológicas.',
        '',
        'Nome: ' + nome,
        empresa ? 'Empresa: ' + empresa : null,
        cidade ? 'Cidade / UF: ' + cidade : null,
        segmento ? 'Segmento: ' + segmento : null,
        '',
        'Necessidade:',
        necessidade
      ].filter(Boolean);

      const url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(lines.join('\n'));
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  // Balão flutuante do WhatsApp.
  const whatsappFloat = document.getElementById('whatsappFloat');
  const whatsappTeaser = document.getElementById('whatsappTeaser');
  const whatsappClose = document.querySelector('.whatsapp-teaser-close');
  const whatsappBubble = document.querySelector('.whatsapp-bubble');

  if (whatsappFloat && whatsappTeaser) {
    let teaserTimer = null;
    let dismissed = false;

    try {
      dismissed = sessionStorage.getItem('help-wa-teaser-dismissed') === '1';
    } catch (_) {}

    if (!dismissed) {
      teaserTimer = window.setTimeout(() => {
        whatsappFloat.classList.add('is-visible');
      }, 1800);
    }

    whatsappClose?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (teaserTimer) window.clearTimeout(teaserTimer);
      whatsappFloat.classList.remove('is-visible');
      try {
        sessionStorage.setItem('help-wa-teaser-dismissed', '1');
      } catch (_) {}
    });

    whatsappBubble?.addEventListener('click', () => {
      whatsappFloat.classList.remove('is-visible');
    });
  }

  // Deixa pontos de conversão preparados para GA4/Meta Pixel no projeto final.
  document.querySelectorAll('[data-track]').forEach(element => {
    element.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('help:conversion', {
        detail: { event: element.dataset.track }
      }));
    });
  });
})();