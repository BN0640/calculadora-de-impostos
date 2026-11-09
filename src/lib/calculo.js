// Motor de cálculo. Tudo roda no navegador; nenhum dado sai do dispositivo.
//
// Convenção: os valores de cada ano são calculados em reais de hoje (ANO_REFERENCIA)
// aplicando as regras vigentes. Os valores nominais são obtidos depois, deflacionando
// pelo IPCA acumulado até o ano em questão.

import {
  ANO_REFERENCIA,
  INSS_EMPREGADO,
  INSS_TETO,
  SALARIO_MINIMO,
  INSS_CONTRIBUINTE_INDIVIDUAL,
  IRPF,
  ENCARGOS_EMPREGADOR,
  SIMPLES_ANEXO_III,
  CONSUMO,
  GASOLINA,
  ICMS_UF,
  UF_PADRAO,
  IPCA,
} from './parametros.js';

export function inssEmpregado(salario) {
  let restante = Math.min(salario, INSS_TETO);
  let anterior = 0;
  let total = 0;
  for (const { ate, aliquota } of INSS_EMPREGADO.faixas) {
    if (restante <= anterior) break;
    total += (Math.min(restante, ate) - anterior) * aliquota;
    anterior = ate;
  }
  return total;
}

export function irpfMensal(rendimentoTributavel, deducoesLegais) {
  const base = Math.max(0, rendimentoTributavel - Math.max(deducoesLegais, IRPF.descontoSimplificado));
  const faixa = IRPF.faixas.find((f) => base <= f.ate);
  const imposto = Math.max(0, base * faixa.aliquota - faixa.deducao);

  const r = IRPF.reducao;
  let reducao = 0;
  if (rendimentoTributavel <= r.isencaoAte) reducao = Math.min(imposto, r.reducaoMaxima);
  else if (rendimentoTributavel <= r.faixaAte) reducao = Math.max(0, r.a - r.b * rendimentoTributavel);
  return Math.max(0, imposto - reducao);
}

function simplesAnual(receitaAnual) {
  const faixas = SIMPLES_ANEXO_III.faixas;
  const faixa = faixas.find((f) => receitaAnual <= f.ate) ?? faixas[faixas.length - 1];
  if (receitaAnual <= 0) return 0;
  const efetiva = (receitaAnual * faixa.aliquota - faixa.deducao) / receitaAnual;
  return receitaAnual * efetiva;
}

// Tributos diretos de um ano, para uma renda mensal em reais de hoje.
export function tributosDiretosAno(rendaMensal, tipo) {
  const zero = { bruto: 0, inss: 0, irpf: 0, simples: 0, encargos: 0 };
  for (const e of ENCARGOS_EMPREGADOR.itens) zero[e.id] = 0;
  if (rendaMensal <= 0) return zero;

  if (tipo === 'clt') {
    const m = rendaMensal;
    const inss = inssEmpregado(m);
    const ir = irpfMensal(m, inss);
    // Mês de férias recebe 1/3 adicional; o 13º é tributado separadamente.
    const ferias = m * (4 / 3);
    const inssFerias = inssEmpregado(ferias);
    const irFerias = irpfMensal(ferias, inssFerias);
    const bruto = m * 13 + m / 3;
    const encargos = Object.fromEntries(ENCARGOS_EMPREGADOR.itens.map((e) => [e.id, bruto * e.aliquota]));
    return {
      ...encargos,
      bruto,
      inss: inss * 12 + (inssFerias - inss) + inss,
      irpf: ir * 12 + (irFerias - ir) + ir,
      simples: 0,
      encargos: Object.values(encargos).reduce((s, v) => s + v, 0),
    };
  }

  if (tipo === 'pj') {
    const faturamento = rendaMensal;
    const proLabore = Math.min(faturamento, Math.max(SALARIO_MINIMO, faturamento * SIMPLES_ANEXO_III.proLaboreFatorR));
    const inss = Math.min(proLabore, INSS_TETO) * INSS_CONTRIBUINTE_INDIVIDUAL.aliquotaProLabore;
    const ir = irpfMensal(proLabore, inss);
    // A parte patronal do INSS (CPP) já está dentro da guia do Simples.
    return { ...zero, bruto: faturamento * 12, inss: inss * 12, irpf: ir * 12, simples: simplesAnual(faturamento * 12) };
  }

  if (tipo === 'autonomo') {
    const inss = Math.min(rendaMensal, INSS_TETO) * INSS_CONTRIBUINTE_INDIVIDUAL.aliquotaAutonomo;
    const ir = irpfMensal(rendaMensal, inss);
    return { ...zero, bruto: rendaMensal * 12, inss: inss * 12, irpf: ir * 12 };
  }

  return { ...zero, bruto: rendaMensal * 12 };
}

