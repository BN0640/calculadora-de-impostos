// Editor do modo Personalizado: cada emprego com ano de entrada e saída, modalidade,
// estado e o salário aproximado no início e no fim, sem detalhar mês a mês.
import { useState } from 'react';
import { contarMeses, empregosParaPeriodos } from '../../lib/calculo.js';
import * as P from '../../lib/parametros.js';
import {
  brl, pct, num, tipoInfo, MES_ATUAL, duracao, Liquido, Campo, Numero, SelectTipo, SelectUF, SeletorMoeda,
} from './ui.jsx';
import { LinhaDoTempo } from './EditorPeriodos.jsx';

let seq = 0;
export const novoEmprego = (dados) => ({
  id: `e${++seq}`, nome: '', inicio: '', fim: '', atual: false, tipo: 'clt', uf: P.UF_PADRAO,
  rendaInicial: '', rendaFinal: '', ...dados,
});

const ANO_ATUAL = Number(MES_ATUAL.slice(0, 4));

// Converte para o formato numérico que o motor espera.
export const empregosNumericos = (empregos) =>
  empregos.map((e) => ({ ...e, rendaInicial: num(e.rendaInicial), rendaFinal: num(e.rendaFinal) }));

export function errosEmpregos(empregos) {
  for (const [i, e] of empregos.entries()) {
    const de = Number(e.inicio);
    const ate = e.atual ? ANO_ATUAL : Number(e.fim);
    if (!de) return `Emprego ${i + 1}: informe o ano em que começou.`;
    if (de < 1950 || de > ANO_ATUAL) return `Emprego ${i + 1}: o ano de início deve estar entre 1950 e ${ANO_ATUAL}.`;
    if (!e.atual && !e.fim) return `Emprego ${i + 1}: informe o ano de saída ou marque "trabalho aqui atualmente".`;
    if (ate < de || ate > ANO_ATUAL) return `Emprego ${i + 1}: o ano de saída deve estar entre ${de} e ${ANO_ATUAL}.`;
    if (num(e.rendaInicial) <= 0) return `Emprego ${i + 1}: informe o salário bruto no início.`;
  }
  return empregos.length ? null : 'Adicione ao menos um emprego.';
}

