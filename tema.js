/* Alternância de tema persistente. */
(function(){
  const CHAVE='help_crm_tema';

  function temaAtual(){
    return document.documentElement.dataset.theme || localStorage.getItem(CHAVE) || 'dark';
  }

  function atualizarBotao(){
    const botao=document.getElementById('themeToggleBtn');
    if(!botao)return;
    const claro=temaAtual()==='light';
    botao.title=claro?'Usar modo escuro':'Usar modo claro';
    botao.setAttribute('aria-label',botao.title);
    botao.innerHTML=`<i data-lucide="${claro?'moon':'sun'}"></i>`;
    if(window.renderizarIcones)renderizarIcones();
    else if(window.lucide)lucide.createIcons();
  }

  function aplicarTema(tema,salvar=true){
    const valor=tema==='light'?'light':'dark';
    document.documentElement.dataset.theme=valor;
    if(salvar)localStorage.setItem(CHAVE,valor);
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',valor==='light'?'#f4f7fb':'#07182b');
    atualizarBotao();
  }

  window.alternarTema=function(){
    aplicarTema(temaAtual()==='light'?'dark':'light');
  };

  function instalarBotao(){
    const box=document.getElementById('userBox');
    if(!box||document.getElementById('themeToggleBtn'))return;
    const sair=box.querySelector('button[title="Sair"]');
    const botao=document.createElement('button');
    botao.id='themeToggleBtn';
    botao.className='theme-toggle';
    botao.type='button';
    botao.onclick=window.alternarTema;
    if(sair)box.insertBefore(botao,sair);else box.appendChild(botao);
    atualizarBotao();
  }

  const salvo=localStorage.getItem(CHAVE);
  aplicarTema(salvo==='light'?'light':'dark',false);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',instalarBotao);
  else instalarBotao();
  new MutationObserver(instalarBotao).observe(document.documentElement,{childList:true,subtree:true});
})();