// Fator que leva reais do ano `ano` para reais de ANO_REFERENCIA.
export function fatorCorrecao(ano) {
  let fator = 1;
  for (let y = Math.max(ano, IPCA.primeiroAno) + 1; y <= ANO_REFERENCIA; y++) {
    fator *= 1 + (IPCA.anual[y] ?? 0) / 100;
  }
  return fator;
}

// Fator para um mês específico: o IPCA do próprio ano é distribuído ao longo dos
// meses, tomando o meio do ano como o nível médio de preços daquele ano.
export function fatorCorrecaoMes(ano, mes) {
  if (ano < IPCA.primeiroAno) return fatorCorrecao(IPCA.primeiroAno);
  const taxa = 1 + (IPCA.anual[ano] ?? 0) / 100;
  return fatorCorrecao(ano) * Math.pow(taxa, (6.5 - mes) / 12);
}

// "2024-03" -> { ano: 2024, mes: 3 }
export const lerMes = (s) => {
  const [ano, mes] = String(s).split('-').map(Number);
  return ano && mes ? { ano, mes } : null;
};

export const contarMeses = (inicio, fim) => {
  const a = lerMes(inicio);
  const b = lerMes(fim);
  if (!a || !b) return 0;
  return Math.max(0, (b.ano - a.ano) * 12 + (b.mes - a.mes) + 1);
};

// Renda líquida mensal típica (sem 13º/férias), para conferência com o contracheque.
export function liquidoMensal(rendaMensal, tipo) {
  if (rendaMensal <= 0) return 0;
  if (tipo === 'clt') {
    const inss = inssEmpregado(rendaMensal);
    return rendaMensal - inss - irpfMensal(rendaMensal, inss);
  }
  const t = tributosDiretosAno(rendaMensal, tipo);
  return (t.bruto - t.inss - t.irpf - t.simples) / 12;
}

// Inverso de liquidoMensal: o bruto que resulta no líquido informado (busca binária;
// o líquido cresce com o bruto, pois nenhuma alíquota marginal chega a 100%).
export function brutoDoLiquido(liquido, tipo) {
  if (liquido <= 0) return 0;
  let lo = liquido;
  let hi = liquido * 3;
  for (let i = 0; i < 60; i++) {
    const meio = (lo + hi) / 2;
    if (liquidoMensal(meio, tipo) < liquido) lo = meio; else hi = meio;
  }
  return hi;
}

// Detalhado: cada mês de cada período vira uma unidade com 1/12 dos tributos anuais
// daquela renda (assim o 13º e o 1/3 de férias da CLT entram proporcionalmente).
// Períodos sobrepostos são somados, como em dois empregos simultâneos.
// Gastos informados no período substituem a média de consumo naqueles meses.
function montarMeses(entrada) {
  const meses = [];
  for (const p of entrada.periodos) {
    const ini = lerMes(p.inicio);
    const n = contarMeses(p.inicio, p.fim);
    if (!ini || p.renda <= 0) continue;
    const temGastos = p.gastos && Object.values(p.gastos).some((v) => v > 0);
    const uf = p.uf || entrada.uf;
    for (let i = 0; i < n; i++) {
      const ano = ini.ano + Math.floor((ini.mes - 1 + i) / 12);
      const mes = ((ini.mes - 1 + i) % 12) + 1;
      const fator = fatorCorrecaoMes(ano, mes);
      const paraHoje = entrada.valoresEm === 'hoje' ? 1 : fator;
      const gastos = temGastos
        ? Object.fromEntries(Object.entries(p.gastos).map(([k, v]) => [k, (v || 0) * paraHoje]))
        : null;
      meses.push({ ano, mes, uf, rendaMensal: p.renda * paraHoje, tipo: p.tipo, fracao: 1 / 12, fator, gastos });
    }
  }
  return meses.sort((a, b) => a.ano - b.ano || a.mes - b.mes);
}

