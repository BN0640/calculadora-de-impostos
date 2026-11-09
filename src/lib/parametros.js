// Parâmetros da calculadora. Cada bloco indica fonte e vigência.
// Revise estes valores a cada mudança de legislação ou novo dado oficial.

export const ANO_REFERENCIA = 2026;

// INSS — empregado, doméstico e avulso (tabela progressiva).
export const INSS_EMPREGADO = {
  fonte: 'Portaria Interministerial MPS/MF nº 13/2026',
  vigencia: 'a partir de 01/2026',
  faixas: [
    { ate: 1621.0, aliquota: 0.075 },
    { ate: 2902.84, aliquota: 0.09 },
    { ate: 4354.27, aliquota: 0.12 },
    { ate: 8475.55, aliquota: 0.14 },
  ],
};
export const INSS_TETO = 8475.55;
export const SALARIO_MINIMO = 1621.0;

// INSS — contribuinte individual (plano normal, 20% até o teto) e pró-labore (11%).
export const INSS_CONTRIBUINTE_INDIVIDUAL = {
  fonte: 'Lei 8.212/1991, art. 21 e art. 30',
  vigencia: 'em vigor',
  aliquotaAutonomo: 0.2,
  aliquotaProLabore: 0.11,
};

// IRPF mensal — tabela progressiva + redução da Lei 15.270/2025.
export const IRPF = {
  fonte: 'Lei 15.191/2025 (tabela) e Lei 15.270/2025 (redução para rendas até R$ 7.350)',
  vigencia: 'a partir de 01/2026',
  faixas: [
    { ate: 2428.8, aliquota: 0, deducao: 0 },
    { ate: 2826.65, aliquota: 0.075, deducao: 182.16 },
    { ate: 3751.05, aliquota: 0.15, deducao: 394.16 },
    { ate: 4664.68, aliquota: 0.225, deducao: 675.49 },
    { ate: Infinity, aliquota: 0.275, deducao: 908.73 },
  ],
  descontoSimplificado: 607.2,
  reducao: { isencaoAte: 5000, reducaoMaxima: 312.89, faixaAte: 7350, a: 978.62, b: 0.133145 },
};

// Encargos patronais sobre a folha (CLT, empresa no regime geral).
export const ENCARGOS_EMPREGADOR = {
  fonte: 'Lei 8.212/1991, art. 22 (20% INSS patronal); RAT/SAT ~2%; terceiros (Sistema S, salário-educação, Incra) ~5,8%',
  vigencia: 'em vigor; empresas do Simples ou com desoneração recolhem menos',
  aliquota: 0.278,
  // Cada item vira um campo do cálculo (mesmo id) e uma linha no resultado.
  itens: [
    { id: 'inssPatronal', nome: 'INSS patronal (20%)', aliquota: 0.2 },
    { id: 'rat', nome: 'RAT/SAT — seguro de acidente de trabalho (~2%)', aliquota: 0.02 },
    { id: 'terceiros', nome: 'Terceiros — salário-educação, Sistema S, Incra (~5,8%)', aliquota: 0.058 },
  ],
};

// Simples Nacional — Anexo III (serviços com Fator R ≥ 28%).
export const SIMPLES_ANEXO_III = {
  fonte: 'Lei Complementar 123/2006, Anexo III (redação da LC 155/2016)',
  vigencia: 'desde 01/2018',
  faixas: [
    { ate: 180000, aliquota: 0.06, deducao: 0 },
    { ate: 360000, aliquota: 0.112, deducao: 9360 },
    { ate: 720000, aliquota: 0.135, deducao: 17640 },
    { ate: 1800000, aliquota: 0.16, deducao: 35640 },
    { ate: 3600000, aliquota: 0.21, deducao: 125640 },
    { ate: 4800000, aliquota: 0.33, deducao: 648000 },
  ],
  proLaboreFatorR: 0.28,
};

