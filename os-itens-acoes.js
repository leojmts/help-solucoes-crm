/* Ações explícitas para itens de Serviços e Peças na Ordem de Serviço. */
(function () {
  const style = document.createElement('style');
  style.textContent = `
    #osItens{min-width:0;overflow:hidden}
    #osItens .os-item{
      width:100%;min-width:0;
      grid-template-columns:88px minmax(0,1fr) 64px 92px 88px 76px;
      gap:6px;
    }
    #osItens .os-item>*{min-width:0}
    #osItens .os-item input,#osItens .os-item select{padding-left:8px;padding-right:8px}
    #osItens .os-item b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
    #osItens .os-item .os-item-excluir{width:76px;height:36px;padding:0 7px;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:1px solid rgba(251,113,133,.45);border-radius:8px;background:rgba(251,113,133,.08);color:#fb7185;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap}
    #osItens .os-item .os-item-excluir:hover{background:rgba(251,113,133,.16);border-color:#fb7185;color:#fb7185}
    #osItens .os-item .os-item-excluir svg{width:13px;height:13px;flex:0 0 auto}
    @media(max-width:900px){
      #osItens .os-item{grid-template-columns:78px minmax(0,1fr) 58px 82px 78px 70px;gap:5px}
      #osItens .os-item .os-item-excluir{width:70px;padding:0 5px}
    }
    @media(max-width:720px){
      #osItens{overflow:visible}
      #osItens .os-item{grid-template-columns:1fr 1fr;gap:8px;padding:10px;border:1px solid var(--border);border-radius:10px}
      #osItens .os-item select{grid-column:1}
      #osItens .os-item input:nth-of-type(1){grid-column:1/-1;grid-row:2}
      #osItens .os-item input:nth-of-type(2){grid-column:1;grid-row:3}
      #osItens .os-item input:nth-of-type(3){grid-column:2;grid-row:3}
      #osItens .os-item b{grid-column:1;grid-row:4;align-self:center;text-align:left;font-size:12px}
      #osItens .os-item .os-item-excluir{grid-column:2;grid-row:4;width:100%;height:38px;justify-self:stretch}
    }
  `;
  document.head.appendChild(style);

  window.removerItemOS = function (i) {
    if (!Array.isArray(osItensEdicao) || i < 0 || i >= osItensEdicao.length) return;
    osItensEdicao.splice(i, 1);
    atualizarItensOS();
  };

  window.atualizarItensOS = function () {
    const box = document.getElementById('osItens');
    if (!box) return;
    box.innerHTML = osItensEdicao.length ? osItensEdicao.map((x, i) => `
      <div class="os-item">
        <select aria-label="Tipo do item" onchange="atualizarItemOS(${i},'tipo',this.value)">
          <option ${x.tipo === 'Serviço' ? 'selected' : ''}>Serviço</option>
          <option ${x.tipo === 'Peça' ? 'selected' : ''}>Peça</option>
        </select>
        <input value="${osHtml(x.descricao)}" placeholder="Descrição" aria-label="Descrição" oninput="atualizarItemOS(${i},'descricao',this.value)">
        <input type="number" min="0.01" step="0.01" value="${x.quantidade}" title="Quantidade" aria-label="Quantidade" oninput="atualizarItemOS(${i},'quantidade',this.value)">
        <input type="number" min="0" step="0.01" value="${x.valor_unitario}" title="Valor unitário" aria-label="Valor unitário" oninput="atualizarItemOS(${i},'valor_unitario',this.value)">
        <b title="${osMoeda(Number(x.quantidade) * Number(x.valor_unitario))}">${osMoeda(Number(x.quantidade) * Number(x.valor_unitario))}</b>
        <button type="button" class="os-item-excluir" onclick="removerItemOS(${i})" title="Excluir este ${x.tipo === 'Peça' ? 'item de peça' : 'serviço'}" aria-label="Excluir ${x.tipo === 'Peça' ? 'peça' : 'serviço'}">
          <i data-lucide="trash-2"></i><span>Excluir</span>
        </button>
      </div>`).join('') : '<div class="os-sem-itens"><i data-lucide="package-open"></i><span>Nenhum serviço ou peça adicionado.</span></div>';
    calcularTotaisOS();
    if (window.lucide) lucide.createIcons();
  };
})();