// Personalizado: cada emprego tem ano de entrada e de saída (ou "atual") e o salário
// no início e no fim; o salário de cada ano é interpolado geometricamente. Quando um
// emprego termina no mesmo ano em que outro começa, a troca é considerada no meio do ano.
// Devolve períodos no formato do Detalhado, um por ano de cada emprego.
export function empregosParaPeriodos(empregos, mesAtual) {
  const anoAtual = Number(mesAtual.slice(0, 4));
  const validos = empregos
    .map((e) => ({ ...e, de: Number(e.inicio), ate: e.atual || !e.fim ? anoAtual : Number(e.fim) }))
    .filter((e) => e.de >= 1950 && e.de <= anoAtual && e.ate >= e.de && e.rendaInicial > 0);

  const periodos = [];
  for (const e of validos) {
    const outros = validos.filter((o) => o !== e);
    let ini = chaveMes(e.de, 1);
    let fim = e.atual || !e.fim ? mesAtual : chaveMes(Math.min(e.ate, anoAtual), 12);
    if (!e.atual && e.fim && outros.some((o) => o.de === e.ate && o.de > e.de)) fim = chaveMes(e.ate, 6);
    if (outros.some((o) => !o.atual && o.fim && o.ate === e.de && o.de < e.de)) ini = chaveMes(e.de, 7);
    if (fim > mesAtual) fim = mesAtual;
    if (ini > fim) continue;

    const anoIni = Number(ini.slice(0, 4));
    const anoFim = Number(fim.slice(0, 4));
    const final = e.rendaFinal > 0 ? e.rendaFinal : e.rendaInicial;
    for (let y = anoIni; y <= anoFim; y++) {
      const k = anoFim > anoIni ? (y - anoIni) / (anoFim - anoIni) : 0;
      periodos.push({
        inicio: y === anoIni ? ini : chaveMes(y, 1),
        fim: y === anoFim ? fim : chaveMes(y, 12),
        renda: Math.round(e.rendaInicial * Math.pow(final / e.rendaInicial, k)),
        tipo: e.tipo,
        uf: e.uf,
        gastos: {},
        emprego: e.id,
      });
    }
  }
  return periodos;
}

// Monta a lista de anos trabalhados com a renda mensal (reais de hoje) e o tipo.
function montarAnos(entrada) {
  const { idade, idadeInicio, nivel } = entrada;
  const anos = [];

  if (nivel === 'detalhado') return montarMeses(entrada);
  if (nivel === 'personalizado') {
    return montarMeses({ ...entrada, periodos: empregosParaPeriodos(entrada.empregos ?? [], entrada.mesAtual) });
  }

  const n = Math.max(0, idade - idadeInicio);
  let g = entrada.crescimentoReal / 100;
  if (entrada.rendaInicial > 0 && n > 1) {
    g = Math.pow(entrada.rendaAtual / entrada.rendaInicial, 1 / (n - 1)) - 1;
  }
  const semTrabalho = Math.min(entrada.anosSemTrabalho || 0, n);
  const fracao = n > 0 ? (n - semTrabalho) / n : 0;

  for (let k = 0; k < n; k++) {
    anos.push({
      idade: idade - 1 - k,
      ano: ANO_REFERENCIA - k,
      rendaMensal: entrada.rendaAtual / Math.pow(1 + g, k),
      tipo: entrada.tipo,
      fracao,
    });
  }
  return anos.reverse();
}

// ---- Tributos no consumo ----------------------------------------------------

// Chave "AAAA-MM" usada para consultar tabelas com vigência mensal.
export const chaveMes = (ano, mes) => `${ano}-${String(mes).padStart(2, '0')}`;

// Valor vigente numa lista [['AAAA-MM', valor], ...] ordenada por data.
const vigente = (historico, chave) => {
  let v = historico[0][1];
  for (const [desde, x] of historico) if (desde <= chave) v = x;
  return v;
};

const dadosUF = (uf) => ICMS_UF.ufs[uf] ?? ICMS_UF.ufs[UF_PADRAO];

export const aliquotaModalICMS = (uf, chave) => vigente(dadosUF(uf).historico, chave) / 100;

