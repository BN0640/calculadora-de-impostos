// Editor de períodos do modo Detalhado: linha do tempo, linhas compactas,
// atalhos para o próximo período e um gerador de vários períodos de uma vez.
import { useState } from 'react';
import { contarMeses, taxaCategoria, taxasSubcategoria } from '../../lib/calculo.js';
import * as P from '../../lib/parametros.js';
import {
  brl, pct, num, tipoInfo, MES_ATUAL, somarMeses, indiceMes, mesCurto, duracao,
  Liquido, Campo, Numero, Mes, SelectTipo, SelectUF, SeletorMoeda,
} from './ui.jsx';

let seq = 0;
export const novoPeriodo = (dados) => ({ id: `p${++seq}`, renda: '', tipo: 'clt', uf: P.UF_PADRAO, gastos: {}, ...dados });

const CORES = { clt: 'var(--cci-primaria)', pj: '#7c3aed', autonomo: '#0e9384', outro: '#98a2b3' };
const minMes = (a, b) => (a < b ? a : b);
// Total mensal de uma categoria: soma das subcategorias, se houver, ou o valor da categoria.
const somaSubs = (g, c) => c.sub.reduce((s, x) => s + num(g?.[`${c.id}.${x.id}`]), 0);
const totalCategoria = (g, c) => somaSubs(g, c) || num(g?.[c.id]);
const somaGastos = (g) => P.CONSUMO.categorias.reduce((s, c) => s + totalCategoria(g, c), 0);

// Para cada período: com quais outros ele se sobrepõe e quantos meses sem trabalho
// existem logo antes dele (desde o fim do período anterior mais próximo).
function relacoes(periodos) {
  const validos = periodos.filter((p) => contarMeses(p.inicio, p.fim) > 0);
  return Object.fromEntries(validos.map((p) => {
    const outros = validos.filter((o) => o.id !== p.id);
    const sobrepoe = outros.filter((o) => o.inicio <= p.fim && o.fim >= p.inicio).map((o) => o.id);
    const anteriores = outros.filter((o) => o.inicio < p.inicio);
    const fimAnterior = anteriores.reduce((m, o) => (o.fim > m ? o.fim : m), '');
    const lacuna = fimAnterior ? indiceMes(p.inicio) - indiceMes(fimAnterior) - 1 : 0;
    const anterior = anteriores.find((o) => o.fim === fimAnterior);
    return [p.id, { sobrepoe, lacuna: lacuna > 0 ? lacuna : 0, fimAnterior, anterior }];
  }));
}

// Distribui períodos sobrepostos em faixas diferentes para não se esconderem.
function faixas(periodos) {
  const fimPorFaixa = [];
  return periodos
    .filter((p) => contarMeses(p.inicio, p.fim) > 0)
    .sort((a, b) => indiceMes(a.inicio) - indiceMes(b.inicio))
    .map((p) => {
      let f = fimPorFaixa.findIndex((fim) => fim < indiceMes(p.inicio));
      if (f < 0) f = fimPorFaixa.length;
      fimPorFaixa[f] = indiceMes(p.fim);
      return { p, faixa: f };
    });
}

