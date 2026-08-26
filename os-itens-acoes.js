/* Ações explícitas para itens de Serviços e Peças na Ordem de Serviço. */
(function () {
  const style = document.createElement('style');
  style.textContent = `
    #osItens .os-item{grid-template-columns:110px minmax(190px,1fr) 80px 115px 100px 88px}
    #osItens .os-item .os-item-excluir{width:88px;height:36px;padding:0 10px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid rgba(251,113,133,.45);border-radius:8px;background:rgba(251,113,133,.08);color:#fb7185;font-size:11px;font-weight:700;cursor:pointer}
    #osItens .os-item .os-item-excluir:hover{background:rgba(251,113,133,.16);border-color:#fb7185;color:#fb7185}
    #osItens .os-item .os-item-excluir svg{width:14px;height:14px;flex:0 0 auto}
    @media(max-width:900px){#osItens .os-item{grid-template-columns:90px 1fr 65px 95px 80px 82px}#osItens .os-item .os-item-excluir{width:82px}}
    @media(max-width:640px){#osItens .os-item{grid-template-columns:1fr 1fr 92px}#osItens .os-item .os-item-excluir{width:92px;grid-column:3;grid-row:1/3;align-self:stretch;height:auto;min-height:42px}}
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
        <input value="${osHtml(x.descricao)}" placeholder="Descrição" oninput="atualizarItemOS(${i},'descricao',this.value)">
        <input type="number" min="0.01" step="0.01" value="${x.quantidade}" title="Quantidade" aria-label="Quantidade" oninput="atualizarItemOS(${i},'quantidade',this.value)">
        <input type="number" min="0" step="0.01" value="${x.valor_unitario}" title="Valor unitário" aria-label="Valor unitário" oninput="atualizarItemOS(${i},'valor_unitario',this.value)">
        <b>${osMoeda(Number(x.quantidade) * Number(x.valor_unitario))}</b>
        <button type="button" class="os-item-excluir" onclick="removerItemOS(${i})" title="Excluir este ${x.tipo === 'Peça' ? 'item de peça' : 'serviço'}" aria-label="Excluir ${x.tipo === 'Peça' ? 'peça' : 'serviço'}">
          <i data-lucide="trash-2"></i><span>Excluir</span>
        </button>
      </div>`).join('') : '<div class="os-sem-itens"><i data-lucide="package-open"></i><span>Nenhum serviço ou peça adicionado.</span></div>';
    calcularTotaisOS();
    if (window.lucide) lucide.createIcons();
  };
})();
