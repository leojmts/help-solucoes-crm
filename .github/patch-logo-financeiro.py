from pathlib import Path

# index.html
p = Path('index.html')
s = p.read_text(encoding='utf-8')
s = s.replace('src="help-logo.png?v=20260826-2" alt="Logo da Help Soluções Tecnológicas"', 'src="help-logo-painel.svg?v=20260827-1" alt="Logo da Help Soluções Tecnológicas"', 1)
s = s.replace('dashboard-financeiro.js?v=20260826-2', 'dashboard-financeiro.js?v=20260827-3')
s = s.replace('financeiro-resumo-mensal.js?v=20260827-2', 'financeiro-resumo-mensal.js?v=20260827-3')
p.write_text(s, encoding='utf-8')

# dashboard-financeiro.js
p = Path('dashboard-financeiro.js')
s = p.read_text(encoding='utf-8')
marker = "  let cache = null;\n  let carregando = null;"
helper = """  const padFin = n => String(n).padStart(2,'0');
  const isoFin = d => `${d.getFullYear()}-${padFin(d.getMonth()+1)}-${padFin(d.getDate())}`;
  function mesFinanceiro(offset=0) {
    const a = new Date();
    return { inicio: isoFin(new Date(a.getFullYear(), a.getMonth()+offset, 1)), fim: isoFin(new Date(a.getFullYear(), a.getMonth()+offset+1, 0)) };
  }
  function faixaFinanceiro() {
    const p = localStorage.getItem('help-financeiro-periodo') || 'atual';
    if (p === 'todos') return { periodo:p, inicio:'', fim:'' };
    if (p === 'atual') return { periodo:p, ...mesFinanceiro(0) };
    if (p === 'proximo') return { periodo:p, ...mesFinanceiro(1) };
    if (p === 'anterior') return { periodo:p, ...mesFinanceiro(-1) };
    if (p === 'atualProximo') { const a=mesFinanceiro(0), b=mesFinanceiro(1); return { periodo:p, inicio:a.inicio, fim:b.fim }; }
    const a=mesFinanceiro(0);
    return { periodo:'personalizado', inicio:localStorage.getItem('help-financeiro-periodo-inicio') || a.inicio, fim:localStorage.getItem('help-financeiro-periodo-fim') || a.fim };
  }
  function dentroFinanceiro(valor, faixa) {
    if (faixa.periodo === 'todos') return true;
    const d = String(valor || '').slice(0,10);
    return !!d && (!faixa.inicio || d >= faixa.inicio) && (!faixa.fim || d <= faixa.fim);
  }

  let cache = null;
  let carregando = null;"""
if marker not in s:
    raise SystemExit('marker dashboard helper nao encontrado')
s = s.replace(marker, helper, 1)
s = s.replace("    if (cache && !forcar) return cache;\n    if (carregando && !forcar) return carregando;", "    cache = null; // sempre busca dados atuais ao redesenhar o Dashboard\n    if (carregando) return carregando;", 1)
s = s.replace("      const transferencias = transfRes.data || [];\n      const porId", "      const transferencias = transfRes.data || [];\n      const periodoFinanceiro = faixaFinanceiro();\n      const porId", 1)
old = """        if (l.tipo === 'Receber') aReceber += restante;
        if (l.tipo === 'Pagar') aPagar += restante;
        if (restante > 0) pendentes.push({ ...l, restante });"""
new = """        if (dentroFinanceiro(l.vencimento, periodoFinanceiro)) {
          if (l.tipo === 'Receber') aReceber += restante;
          if (l.tipo === 'Pagar') aPagar += restante;
          if (restante > 0) pendentes.push({ ...l, restante });
        }"""
if old not in s:
    raise SystemExit('bloco pendentes dashboard nao encontrado')
s = s.replace(old, new, 1)
s = s.replace("        if (!p.pago_em || !dataNoPeriodo(p.pago_em)) return;", "        if (!p.pago_em || !dentroFinanceiro(p.pago_em, periodoFinanceiro)) return;", 1)
s = s.replace("cache = { aReceber, aPagar, recebido, pago, saldoPeriodo, pendentes, saldosContas };", "cache = { aReceber, aPagar, recebido, pago, saldoPeriodo, pendentes, saldosContas, periodoFinanceiro };", 1)
s = s.replace("    preencherPins(false);", "    preencherPins(true);", 1)
p.write_text(s, encoding='utf-8')

# financeiro-resumo-mensal.js
p = Path('financeiro-resumo-mensal.js')
s = p.read_text(encoding='utf-8')
s = s.replace("window.renderizarTabelaFinanceiro?.();window.finRenderResumo?.()});", "window.renderizarTabelaFinanceiro?.();window.finRenderResumo?.();window.atualizarPinsFinanceiros?.()});")
p.write_text(s, encoding='utf-8')