export default function EditorEmpregos({ empregos, setEmpregos, valoresEm, setValoresEm, onLevarParaDetalhado, exemplo, ufPadrao = P.UF_PADRAO }) {
  const [selecionado, setSelecionado] = useState(null);
  const atualizar = (id, campo, v) => setEmpregos((es) => es.map((e) => (e.id === id ? { ...e, [campo]: v } : e)));

  // Linha do tempo: um segmento por emprego, já com as trocas no meio do ano.
  const periodos = empregosParaPeriodos(empregosNumericos(empregos), MES_ATUAL);
  const segmentos = empregos.map((e, i) => {
    const ps = periodos.filter((p) => p.emprego === e.id);
    if (!ps.length) return null;
    return { id: e.id, inicio: ps[0].inicio, fim: ps[ps.length - 1].fim, tipo: e.tipo, rotulo: e.nome || `Emprego ${i + 1}` };
  }).filter(Boolean);
  const numeros = Object.fromEntries(empregos.map((e, i) => [e.id, i + 1]));

  const adicionar = () => {
    const ultimo = empregos[empregos.length - 1];
    const inicio = ultimo ? String(ultimo.atual ? ANO_ATUAL : Number(ultimo.fim) || ANO_ATUAL) : String(ANO_ATUAL - 5);
    const e = novoEmprego({
      inicio, atual: true, tipo: ultimo?.tipo ?? 'clt', uf: ultimo?.uf ?? ufPadrao,
      rendaInicial: ultimo ? String(num(ultimo.rendaFinal) || num(ultimo.rendaInicial) || '') : '',
    });
    // O emprego anterior deixa de ser o atual.
    setEmpregos((es) => [...es.map((x) => (x.atual ? { ...x, atual: false, fim: inicio } : x)), e]);
    setSelecionado(e.id);
  };

  return (
    <div className="cci-periodos">
      <p className="cci-ajuda">
        Um bloco por emprego, com os anos de entrada e saída e o salário bruto aproximado. Os anos intermediários são
        estimados; anos sem emprego contam como sem trabalho.
      </p>

      {exemplo && empregos.length > 0 && (
        <div className="cci-exemplo">
          <span><strong>Exemplo preenchido.</strong> Altere os empregos ou</span>
          <button type="button" className="cci-link" onClick={() => setEmpregos([])}>comece do zero</button>
        </div>
      )}

      <SeletorMoeda valoresEm={valoresEm} setValoresEm={setValoresEm} />

      <LinhaDoTempo periodos={segmentos} numeros={numeros} selecionado={selecionado} onSelect={setSelecionado} />

      <div className="cci-tabela-periodos">
        {empregos.map((e, i) => {
          const ps = periodos.filter((p) => p.emprego === e.id);
          const meses = ps.reduce((s, p) => s + contarMeses(p.inicio, p.fim), 0);
          const r0 = num(e.rendaInicial);
          const r1 = num(e.rendaFinal) || r0;
          const anos = ps.length > 1 ? ps.length - 1 : 0;
          const taxa = anos && r0 > 0 ? Math.pow(r1 / r0, 1 / anos) - 1 : 0;
          return (
            <div key={e.id} className={'cci-item-periodo' + (selecionado === e.id ? ' cci-sel' : '')} onFocus={() => setSelecionado(e.id)}>
              <div className="cci-emprego-topo">
                <span className="cci-indice">{i + 1}</span>
                <input className="cci-nome-emprego" value={e.nome} placeholder={`Emprego ${i + 1} (nome opcional)`}
                  onChange={(ev) => atualizar(e.id, 'nome', ev.target.value)} aria-label={`Nome do emprego ${i + 1}`} />
                <button type="button" className="cci-remover" aria-label={`Remover emprego ${i + 1}`}
                  onClick={() => setEmpregos((es) => es.filter((x) => x.id !== e.id))}>×</button>
              </div>
              <div className="cci-grade cci-grade-emprego">
                <Campo label="Entrou em">
                  <Numero mascara="ano" value={e.inicio} onChange={(v) => atualizar(e.id, 'inicio', v)} placeholder="aaaa" />
                </Campo>
                <Campo label="Saiu em">
                  <Numero mascara="ano" value={e.atual ? '' : e.fim} disabled={e.atual}
                    onChange={(v) => atualizar(e.id, 'fim', v)} placeholder={e.atual ? 'atual' : 'aaaa'} />
                </Campo>
                <Campo label="Modalidade"><SelectTipo value={e.tipo} onChange={(v) => atualizar(e.id, 'tipo', v)} /></Campo>
                <Campo label="Estado"><SelectUF value={e.uf} onChange={(v) => atualizar(e.id, 'uf', v)} /></Campo>
                <Campo label="Salário BRUTO ao entrar" dica={tipoInfo(e.tipo).ajudaRenda}>
                  <Numero value={e.rendaInicial} onChange={(v) => atualizar(e.id, 'rendaInicial', v)} prefixo="R$" />
                </Campo>
                <Campo label={e.atual ? 'Salário BRUTO hoje' : 'Salário BRUTO ao sair'} dica="Opcional; sem ele, o salário fica igual ao de entrada.">
                  <Numero value={e.rendaFinal} onChange={(v) => atualizar(e.id, 'rendaFinal', v)} prefixo="R$" placeholder={e.rendaInicial || 'opcional'} />
                </Campo>
              </div>
              <div className="cci-meta-emprego">
                <label className="cci-check">
                  <input type="checkbox" checked={!!e.atual} onChange={(ev) => atualizar(e.id, 'atual', ev.target.checked)} />
                  Trabalho aqui atualmente
                </label>
                {meses > 0 && (
                  <span className="cci-ajuda">
                    {duracao(meses)}
                    {r0 > 0 && <> · {brl(r0)}{r1 !== r0 && <> → {brl(r1)} (≈ {pct(taxa)} ao ano)</>}</>}
                    {valoresEm === 'hoje' && r1 > 0 && <> · <Liquido renda={r1} tipo={e.tipo} /></>}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {empregos.length === 0 && <p className="cci-vazio-lista">Nenhum emprego ainda. Clique em "Adicionar emprego" para começar.</p>}
      </div>

      <div className="cci-acoes">
        <button type="button" className="cci-botao" onClick={adicionar}>+ Adicionar emprego</button>
        {periodos.length > 0 && (
          <button type="button" className="cci-botao-sec" onClick={() => onLevarParaDetalhado(periodos)}
            title="Cria um período por ano de cada emprego no modo Detalhado, para você ajustar mês a mês">
            Refinar no modo Detalhado (mês a mês)
          </button>
        )}
      </div>
    </div>
  );
}
