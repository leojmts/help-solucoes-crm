(function (global) {
  'use strict';

  const A4 = [595.28, 841.89];
  const COR = { azul: [7, 24, 43], azul2: [13, 68, 104], vermelho: [194, 35, 42], cinza: [244, 246, 248], texto: [29, 37, 45], suave: [91, 103, 116], branco: [255, 255, 255] };

  const rgb255 = (PDFLib, c) => PDFLib.rgb(c[0] / 255, c[1] / 255, c[2] / 255);
  const texto = v => String(v ?? '').trim() || 'Não informado';
  const moeda = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataBR = v => {
    if (!v) return 'Não informada';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? new Date(`${v}T12:00:00`) : new Date(v);
    return Number.isNaN(d.getTime()) ? texto(v) : d.toLocaleDateString('pt-BR');
  };

  function quebrar(text, font, size, largura) {
    const paragrafos = String(text ?? '').replace(/\r/g, '').split('\n');
    const linhas = [];
    paragrafos.forEach((paragrafo, pi) => {
      const palavras = paragrafo.trim().split(/\s+/).filter(Boolean);
      if (!palavras.length) { linhas.push(''); return; }
      let linha = '';
      palavras.forEach(palavra => {
        const teste = linha ? `${linha} ${palavra}` : palavra;
        if (font.widthOfTextAtSize(teste, size) <= largura) linha = teste;
        else { if (linha) linhas.push(linha); linha = palavra; }
      });
      if (linha) linhas.push(linha);
      if (pi < paragrafos.length - 1) linhas.push('');
    });
    return linhas;
  }

  async function gerarContratoPdf(dados, opcoes = {}) {
    if (!global.PDFLib) throw new Error('Biblioteca PDF não carregada.');
    const PDFLib = global.PDFLib;
    const rotuloCobranca = dados.contrato.periodicidade === 'Anual' ? 'Valor anual' : dados.contrato.periodicidade === 'Semestral' ? 'Valor semestral' : dados.contrato.periodicidade === 'Trimestral' ? 'Valor trimestral' : dados.contrato.periodicidade === 'Bimestral' ? 'Valor bimestral' : 'Mensalidade';
    const unidadesCobertas = (dados.contrato.contrato_unidades || []).map(x => x.cliente_unidades?.nome).filter(Boolean).join(', ');
    const doc = await PDFLib.PDFDocument.create();
    doc.setTitle(`${dados.modelo?.titulo || 'Contrato'} - ${dados.contrato.numero}`);
    doc.setAuthor(dados.empresa.nome_fantasia || dados.empresa.razao_social);
    doc.setSubject('Contrato formal gerado pelo CRM Help Soluções Tecnológicas');
    doc.setCreator('CRM Help Soluções Tecnológicas');
    const normal = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const italic = await doc.embedFont(PDFLib.StandardFonts.HelveticaOblique);
    let logo = null;
    if (opcoes.logoBytes) {
      try { logo = await doc.embedPng(opcoes.logoBytes); } catch (_) { logo = null; }
    }

    const margem = 48, largura = A4[0] - margem * 2;
    let page, y;
    const paginas = [];
    const novaPagina = (primeira = false) => {
      page = doc.addPage(A4); paginas.push(page); y = A4[1] - 48;
      if (logo) {
        const escala = Math.min(96 / logo.width, 42 / logo.height);
        page.drawImage(logo, { x: margem, y: A4[1] - 42 - 28, width: logo.width * escala, height: logo.height * escala });
      }
      page.drawText(texto(dados.empresa.nome_fantasia || dados.empresa.razao_social), { x: logo ? margem + 108 : margem, y: A4[1] - 46, size: 9, font: bold, color: rgb255(PDFLib, COR.azul) });
      page.drawText(`Contrato ${dados.contrato.numero}`, { x: A4[0] - margem - 110, y: A4[1] - 46, size: 8, font: normal, color: rgb255(PDFLib, COR.suave) });
      page.drawLine({ start: { x: margem, y: A4[1] - 76 }, end: { x: A4[0] - margem, y: A4[1] - 76 }, thickness: 1.2, color: rgb255(PDFLib, COR.azul2) });
      y = A4[1] - 94;
      if (!primeira) return;
      const titulo = dados.modelo?.titulo || 'CONTRATO DE LOCAÇÃO DE SOFTWARE';
      page.drawText(titulo, { x: (A4[0] - bold.widthOfTextAtSize(titulo, 15)) / 2, y, size: 15, font: bold, color: rgb255(PDFLib, COR.azul) });
      y -= 20;
      const sub = `${dados.contrato.tipo_contrato} - ${dados.contrato.numero}`;
      page.drawText(sub, { x: (A4[0] - normal.widthOfTextAtSize(sub, 8.5)) / 2, y, size: 8.5, font: normal, color: rgb255(PDFLib, COR.suave) });
      y -= 26;
    };
    const garantir = altura => { if (y - altura < 55) novaPagina(false); };
    const espaco = n => { y -= n; garantir(0); };
    const linhaTexto = (str, opts = {}) => {
      const font = opts.font || normal, size = opts.size || 9.2, indent = opts.indent || 0;
      const linhas = quebrar(str, font, size, largura - indent);
      const lh = opts.lineHeight || size * 1.45;
      linhas.forEach(l => { garantir(lh + 2); if (l) page.drawText(l, { x: margem + indent, y, size, font, color: rgb255(PDFLib, opts.color || COR.texto) }); y -= lh; });
      y -= opts.after ?? 5;
    };
    const secao = (numero, titulo) => {
      garantir(31); y -= 4;
      page.drawRectangle({ x: margem, y: y - 18, width: largura, height: 25, color: rgb255(PDFLib, COR.cinza), borderColor: rgb255(PDFLib, [220, 226, 232]), borderWidth: .5 });
      page.drawRectangle({ x: margem, y: y - 18, width: 5, height: 25, color: rgb255(PDFLib, COR.azul2) });
      page.drawText(`${numero}. ${titulo}`, { x: margem + 13, y: y - 10, size: 10.5, font: bold, color: rgb255(PDFLib, COR.azul) });
      y -= 31;
    };
    const campo = (rotulo, valor) => linhaTexto(`${rotulo}: ${texto(valor)}`, { size: 8.9, indent: 10, after: 1 });
    const destaque = itens => {
      const linhas = itens.map(i => ({ ...i, linhas: quebrar(`${i.rotulo}: ${i.valor}`, i.bold ? bold : normal, 9.2, largura - 28) }));
      const altura = 20 + linhas.reduce((s, i) => s + Math.max(1, i.linhas.length) * 13, 0);
      garantir(altura + 8);
      page.drawRectangle({ x: margem, y: y - altura + 5, width: largura, height: altura, color: rgb255(PDFLib, [252, 247, 238]), borderColor: rgb255(PDFLib, [225, 171, 72]), borderWidth: 1 });
      y -= 12;
      linhas.forEach(i => {
        i.linhas.forEach(l => { page.drawText(l, { x: margem + 14, y, size: 9.2, font: i.bold ? bold : normal, color: rgb255(PDFLib, i.cor || COR.texto) }); y -= 13; });
      });
      y -= 10;
    };
    const paragrafosModelo = chave => (Array.isArray(dados.modelo?.clausulas?.[chave]) ? dados.modelo.clausulas[chave] : []);

    novaPagina(true);
    linhaTexto('Pelo presente instrumento particular, as partes abaixo identificadas resolvem celebrar o presente contrato, que será regido pelas cláusulas e condições seguintes.', { size: 9.5, after: 10 });

    secao(1, 'IDENTIFICAÇÃO DA CONTRATANTE');
    campo('Razão social / nome', dados.parte.nome);
    campo('CNPJ / CPF', dados.parte.documento);
    campo('Endereço', dados.parte.endereco);
    campo('Cidade / UF / CEP', `${texto(dados.parte.cidade)} / ${texto(dados.parte.uf)} / ${texto(dados.parte.cep)}`);
    campo('Telefone', dados.parte.telefone || dados.parte.contato);
    campo('E-mail', dados.parte.email);
    campo('Representante', dados.parte.representante);
    campo('CPF do representante', dados.parte.representante_cpf);
    espaco(6);

    secao(2, 'IDENTIFICAÇÃO DA CONTRATADA');
    campo('Razão social', dados.empresa.razao_social);
    campo('Nome fantasia', dados.empresa.nome_fantasia);
    campo('CNPJ / Inscrição Estadual', `${texto(dados.empresa.cnpj)} / ${texto(dados.empresa.inscricao_estadual)}`);
    campo('Endereço', dados.empresa.endereco);
    campo('Cidade / UF / CEP', `${texto(dados.empresa.cidade)} / ${texto(dados.empresa.uf)} / ${texto(dados.empresa.cep)}`);
    campo('Telefone / E-mail', `${texto(dados.empresa.telefone)} / ${texto(dados.empresa.email)}`);
    campo('Representante legal', dados.empresa.representante_legal);
    campo('CPF do representante', dados.empresa.representante_cpf);
    espaco(6);

    secao(3, 'OBJETO DO CONTRATO');
    paragrafosModelo('objeto').forEach(p => linhaTexto(p));
    linhaTexto(`Objeto específico: ${texto(dados.contrato.objeto)}`, { font: bold });
    linhaTexto(`Sistemas contratados: ${texto(dados.contrato.sistemas_contratados)}`);
    linhaTexto(`Serviços, licenças, manutenção e suporte: ${texto(dados.contrato.servicos_contratados)}`);
    linhaTexto(`Unidades atendidas: ${texto(unidadesCobertas)}`, { font: bold });

    // Mantém o título e o quadro comercial juntos na mudança de página.
    garantir(185);
    secao(4, 'DOS VALORES DO ACORDO');
    destaque([
      { rotulo: 'Implantação', valor: moeda(dados.contrato.implantacao_valor), bold: true, cor: COR.vermelho },
      { rotulo: 'Equipamentos / kit de automação', valor: `${moeda(dados.contrato.equipamentos_valor)} - ${texto(dados.contrato.equipamentos_descricao)}`, bold: true },
      { rotulo: texto(dados.contrato.outros_valores_descricao || 'Outros valores iniciais'), valor: moeda(dados.contrato.outros_valores), bold: true },
      { rotulo: 'Valor inicial total', valor: moeda(dados.contrato.valor_inicial), bold: true, cor: COR.vermelho },
      { rotulo: rotuloCobranca, valor: moeda(dados.contrato.valor_mensal), bold: true, cor: COR.vermelho },
      { rotulo: 'Forma de pagamento', valor: texto(dados.contrato.forma_pagamento), bold: true },
      { rotulo: 'Instalação prevista', valor: dataBR(dados.contrato.data_instalacao), bold: true }
    ]);
    if (dados.contrato.observacoes_comerciais) linhaTexto(`Observações comerciais: ${dados.contrato.observacoes_comerciais}`, { font: italic });

    secao(5, 'VALOR, COBRANÇA E VIGÊNCIA FINANCEIRA');
    linhaTexto(`O ${rotuloCobranca.toLowerCase()} será de ${moeda(dados.contrato.valor_mensal)}, pelo período inicial de ${dados.contrato.duracao_meses} mês(es), em ${dados.contrato.quantidade_parcelas} parcela(s) com periodicidade ${texto(dados.contrato.periodicidade).toLowerCase()}. A primeira parcela vencerá em ${dataBR(dados.contrato.primeira_mensalidade)} e as demais observarão, quando aplicável, o dia ${dados.contrato.dia_vencimento}. O valor é único para todas as unidades atendidas descritas neste contrato.`, { font: bold });
    linhaTexto(`Formas válidas de pagamento: ${texto(dados.contrato.formas_validas_pagamento)}.`);
    paragrafosModelo('pagamentos').forEach((p, i) => linhaTexto(`5.${i + 1} ${p}`));
    linhaTexto(`Os valores poderão ser reajustados a cada 12 meses pelo índice ${texto(dados.contrato.indice_reajuste)} ou por outro índice oficial que o substitua. Variação negativa não implicará redução automática do valor vigente.`);

    secao(6, 'OBRIGAÇÕES DA CONTRATADA');
    paragrafosModelo('obrigacoes').forEach((p, i) => linhaTexto(`6.${i + 1} ${p}`));

    secao(7, 'DURAÇÃO, RENOVAÇÃO E RESCISÃO');
    const fim = (() => { const d = new Date(`${dados.contrato.inicio}T12:00:00`); d.setMonth(d.getMonth() + Number(dados.contrato.duracao_meses || 0)); return d.toLocaleDateString('pt-BR'); })();
    linhaTexto(`7.1 O contrato inicia em ${dataBR(dados.contrato.inicio)} e terá duração inicial de ${dados.contrato.duracao_meses} mês(es), com término previsto em ${fim}. ${dados.contrato.auto_renovacao ? 'Ao final, será renovado por prazo indeterminado, salvo manifestação em contrário.' : 'A renovação dependerá de nova manifestação das partes.'}`);
    linhaTexto(`7.2 A rescisão sem justa causa deverá ser comunicada com antecedência mínima de ${dados.contrato.aviso_previo_dias} dia(s). Durante o prazo determinado, poderá incidir multa rescisória de ${Number(dados.contrato.multa_rescisoria_percentual || 0).toLocaleString('pt-BR')}% sobre o saldo das parcelas vincendas.`);

    secao(8, 'INADIMPLÊNCIA');
    linhaTexto(`8.1 O atraso acarretará multa de ${Number(dados.contrato.multa_atraso_percentual || 0).toLocaleString('pt-BR')}% e juros moratórios de ${Number(dados.contrato.juros_dia_percentual || 0).toLocaleString('pt-BR')}% ao dia, calculados sobre o débito.`);
    linhaTexto(`8.2 Após ${dados.contrato.bloqueio_dias} dia(s) de inadimplência, a CONTRATADA poderá bloquear o acesso aos sistemas até a regularização integral, sem afastar a exigibilidade das parcelas.`);
    linhaTexto(`8.3 Decorridos ${dados.contrato.rescisao_inadimplencia_dias} dia(s) do vencimento sem pagamento ou negociação, a CONTRATADA poderá rescindir o contrato e adotar as medidas de cobrança permitidas em lei.`);
    linhaTexto(`8.4 Para reativação, deverão ser quitados os débitos e encargos, além da taxa de reativação de ${moeda(dados.contrato.taxa_reativacao)}, quando aplicável.`);

    secao(9, 'CONDIÇÕES GERAIS');
    paragrafosModelo('condicoes_gerais').forEach((p, i) => linhaTexto(`9.${i + 1} ${p}`));
    if (dados.contrato.observacoes) linhaTexto(`9.${paragrafosModelo('condicoes_gerais').length + 1} Condições adicionais: ${dados.contrato.observacoes}`);

    secao(10, 'PERDAS E DANOS');
    paragrafosModelo('perdas_danos').forEach((p, i) => linhaTexto(`10.${i + 1} ${p}`));

    secao(11, 'FORO');
    linhaTexto(`11.1 Fica eleito o Foro de ${texto(dados.empresa.foro_cidade)}, Estado de ${texto(dados.empresa.foro_uf)}, com exclusão de qualquer outro, por mais privilegiado que seja, para dirimir dúvidas ou controvérsias decorrentes deste contrato.`);
    linhaTexto(dados.modelo?.clausulas?.declaracao_final || 'As partes declaram concordância com todas as condições deste instrumento.', { after: 12 });

    secao(12, 'ASSINATURAS');
    linhaTexto(`${texto(dados.contrato.cidade_assinatura)}, ${dataBR(dados.contrato.data_assinatura)}.`, { font: bold, after: 14 });
    garantir(245);
    const assinatura = (x, yy, nome, cargo, docId = '') => {
      page.drawLine({ start: { x, y: yy }, end: { x: x + 210, y: yy }, thickness: .7, color: rgb255(PDFLib, COR.texto) });
      const n = texto(nome);
      page.drawText(n, { x: x + Math.max(0, (210 - bold.widthOfTextAtSize(n, 8.7)) / 2), y: yy - 14, size: 8.7, font: bold, color: rgb255(PDFLib, COR.texto) });
      page.drawText(cargo, { x: x + Math.max(0, (210 - normal.widthOfTextAtSize(cargo, 8)) / 2), y: yy - 27, size: 8, font: normal, color: rgb255(PDFLib, COR.suave) });
      if (docId) page.drawText(`CPF: ${docId}`, { x: x + Math.max(0, (210 - normal.widthOfTextAtSize(`CPF: ${docId}`, 7.5)) / 2), y: yy - 38, size: 7.5, font: normal, color: rgb255(PDFLib, COR.suave) });
    };
    assinatura(margem, y - 20, dados.parte.representante || dados.parte.nome, 'CONTRATANTE', dados.parte.representante_cpf);
    assinatura(A4[0] - margem - 210, y - 20, dados.empresa.representante_legal || dados.empresa.razao_social, 'CONTRATADA', dados.empresa.representante_cpf);
    assinatura(margem, y - 105, dados.contrato.representante_comercial, 'REPRESENTANTE COMERCIAL');
    if (dados.contrato.testemunha_1_nome || dados.contrato.testemunha_2_nome) {
      assinatura(margem, y - 190, dados.contrato.testemunha_1_nome, 'TESTEMUNHA 1', dados.contrato.testemunha_1_cpf);
      assinatura(A4[0] - margem - 210, y - 190, dados.contrato.testemunha_2_nome, 'TESTEMUNHA 2', dados.contrato.testemunha_2_cpf);
    }

    const total = paginas.length;
    paginas.forEach((p, i) => {
      p.drawLine({ start: { x: margem, y: 39 }, end: { x: A4[0] - margem, y: 39 }, thickness: .5, color: rgb255(PDFLib, [215, 222, 229]) });
      p.drawText(`${texto(dados.empresa.nome_fantasia)} - ${dados.contrato.numero}`, { x: margem, y: 24, size: 7, font: normal, color: rgb255(PDFLib, COR.suave) });
      const num = `${i + 1} / ${total}`;
      p.drawText(num, { x: A4[0] - margem - normal.widthOfTextAtSize(num, 7), y: 24, size: 7, font: normal, color: rgb255(PDFLib, COR.suave) });
    });

    return doc.save();
  }

  global.ContratosPDF = { gerarContratoPdf, moeda, dataBR };
})(globalThis);
