# Protótipo de lógica — Funil de Vendas

Este diretório é um laboratório isolado do futuro site de Funil de Vendas.

## Estado atual

- Não usa Supabase.
- Não altera nenhuma tabela do CRM.
- Não acessa Financeiro, OS, Contratos ou Chamados.
- Não representa o layout final.
- Persistência demonstrativa opcional via localStorage.
- Branch: `preview/funil-logica-prototipo`.

## Motor implementado

- usuários e perfis: vendedor / gestor / admin;
- oportunidades;
- etapas: Lead → Contato → Qualificado → Proposta → Negociação → Ganho/Perdido;
- próxima ação obrigatória em oportunidade ativa;
- motivo obrigatório ao perder;
- histórico/auditoria;
- interações: WhatsApp, ligação, e-mail, reunião, visita e anotação;
- permissões de carteira;
- redistribuição somente por gestão/admin;
- reabertura de negócio encerrado somente por gestão/admin;
- pipeline, conversão, vendas, interações e desempenho por vendedor;
- metas;
- resumo isolado para futura leitura pelo CRM;
- handoff de venda ganha com detecção simples de cliente existente;
- verificação de integridade.

## Próxima fase

Depois de validar as regras:
1. criar persistência real em banco próprio do Funil;
2. autenticação e RLS;
3. API/visão de indicadores para o CRM;
4. interface web/mobile.
