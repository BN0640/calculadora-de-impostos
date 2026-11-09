// Benefícios recebidos do governo (Bolsa Família e aposentadoria do INSS): entram como
// valor negativo no total destinado ao governo, pois é dinheiro que volta para você.
import { contarMeses } from '../../lib/calculo.js';
import * as P from '../../lib/parametros.js';
import { brl, num, MES_ATUAL, duracao, somarMeses, Numero, Mes } from './ui.jsx';

export const TIPOS_BENEFICIO = [
  {
    id: 'bolsa', nome: 'Bolsa Família',
    rotulo: 'Minha família recebeu Bolsa Família',
    dica: 'Informe o valor que caía por mês, em R$ da época (desde 03/2023 o mínimo é R$ 600 por família). Vale também para Auxílio Brasil e programas anteriores.',
    padrao: () => ({ inicio: '2023-03', fim: MES_ATUAL, valor: '600' }),
  },
  {
    id: 'aposentadoria', nome: 'Aposentadoria',
    rotulo: 'Recebo (ou recebi) aposentadoria ou pensão do INSS',
    dica: 'Valor BRUTO mensal do benefício, em R$ da época. Somamos o 13º (abono anual) e calculamos o IR retido na fonte, que entra nos tributos.',
    padrao: () => ({ inicio: somarMeses(MES_ATUAL, -11), fim: MES_ATUAL, valor: String(P.SALARIO_MINIMO).replace('.', ',') }),
  },
];

let seq = 0;
export const novoBeneficio = (dados) => {
  const tipo = TIPOS_BENEFICIO.find((t) => t.id === (dados?.tipo ?? 'bolsa'));
  return { id: `b${++seq}`, tipo: tipo.id, ...tipo.padrao(), ...dados };
};

// Só os tipos marcados entram no cálculo.
export const beneficiosNumericos = (lista, usar) =>
  lista.filter((b) => usar[b.tipo]).map((b) => ({ ...b, tipo: b.tipo === 'aposentadoria' ? 'aposentadoria' : 'bolsa', valor: num(b.valor) }));

function Lista({ tipo, itens, atualizar, remover, adicionar }) {
  const total = itens.reduce((s, b) => s + num(b.valor) * contarMeses(b.inicio, b.fim), 0)
    * (tipo.id === 'aposentadoria' ? 13 / 12 : 1);
  return (
    <div className="cci-beneficio-lista">
      {itens.map((b, i) => {
        const meses = contarMeses(b.inicio, b.fim);
        return (
          <div key={b.id} className="cci-beneficio-linha">
            <span>De</span>
            <Mes value={b.inicio} max={MES_ATUAL} onChange={(v) => atualizar(b.id, 'inicio', v)} aria-label={`Início: ${tipo.nome} ${i + 1}`} />
            <span>até</span>
            <Mes value={b.fim} max={MES_ATUAL} onChange={(v) => atualizar(b.id, 'fim', v)} aria-label={`Fim: ${tipo.nome} ${i + 1}`} />
            <Numero value={b.valor} onChange={(v) => atualizar(b.id, 'valor', v)} prefixo="R$" sufixo="/mês"
              aria-label={`Valor mensal: ${tipo.nome} ${i + 1}`} />
            <span className="cci-ajuda">{meses > 0 ? duracao(meses) : 'datas inválidas'}</span>
            <button type="button" className="cci-remover" aria-label={`Remover ${tipo.nome} ${i + 1}`} onClick={() => remover(b.id)}>×</button>
          </div>
        );
      })}
      <p className="cci-ajuda">
        <button type="button" className="cci-link" onClick={adicionar}>+ outro período (valor diferente)</button>
        {total > 0 && <> · Recebido: <strong className="cci-negativo">−{brl(total)}</strong> (R$ da época{tipo.id === 'aposentadoria' ? ', com 13º' : ''}), abatido do total destinado ao governo.</>}
      </p>
    </div>
  );
}

export default function Beneficios({ usar, setUsar, beneficios, setBeneficios }) {
  const atualizar = (id, campo, v) => setBeneficios((bs) => bs.map((b) => (b.id === id ? { ...b, [campo]: v } : b)));
  const remover = (id) => setBeneficios((bs) => bs.filter((b) => b.id !== id));

  const ligar = (tipo, v) => {
    setUsar((u) => ({ ...u, [tipo]: v }));
    if (v && !beneficios.some((b) => b.tipo === tipo)) setBeneficios((bs) => [...bs, novoBeneficio({ tipo })]);
  };
  const adicionar = (tipo) => {
    const ultimo = beneficios.filter((b) => b.tipo === tipo).pop();
    setBeneficios((bs) => [...bs, novoBeneficio({ tipo, ...(ultimo ? { inicio: ultimo.inicio, fim: ultimo.fim, valor: ultimo.valor } : {}) })]);
  };

  return (
    <div className="cci-beneficios">
      <span className="cci-rotulo">Benefícios recebidos do governo <small className="cci-ajuda-inline">(opcional, abatem do total)</small></span>
      {TIPOS_BENEFICIO.map((t) => (
        <div key={t.id} className="cci-beneficio">
          <label className="cci-check">
            <input type="checkbox" checked={!!usar[t.id]} onChange={(e) => ligar(t.id, e.target.checked)} />
            <span>
              {t.rotulo}
              <span className="cci-dica" tabIndex={0} role="note" aria-label={t.dica} data-dica={t.dica}>?</span>
            </span>
          </label>
          {usar[t.id] && (
            <Lista tipo={t} itens={beneficios.filter((b) => b.tipo === t.id)} atualizar={atualizar} remover={remover}
              adicionar={() => adicionar(t.id)} />
          )}
        </div>
      ))}
    </div>
  );
}