// ---------------------------------------------------------------------------
// Tributos embutidos no consumo, separados por esfera.
//
// Cada subcategoria tem:
//   federal  — PIS/Cofins, IPI e CIDE como fração do preço final (igual no país);
//   icms     — como o ICMS estadual incide:
//                { tipo: 'modal', fator }  alíquota modal da UF × fator (1 = cheia,
//                                          < 1 = base reduzida/cesta básica);
//                                          com `especial`, usa a alíquota própria
//                                          da UF antes do teto da LC 194/2022;
//                { tipo: 'gasolina' }      valor fixo por litro (ad rem) desde 06/2023;
//                { tipo: 'fixo', valor }   fração fixa nacional (ex.: GLP ad rem);
//                null                      sem ICMS;
//   iss      — ISS municipal sobre serviços, como fração do preço.
// Como o ICMS é calculado "por dentro", a alíquota já é a fração do preço final.
// ---------------------------------------------------------------------------
export const CONSUMO = {
  fonte: 'Alíquotas usuais de PIS/Cofins (Leis 10.637/2002 e 10.833/2003; alíquota zero da cesta básica, Lei 10.925/2004), IPI (TIPI), ISS (LC 116/2003) e ICMS de cada UF; divisão padrão inspirada na POF 2017–2018 (IBGE)',
  vigencia: 'parâmetros federais e de ISS aproximados para 2023–2026; ICMS por UF e mês conforme tabela própria',
  fracaoConsumoPadrao: 0.85,
  categorias: [
    {
      id: 'supermercado', nome: 'Supermercado e alimentação', pesoPadrao: 0.22,
      nota: 'Cesta básica tem PIS/Cofins zero e ICMS reduzido; industrializados pagam alíquota cheia.',
      sub: [
        { id: 'cesta', nome: 'Básicos (arroz, feijão, carnes, hortifrúti)', peso: 0.5, federal: 0, icms: { tipo: 'modal', fator: 0.4 }, iss: 0 },
        { id: 'industrializados', nome: 'Industrializados, limpeza e higiene', peso: 0.5, federal: 0.09, icms: { tipo: 'modal', fator: 1 }, iss: 0 },
      ],
    },
    {
      id: 'restaurantes', nome: 'Restaurantes e delivery', pesoPadrao: 0.09,
      nota: 'Muitos estados reduzem o ICMS de refeições; inclui tributos dos insumos.',
      sub: [
        { id: 'refeicoes', nome: 'Restaurantes, lanches e delivery', peso: 1, federal: 0.09, icms: { tipo: 'modal', fator: 0.6 }, iss: 0.01 },
      ],
    },
    {
      id: 'transporte', nome: 'Transporte e combustível', pesoPadrao: 0.2,
      nota: 'Gasolina tem ICMS fixo por litro, igual em todo o país desde 06/2023.',
      sub: [
        { id: 'combustivel', nome: 'Combustível', peso: 0.6, federal: 0.14, icms: { tipo: 'gasolina' }, iss: 0 },
        { id: 'publico', nome: 'Ônibus, metrô e trem', peso: 0.25, federal: 0.03, icms: null, iss: 0.02 },
        { id: 'app', nome: 'Aplicativos e táxi', peso: 0.15, federal: 0.1, icms: null, iss: 0.03 },
      ],
    },
    {
      id: 'moradia', nome: 'Moradia e contas', pesoPadrao: 0.35,
      nota: 'Aluguel quase não tem tributo sobre consumo; energia e telecom pagam ICMS cheio.',
      sub: [
        { id: 'aluguel', nome: 'Aluguel', peso: 0.45, federal: 0, icms: null, iss: 0 },
        { id: 'condominio', nome: 'Condomínio', peso: 0.1, federal: 0.03, icms: null, iss: 0 },
        { id: 'energia', nome: 'Energia elétrica', peso: 0.2, federal: 0.055, icms: { tipo: 'modal', fator: 1, especial: 'energia' }, iss: 0 },
        { id: 'agua', nome: 'Água e esgoto', peso: 0.08, federal: 0.07, icms: null, iss: 0 },
        { id: 'telecom', nome: 'Internet, TV e telefone', peso: 0.12, federal: 0.05, icms: { tipo: 'modal', fator: 1, especial: 'telecom' }, iss: 0 },
        { id: 'gas', nome: 'Gás de cozinha', peso: 0.05, federal: 0, icms: { tipo: 'fixo', valor: 0.14 }, iss: 0 },
      ],
    },
    {
      id: 'outros', nome: 'Outros gastos', pesoPadrao: 0.14,
      nota: 'Bens pagam ICMS e IPI; serviços pagam ISS.',
      sub: [
        { id: 'vestuario', nome: 'Roupas e calçados', peso: 0.25, federal: 0.09, icms: { tipo: 'modal', fator: 1 }, iss: 0 },
        { id: 'farmacia', nome: 'Farmácia e cuidados pessoais', peso: 0.25, federal: 0.04, icms: { tipo: 'modal', fator: 1 }, iss: 0 },
        { id: 'eletronicos', nome: 'Eletrônicos e eletrodomésticos', peso: 0.2, federal: 0.15, icms: { tipo: 'modal', fator: 1 }, iss: 0 },
        { id: 'servicos', nome: 'Lazer, cursos e serviços', peso: 0.3, federal: 0.04, icms: null, iss: 0.03 },
      ],
    },
  ],
};

