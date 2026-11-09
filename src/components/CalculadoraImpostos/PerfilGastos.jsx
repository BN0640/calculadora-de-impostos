// Seção de consumo comum aos três modos: quanto da renda líquida vira gasto do dia a
// dia e, opcionalmente, como esse gasto se divide entre as categorias (em %).
import { taxaCategoria } from '../../lib/calculo.js';
import * as P from '../../lib/parametros.js';
import { brl, pct, num, MES_ATUAL, Campo, Numero } from './ui.jsx';

const PADRAO = Math.round(P.CONSUMO.fracaoConsumoPadrao * 100);

export default function PerfilGastos({
  fracaoGasta, setFracaoGasta, divisao, setDivisao, usarDivisao, setUsarDivisao, liquidoMensal, uf, nivel,
}) {
  const valor = fracaoGasta === '' ? PADRAO : num(fracaoGasta);
  // Vazios entram com a média, como no cálculo.
  const preenchida = (c) => divisao[c.id] != null && divisao[c.id] !== '';
  const algumaPreenchida = P.CONSUMO.categorias.some(preenchida);
  const soma = P.CONSUMO.categorias.reduce((s, c) => s + (preenchida(c) ? num(divisao[c.id]) : c.pesoPadrao * 100), 0);

  return (
    <div className="cci-perfil-gastos">
      <div className="cci-campo">
        <span className="cci-rotulo">
          Parte da renda líquida gasta no dia a dia
          <span className="cci-dica" tabIndex={0} role="note" data-dica={`O restante é poupança, investimentos ou dívidas e não paga tributo de consumo. A média das famílias brasileiras fica perto de ${PADRAO}%; acima de 100% é gastar mais do que ganha (ex.: usando reservas).`}
            aria-label="Ajuda">?</span>
        </span>
        <div className="cci-faixa">
          <input type="range" min="0" max="120" step="1" value={Math.min(120, Math.max(0, valor))}
            onChange={(e) => setFracaoGasta(e.target.value)} aria-label="Percentual da renda líquida gasto"
            style={{ '--cci-preench': `${(Math.min(120, Math.max(0, valor)) / 120) * 100}%` }} />
          <Numero value={fracaoGasta} onChange={setFracaoGasta} sufixo="%" placeholder={String(PADRAO)} aria-label="Percentual gasto" />
        </div>
        <span className="cci-faixa-marcas" aria-hidden="true">
          <span style={{ left: 0 }}>0%</span>
          <span style={{ left: `calc(${(PADRAO / 120) * 100}% + ${9 - (PADRAO / 120) * 18}px)` }}>média {PADRAO}%</span>
          <span style={{ left: '100%' }}>120%</span>
        </span>
      </div>
      <p className="cci-ajuda">
        {liquidoMensal > 0 && <>≈ <strong>{brl((liquidoMensal * valor) / 100)}</strong> por mês, de {brl(liquidoMensal)} líquidos hoje.</>}
        {nivel === 'detalhado' && <> Vale para os períodos sem gastos informados em R$.</>}
        {valor !== PADRAO && <> <button type="button" className="cci-link" onClick={() => setFracaoGasta(String(PADRAO))}>voltar à média</button></>}
      </p>

      <label className="cci-check">
        <input type="checkbox" checked={usarDivisao} onChange={(e) => setUsarDivisao(e.target.checked)} />
        Dividir meus gastos por categoria (em %)
      </label>
      {usarDivisao && (
        <>
          <div className="cci-grade cci-grade-compacta">
            {P.CONSUMO.categorias.map((c) => (
              <Campo key={c.id} label={c.nome}
                ajuda={uf ? `~${pct(taxaCategoria(c.id, uf, MES_ATUAL))} em tributos` : c.nota}>
                <Numero value={divisao[c.id] ?? ''} onChange={(v) => setDivisao((d) => ({ ...d, [c.id]: v }))}
                  sufixo="%" placeholder={String(Math.round(c.pesoPadrao * 100))} />
              </Campo>
            ))}
          </div>
          <p className={'cci-ajuda' + (algumaPreenchida && Math.abs(soma - 100) > 0.5 ? ' cci-texto-alerta' : '')}>
            Campos vazios usam a média (o valor em cinza).
            {algumaPreenchida && (
              <> Soma: <strong>{Math.round(soma).toLocaleString('pt-BR')}%</strong>
                {Math.abs(soma - 100) > 0.5 && ' — ajustamos proporcionalmente para fechar 100%.'}</>
            )}
            {' '}
            {algumaPreenchida && (
              <button type="button" className="cci-link" onClick={() => setDivisao({})}>Limpar</button>
            )}
          </p>
        </>
      )}
    </div>
  );
}
