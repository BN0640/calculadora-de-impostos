// Exportação e importação dos dados preenchidos, como arquivo JSON local.
// Nada é enviado a servidores: o arquivo é gerado e lido no próprio navegador.
import * as P from '../../lib/parametros.js';

const FORMATO = 'calculadora-custo-impostos';
const VERSAO = 2;
const ANO = /^\d{4}$/;
const NIVEIS = ['rapido', 'personalizado', 'detalhado'];
const TIPOS = P.TIPOS_TRABALHO.map((t) => t.id);
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

const texto = (v) => (v === undefined || v === null ? '' : String(v));
const mapaTextos = (o) =>
  Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).map(([k, v]) => [k, texto(v)]));

export function baixarDados(estado) {
  const dados = {
    formato: FORMATO,
    versao: VERSAO,
    salvoEm: new Date().toISOString(),
    ...estado,
    // O id de períodos e empregos é interno da tela e é recriado ao importar.
    periodos: estado.periodos.map(({ id, ...p }) => p),
    empregos: estado.empregos.map(({ id, ...e }) => e),
    beneficios: (estado.beneficios ?? []).map(({ id, ...b }) => b),
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `calculadora-impostos-${dados.salvoEm.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Lê o conteúdo de um arquivo salvo e devolve o estado normalizado,
// ou lança um Error com mensagem para o usuário.
export function lerDados(conteudo) {
  let d;
  try {
    d = JSON.parse(conteudo);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  if (!d || d.formato !== FORMATO) throw new Error('Este arquivo não foi salvo por esta calculadora.');
  if (d.versao > VERSAO) throw new Error('O arquivo foi salvo por uma versão mais nova da calculadora.');

  const periodos = Array.isArray(d.periodos) ? d.periodos : [];
  const empregos = Array.isArray(d.empregos) ? d.empregos : [];
  const periodosValidos = periodos.filter((p) => p && MES.test(p.inicio) && MES.test(p.fim));
  const empregosValidos = empregos.filter((e) => e && ANO.test(String(e.inicio)));
  const beneficios = Array.isArray(d.beneficios) ? d.beneficios : [];
  const beneficiosValidos = beneficios.filter((b) => b && MES.test(b.inicio) && MES.test(b.fim));
  const usar = d.usarBeneficio && typeof d.usarBeneficio === 'object' ? d.usarBeneficio : {};

  // Versão 1: o antigo Personalizado (crescimento, renda inicial, anos parados) virou o
  // Rápido com campos opcionais, e os gastos em R$ por categoria viram a divisão em %.
  const v1 = !d.versao || d.versao < 2;
  const gastosV1 = v1 && d.usarGastos ? mapaTextos(d.gastos) : null;
  const somaV1 = gastosV1 ? Object.values(gastosV1).reduce((s, v) => s + (parseFloat(v) || 0), 0) : 0;
  const divisaoV1 = somaV1 > 0
    ? Object.fromEntries(Object.entries(gastosV1).map(([k, v]) => [k, String(Math.round(((parseFloat(v) || 0) / somaV1) * 100))]))
    : null;

  return {
    nivel: v1 && d.nivel === 'personalizado' ? 'rapido' : NIVEIS.includes(d.nivel) ? d.nivel : 'rapido',
    idade: texto(d.idade),
    idadeInicio: texto(d.idadeInicio),
    renda: texto(d.renda),
    rendaEm: d.rendaEm === 'liquido' ? 'liquido' : 'bruto',
    tipo: TIPOS.includes(d.tipo) ? d.tipo : 'clt',
    crescimento: v1 && texto(d.crescimento) === '2' ? '' : texto(d.crescimento),
    rendaInicial: texto(d.rendaInicial),
    anosSemTrabalho: v1 && texto(d.anosSemTrabalho) === '0' ? '' : texto(d.anosSemTrabalho),
    uf: P.ICMS_UF.ufs[d.uf] ? d.uf : P.UF_PADRAO,
    fracaoGasta: texto(d.fracaoGasta),
    usarDivisao: v1 ? !!divisaoV1 : !!d.usarDivisao,
    divisao: v1 ? divisaoV1 ?? {} : mapaTextos(d.divisao),
    valoresEm: d.valoresEm === 'hoje' ? 'hoje' : 'epoca',
    empregos: empregosValidos.map((e) => ({
      nome: texto(e.nome),
      inicio: String(e.inicio),
      fim: ANO.test(String(e.fim)) ? String(e.fim) : '',
      atual: !!e.atual,
      tipo: TIPOS.includes(e.tipo) ? e.tipo : 'clt',
      uf: P.ICMS_UF.ufs[e.uf] ? e.uf : P.UF_PADRAO,
      rendaInicial: texto(e.rendaInicial),
      rendaFinal: texto(e.rendaFinal),
    })),
    periodos: periodosValidos
      .map((p) => ({
        inicio: p.inicio,
        fim: p.fim,
        renda: texto(p.renda),
        tipo: TIPOS.includes(p.tipo) ? p.tipo : 'clt',
        uf: P.ICMS_UF.ufs[p.uf] ? p.uf : P.UF_PADRAO,
        gastos: mapaTextos(p.gastos),
      })),
    usarBeneficio: { bolsa: !!usar.bolsa, aposentadoria: !!usar.aposentadoria },
    beneficios: beneficiosValidos.map((b) => ({
      tipo: b.tipo === 'aposentadoria' ? 'aposentadoria' : 'bolsa', inicio: b.inicio, fim: b.fim, valor: texto(b.valor),
    })),
    ignorados: periodos.length - periodosValidos.length + empregos.length - empregosValidos.length
      + beneficios.length - beneficiosValidos.length,
  };
}
