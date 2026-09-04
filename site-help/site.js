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


  // Detalhes interativos das soluções.
  const serviceDetails = {
    suporte: {
      title: 'Suporte técnico',
      intro: 'Apoio para manter usuários e rotina tecnológica funcionando com mais previsibilidade.',
      items: [
        'Entendimento e diagnóstico inicial da necessidade.',
        'Apoio a usuários e ocorrências da rotina de TI.',
        'Acompanhamento das demandas para reduzir recorrência de problemas.'
      ]
    },
    infraestrutura: {
      title: 'Redes e infraestrutura',
      intro: 'Organização da base tecnológica para melhorar conectividade, estabilidade e evolução do ambiente.',
      items: [
        'Avaliação da estrutura e dos pontos que precisam de melhoria.',
        'Organização de rede, conectividade e equipamentos envolvidos.',
        'Planejamento de melhorias conforme a realidade da operação.'
      ]
    },
    manutencao: {
      title: 'Manutenção',
      intro: 'Cuidados preventivos e corretivos para reduzir paradas e prolongar a vida útil dos equipamentos.',
      items: [
        'Avaliação do equipamento e identificação da causa do problema.',
        'Manutenção preventiva ou corretiva conforme a necessidade.',
        'Orientação sobre conservação, uso e próximos cuidados.'
      ]
    },
    seguranca: {
      title: 'Segurança e continuidade',
      intro: 'Boas práticas para reduzir riscos e manter informações e serviços importantes disponíveis.',
      items: [
        'Revisão das rotinas e pontos de risco do ambiente.',
        'Orientações para proteção e continuidade da operação.',
        'Acompanhamento de melhorias de acordo com a necessidade da empresa.'
      ]
    },
    equipamentos: {
      title: 'Equipamentos e ambiente',
      intro: 'Apoio para organizar, acompanhar e manter os equipamentos usados pela empresa.',
      items: [
        'Avaliação do cenário atual de equipamentos.',
        'Organização de necessidades de manutenção e substituição.',
        'Acompanhamento do ambiente para facilitar decisões futuras.'
      ]
    },
    'sob-medida': {
      title: 'Soluções sob medida',
      intro: 'Quando a necessidade não cabe em uma categoria pronta, começamos entendendo a operação.',
      items: [
        'Levantamento do cenário e do objetivo da empresa.',
        'Definição de prioridades e desenho da solução adequada.',
        'Implementação e acompanhamento conforme o escopo combinado.'
      ]
    }
  };

  const drawerShell = document.getElementById('serviceDrawerShell');
  const drawer = document.getElementById('serviceDrawer');
  const drawerTitle = document.getElementById('serviceDrawerTitle');
  const drawerIntro = document.getElementById('serviceDrawerIntro');
  const drawerList = document.getElementById('serviceDrawerList');
  const drawerCta = document.getElementById('serviceDrawerCta');
  let drawerOrigin = null;
  let drawerCloseTimer = null;

  const closeServiceDrawer = () => {
    if (!drawerShell || !drawer) return;
    drawerShell.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('modal-open');
    if (drawerCloseTimer) window.clearTimeout(drawerCloseTimer);
    drawerCloseTimer = window.setTimeout(() => {
      drawerShell.hidden = true;
      drawerOrigin?.focus();
    }, 340);
  };

  document.querySelectorAll('[data-service]').forEach(button => {
    button.addEventListener('click', () => {
      const service = serviceDetails[button.dataset.service];
      if (!service || !drawerShell || !drawer) return;

      drawerOrigin = button;
      drawerTitle.textContent = service.title;
      drawerIntro.textContent = service.intro;
      drawerList.innerHTML = service.items.map(item => '<li>' + item + '</li>').join('');
      drawerCta.href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(
        'Olá! Vim pelo site da Help Soluções Tecnológicas e gostaria de conversar sobre ' + service.title + '.'
      );

      drawerShell.hidden = false;
      document.documentElement.classList.add('modal-open');
      requestAnimationFrame(() => {
        drawerShell.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        drawer.querySelector('[data-service-close]')?.focus();
      });
    });
  });

  document.querySelectorAll('[data-service-close]').forEach(button => {
    button.addEventListener('click', closeServiceDrawer);
  });

  document.addEventListener('keydown', event => {
    if (!drawerShell || drawerShell.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeServiceDrawer();
      return;
    }
    if (event.key !== 'Tab' || !drawer) return;

    const focusable = [...drawer.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.hasAttribute('hidden'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // Diagnóstico rápido em 3 etapas.
  const diagnosisTool = document.getElementById('diagnosisTool');
  if (diagnosisTool) {
    const steps = [...diagnosisTool.querySelectorAll('[data-diagnosis-step]')];
    const result = document.getElementById('diagnosisResult');
    const progress = document.getElementById('diagnosisProgress');
    const stepLabel = document.getElementById('diagnosisStepLabel');
    const back = document.getElementById('diagnosisBack');
    const restart = document.getElementById('diagnosisRestart');
    const summary = document.getElementById('diagnosisSummary');
    const whatsapp = document.getElementById('diagnosisWhatsapp');
    const diagnosis = { area: '', impact: '', size: '' };
    let currentStep = 1;

    const showStep = step => {
      currentStep = Math.max(1, Math.min(3, step));
      steps.forEach(el => {
        const active = Number(el.dataset.diagnosisStep) === currentStep;
        el.hidden = !active;
        el.classList.toggle('is-active', active);
      });
      result.hidden = true;
      stepLabel.textContent = 'ETAPA ' + currentStep + ' DE 3';
      progress.style.width = (currentStep / 3 * 100) + '%';
      back.hidden = currentStep === 1;
      steps[currentStep - 1]?.querySelector('button')?.focus({ preventScroll: true });
    };

    diagnosisTool.querySelectorAll('[data-diagnosis-area]').forEach(button => {
      button.addEventListener('click', () => {
        diagnosis.area = button.dataset.diagnosisArea;
        showStep(2);
      });
    });

    diagnosisTool.querySelectorAll('[data-diagnosis-impact]').forEach(button => {
      button.addEventListener('click', () => {
        diagnosis.impact = button.dataset.diagnosisImpact;
        showStep(3);
      });
    });

    diagnosisTool.querySelectorAll('[data-diagnosis-size]').forEach(button => {
      button.addEventListener('click', () => {
        diagnosis.size = button.dataset.diagnosisSize;
        steps.forEach(el => { el.hidden = true; el.classList.remove('is-active'); });
        result.hidden = false;
        stepLabel.textContent = 'DIAGNÓSTICO CONCLUÍDO';
        progress.style.width = '100%';
        back.hidden = true;

        summary.textContent = diagnosis.area + ' · ' + diagnosis.impact + ' · ' + diagnosis.size + '.';
        const message = [
          'Olá! Fiz o diagnóstico rápido no site da Help Soluções Tecnológicas.',
          '',
          'Principal necessidade: ' + diagnosis.area,
          'Impacto: ' + diagnosis.impact,
          'Tamanho aproximado: ' + diagnosis.size,
          '',
          'Gostaria de conversar sobre esse cenário.'
        ].join('\n');
        whatsapp.href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(message);
        whatsapp.focus({ preventScroll: true });
      });
    });

    back?.addEventListener('click', () => showStep(currentStep - 1));
    restart?.addEventListener('click', () => {
      diagnosis.area = '';
      diagnosis.impact = '';
      diagnosis.size = '';
      showStep(1);
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