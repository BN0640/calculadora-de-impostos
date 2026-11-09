// Formatação e campos básicos compartilhados pela calculadora.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { liquidoMensal } from '../../lib/calculo.js';
import * as P from '../../lib/parametros.js';

export const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const pct = (v) => (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
// Aceita "5.000", "5000,50" e "2.5".
export const num = (v) => {
  const s = String(v ?? '').trim();
  const normal = s.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = parseFloat(normal);
  return Number.isFinite(n) ? n : 0;
};

export const tipoInfo = (tipo) => P.TIPOS_TRABALHO.find((t) => t.id === tipo) ?? P.TIPOS_TRABALHO[0];

const hoje = new Date();
export const MES_ATUAL = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

// "2024-03" + n meses -> "AAAA-MM"
export const somarMeses = (s, n) => {
  const [a, m] = s.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
export const indiceMes = (s) => {
  const [a, m] = String(s).split('-').map(Number);
  return a * 12 + (m - 1);
};
export const mesCurto = (s) => {
  if (!s) return '';
  const [a, m] = String(s).split('-');
  return `${m}/${a}`;
};

export const duracao = (meses) => {
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  const partes = [];
  if (a) partes.push(`${a} ${a === 1 ? 'ano' : 'anos'}`);
  if (m) partes.push(`${m} ${m === 1 ? 'mês' : 'meses'}`);
  return partes.join(' e ') || '0 meses';
};

// Mostra o líquido estimado ao lado de um valor bruto, para conferir com o contracheque.
export function Liquido({ renda, tipo }) {
  if (renda <= 0 || tipo === 'outro') return null;
  return (
    <span className="cci-liquido">
      ≈ {brl(liquidoMensal(renda, tipo))} líquido/mês{tipo === 'pj' ? ' (antes dos custos da empresa)' : ''}
    </span>
  );
}

// Máscaras de digitação. Os valores ficam guardados como texto formatado
// ("5.000", "85", "2,5"), que num() converte de volta para número.
const MASCARAS = {
  moeda: { casas: 2, milhar: true, maxInt: 9, modo: 'decimal' },
  pct: { casas: 1, milhar: false, maxInt: 3, modo: 'decimal' },
  inteiro: { casas: 0, milhar: false, maxInt: 3, modo: 'numeric' },
  ano: { casas: 0, milhar: false, maxInt: 4, modo: 'numeric' },
};
const agrupar = (d) => d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function mascarar(bruto, tipo) {
  const m = MASCARAS[tipo];
  let s = String(bruto ?? '');
  // Sem milhar, o ponto é separador decimal ("2.5" -> "2,5"). Com milhar, um valor
  // canônico como "5000.5" (de arquivos antigos) também é aceito.
  if (!m.milhar || /^\d+\.\d{1,2}$/.test(s)) s = s.replace('.', ',');
  const virgula = m.casas > 0 && s.includes(',');
  const [antes, depois = ''] = s.split(',');
  let int = antes.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, m.maxInt);
  const dec = depois.replace(/\D/g, '').slice(0, m.casas);
  if (virgula && !int) int = '0';
  return (m.milhar ? agrupar(int) : int) + (virgula ? ',' + dec : '');
}
// Quantos caracteres "de conteúdo" (dígitos e vírgula) há antes de uma posição.
const contarSignificativos = (s, ate) => (s.slice(0, ate).match(/[\d,]/g) ?? []).length;
const posicaoApos = (s, n) => {
  if (n <= 0) return 0;
  let k = 0;
  for (let i = 0; i < s.length; i++) if (/[\d,]/.test(s[i]) && ++k === n) return i + 1;
  return s.length;
};

export function Campo({ label, ajuda, dica, children }) {
  return (
    <label className="cci-campo">
      <span className="cci-rotulo">
        {label}
        {dica && <span className="cci-dica" tabIndex={0} role="note" aria-label={dica} data-dica={dica}>?</span>}
      </span>
      <span className="cci-campo-corpo">
        {children}
        {ajuda && <span className="cci-ajuda">{ajuda}</span>}
      </span>
    </label>
  );
}

// Campo numérico com máscara. Sem `mascara`, deduz pelo afixo: R$ = moeda, % = percentual.
export function Numero({ value, onChange, prefixo, sufixo, mascara, ...rest }) {
  const tipo = mascara ?? (prefixo === 'R$' ? 'moeda' : sufixo?.startsWith('%') ? 'pct' : 'inteiro');
  const ref = useRef(null);
  const cursor = useRef(null);
  const exibido = mascarar(value, tipo);

  useLayoutEffect(() => {
    if (cursor.current === null || !ref.current) return;
    const pos = posicaoApos(ref.current.value, cursor.current);
    cursor.current = null;
    ref.current.setSelectionRange(pos, pos);
  });

  const mudar = (e) => {
    let bruto = e.target.value;
    let pos = e.target.selectionStart;
    // Apagar só o ponto de milhar não mudaria nada: apaga o dígito vizinho.
    const tipoInput = e.nativeEvent?.inputType;
    if (mascarar(bruto, tipo) === exibido && bruto.length < exibido.length) {
      if (tipoInput === 'deleteContentBackward' && pos > 0) { bruto = bruto.slice(0, pos - 1) + bruto.slice(pos); pos -= 1; }
      if (tipoInput === 'deleteContentForward') bruto = bruto.slice(0, pos) + bruto.slice(pos + 1);
    }
    const novo = mascarar(bruto, tipo);
    if (document.activeElement === e.target) cursor.current = contarSignificativos(tipo === 'moeda' ? bruto : bruto.replace('.', ','), pos);
    onChange(novo);
  };

  return (
    <span className={'cci-input' + (rest.disabled ? ' cci-desab' : '')}>
      {prefixo && <span className="cci-afixo">{prefixo}</span>}
      <input ref={ref} type="text" inputMode={MASCARAS[tipo].modo} autoComplete="off" value={exibido} onChange={mudar} {...rest} />
      {sufixo && <span className="cci-afixo">{sufixo}</span>}
    </span>
  );
}

// Mês no formato MM/AAAA, digitado com máscara. Guarda "AAAA-MM" quando completo e válido.
const paraTexto = (iso) => (iso ? mesCurto(iso) : '');
export function Mes({ value, onChange, max, ...rest }) {
  const [texto, setTexto] = useState(() => paraTexto(value));
  const [editando, setEditando] = useState(false);
  useEffect(() => { if (!editando) setTexto(paraTexto(value)); }, [value, editando]);

  const d = texto.replace(/\D/g, '');
  const mesNum = Number(d.slice(0, 2));
  const anoNum = Number(d.slice(2));
  const invalido = d.length === 6 && (mesNum < 1 || mesNum > 12 || anoNum < 1950 || (max && `${d.slice(2)}-${d.slice(0, 2)}` > max));

  const mudar = (e) => {
    const dig = e.target.value.replace(/\D/g, '').slice(0, 6);
    setTexto(dig.length > 2 ? `${dig.slice(0, 2)}/${dig.slice(2)}` : dig);
    if (dig.length === 6) {
      const m = Number(dig.slice(0, 2));
      const iso = `${dig.slice(2)}-${dig.slice(0, 2)}`;
      if (m >= 1 && m <= 12 && Number(dig.slice(2)) >= 1950 && (!max || iso <= max)) onChange(iso);
    }
  };

  return (
    <span className={'cci-input' + (invalido ? ' cci-input-invalido' : '')}>
      <input type="text" inputMode="numeric" placeholder="mm/aaaa" autoComplete="off" value={texto}
        aria-invalid={invalido || undefined} title={invalido ? `Mês inválido${max ? ` (até ${mesCurto(max)})` : ''}` : undefined}
        onFocus={() => setEditando(true)} onBlur={() => setEditando(false)} onChange={mudar} {...rest} />
    </span>
  );
}

// Escolha da moeda em que os valores são informados.
export function SeletorMoeda({ valoresEm, setValoresEm }) {
  return (
    <div className="cci-segmentado" role="radiogroup" aria-label="Moeda dos valores informados">
      <span className="cci-rotulo">Valores em:</span>
      <button type="button" role="radio" aria-checked={valoresEm === 'epoca'} className={valoresEm === 'epoca' ? 'cci-ativo' : ''}
        onClick={() => setValoresEm('epoca')}>R$ da época <small>(como no contracheque)</small></button>
      <button type="button" role="radio" aria-checked={valoresEm === 'hoje'} className={valoresEm === 'hoje' ? 'cci-ativo' : ''}
        onClick={() => setValoresEm('hoje')}>R$ de hoje <small>(já corrigidos)</small></button>
    </div>
  );
}

const UFS = Object.entries(P.ICMS_UF.ufs).sort((a, b) => a[1].nome.localeCompare(b[1].nome));

export function SelectUF({ value, onChange, curto, ...rest }) {
  return (
    <select className="cci-select" value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {UFS.map(([sigla, { nome }]) => (
        <option key={sigla} value={sigla}>{curto ? sigla : `${nome} (${sigla})`}</option>
      ))}
    </select>
  );
}

export function SelectTipo({ value, onChange, curto, ...rest }) {
  return (
    <select className="cci-select" value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {P.TIPOS_TRABALHO.map((t) => (
        <option key={t.id} value={t.id}>{curto ? t.curto : t.nome}</option>
      ))}
    </select>
  );
}
