import { Fragment, useMemo, useRef, useState } from 'react';
import { calcular, contarMeses, liquidoMensal, brutoDoLiquido } from '../../lib/calculo.js';
import * as P from '../../lib/parametros.js';
import { brl, pct, num, tipoInfo, MES_ATUAL, duracao, mascarar, Campo, Numero, SelectTipo, SelectUF } from './ui.jsx';
import EditorPeriodos, { novoPeriodo } from './EditorPeriodos.jsx';
import EditorEmpregos, { novoEmprego, empregosNumericos, errosEmpregos } from './EditorEmpregos.jsx';
import PerfilGastos from './PerfilGastos.jsx';
import Beneficios, { novoBeneficio, beneficiosNumericos } from './Beneficios.jsx';
import { baixarDados, lerDados } from './dadosSalvos.js';
import './CalculadoraImpostos.css';

function exportarCSV(resultado) {
  const cab = ['Ano', 'Meses trabalhados', 'Renda bruta mensal média (R$ hoje)', 'Remuneração bruta (R$ hoje)', 'INSS', 'IRPF', 'Simples',
    ...P.ENCARGOS_EMPREGADOR.itens.map((e) => e.nome), 'Tributos consumo', 'Consumo: federal', 'Consumo: estadual (ICMS)',
    'Consumo: municipal (ISS)', 'Bolsa Família recebido', 'Aposentadoria recebida', 'Remuneração bruta (R$ da época)',
    'Tributos diretos (R$ da época)', 'Benefícios recebidos (R$ da época)'];
  const linhas = resultado.linhas.map((l) =>
    [l.ano, l.meses, l.rendaMensal, l.bruto, l.inss, l.irpf, l.simples, ...P.ENCARGOS_EMPREGADOR.itens.map((e) => l[e.id]), l.consumo,
      l.consumoFederal, l.consumoEstadual, l.consumoMunicipal, -l.bolsaFamilia, -l.aposentadoria,
      l.nominal.bruto, l.nominal.inss + l.nominal.irpf + l.nominal.simples, -l.nominal.beneficios]
      .map((v) => (typeof v === 'number' ? v.toFixed(2).replace('.', ',') : v))
      .join(';')
  );
  const blob = new Blob(['﻿' + [cab.join(';'), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'estimativa-impostos.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const NIVEIS = [
  { id: 'rapido', nome: 'Rápido', desc: 'Idade e renda atual; ajustes opcionais para refinar.' },
  { id: 'personalizado', nome: 'Personalizado', desc: 'Cada emprego com ano de entrada, saída e salário aproximado.' },
  { id: 'detalhado', nome: 'Detalhado', desc: 'Mês a mês, com estado e gastos por período.' },
];

const exemploPeriodos = () => [
  novoPeriodo({ inicio: '2015-02', fim: '2019-12', renda: '2500' }),
  novoPeriodo({ inicio: '2020-01', fim: MES_ATUAL, renda: '5000' }),
];
const exemploEmpregos = () => [
  novoEmprego({ nome: 'Primeiro emprego', inicio: '2012', fim: '2016', rendaInicial: '1500', rendaFinal: '2500' }),
  novoEmprego({ nome: 'Emprego atual', inicio: '2016', atual: true, rendaInicial: '3000', rendaFinal: '5000' }),
];

// Valores com que a calculadora abre (e que "Restaurar padrão" devolve).
const PADRAO = {
  idade: '35', idadeInicio: '18', renda: '5.000', rendaEm: 'bruto', tipo: 'clt', crescimento: '2', rendaInicial: '', anosSemTrabalho: '0',
  uf: P.UF_PADRAO, fracaoGasta: String(Math.round(P.CONSUMO.fracaoConsumoPadrao * 100)), valoresEm: 'epoca',
};

export default function CalculadoraImpostos() {
  const [nivel, setNivel] = useState('rapido');
  const [idade, setIdade] = useState(PADRAO.idade);
  const [idadeInicio, setIdadeInicio] = useState(PADRAO.idadeInicio);
  const [renda, setRenda] = useState(PADRAO.renda);
  const [rendaEm, setRendaEm] = useState(PADRAO.rendaEm);
  const [tipo, setTipo] = useState(PADRAO.tipo);
  const [crescimento, setCrescimento] = useState(PADRAO.crescimento);
  const [rendaInicial, setRendaInicial] = useState(PADRAO.rendaInicial);
  const [anosSemTrabalho, setAnosSemTrabalho] = useState(PADRAO.anosSemTrabalho);
  const [uf, setUf] = useState(PADRAO.uf);
  const [fracaoGasta, setFracaoGasta] = useState(PADRAO.fracaoGasta);
  const [usarDivisao, setUsarDivisao] = useState(false);
  const [divisao, setDivisao] = useState({});
  const [valoresEm, setValoresEm] = useState(PADRAO.valoresEm);
  const [usarBeneficio, setUsarBeneficio] = useState({});
  const [beneficios, setBeneficios] = useState([]);
  const [periodos, setPeriodosBase] = useState(exemploPeriodos);
  const [empregos, setEmpregosBase] = useState(exemploEmpregos);
  // Os dados iniciais de Personalizado e Detalhado são exemplos até o usuário mexer neles.
  const [exemplo, setExemplo] = useState({ periodos: true, empregos: true });

  const restaurar = () => {
    setIdade(PADRAO.idade); setIdadeInicio(PADRAO.idadeInicio); setRenda(PADRAO.renda); setRendaEm(PADRAO.rendaEm); setTipo(PADRAO.tipo);
    setCrescimento(PADRAO.crescimento); setRendaInicial(PADRAO.rendaInicial); setAnosSemTrabalho(PADRAO.anosSemTrabalho);
    setUf(PADRAO.uf); setFracaoGasta(PADRAO.fracaoGasta); setUsarDivisao(false); setDivisao({}); setValoresEm(PADRAO.valoresEm);
    setUsarBeneficio({}); setBeneficios([]);
    setPeriodosBase(exemploPeriodos()); setEmpregosBase(exemploEmpregos()); setExemplo({ periodos: true, empregos: true });
    setAvisoArquivo({ ok: true, texto: 'Valores padrão restaurados.' });
  };
  const setPeriodos = (f) => { setExemplo((x) => ({ ...x, periodos: false })); setPeriodosBase(f); };
  const setEmpregos = (f) => { setExemplo((x) => ({ ...x, empregos: false })); setEmpregosBase(f); };

  // No Rápido a renda pode ser informada pelo líquido; o cálculo sempre usa o bruto.
  const emLiquido = rendaEm === 'liquido' && tipo !== 'outro';
  const rendaBruta = emLiquido ? brutoDoLiquido(num(renda), tipo) : num(renda);
  // Ida e volta sem editar o campo devolve o valor original (evita 5.000 -> 4.498 -> 4.999).
  const trocaAnterior = useRef(null);
  const trocarRendaEm = (para) => {
    const v = para === 'liquido' ? liquidoMensal(rendaBruta, tipo) : rendaBruta;
    const volta = trocaAnterior.current;
    const novo = volta && volta.de === renda && volta.para === para && volta.tipo === tipo ? volta.valor : v > 0 ? mascarar(String(Math.round(v)), 'moeda') : renda;
    trocaAnterior.current = { de: novo, para: rendaEm, valor: renda, tipo };
    setRenda(novo);
    setRendaEm(para);
  };

  const entrada = useMemo(() => ({
    nivel,
    idade: Math.round(num(idade)),
    idadeInicio: Math.round(num(idadeInicio)),
    rendaAtual: rendaBruta,
    tipo,
    crescimentoReal: crescimento === '' ? 2 : num(crescimento),
    rendaInicial: num(rendaInicial),
    anosSemTrabalho: num(anosSemTrabalho),
    fracaoGasta: fracaoGasta === '' ? null : num(fracaoGasta) / 100,
    // Só as categorias preenchidas; as vazias usam o peso médio.
    divisaoGastos: usarDivisao
      ? Object.fromEntries(Object.entries(divisao).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, num(v)]))
      : null,
    valoresEm,
    uf,
    mesAtual: MES_ATUAL,
    beneficios: beneficiosNumericos(beneficios, usarBeneficio),
    empregos: empregosNumericos(empregos),
    periodos: periodos.map((p) => ({
      ...p,
      renda: num(p.renda),
      gastos: Object.fromEntries(Object.entries(p.gastos ?? {}).map(([k, v]) => [k, num(v)])),
    })),
  }), [nivel, idade, idadeInicio, rendaBruta, tipo, crescimento, rendaInicial, anosSemTrabalho, fracaoGasta, usarDivisao,
    divisao, valoresEm, uf, empregos, periodos, beneficios, usarBeneficio]);

  const erro = useMemo(() => {
    const temBeneficio = entrada.beneficios.some((b) => b.valor > 0 && contarMeses(b.inicio, b.fim) > 0);
    const ouBeneficio = ' Sem salário, marque só os benefícios recebidos (Bolsa Família ou aposentadoria) logo abaixo.';
    if (nivel === 'detalhado') {
      const i = entrada.periodos.findIndex((p) => !p.inicio || !p.fim || contarMeses(p.inicio, p.fim) === 0);
      if (i >= 0) return `Período ${i + 1}: o mês final deve ser igual ou posterior ao inicial.`;
      if (!entrada.periodos.some((p) => p.renda > 0) && !temBeneficio) return 'Informe ao menos um período com valor recebido.' + ouBeneficio;
      return null;
    }
    if (nivel === 'personalizado') {
      if (empregos.length === 0 && temBeneficio) return null;
      const e = errosEmpregos(empregos);
      return e && empregos.length === 0 ? e + ouBeneficio : e;
    }
    if (entrada.rendaAtual <= 0) return temBeneficio ? null : 'Informe a renda mensal atual.' + ouBeneficio;
    if (entrada.idade < 14 || entrada.idade > 100) return 'Informe uma idade entre 14 e 100 anos.';
    if (entrada.idadeInicio < 10 || entrada.idadeInicio >= entrada.idade) return 'A idade de início deve ser menor que a idade atual.';
    return null;
  }, [entrada, nivel, empregos]);

  const resultado = useMemo(() => (erro ? null : calcular(entrada)), [entrada, erro]);
  const liquidoAtual = nivel === 'rapido' ? liquidoMensal(rendaBruta, tipo) : resultado?.liquidoAtual ?? 0;

  const levarParaDetalhado = (lista) => {
    setPeriodos(lista.map(({ emprego, ...p }) => novoPeriodo({ ...p, renda: String(p.renda), gastos: {} })));
    setNivel('detalhado');
  };

  const irParaResultado = () => document.getElementById('cci-resultado')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const [avisoArquivo, setAvisoArquivo] = useState(null);

  const salvar = () => {
    baixarDados({
      nivel, idade, idadeInicio, renda, rendaEm, tipo, crescimento, rendaInicial, anosSemTrabalho,
      uf, fracaoGasta, usarDivisao, divisao, valoresEm, empregos, periodos, usarBeneficio, beneficios,
    });
    setAvisoArquivo({ ok: true, texto: 'Arquivo salvo. Guarde-o para carregar seus dados depois.' });
  };

  const carregar = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      const d = lerDados(await arquivo.text());
      setNivel(d.nivel);
      setIdade(d.idade);
      setIdadeInicio(d.idadeInicio);
      setRenda(d.renda);
      setRendaEm(d.rendaEm);
      setTipo(d.tipo);
      setCrescimento(d.crescimento || PADRAO.crescimento);
      setRendaInicial(d.rendaInicial);
      setAnosSemTrabalho(d.anosSemTrabalho || PADRAO.anosSemTrabalho);
      setUf(d.uf);
      setFracaoGasta(d.fracaoGasta || PADRAO.fracaoGasta);
      setUsarDivisao(d.usarDivisao);
      setDivisao(d.divisao);
      setValoresEm(d.valoresEm);
      setEmpregos(d.empregos.map((x) => novoEmprego(x)));
      setPeriodos(d.periodos.map((p) => novoPeriodo(p)));
      setUsarBeneficio(d.usarBeneficio);
      setBeneficios(d.beneficios.map((b) => novoBeneficio(b)));
      setAvisoArquivo({
        ok: true,
        texto: `Dados carregados de "${arquivo.name}" (${d.empregos.length} empregos, ${d.periodos.length} períodos).`
          + (d.ignorados ? ` ${d.ignorados} item(ns) com datas inválidas foram ignorados.` : ''),
      });
    } catch (err) {
      setAvisoArquivo({ ok: false, texto: err.message });
    }
  };

  return (
    <section className="cci" aria-label="Calculadora do custo dos impostos">
      <header className="cci-cabecalho">
        <h2>Calculadora do Custo dos Impostos</h2>
        <p>
          Estime quanto você recebeu pelo trabalho ao longo da vida, quanto disso foi destinado ao governo e quanto
          poderia ter conservado. <strong>Os cálculos são feitos no seu navegador — nenhum dado é enviado.</strong>
        </p>
        <div className="cci-arquivo">
          <button type="button" className="cci-botao-ghost" onClick={salvar}
            title="Gera um arquivo .json no seu computador com tudo o que você preencheu, nos três modos">Salvar meus dados</button>
          <label className="cci-botao-ghost" title="Abre um arquivo .json salvo antes por esta calculadora">
            Carregar dados salvos
            <input type="file" accept=".json,application/json" onChange={carregar} hidden />
          </label>
          <button type="button" className="cci-botao-ghost" onClick={restaurar}
            title="Volta todos os campos aos valores iniciais">Restaurar padrão</button>
        </div>
        {avisoArquivo && (
          <p className={avisoArquivo.ok ? 'cci-sucesso' : 'cci-erro'} role="status">{avisoArquivo.texto}</p>
        )}
      </header>

      <div className="cci-niveis" role="tablist">
        {NIVEIS.map((n) => (
          <button key={n.id} role="tab" aria-selected={nivel === n.id}
            className={'cci-nivel' + (nivel === n.id ? ' cci-ativo' : '')} onClick={() => setNivel(n.id)}>
            <strong>{n.nome}</strong>
            <span>{n.desc}</span>
          </button>
        ))}
      </div>
      <p className="cci-nivel-desc">{NIVEIS.find((n) => n.id === nivel).desc}</p>

      <div className="cci-bloco">
        <h3><span className="cci-num">1</span> Quanto você ganhou na vida?</h3>
        {nivel === 'rapido' && (
          <>
            <div className="cci-grade">
              <Campo label="Idade atual">
                <Numero value={idade} onChange={setIdade} sufixo="anos" />
              </Campo>
              <Campo label="Idade no 1º trabalho">
                <Numero value={idadeInicio} onChange={setIdadeInicio} sufixo="anos" />
              </Campo>
              <Campo label="Tipo de trabalho">
                <SelectTipo value={tipo} onChange={setTipo} />
              </Campo>
              <Campo
                label={emLiquido ? (tipo === 'clt' ? 'Salário LÍQUIDO mensal' : 'Renda LÍQUIDA mensal') : tipoInfo(tipo).rotuloRenda}
                dica={emLiquido
                  ? 'O que cai na conta por mês, já sem INSS e IR (sem contar 13º e férias). O bruto é calculado a partir dele.'
                  : tipoInfo(tipo).ajudaRenda}>
                <Numero value={renda} onChange={setRenda} prefixo="R$" />
                {tipo !== 'outro' && rendaBruta > 0 && (
                  <span className="cci-liquido">≈ {brl(emLiquido ? rendaBruta : liquidoMensal(rendaBruta, tipo))} {emLiquido ? 'bruto' : 'líquido'}/mês</span>
                )}
                {tipo !== 'outro' && (
                  <button type="button" className="cci-link cci-troca-renda" onClick={() => trocarRendaEm(emLiquido ? 'bruto' : 'liquido')}>
                    {emLiquido ? 'prefiro informar o bruto' : 'só sei o líquido'}
                  </button>
                )}
              </Campo>
              <Campo label="Estado onde mora" dica="Define o ICMS embutido no que você compra. Também é o estado inicial de novos empregos e períodos.">
                <SelectUF value={uf} onChange={setUf} />
              </Campo>
            </div>
            <details className="cci-opcionais"
              open={!!(rendaInicial || num(anosSemTrabalho) > 0 || (crescimento !== '' && num(crescimento) !== 2)) || undefined}>
              <summary>Refinar a estimativa (opcional)</summary>
              <div className="cci-grade">
                <Campo label="Renda BRUTA no 1º trabalho"
                  dica="Em valores de hoje. Opcional: se preenchida, define o crescimento da renda (o campo ao lado fica bloqueado).">
                  <Numero value={rendaInicial} onChange={setRendaInicial} prefixo="R$" placeholder="opcional" />
                </Campo>
                <Campo label="Crescimento real da renda" dica="Quanto a renda subiu por ano acima da inflação. Padrão: 2%.">
                  <Numero value={num(rendaInicial) > 0 ? '' : crescimento} onChange={setCrescimento} sufixo="% a.a."
                    placeholder={num(rendaInicial) > 0 ? 'pela renda' : '2'} disabled={num(rendaInicial) > 0} />
                </Campo>
                <Campo label="Anos sem trabalhar" dica="Total de anos parado: desemprego, estudo, licenças etc.">
                  <Numero value={anosSemTrabalho} onChange={setAnosSemTrabalho} sufixo="anos" placeholder="0" />
                </Campo>
              </div>
              <p className="cci-ajuda">
                Quer informar cada emprego? Use o modo <button type="button" className="cci-link" onClick={() => setNivel('personalizado')}>Personalizado</button>.
              </p>
            </details>
            <p className="cci-hipotese">
              Hipóteses: {num(rendaInicial) > 0
                ? <>a renda bruta foi de {brl(num(rendaInicial))} a {brl(rendaBruta)} (valores de hoje), crescendo a uma taxa constante</>
                : <>a renda bruta cresceu {pct(entrada.crescimentoReal / 100)} ao ano acima da inflação</>}
              {num(anosSemTrabalho) > 0 ? `, com ${num(anosSemTrabalho)} ano(s) sem trabalho distribuídos na carreira` : ', sem interrupções'},
              sempre na mesma modalidade e no mesmo estado.
            </p>
          </>
        )}

        {nivel === 'personalizado' && (
          <EditorEmpregos empregos={empregos} setEmpregos={setEmpregos} valoresEm={valoresEm} setValoresEm={setValoresEm}
            onLevarParaDetalhado={levarParaDetalhado} exemplo={exemplo.empregos} ufPadrao={uf} />
        )}

        {nivel === 'detalhado' && (
          <EditorPeriodos periodos={periodos} setPeriodos={setPeriodos} valoresEm={valoresEm} setValoresEm={setValoresEm}
            exemplo={exemplo.periodos} ufPadrao={uf} />
        )}

        <Beneficios usar={usarBeneficio} setUsar={setUsarBeneficio} beneficios={beneficios} setBeneficios={setBeneficios} />
      </div>

      <div className="cci-bloco">
        <h3><span className="cci-num">2</span> Seus gastos (impostos sobre o consumo)</h3>
        <PerfilGastos fracaoGasta={fracaoGasta} setFracaoGasta={setFracaoGasta} divisao={divisao} setDivisao={setDivisao}
          usarDivisao={usarDivisao} setUsarDivisao={setUsarDivisao} liquidoMensal={liquidoAtual}
          uf={nivel === 'rapido' ? uf : null} nivel={nivel} />
      </div>

      {erro && <p className="cci-erro">{erro}</p>}
      {resultado && (
        <button type="button" className="cci-resumo-fixo" onClick={irParaResultado}>
          {resultado.nominal.total < 0 ? (
            <>
              <span>Saldo com o governo: <strong>{brl(resultado.nominal.total)}</strong></span>
              <span>recebeu mais do que pagou</span>
            </>
          ) : (
            <>
              <span>Destinado ao governo: <strong>{brl(resultado.nominal.total)}</strong></span>
              {resultado.semTrabalho
                ? <span>pagou {brl(resultado.nominal.pago)} · recebeu {brl(resultado.nominal.beneficios)}</span>
                : <span>{pct(resultado.nominal.percentual)} · {Math.round(resultado.nominal.percentual * 365)} dias por ano</span>}
            </>
          )}
          <span className="cci-resumo-ver">ver resultado ↓</span>
        </button>
      )}
      {resultado && <Resultado r={resultado} />}

      <Metodologia />
    </section>
  );
}

