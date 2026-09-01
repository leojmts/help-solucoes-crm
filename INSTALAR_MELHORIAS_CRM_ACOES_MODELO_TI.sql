begin;

insert into public.contrato_modelos (nome, titulo, clausulas, ativo)
values (
  'Serviços de T.I. - padrão Help',
  'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TECNOLOGIA DA INFORMAÇÃO',
  jsonb_build_object(
    'tipo_contrato', 'Prestação de serviços de T.I.',
    'objeto_padrao', 'Prestação continuada de serviços de tecnologia da informação, suporte técnico, manutenção preventiva e corretiva e atendimento remoto ou presencial às unidades contratadas.',
    'sistemas_padrao', 'Não se aplica',
    'servicos_padrao', 'Suporte técnico remoto e presencial; manutenção preventiva e corretiva de computadores, periféricos e rede; diagnóstico de falhas; orientação aos usuários; instalação e configuração de softwares devidamente licenciados.',
    'objeto', jsonb_build_array(
      'A CONTRATADA prestará serviços continuados de tecnologia da informação conforme o escopo específico deste instrumento, podendo atender remotamente ou presencialmente as unidades contratadas.',
      'Atividades, peças, equipamentos, licenças, deslocamentos extraordinários e serviços não incluídos no escopo dependerão de aprovação e orçamento próprios.'
    ),
    'pagamentos', jsonb_build_array(
      'O pagamento será considerado realizado após a compensação em meio autorizado e em conta de titularidade da CONTRATADA.',
      'O valor contratado remunera exclusivamente o escopo descrito neste instrumento e suas unidades atendidas, sem cobrança automática adicional por filial.',
      'Serviços extraordinários previamente aprovados poderão ser cobrados separadamente.'
    ),
    'obrigacoes', jsonb_build_array(
      'Prestar os atendimentos com diligência técnica, registrar as intervenções e comunicar riscos ou necessidades identificadas.',
      'Preservar a confidencialidade das informações acessadas durante os atendimentos e limitar o acesso ao necessário para executar o serviço.',
      'Informar previamente quando a solução depender de peça, equipamento, licença, fornecedor externo ou serviço fora do escopo contratado.',
      'A CONTRATANTE deverá disponibilizar acesso, responsáveis locais e informações necessárias, além de manter cópias de segurança quando o serviço de backup não estiver expressamente contratado.'
    ),
    'condicoes_gerais', jsonb_build_array(
      'Os prazos de atendimento poderão variar conforme prioridade, disponibilidade de acesso, distância, peças, fornecedores e complexidade técnica.',
      'A CONTRATADA não responderá por falhas de energia, internet, equipamentos, softwares sem licença, serviços de terceiros, uso indevido ou descumprimento das orientações técnicas.',
      'Alterações de escopo, níveis de serviço ou unidades atendidas deverão ser formalizadas por escrito.'
    ),
    'perdas_danos', jsonb_build_array(
      'Cada parte responderá pelos danos diretos comprovadamente causados por descumprimento de suas obrigações, observadas as limitações legais e as condições deste contrato.',
      'A CONTRATADA não responderá por perda de dados quando o backup não fizer parte do escopo ou quando a CONTRATANTE deixar de executar as rotinas e orientações de segurança recomendadas.'
    ),
    'declaracao_final', 'As partes declaram ter lido e compreendido o escopo, as unidades atendidas e todas as condições deste instrumento e, por estarem de pleno acordo, assinam o presente contrato.'
  ),
  true
)
on conflict (nome) do update
set titulo = excluded.titulo,
    clausulas = excluded.clausulas,
    ativo = true,
    atualizado_em = now();

commit;