// Fração do preço final que é tributo, por esfera, numa subcategoria de consumo.
export function taxasSubcategoria(sub, uf, chave) {
  let estadual = 0;
  const icms = sub.icms;
  // Antes do teto da LC 194/2022, energia, telecom e gasolina tinham alíquotas próprias.
  const antesDoTeto = chave < ICMS_UF.tetoLC194;
  if (icms?.tipo === 'modal') {
    estadual = antesDoTeto && icms.especial
      ? dadosUF(uf)[icms.especial] / 100
      : aliquotaModalICMS(uf, chave) * icms.fator;
  } else if (icms?.tipo === 'fixo') estadual = icms.valor;
  else if (icms?.tipo === 'gasolina') {
    if (chave >= GASOLINA.adRem[0][0]) {
      const anos = Object.keys(GASOLINA.precoMedio).map(Number);
      const ano = Math.min(Math.max(Number(chave.slice(0, 4)), Math.min(...anos)), Math.max(...anos));
      estadual = vigente(GASOLINA.adRem, chave) / GASOLINA.precoMedio[ano];
    } else if (antesDoTeto) {
      estadual = vigente(dadosUF(uf).gasolina, chave) / 100;
    } else {
      estadual = aliquotaModalICMS(uf, chave);
    }
  }
  return { federal: sub.federal, estadual, municipal: sub.iss };
}

// Tributos de um conjunto de gastos mensais. Aceita o total da categoria
// ({ moradia: 2000 }) ou subcategorias ({ 'moradia.energia': 300 }); quando há
// subcategorias preenchidas, elas substituem o total da categoria.
export function tributosConsumo(gastos, uf, chave) {
  const r = { gasto: 0, federal: 0, estadual: 0, municipal: 0 };
  for (const c of CONSUMO.categorias) {
    const subs = c.sub.map((s) => gastos[`${c.id}.${s.id}`] || 0);
    const usarSubs = subs.some((v) => v > 0);
    c.sub.forEach((s, k) => {
      const v = usarSubs ? subs[k] : (gastos[c.id] || 0) * s.peso;
      if (!v) return;
      const t = taxasSubcategoria(s, uf, chave);
      r.gasto += v;
      r.federal += v * t.federal;
      r.estadual += v * t.estadual;
      r.municipal += v * t.municipal;
    });
  }
  return r;
}

// Alíquota total de uma categoria (com a divisão padrão ou as subcategorias informadas).
export function taxaCategoria(catId, uf, chave, gastos = {}) {
  const prefixo = catId + '.';
  const proprios = Object.fromEntries(Object.entries(gastos).filter(([k, v]) => k.startsWith(prefixo) && v > 0));
  const t = tributosConsumo(Object.keys(proprios).length ? proprios : { [catId]: 100 }, uf, chave);
  return t.gasto > 0 ? (t.federal + t.estadual + t.municipal) / t.gasto : 0;
}

// Fração da renda líquida gasta no dia a dia e divisão entre categorias (em %).
// Categorias não informadas entram com o peso médio; uma divisão que não soma 100% é
// ajustada proporcionalmente.
function perfilConsumo(entrada) {
  const cats = CONSUMO.categorias;
  // null = não informado (usa a média); 0 é um valor válido (nada gasto).
  const informada = entrada.fracaoGasta !== null && entrada.fracaoGasta !== undefined && entrada.fracaoGasta >= 0;
  const fracao = informada ? entrada.fracaoGasta : CONSUMO.fracaoConsumoPadrao;
  const d = entrada.divisaoGastos ?? {};
  const algumaInformada = cats.some((c) => d[c.id] != null);
  const divisao = cats.map((c) => (d[c.id] != null ? Number(d[c.id]) || 0 : c.pesoPadrao * 100));
  const soma = divisao.reduce((s, v) => s + v, 0);
  const pesos = algumaInformada && soma > 0
    ? Object.fromEntries(cats.map((c, i) => [c.id, divisao[i] / soma]))
    : Object.fromEntries(cats.map((c) => [c.id, c.pesoPadrao]));
  return {
    pesos, fracao,
    personalizado: algumaInformada || (informada && Math.abs(fracao - CONSUMO.fracaoConsumoPadrao) > 1e-9),
    somaDivisao: algumaInformada ? soma : 0,
  };
}

const ITENS_ENCARGOS = ENCARGOS_EMPREGADOR.itens.map((e) => e.id);
const DIRETOS = ['bruto', 'inss', 'irpf', 'simples', 'encargos', ...ITENS_ENCARGOS];
const CONSUMO_CAMPOS = ['consumo', 'consumoFederal', 'consumoEstadual', 'consumoMunicipal', 'gastoConsumo'];
const CAMPOS = [...DIRETOS, ...CONSUMO_CAMPOS];
// Benefícios recebidos do governo (Bolsa Família, aposentadoria), que abatem do total.
const BENEFICIOS = ['bolsaFamilia', 'aposentadoria'];
const vazio = () => ({ ...Object.fromEntries([...CAMPOS, ...BENEFICIOS].map((c) => [c, 0])), beneficios: 0 });