export function LinhaDoTempo({ periodos, numeros, selecionado, onSelect }) {
  const itens = faixas(periodos);
  if (itens.length === 0) return null;
  const ini = Math.min(...itens.map((i) => indiceMes(i.p.inicio)));
  const fim = Math.max(indiceMes(MES_ATUAL), ...itens.map((i) => indiceMes(i.p.fim)));
  const total = fim - ini + 1;
  const nFaixas = Math.max(...itens.map((i) => i.faixa)) + 1;
  const anoIni = Math.floor(ini / 12);
  const anoFim = Math.floor(fim / 12);
  const passo = Math.max(1, Math.ceil((anoFim - anoIni) / 8));
  const marcas = [];
  for (let a = anoIni + (ini % 12 ? 1 : 0); a <= anoFim; a += passo) marcas.push(a);

  return (
    <div className="cci-timeline" aria-label="Linha do tempo dos períodos">
      <div className="cci-timeline-trilho" style={{ height: nFaixas * 22 + 6 }}>
        {itens.map(({ p, faixa }) => (
          <button
            key={p.id}
            type="button"
            className={'cci-timeline-seg' + (selecionado === p.id ? ' cci-sel' : '')}
            style={{
              left: `${((indiceMes(p.inicio) - ini) / total) * 100}%`,
              width: `${(contarMeses(p.inicio, p.fim) / total) * 100}%`,
              top: 3 + faixa * 22,
              background: CORES[p.tipo],
            }}
            title={`${p.rotulo ?? `Período ${numeros[p.id]}`}: ${mesCurto(p.inicio)} a ${mesCurto(p.fim)} · ${tipoInfo(p.tipo).nome}`}
            onClick={() => onSelect(p.id)}
          >
            <span>{numeros[p.id]}</span>
          </button>
        ))}
      </div>
      <div className="cci-timeline-anos">
        {marcas.map((a) => (
          <span key={a} style={{ left: `${((a * 12 - ini) / total) * 100}%` }}>{a}</span>
        ))}
      </div>
      <div className="cci-timeline-legenda">
        {P.TIPOS_TRABALHO.filter((t) => periodos.some((p) => p.tipo === t.id)).map((t) => (
          <span key={t.id}><i style={{ background: CORES[t.id] }} />{t.nome}</span>
        ))}
        <span><i className="cci-vazio" />sem trabalho</span>
      </div>
    </div>
  );
}

// Gastos mensais de um período, por categoria; cada categoria pode ser detalhada
// em subcategorias, cuja soma substitui o total informado.
// Percentual de tributos embutido no preço, mostrado discretamente ao lado do rótulo.
const Taxa = ({ v }) => <span className="cci-taxa" title="Tributos embutidos no preço">{pct(v)}</span>;