// ICMS ad rem da gasolina (R$/litro, nacional) e preço médio de bomba estimado (ANP).
// Antes disso: alíquota própria da UF até 06/2022 e modal de 07/2022 a 05/2023.
export const GASOLINA = {
  fonte: 'Convênios ICMS 15/2023 e atualizações anuais do Confaz (ex.: 112/2025); preços médios aproximados da ANP',
  vigencia: 'ICMS fixo por litro desde 06/2023',
  adRem: [
    ['2023-06', 1.22],
    ['2024-02', 1.37],
    ['2025-02', 1.47],
    ['2026-01', 1.57],
  ],
  precoMedio: { 2023: 5.6, 2024: 6.0, 2025: 6.3, 2026: 6.3 },
};

// Alíquota modal (interna padrão) de ICMS por UF, com o mês de cada mudança,
// e as alíquotas especiais anteriores ao teto da LC 194/2022.
//
//   historico — alíquota modal; o primeiro valor vale também para meses anteriores.
//   energia   — energia elétrica residencial antes de 07/2022 (depois: modal).
//   telecom   — telecomunicações antes de 07/2022 (depois: modal).
//   gasolina  — gasolina antes de 07/2022 (de 07/2022 a 05/2023: modal; depois: ad rem).
// Valores marcados em `estimados` não foram confirmados em fonte por UF e usam a
// alíquota mais comum do país (25% para energia residencial).
export const ICMS_UF = {
  fonte: 'Modal: leis estaduais compiladas por IMendes (mudanças de 2016), Cescon Barrieu (2023) e Paggo (atualizada em 22/10/2026). Telecom antes da LC 194: Teleco. Gasolina: Contábeis (10/2021) e Estadão/Broadcast (06/2022). Energia: CNN Brasil (07/2022), LegisWeb (MG) e concessionárias; conferir na legislação de cada UF',
  vigencia: '2015 a 2026, com o teto da LC 194/2022 aplicado a partir de 07/2022; anos anteriores a 2015 usam os valores de 2015',
  tetoLC194: '2022-07',
  ufs: {
    AC: { nome: 'Acre', historico: [['2015-01', 17], ['2023-04', 19]], energia: 25, telecom: 25, gasolina: [['2015-01', 25]] },
    AL: { nome: 'Alagoas', historico: [['2015-01', 17], ['2023-04', 19], ['2026-04', 20.5]], energia: 25, telecom: 30, gasolina: [['2015-01', 29]], estimados: ['energia'] },
    AP: { nome: 'Amapá', historico: [['2015-01', 17], ['2016-01', 18]], energia: 25, telecom: 29, gasolina: [['2015-01', 25]], estimados: ['energia'] },
    AM: { nome: 'Amazonas', historico: [['2015-01', 17], ['2016-01', 18], ['2023-01', 20]], energia: 25, telecom: 30, gasolina: [['2015-01', 25]], estimados: ['energia'] },
    BA: { nome: 'Bahia', historico: [['2015-01', 17], ['2016-03', 18], ['2023-03', 19], ['2024-02', 20.5]], energia: 25, telecom: 28, gasolina: [['2015-01', 28]], estimados: ['energia'] },
    CE: { nome: 'Ceará', historico: [['2015-01', 18], ['2024-01', 20]], energia: 25, telecom: 30, gasolina: [['2015-01', 29]], estimados: ['energia', 'modal antes de 2024'] },
    DF: { nome: 'Distrito Federal', historico: [['2015-01', 17], ['2016-01', 18], ['2024-01', 20]], energia: 25, telecom: 28, gasolina: [['2015-01', 28], ['2022-01', 27]] },
    ES: { nome: 'Espírito Santo', historico: [['2015-01', 17]], energia: 25, telecom: 25, gasolina: [['2015-01', 27]], estimados: ['energia'] },
    GO: { nome: 'Goiás', historico: [['2015-01', 17], ['2024-04', 19]], energia: 29, telecom: 29, gasolina: [['2015-01', 30]] },
    MA: { nome: 'Maranhão', historico: [['2015-01', 17], ['2016-01', 18], ['2023-04', 20], ['2024-02', 22], ['2025-02', 23]], energia: 25, telecom: 29, gasolina: [['2015-01', 31], ['2022-01', 30.5]], estimados: ['energia'] },
    MT: { nome: 'Mato Grosso', historico: [['2015-01', 17]], energia: 17, telecom: 19, gasolina: [['2015-01', 25], ['2022-01', 23]] },
    MS: { nome: 'Mato Grosso do Sul', historico: [['2015-01', 17]], energia: 25, telecom: 29, gasolina: [['2015-01', 30]] },
    MG: { nome: 'Minas Gerais', historico: [['2015-01', 18]], energia: 30, telecom: 27, gasolina: [['2015-01', 31]] },
    PA: { nome: 'Pará', historico: [['2015-01', 17], ['2023-03', 19]], energia: 25, telecom: 30, gasolina: [['2015-01', 28]] },
    PB: { nome: 'Paraíba', historico: [['2015-01', 17], ['2016-01', 18], ['2024-01', 20]], energia: 25, telecom: 30, gasolina: [['2015-01', 29]], estimados: ['energia'] },
    PR: { nome: 'Paraná', historico: [['2015-01', 18], ['2023-04', 19], ['2024-03', 19.5]], energia: 29, telecom: 29, gasolina: [['2015-01', 29]] },
    PE: { nome: 'Pernambuco', historico: [['2015-01', 17], ['2016-01', 18], ['2024-01', 20.5]], energia: 25, telecom: 30, gasolina: [['2015-01', 29]], estimados: ['energia'] },
    PI: { nome: 'Piauí', historico: [['2015-01', 18], ['2023-01', 21], ['2025-04', 22.5]], energia: 25, telecom: 30, gasolina: [['2015-01', 31]], estimados: ['energia', 'modal antes de 2023'] },
    RJ: { nome: 'Rio de Janeiro', historico: [['2015-01', 19], ['2016-01', 20], ['2024-03', 22]], energia: 32, telecom: 32, gasolina: [['2015-01', 34]], nota: 'inclui o adicional do FECP (1 p.p. até 2015, 2 p.p. depois)' },
    RN: { nome: 'Rio Grande do Norte', historico: [['2015-01', 17], ['2016-01', 18], ['2023-04', 20], ['2024-01', 18], ['2025-03', 20]], energia: 25, telecom: 30, gasolina: [['2015-01', 29]], estimados: ['energia'] },
    RS: { nome: 'Rio Grande do Sul', historico: [['2015-01', 17], ['2016-01', 18], ['2021-01', 17.5], ['2022-01', 17]], energia: 25, telecom: 25, gasolina: [['2015-01', 30], ['2022-01', 25]], estimados: ['energia'] },
    RO: { nome: 'Rondônia', historico: [['2015-01', 17.5], ['2024-01', 19.5]], energia: 25, telecom: 37, gasolina: [['2015-01', 26]], estimados: ['energia'] },
    RR: { nome: 'Roraima', historico: [['2015-01', 17], ['2023-04', 20]], energia: 25, telecom: 25, gasolina: [['2015-01', 25]], estimados: ['energia'] },
    SC: { nome: 'Santa Catarina', historico: [['2015-01', 17]], energia: 25, telecom: 25, gasolina: [['2015-01', 25]], estimados: ['energia'] },
    SP: { nome: 'São Paulo', historico: [['2015-01', 18]], energia: 25, telecom: 25, gasolina: [['2015-01', 25]], nota: 'energia: 25% acima de 200 kWh/mês (18% até 200 kWh)' },
    SE: { nome: 'Sergipe', historico: [['2015-01', 17], ['2016-01', 18], ['2023-04', 19]], energia: 25, telecom: 30, gasolina: [['2015-01', 29]], estimados: ['energia'] },
    TO: { nome: 'Tocantins', historico: [['2015-01', 17], ['2016-01', 18], ['2024-01', 20]], energia: 25, telecom: 29, gasolina: [['2015-01', 29]], estimados: ['energia'] },
  },
};
export const UF_PADRAO = 'SP';