function Resultado({ r }) {
  const [verAnos, setVerAnos] = useState(false);
  // Cards, barra e tabela anual usam valores nominais (o que foi recebido/pago na época).
  // Valores corrigidos aparecem só onde estão rotulados como tal.
  const { real, nominal } = r;
  const partes = [
    { id: 'diretos', nome: 'Descontados de você (INSS, IR, Simples)', valor: nominal.diretos, cor: 'var(--cci-c1)' },
    ...(nominal.encargos > 0 ? [{ id: 'encargos', nome: 'Pagos pelo empregador (INSS patronal, RAT, terceiros)', valor: nominal.encargos, cor: 'var(--cci-c2)' }] : []),
    { id: 'consumo', nome: 'Tributos no consumo', valor: nominal.consumo, cor: 'var(--cci-c3)' },
    ...(nominal.beneficios > 0 ? [{ id: 'beneficios', nome: 'Benefícios recebidos (abatidos)', valor: -nominal.beneficios, cor: 'var(--cci-c4)', negativo: true }] : []),
    { id: 'conservado', nome: 'Ficou com você (poder de compra)', valor: nominal.conservado, cor: 'var(--cci-c4)' },
  ];

  // "Dias por ano trabalhando para o governo" = fração da renda destinada a tributos × 365.
  const dias = Math.round(nominal.percentual * 365);
  // Sem renda do trabalho (só benefícios), os percentuais usam o total recebido como base.
  const sem = r.semTrabalho;
  const denominador = nominal.base > 0 ? nominal.base : nominal.beneficios;
  const aFavor = nominal.total < 0;

  const linha = (nome, chave, destaque, negativo) => {
    const fmt = (v) => (negativo ? '−' + brl(v) : brl(v));
    return (
      <tr className={(destaque ? 'cci-destaque' : '') + (negativo ? ' cci-negativo' : '')}>
        <th scope="row">{nome}</th>
        <td data-rotulo="Nominal">{fmt(nominal[chave])}</td>
        <td data-rotulo={`Corrigido (R$ ${P.ANO_REFERENCIA})`}>{fmt(real[chave])}</td>
      </tr>
    );
  };

  return (
    <div className="cci-bloco cci-resultado" id="cci-resultado" aria-live="polite">
      <h3><span className="cci-num">3</span> Resultado estimado</h3>

      <div className="cci-cards">
        {sem ? (
          <div className="cci-card">
            <span>Benefícios recebidos</span>
            <strong>{brl(nominal.beneficios)}</strong>
            <small>{duracao(r.mesesBeneficio)} de benefícios, somando os valores de cada época; nenhuma renda do trabalho informada</small>
          </div>
        ) : (
          <div className="cci-card">
            <span>{nominal.encargos > 0 ? 'Custo total do seu trabalho' : 'Remuneração bruta acumulada'}</span>
            <strong>{brl(nominal.base)}</strong>
            <small>
              {nominal.encargos > 0 && <>Salário bruto {brl(nominal.bruto)} + encargos do empregador {brl(nominal.encargos)}. </>}
              {duracao(r.mesesTrabalhados)} de trabalho, em valores de cada época.
            </small>
          </div>
        )}
        <div className={'cci-card ' + (aFavor ? 'cci-card-voce' : 'cci-card-governo')}>
          <span>{aFavor ? 'Saldo com o governo (a seu favor)' : `Total destinado ao governo${nominal.beneficios > 0 ? ' (saldo)' : ''}`}</span>
          <strong>{brl(nominal.total)}</strong>
          <small>
            {!sem && <>{pct(nominal.percentual)} {nominal.encargos > 0 ? 'do custo total do seu trabalho' : 'da sua remuneração bruta'}.</>}
            {nominal.beneficios > 0 && <>{sem ? '' : ' '}Pagou {brl(nominal.pago)} em tributos e recebeu {brl(nominal.beneficios)} de volta em benefícios.</>}
          </small>
        </div>
        {sem ? (
          <div className="cci-card">
            <span>Tributos pagos no consumo</span>
            <strong>{brl(nominal.pago)}</strong>
            <small>{pct(denominador > 0 ? nominal.pago / denominador : 0)} do que recebeu, embutidos nos preços do que comprou{nominal.irpf > 0 ? ' (inclui o IR da aposentadoria)' : ''}.</small>
          </div>
        ) : (
          <div className="cci-card">
            <span>Dias por ano trabalhando só para pagar tributos</span>
            <strong>{dias} dias</strong>
            <small>
              ≈ {(dias / 30.4).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses de cada ano ({pct(nominal.percentual)} × 365 dias).
            </small>
          </div>
        )}
        <div className="cci-card cci-card-voce">
          <span>Ficou com você</span>
          <strong>{brl(nominal.conservado)}</strong>
          <small>
            {sem
              ? <>Benefícios menos os tributos embutidos no que você comprou.</>
              : <>Em poder de compra. Sem nenhum tributo seriam {brl(nominal.base + nominal.beneficios)} (sem contar os serviços públicos recebidos).</>}
          </small>
        </div>
        <div className="cci-card cci-card-corrigido">
          <span>Corrigido pela inflação (R$ de {P.ANO_REFERENCIA})</span>
          <strong>{brl(real.total)}</strong>
          <small>
            {real.total < 0 ? 'De saldo a seu favor' : 'Destinados ao governo'}, a valores de hoje (IPCA).{' '}
            {sem ? 'Benefícios corrigidos' : real.encargos > 0 ? 'Custo total corrigido' : 'Remuneração corrigida'}: {brl(sem ? real.beneficios : real.base)}.
          </small>
        </div>
      </div>

      <div className="cci-barra" role="img" aria-label="Divisão da remuneração">
        {partes.filter((p) => !p.negativo).map((p) => (
          <span key={p.id} style={{ flexGrow: Math.max(p.valor, 0), background: p.cor }} title={`${p.nome}: ${brl(p.valor)}`} />
        ))}
      </div>
      <ul className="cci-legenda">
        {partes.filter((p) => p.valor !== 0 || p.id === 'conservado').map((p) => (
          <li key={p.id} className={p.negativo ? 'cci-negativo' : ''}>
            <i style={{ background: p.negativo ? 'transparent' : p.cor, border: p.negativo ? '1px dashed var(--cci-c4)' : 0 }} />
            {p.nome}: {p.negativo ? '−' + brl(-p.valor) : brl(p.valor)} ({pct(denominador > 0 ? Math.abs(p.valor) / denominador : 0)})
          </li>
        ))}
      </ul>

      <div className="cci-tabela-wrap">
        <table className="cci-tabela cci-tabela-resumo">
          <thead>
            <tr><th /><th>Nominal (R$ da época)</th><th>Corrigido (R$ de {P.ANO_REFERENCIA})</th></tr>
          </thead>
          <tbody>
            {!sem && (
              <>
                {linha('Remuneração bruta (salários, 13º e férias)', 'bruto')}
                {real.encargos > 0 && linha('+ Encargos pagos pelo empregador', 'encargos')}
                {real.encargos > 0 && linha('= Custo total do trabalho', 'base', true)}
                <tr className="cci-secao"><th scope="row" colSpan={3}>Tributos sobre o trabalho</th></tr>
                {linha('INSS descontado do salário (sua parte)', 'inss')}
                {linha('Imposto de Renda', 'irpf')}
                {real.simples > 0 && linha('Simples Nacional (empresa PJ, inclui INSS patronal)', 'simples')}
                {real.encargos > 0 && P.ENCARGOS_EMPREGADOR.itens.map((e) => (
                  <Fragment key={e.id}>{linha(e.nome, e.id)}</Fragment>
                ))}
                {linha('Subtotal: tributos sobre o trabalho', 'trabalho', true)}
              </>
            )}
            {sem && real.irpf > 0 && linha('Imposto de Renda retido na aposentadoria', 'irpf')}
            <tr className="cci-secao"><th scope="row" colSpan={3}>Tributos no consumo{r.consumo.personalizado ? '' : ' (gastos médios)'}</th></tr>
            {linha('Federais (PIS/Cofins, IPI, CIDE)', 'consumoFederal')}
            {linha(`Estaduais (ICMS${r.consumo.ufs.length === 1 ? ' — ' + r.consumo.ufs[0] : ''})`, 'consumoEstadual')}
            {linha('Municipais (ISS)', 'consumoMunicipal')}
            {linha('Subtotal: tributos no consumo', 'consumo', true)}
            {real.beneficios > 0 && (
              <>
                {linha('Total pago ao governo', 'pago', true)}
                <tr className="cci-secao"><th scope="row" colSpan={3}>Recebido de volta (abate do total)</th></tr>
                {real.bolsaFamilia > 0 && linha('Bolsa Família', 'bolsaFamilia', false, true)}
                {real.aposentadoria > 0 && linha('Aposentadoria do INSS (com 13º)', 'aposentadoria', false, true)}
              </>
            )}
            {linha(real.total < 0 ? 'Saldo com o governo (negativo = a seu favor)' : real.beneficios > 0 ? 'Total destinado ao governo (saldo)' : 'Total destinado ao governo', 'total', true)}
            {linha(sem ? 'Ficou com você (benefícios − tributos pagos)' : `Ficou com você (${real.encargos > 0 ? 'custo total' : 'remuneração'} − total destinado ao governo)`, 'conservado', true)}
          </tbody>
        </table>
      </div>

      {r.consumo.acimaDoLiquido && (
        <p className="cci-aviso">Em algum período os gastos informados superam a renda líquida estimada. Mantivemos os valores como informados (pode ser outra fonte de renda ou uso de poupança).</p>
      )}
      {r.consumo.limitado && (
        <p className="cci-aviso">Seus gastos informados superam a renda líquida estimada; limitamos o consumo a 100% da renda líquida.</p>
      )}
      {r.consumo.antesDe2015 && (
        <p className="cci-aviso">Para anos anteriores a 2015, o ICMS usa as alíquotas de 2015 de cada estado (o histórico mais antigo ainda não está na calculadora).</p>
      )}
      {r.consumo.estimados.length > 0 && (
        <p className="cci-aviso">
          Antes de 07/2022, a alíquota de energia elétrica de {r.consumo.estimados.map((u) => P.ICMS_UF.ufs[u]?.nome ?? u).join(', ')} não
          foi confirmada em fonte e usa 25%, a mais comum no país na época.
        </p>
      )}
      {r.inicioAntesDoReal && (
        <p className="cci-aviso">Anos anteriores a 1995 aparecem nos valores nominais no nível de preços de 1995, pois valores anteriores ao Plano Real não são comparáveis em reais.</p>
      )}

      <p className="cci-base">
        {sem
          ? <><strong>Sem renda do trabalho:</strong> os percentuais usam como base os benefícios recebidos.</>
          : <><strong>Base do percentual:</strong> total destinado ao governo ÷ {nominal.encargos > 0 ? 'custo total do trabalho (remuneração bruta + encargos do empregador)' : 'remuneração bruta acumulada'}.</>}
        {' '}Os tributos no consumo incidem apenas sobre a renda líquida que foi gasta, sem dupla contagem com os tributos diretos.
        {' '}
        {r.consumo.porPeriodo ? (
          <>
            Alíquota média nos gastos informados por período: {pct(r.consumo.aliquotaPeriodos)} do preço final.
            {r.consumo.mesesComMedia > 0 && <> Nos {r.consumo.mesesComMedia} meses sem gastos informados, usamos a média.</>}
          </>
        ) : (
          <>Alíquota média estimada nos seus gastos: {pct(r.consumo.aliquota)} do preço final.</>
        )}
        {' '}Estado{r.consumo.ufs.length > 1 ? 's' : ''} considerado{r.consumo.ufs.length > 1 ? 's' : ''}:{' '}
        {r.consumo.ufs.map((u) => P.ICMS_UF.ufs[u]?.nome ?? u).join(', ')}.
      </p>

      <div className="cci-acoes">
        <button className="cci-botao-sec" onClick={() => setVerAnos((v) => !v)}>
          {verAnos ? 'Ocultar' : 'Ver'} detalhamento por ano
        </button>
        <button className="cci-botao-sec" onClick={() => exportarCSV(r)}>Baixar planilha (CSV)</button>
      </div>

      {verAnos && (
        <div className="cci-tabela-wrap cci-anos">
          <table className="cci-tabela">
            <thead>
              <tr><th>Ano</th><th>Meses</th><th>Renda bruta mensal média</th><th>Remuneração bruta no ano</th><th>Tributos diretos</th><th>Consumo</th>
                {r.nominal.beneficios > 0 && <th>Benefícios recebidos</th>}</tr>
            </thead>
            <tbody>
              {r.linhas.map((l) => (
                <tr key={l.ano}>
                  <td>{l.ano}</td>
                  <td>{l.meses}</td>
                  <td>{brl(l.rendaMensalNominal)}</td>
                  <td>{brl(l.nominal.bruto)}</td>
                  <td>{brl(l.nominal.inss + l.nominal.irpf + l.nominal.simples)}</td>
                  <td>{brl(l.nominal.consumo)}</td>
                  {r.nominal.beneficios > 0 && <td className="cci-negativo">{l.nominal.beneficios > 0 ? '−' + brl(l.nominal.beneficios) : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="cci-ajuda">Valores nominais (R$ de cada ano). A remuneração da CLT inclui 13º e 1/3 de férias proporcionais.</p>
        </div>
      )}

      <p className="cci-aviso">
        Este resultado é uma <strong>estimativa</strong> baseada nas hipóteses abaixo, não um registro exato dos tributos que você pagou.
      </p>
    </div>
  );
}

function Metodologia() {
  const fontes = [
    ['INSS do empregado', P.INSS_EMPREGADO],
    ['INSS contribuinte individual / pró-labore', P.INSS_CONTRIBUINTE_INDIVIDUAL],
    ['Imposto de Renda', P.IRPF],
    ['Encargos do empregador', P.ENCARGOS_EMPREGADOR],
    ['Simples Nacional', P.SIMPLES_ANEXO_III],
    ['Tributos no consumo', P.CONSUMO],
    ['ICMS por estado', P.ICMS_UF],
    ['ICMS da gasolina', P.GASOLINA],
    ['Inflação', P.IPCA],
  ];
  return (
    <details className="cci-bloco cci-metodo">
      <summary>Como calculamos — hipóteses, fontes e limitações</summary>
      <h4>Hipóteses</h4>
      <ul>
        <li>Cada ano é calculado em reais de {P.ANO_REFERENCIA} com as regras tributárias de {P.ANO_REFERENCIA}. Regras históricas (tabelas antigas de IR e INSS) ainda não são aplicadas ano a ano.</li>
        <li><strong>CLT:</strong> 13 salários + 1/3 de férias por ano; INSS pela tabela progressiva; IR mensal com desconto simplificado ou dedução do INSS (o que for maior) e a redução da Lei 15.270/2025. Sempre somamos os encargos que o empregador recolhe sobre a folha — INSS patronal (20%), RAT/SAT (~2%) e terceiros (~5,8%) — pois fazem parte do custo do seu trabalho; nesse caso a base do percentual é o custo total (salário + encargos). FGTS (8%) é um depósito em conta do trabalhador, não tributo, e não entra na conta.</li>
        <li><strong>PJ:</strong> empresa de serviços no Simples Nacional, Anexo III, com pró-labore de 28% do faturamento (Fator R). Sobre o pró-labore incidem INSS de 11% e IR; a distribuição de lucros é considerada isenta. A parte patronal do INSS (CPP) já está incluída na guia do Simples. Custos da empresa não são descontados.</li>
        <li><strong>Autônomo:</strong> INSS de 20% até o teto e IR pelo carnê-leão, sem livro-caixa.</li>
        <li><strong>Outro / informal:</strong> sem tributos diretos; apenas os do consumo.</li>
        <li><strong>Consumo:</strong> cada categoria é dividida em subcategorias (ex.: moradia = aluguel, condomínio, energia, água, telecom e gás), cada uma com sua parte <strong>federal</strong> (PIS/Cofins, IPI, CIDE), <strong>estadual</strong> (ICMS pela alíquota padrão do estado no mês, reduzida para a cesta básica e refeições) e <strong>municipal</strong> (ISS sobre serviços). Antes de 07/2022 (teto da LC 194/2022), energia, telecom e gasolina usam as alíquotas próprias de cada estado, em geral de 25% a 34%; depois, a alíquota padrão. A gasolina paga ICMS fixo por litro, igual em todo o país, desde 06/2023. Os tributos incidem só sobre a parte da renda líquida que foi gasta. Sem gastos informados, a fração gasta e a divisão entre categorias se mantêm ao longo da vida.</li>
        <li>Todos os valores de renda informados são <strong>brutos</strong> (antes de INSS, IR e Simples). O líquido exibido é apenas uma estimativa para você conferir com o contracheque.</li>
        <li><strong>Rápido:</strong> a renda de cada ano sai da renda atual descontando o crescimento real (2% ao ano, ou o informado); anos sem trabalho reduzem proporcionalmente cada ano.</li>
        <li><strong>Personalizado:</strong> cada emprego vira um período por ano, com o salário interpolado entre o valor de entrada e o de saída (taxa constante). Se um emprego termina no mesmo ano em que outro começa, a troca é considerada em julho.</li>
        <li><strong>Gastos:</strong> o percentual informado da renda líquida (padrão 85%) vira consumo; a divisão entre categorias é a média das famílias ou a que você informar em %.</li>
        <li><strong>Detalhado:</strong> cada mês é calculado com a renda informada para ele. Valores em R$ da época são corrigidos pelo IPCA do mês (o IPCA anual distribuído entre os meses). Na CLT, 13º e 1/3 de férias entram proporcionalmente (1/12 por mês trabalhado).</li>
        <li><strong>Benefícios:</strong> Bolsa Família e aposentadoria/pensão do INSS recebidos entram com sinal negativo — são dinheiro que o governo devolve — e o resultado é o saldo destinado ao governo. Os valores são informados em R$ da época. A aposentadoria inclui o 13º (abono anual) e paga IR na fonte pela tabela mensal (sem a parcela isenta extra para maiores de 65 anos). O que é gasto dos benefícios paga tributos no consumo como o resto da renda.</li>
        <li>Os valores nominais são obtidos deflacionando cada ano ou mês pelo IPCA acumulado.</li>
      </ul>
      <h4>Fora da conta</h4>
      <ul>
        <li>IPTU, IPVA, ITBI, ITCMD, IOF, taxas e tributos sobre investimentos.</li>
        <li>Deduções individuais do IR (dependentes, saúde, educação) e restituições.</li>
        <li>Alíquotas de ICMS anteriores a 2015, faixas de consumo de energia (ex.: SP cobrava 18% até 200 kWh), regimes especiais de cada estado e fundos de pobreza sobre itens específicos (bebidas, fumo, perfumes).</li>
        <li>Mudanças nas alíquotas de gasolina entre 2015 e 2021: usamos os valores de 10/2021 e de 06/2022.</li>
        <li>O efeito gradual da reforma tributária (CBS/IBS), que começa a valer a partir de 2027.</li>
        <li>O valor dos serviços públicos (saúde, educação, segurança) e de benefícios não listados na seção 1, como seguro-desemprego, BPC e abono salarial.</li>
      </ul>
      <h4>Fontes e vigência dos parâmetros</h4>
      <ul>
        {fontes.map(([nome, p]) => (
          <li key={nome}><strong>{nome}:</strong> {p.fonte} — <em>{p.vigencia}</em></li>
        ))}
      </ul>
    </details>
  );
}
