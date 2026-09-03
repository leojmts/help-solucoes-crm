(() => {
  'use strict';
  if(typeof norm!=='function')return;
  const baseNorm=norm;
  const aliases=[
    [/como.*cobrar|cobrar.*cliente|mandar.*cobranca/,'cobrar'],
    [/dar.*baixa|registrar.*pagamento|cliente.*pagou/,'baixa'],
    [/pagou.*parte|pagamento.*parcial|recebeu.*parte/,'parcial'],
    [/cancelar.*contrato|encerrar.*contrato/,'cancelar contrato'],
    [/renovar.*contrato|renovacao.*contrato/,'renovar contrato'],
    [/computador.*emprest|maquina.*emprest|reserva.*cliente/,'emprestar'],
    [/devolver.*maquina|devolucao.*reserva/,'devolucao'],
    [/abrir.*chamado|novo.*chamado/,'novo chamado'],
    [/fechar.*chamado|finalizar.*chamado|resolver.*chamado/,'resolvido'],
    [/criar.*os|ordem.*servico/,'os'],
    [/estoque.*baixo|saldo.*produto|entrada.*estoque|saida.*estoque/,'estoque'],
    [/extrato.*banco|conciliar.*banco|ofx/,'ofx'],
    [/proposta.*contrato|converter.*proposta/,'converter proposta'],
    [/permissao.*usuario|acesso.*usuario/,'permissoes'],
    [/backup|copia.*dados/,'backup']
  ];
  window.norm=function(v){
    const n=baseNorm(v);
    if(String(v||'').length>140)return n;
    const hit=aliases.find(([rx])=>rx.test(n));
    return hit?hit[1]:n;
  };
  const input=document.getElementById('globalSearch');
  if(input){
    input.placeholder='Pergunte ou pesquise: “como dar baixa?”, “onde vejo máquina emprestada?”, OFX...';
    input.title='A busca reconhece algumas perguntas comuns e também pesquisa por palavras-chave.';
  }
})();