// IPCA anual (% a.a.). Anos antes de 1995 são expressos no nível de preços de 1995,
// pois valores nominais anteriores ao Plano Real não são comparáveis em reais.
export const IPCA = {
  fonte: 'IBGE — IPCA, variação acumulada no ano; 2026 é projeção',
  vigencia: 'série 1995–2025; 2026 estimado',
  anual: {
    1995: 22.41, 1996: 9.56, 1997: 5.22, 1998: 1.65, 1999: 8.94, 2000: 5.97,
    2001: 7.67, 2002: 12.53, 2003: 9.3, 2004: 7.6, 2005: 5.69, 2006: 3.14,
    2007: 4.46, 2008: 5.9, 2009: 4.31, 2010: 5.91, 2011: 6.5, 2012: 5.84,
    2013: 5.91, 2014: 6.41, 2015: 10.67, 2016: 6.29, 2017: 2.95, 2018: 3.75,
    2019: 4.31, 2020: 4.52, 2021: 10.06, 2022: 5.79, 2023: 4.62, 2024: 4.83,
    2025: 4.26, 2026: 4.0,
  },
  primeiroAno: 1995,
};

export const TIPOS_TRABALHO = [
  { id: 'clt', nome: 'CLT (empregado)', curto: 'CLT', rotuloRenda: 'Salário BRUTO mensal',
    ajudaRenda: 'O valor do contrato/carteira, antes dos descontos de INSS e IR. Não inclua 13º e férias: são somados automaticamente.' },
  { id: 'pj', nome: 'PJ (Simples Nacional)', curto: 'PJ', rotuloRenda: 'Faturamento BRUTO mensal',
    ajudaRenda: 'Total das notas fiscais emitidas no mês, antes do Simples, INSS e IR.' },
  { id: 'autonomo', nome: 'Autônomo (pessoa física)', curto: 'Autônomo', rotuloRenda: 'Rendimento BRUTO mensal',
    ajudaRenda: 'O que você recebe dos clientes, antes de INSS e IR (carnê-leão).' },
  { id: 'outro', nome: 'Outro / informal', curto: 'Informal', rotuloRenda: 'Renda mensal',
    ajudaRenda: 'Sem tributos descontados da renda; aqui bruto e líquido são iguais.' },
];