export function calcular(entrada) {
  // Unidades: anos (níveis rápido/personalizado) ou meses (detalhado).
  const unidades = montarAnos(entrada).map((u) => {
    const t = tributosDiretosAno(u.rendaMensal, u.tipo);
    const r = {};
    for (const c of DIRETOS) r[c] = t[c] * u.fracao;
    return { ...u, ...r, fator: u.fator ?? fatorCorrecao(u.ano) };
  }).filter((u) => u.rendaMensal > 0);
  // Sem renda do trabalho, o cálculo ainda vale se houver benefícios recebidos.
  const temBeneficio = (entrada.beneficios ?? []).some((b) => b.valor > 0 && contarMeses(b.inicio, b.fim) > 0);
  if (unidades.length === 0 && !temBeneficio) return null;

  // Situação atual = soma das unidades do último ano/mês (cobre empregos simultâneos).
  const fim = unidades[unidades.length - 1];
  const atuais = fim ? unidades.filter((u) => u.ano === fim.ano && u.mes === fim.mes) : [];
  const rendaMensalAtual = atuais.reduce((s, u) => s + u.rendaMensal, 0);
  const liquidoAtual = atuais.reduce((s, u) => s + liquidoMensal(u.rendaMensal, u.tipo), 0);
  const consumo = perfilConsumo(entrada);

  const real = vazio();
  const nominal = vazio();
  const porAno = new Map();
  const mesesDistintos = new Set();
  let mesesTrabalhados = 0;
  let gastosInformados = 0;
  let tributosGastosInformados = 0;
  let gastosAcimaDoLiquido = false;

  const linhaDoAno = (ano, idade) => {
    if (!porAno.has(ano)) {
      porAno.set(ano, { ano, idade, meses: 0, mesesSet: new Set(), somaRenda: 0, somaRendaNominal: 0, ...vazio(), nominal: vazio() });
    }
    return porAno.get(ano);
  };

  for (const u of unidades) {
    // Anos inteiros usam o meio do ano como referência para as alíquotas.
    const chave = chaveMes(u.ano, u.mes ?? 7);
    const uf = u.uf || entrada.uf || UF_PADRAO;
    let t;
    if (u.gastos) {
      t = tributosConsumo(u.gastos, uf, chave);
      gastosInformados += t.gasto;
      tributosGastosInformados += t.federal + t.estadual + t.municipal;
      if (t.gasto > liquidoMensal(u.rendaMensal, u.tipo) * 1.0001) gastosAcimaDoLiquido = true;
    } else {
      const gasto = (u.bruto - u.inss - u.irpf - u.simples) * consumo.fracao;
      t = tributosConsumo(Object.fromEntries(Object.entries(consumo.pesos).map(([k, w]) => [k, gasto * w])), uf, chave);
    }
    u.consumoFederal = t.federal;
    u.consumoEstadual = t.estadual;
    u.consumoMunicipal = t.municipal;
    u.gastoConsumo = t.gasto;
    u.consumo = t.federal + t.estadual + t.municipal;
    const linha = linhaDoAno(u.ano, u.idade);
    for (const c of CAMPOS) {
      real[c] += u[c];
      nominal[c] += u[c] / u.fator;
      linha[c] += u[c];
      linha.nominal[c] += u[c] / u.fator;
    }
    if (u.mes) {
      mesesDistintos.add(u.ano * 12 + u.mes);
      linha.mesesSet.add(u.mes);
      linha.meses = linha.mesesSet.size;
      linha.somaRenda += u.rendaMensal;
      linha.somaRendaNominal += u.rendaMensal / u.fator;
    } else {
      mesesTrabalhados += 12 * u.fracao;
      linha.meses = Math.round(12 * u.fracao);
      linha.somaRenda = u.rendaMensal * linha.meses;
      linha.somaRendaNominal = (u.rendaMensal / u.fator) * linha.meses;
    }
  }

  // Benefícios (Bolsa Família e aposentadoria do INSS): o valor recebido (em R$ da época)
  // entra com sinal negativo no total destinado ao governo. A aposentadoria tem 13º (abono
  // anual) e paga IR na fonte, que soma aos tributos. A parte gasta do valor líquido paga
  // tributos no consumo, exceto nos meses com gastos informados em R$ (já incluem tudo).
  const unidadePorMes = new Map(unidades.filter((u) => u.mes).map((u) => [u.ano * 12 + u.mes, u]));
  let mesesBeneficio = 0;
  for (const b of entrada.beneficios ?? []) {
    const ini = lerMes(b.inicio);
    const n = contarMeses(b.inicio, b.fim);
    if (!ini || !(b.valor > 0)) continue;
    for (let i = 0; i < n; i++) {
      const ano = ini.ano + Math.floor((ini.mes - 1 + i) / 12);
      const mes = ((ini.mes - 1 + i) % 12) + 1;
      const fator = fatorCorrecaoMes(ano, mes);
      const u = unidadePorMes.get(ano * 12 + mes);
      const aposentadoria = b.tipo === 'aposentadoria';
      const mensal = b.valor * fator;
      const valor = aposentadoria ? (mensal * 13) / 12 : mensal;
      const ir = aposentadoria ? (irpfMensal(mensal, 0) * 13) / 12 : 0;
      const soma = { beneficios: valor, [aposentadoria ? 'aposentadoria' : 'bolsaFamilia']: valor, irpf: ir };
      if (!u?.gastos) {
        const gasto = (valor - ir) * consumo.fracao;
        const t = tributosConsumo(Object.fromEntries(Object.entries(consumo.pesos).map(([k, w]) => [k, gasto * w])),
          u?.uf || entrada.uf || UF_PADRAO, chaveMes(ano, mes));
        Object.assign(soma, {
          consumoFederal: t.federal, consumoEstadual: t.estadual, consumoMunicipal: t.municipal,
          gastoConsumo: t.gasto, consumo: t.federal + t.estadual + t.municipal,
        });
      }
      const linha = linhaDoAno(ano);
      for (const [c, v] of Object.entries(soma)) {
        real[c] += v;
        nominal[c] += v / fator;
        linha[c] += v;
        linha.nominal[c] += v / fator;
      }
      mesesBeneficio++;
    }
  }

  const linhas = [...porAno.values()].sort((a, b) => a.ano - b.ano).map(({ mesesSet, ...l }) => ({
    ...l,
    rendaMensal: l.meses ? l.somaRenda / l.meses : 0,
    rendaMensalNominal: l.meses ? l.somaRendaNominal / l.meses : 0,
  }));

  const resumir = (v) => {
    const diretos = v.inss + v.irpf + v.simples;
    // Encargos do empregador sempre entram: base = custo total do trabalho.
    // O Bolsa Família recebido abate do total (é dinheiro que volta do governo).
    const pago = diretos + v.consumo + v.encargos;
    const total = pago - v.beneficios;
    const base = v.bruto + v.encargos;
    return { ...v, diretos, trabalho: diretos + v.encargos, pago, total, base, conservado: base - total, percentual: base > 0 ? total / base : 0 };
  };

  if (gastosInformados > 0) {
    consumo.personalizado = true;
    consumo.porPeriodo = true;
    consumo.aliquotaPeriodos = tributosGastosInformados / gastosInformados;
    consumo.mesesComMedia = unidades.filter((u) => !u.gastos).length;
    consumo.acimaDoLiquido = gastosAcimaDoLiquido;
  }

  consumo.aliquota = real.gastoConsumo > 0 ? real.consumo / real.gastoConsumo : 0;
  consumo.ufs = [...new Set(unidades.map((u) => u.uf || entrada.uf || UF_PADRAO))];
  if (!consumo.ufs.length) consumo.ufs = [entrada.uf || UF_PADRAO];
  consumo.antesDe2015 = unidades.some((u) => u.ano < 2015);
  consumo.estimados = consumo.ufs.filter((uf) => dadosUF(uf).estimados?.length && unidades.some((u) => (u.uf || entrada.uf || UF_PADRAO) === uf && chaveMes(u.ano, u.mes ?? 7) < ICMS_UF.tetoLC194));

  const r = resumir(real);
  return {
    linhas,
    real: r,
    nominal: resumir(nominal),
    consumo,
    mesesTrabalhados: Math.round(mesesDistintos.size || mesesTrabalhados),
    mesesBeneficio,
    rendaMensalAtual,
    liquidoAtual,
    mesesEquivalentes: rendaMensalAtual > 0 ? r.total / rendaMensalAtual : 0,
    inicioAntesDoReal: linhas.length > 0 && linhas[0].ano < IPCA.primeiroAno,
    semTrabalho: unidades.length === 0,
  };
}