function GastosPeriodo({ gastos, valoresEm, uf, chave, onChange }) {
  const [detalhes, setDetalhes] = useState(() =>
    Object.fromEntries(P.CONSUMO.categorias.map((c) => [c.id, somaSubs(gastos, c) > 0])));
  const numericos = Object.fromEntries(Object.entries(gastos).map(([k, v]) => [k, num(v)]));
  const nomeUF = P.ICMS_UF.ufs[uf]?.nome ?? uf;

  return (
    <div className="cci-gastos-periodo">
      <div className="cci-gastos-cats">
        {P.CONSUMO.categorias.map((c) => {
          const subTotal = somaSubs(gastos, c);
          const detalhavel = c.sub.length > 1;
          const aberto = detalhavel && detalhes[c.id];
          return (
            <div key={c.id} className={'cci-gasto-cat' + (aberto ? ' cci-aberto' : '')}>
              <Campo label={<>{c.nome} <Taxa v={taxaCategoria(c.id, uf, chave, numericos)} /></>}>
                <Numero value={subTotal > 0 ? String(Math.round(subTotal)) : gastos[c.id] ?? ''} disabled={subTotal > 0}
                  onChange={(v) => onChange(c.id, v)} prefixo="R$" placeholder="0" />
              </Campo>
              {detalhavel && (
                <button type="button" className="cci-link" onClick={() => setDetalhes((d) => ({ ...d, [c.id]: !d[c.id] }))}>
                  {aberto ? '− subcategorias' : '+ subcategorias'}
                </button>
              )}
              {aberto && (
                <div className="cci-grade cci-grade-compacta cci-subs">
                  {c.sub.map((x) => {
                    const t = taxasSubcategoria(x, uf, chave);
                    return (
                      <Campo key={x.id} label={<>{x.nome} <Taxa v={t.federal + t.estadual + t.municipal} /></>}>
                        <Numero value={gastos[`${c.id}.${x.id}`] ?? ''} onChange={(v) => onChange(`${c.id}.${x.id}`, v)}
                          prefixo="R$" placeholder="0" />
                      </Campo>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="cci-ajuda">
        Gastos por mês, em {valoresEm === 'epoca' ? 'R$ da época' : 'R$ de hoje'}; o % é o tributo embutido em {nomeUF} em{' '}
        {mesCurto(chave)}. Vazio = usa o percentual da seção 2. Em períodos sobrepostos, informe em apenas um.
      </p>
    </div>
  );
}

function Gerador({ primeiroInicio, ultimoFim, ufPadrao, onGerar, onFechar }) {
  // Se ainda há meses livres até hoje, continua depois do último período;
  // senão, propõe refazer tudo a partir do primeiro.
  const continuar = ultimoFim && ultimoFim < MES_ATUAL;
  const [g, setG] = useState({
    inicio: continuar ? somarMeses(ultimoFim, 1) : primeiroInicio ?? '2015-01',
    fim: MES_ATUAL, tipo: 'clt', uf: ufPadrao ?? P.UF_PADRAO, rendaInicial: '', modo: 'reajuste', reajuste: '5', rendaFinal: '',
    substituir: !!ultimoFim && !continuar,
  });
  const set = (campo) => (v) => setG((x) => ({ ...x, [campo]: v }));

  const meses = contarMeses(g.inicio, g.fim);
  const n = Math.ceil(meses / 12);
  const r0 = num(g.rendaInicial);
  const taxa = g.modo === 'final' && n > 1 && r0 > 0 && num(g.rendaFinal) > 0
    ? Math.pow(num(g.rendaFinal) / r0, 1 / (n - 1)) - 1
    : g.modo === 'reajuste' ? num(g.reajuste) / 100 : 0;
  const valido = meses > 0 && r0 > 0;
  const rendaDoAno = (k) => Math.round(r0 * Math.pow(1 + taxa, k));

  const gerar = () => {
    const lista = [];
    for (let k = 0; k < n; k++) {
      const inicio = somarMeses(g.inicio, k * 12);
      const fim = minMes(somarMeses(inicio, 11), g.fim);
      lista.push(novoPeriodo({ inicio, fim, tipo: g.tipo, uf: g.uf, renda: String(rendaDoAno(k)) }));
    }
    onGerar(lista, g.substituir);
  };

  return (
    <div className="cci-gerador">
      <div className="cci-gerador-topo">
        <strong>Gerar vários períodos</strong>
        <span className="cci-ajuda">Cria um período a cada 12 meses, aplicando o reajuste anual.</span>
        <button type="button" className="cci-remover" aria-label="Fechar gerador" onClick={onFechar}>×</button>
      </div>
      <div className="cci-grade cci-grade-compacta">
        <Campo label="Do mês"><Mes value={g.inicio} max={MES_ATUAL} onChange={set('inicio')} /></Campo>
        <Campo label="Até o mês"><Mes value={g.fim} max={MES_ATUAL} onChange={set('fim')} /></Campo>
        <Campo label="Modalidade"><SelectTipo value={g.tipo} onChange={set('tipo')} /></Campo>
        <Campo label="Estado"><SelectUF value={g.uf} onChange={set('uf')} /></Campo>
        <Campo label="Valor bruto no 1º ano"><Numero value={g.rendaInicial} onChange={set('rendaInicial')} prefixo="R$" /></Campo>
        <Campo label="Evolução">
          <select className="cci-select" value={g.modo} onChange={(e) => set('modo')(e.target.value)}>
            <option value="reajuste">Reajuste anual fixo</option>
            <option value="final">Até um valor final</option>
            <option value="fixo">Sem reajuste</option>
          </select>
        </Campo>
        {g.modo === 'reajuste' && (
          <Campo label="Reajuste por ano"><Numero value={g.reajuste} onChange={set('reajuste')} sufixo="%" /></Campo>
        )}
        {g.modo === 'final' && (
          <Campo label="Valor bruto no último ano"><Numero value={g.rendaFinal} onChange={set('rendaFinal')} prefixo="R$" /></Campo>
        )}
      </div>
      {valido && (
        <p className="cci-ajuda">
          Vai criar {n} {n === 1 ? 'período' : 'períodos'} ({duracao(meses)}): {brl(rendaDoAno(0))}
          {n > 1 && <> → {brl(rendaDoAno(n - 1))}{taxa ? ` (${pct(taxa)} ao ano)` : ''}</>}.
          Depois você pode ajustar qualquer linha.
        </p>
      )}
      <div className="cci-acoes">
        <label className="cci-check">
          <input type="checkbox" checked={g.substituir} onChange={(e) => set('substituir')(e.target.checked)} />
          Substituir os períodos atuais
        </label>
        <button type="button" className="cci-botao" disabled={!valido} onClick={gerar}>Gerar períodos</button>
      </div>
    </div>
  );
}

export default function EditorPeriodos({ periodos, setPeriodos, valoresEm, setValoresEm, exemplo, ufPadrao = P.UF_PADRAO }) {
  const [selecionado, setSelecionado] = useState(null);
  const [gastosAbertos, setGastosAbertos] = useState({});
  const [reajuste, setReajuste] = useState('0');
  const [gerador, setGerador] = useState(false);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);
  const rel = relacoes(periodos);

  const numeros = Object.fromEntries(periodos.map((p, i) => [p.id, i + 1]));
  const atualizar = (id, campo, v) => setPeriodos((ps) => ps.map((p) => (p.id === id ? { ...p, [campo]: v } : p)));
  const remover = (id) => setPeriodos((ps) => ps.filter((p) => p.id !== id));

  const ultimo = periodos.reduce((u, p) => (!u || (p.fim && p.fim > u.fim) ? p : u), null);
  const ultimoFim = ultimo?.fim;
  const podeContinuar = !ultimoFim || ultimoFim < MES_ATUAL;

  const proximo = (meses) => {
    const inicio = ultimoFim ? somarMeses(ultimoFim, 1) : minMes('2020-01', MES_ATUAL);
    const fim = meses === 'hoje' ? MES_ATUAL : minMes(somarMeses(inicio, meses - 1), MES_ATUAL);
    const base = num(ultimo?.renda);
    const renda = base > 0 ? String(Math.round(base * (1 + num(reajuste) / 100))) : '';
    const p = novoPeriodo({ inicio, fim, renda, tipo: ultimo?.tipo ?? 'clt', uf: ultimo?.uf ?? ufPadrao, gastos: { ...(ultimo?.gastos ?? {}) } });
    setPeriodos((ps) => [...ps, p]);
    setSelecionado(p.id);
  };

  const outroPeriodo = () => {
    const p = novoPeriodo({ inicio: MES_ATUAL, fim: MES_ATUAL, tipo: ultimo?.tipo ?? 'clt', uf: ultimo?.uf ?? ufPadrao });
    setPeriodos((ps) => [...ps, p]);
    setSelecionado(p.id);
  };

  // Cria um período cobrindo a lacuna antes de `p`, inserido na posição dele.
  const preencherLacuna = (p) => {
    const r = rel[p.id];
    const novo = novoPeriodo({
      inicio: somarMeses(r.fimAnterior, 1), fim: somarMeses(p.inicio, -1),
      tipo: r.anterior?.tipo ?? p.tipo, uf: r.anterior?.uf ?? p.uf, renda: '',
    });
    setPeriodos((ps) => {
      const i = ps.findIndex((x) => x.id === p.id);
      return [...ps.slice(0, i), novo, ...ps.slice(i)];
    });
    setSelecionado(novo.id);
  };

  const selecionar = (id) => {
    setSelecionado(id);
    document.getElementById(`cci-periodo-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="cci-periodos">
      <p className="cci-ajuda">
        Cada linha é um período com o mesmo valor bruto por mês (para um mês só, repita o mês no início e no fim). Meses
        fora dos períodos contam como sem trabalho; períodos sobrepostos são somados.
      </p>

      {exemplo && periodos.length > 0 && (
        <div className="cci-exemplo">
          <span><strong>Exemplo preenchido.</strong> Altere os períodos ou</span>
          <button type="button" className="cci-link" onClick={() => setPeriodos([])}>comece do zero</button>
        </div>
      )}

      <SeletorMoeda valoresEm={valoresEm} setValoresEm={setValoresEm} />

      <LinhaDoTempo periodos={periodos} numeros={numeros} selecionado={selecionado} onSelect={selecionar} />

      <div className="cci-tabela-periodos">
        {periodos.length > 0 && (
          <div className="cci-linha-periodo cci-cab" aria-hidden="true">
            <span>#</span><span>Do mês</span><span>Até o mês</span><span>Modalidade</span><span>Estado</span><span>Valor BRUTO mensal</span><span />
          </div>
        )}
        {periodos.map((p, i) => {
          const meses = contarMeses(p.inicio, p.fim);
          const totalGastos = somaGastos(p.gastos);
          const aberto = gastosAbertos[p.id];
          return (
            <div key={p.id} id={`cci-periodo-${p.id}`}
              className={'cci-item-periodo' + (selecionado === p.id ? ' cci-sel' : '') + (meses === 0 ? ' cci-invalido' : '')}
              onFocus={() => setSelecionado(p.id)}>
              <div className="cci-linha-periodo">
                <span className="cci-indice" style={{ background: CORES[p.tipo] }}>{i + 1}</span>
                <Mes value={p.inicio} max={MES_ATUAL} onChange={(v) => atualizar(p.id, 'inicio', v)} aria-label={`Início do período ${i + 1}`} />
                <Mes value={p.fim} max={MES_ATUAL} onChange={(v) => atualizar(p.id, 'fim', v)} aria-label={`Fim do período ${i + 1}`} />
                <SelectTipo curto value={p.tipo} onChange={(v) => atualizar(p.id, 'tipo', v)} aria-label={`Modalidade do período ${i + 1}`} />
                <SelectUF curto value={p.uf ?? P.UF_PADRAO} onChange={(v) => atualizar(p.id, 'uf', v)}
                  aria-label={`Estado onde morava no período ${i + 1}`} title="Estado onde você morava (define o ICMS do consumo)" />
                <Numero value={p.renda} onChange={(v) => atualizar(p.id, 'renda', v)} prefixo="R$"
                  aria-label={`${tipoInfo(p.tipo).rotuloRenda} do período ${i + 1}`} />
                <div className="cci-acoes-linha">
                  <button type="button" className={'cci-chip' + (totalGastos > 0 ? ' cci-chip-on' : '')}
                    aria-expanded={!!aberto} onClick={() => setGastosAbertos((g) => ({ ...g, [p.id]: !g[p.id] }))}>
                    {totalGastos > 0 ? `Gastos ${brl(totalGastos)}` : '+ Gastos'}
                  </button>
                  <button type="button" className="cci-remover" aria-label={`Remover período ${i + 1}`} onClick={() => remover(p.id)}>×</button>
                </div>
              </div>
              <div className="cci-meta-periodo">
                {meses > 0 ? duracao(meses) : 'o mês final deve ser igual ou posterior ao inicial'}
                {valoresEm === 'hoje' && num(p.renda) > 0 && <> · <Liquido renda={num(p.renda)} tipo={p.tipo} /></>}
                {p.id === ultimo?.id && meses > 0 && p.fim < MES_ATUAL && (
                  <> · <button type="button" className="cci-link" onClick={() => atualizar(p.id, 'fim', MES_ATUAL)}>estender até hoje</button></>
                )}
              </div>
              {rel[p.id]?.lacuna > 0 && (
                <div className="cci-alerta-periodo">
                  {duracao(rel[p.id].lacuna)} sem trabalho antes deste período (de {mesCurto(somarMeses(rel[p.id].fimAnterior, 1))} a{' '}
                  {mesCurto(somarMeses(p.inicio, -1))}).{' '}
                  <button type="button" className="cci-link" onClick={() => preencherLacuna(p)}>Preencher com um período</button>
                </div>
              )}
              {rel[p.id]?.sobrepoe.length > 0 && (
                <div className="cci-alerta-periodo cci-alerta-forte">
                  Sobrepõe {rel[p.id].sobrepoe.length === 1 ? 'o período' : 'os períodos'}{' '}
                  {rel[p.id].sobrepoe.map((id) => numeros[id]).join(', ')}: as rendas são somadas nos meses em comum
                  (correto para dois empregos ao mesmo tempo).
                </div>
              )}
              {aberto && (
                <GastosPeriodo gastos={p.gastos ?? {}} valoresEm={valoresEm} uf={p.uf ?? P.UF_PADRAO}
                  chave={meses > 0 ? p.fim : MES_ATUAL}
                  onChange={(id, v) => atualizar(p.id, 'gastos', { ...(p.gastos ?? {}), [id]: v })} />
              )}
            </div>
          );
        })}
        {periodos.length === 0 && (
          <p className="cci-vazio-lista">Nenhum período ainda. Use os botões abaixo, ou o gerador, para começar.</p>
        )}
      </div>

      <div className="cci-proximo">
        <span className="cci-rotulo">
          {!ultimoFim ? 'Primeiro período:' : podeContinuar ? `Próximo período (a partir de ${mesCurto(somarMeses(ultimoFim, 1))}):` : 'Adicionar:'}
        </span>
        {podeContinuar && (
          <>
            {[['+ 1 mês', 1], ['+ 6 meses', 6], ['+ 1 ano', 12], ['+ 2 anos', 24], ['até hoje', 'hoje']].map(([rotulo, m]) => (
              <button key={rotulo} type="button" className="cci-chip" onClick={() => proximo(m)}>{rotulo}</button>
            ))}
            <span className="cci-reajuste">
              com reajuste de
              <Numero value={reajuste} onChange={setReajuste} sufixo="%" aria-label="Reajuste sobre o último valor" />
            </span>
          </>
        )}
        <button type="button" className="cci-chip" onClick={outroPeriodo}>{podeContinuar ? '+ Período com outras datas' : '+ Período (outras datas ou emprego simultâneo)'}</button>
      </div>

      {gerador ? (
        <Gerador
          ultimoFim={ultimoFim}
          ufPadrao={ultimo?.uf ?? ufPadrao}
          primeiroInicio={periodos.reduce((m, p) => (p.inicio && (!m || p.inicio < m) ? p.inicio : m), null)}
          onFechar={() => setGerador(false)}
          onGerar={(lista, substituir) => {
            setPeriodos((ps) => (substituir ? lista : [...ps, ...lista]));
            setGerador(false);
          }}
        />
      ) : (
        <div className="cci-acoes">
          <button type="button" className="cci-botao-sec" onClick={() => setGerador(true)}>
            Gerar vários períodos com reajuste anual…
          </button>
          {periodos.length > 0 && (confirmarLimpar ? (
            <span className="cci-confirmar">
              Apagar os {periodos.length} períodos?
              <button type="button" className="cci-link cci-link-perigo" onClick={() => { setPeriodos([]); setConfirmarLimpar(false); }}>Sim, apagar</button>
              <button type="button" className="cci-link" onClick={() => setConfirmarLimpar(false)}>Cancelar</button>
            </span>
          ) : (
            <button type="button" className="cci-link" onClick={() => setConfirmarLimpar(true)}>Apagar todos os períodos</button>
          ))}
        </div>
      )}
    </div>
  );
}
