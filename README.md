# Calculadora do Custo dos Impostos

Componente React autocontido. Todos os cálculos rodam no navegador.

## Rodar

```bash
npm install
npm run dev
```

## Estrutura

- `src/components/CalculadoraImpostos/` — o componente (JSX + CSS com prefixo `cci-`).
- `src/lib/calculo.js` — motor de cálculo, sem dependência de React.
- `src/lib/parametros.js` — alíquotas, tabelas e IPCA, cada um com fonte e vigência.

## Embutir em outro site

Copie `src/components/CalculadoraImpostos` e `src/lib` e use:

```jsx
import CalculadoraImpostos from './components/CalculadoraImpostos';

<CalculadoraImpostos />
```

As cores podem ser ajustadas redefinindo as variáveis `--cci-*` no seletor `.cci`.
