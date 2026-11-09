import CalculadoraImpostos from './components/CalculadoraImpostos';

// Página de demonstração: apenas hospeda o componente, que é autocontido
// (estilos com prefixo próprio) para ser embutido em outro site.
export default function App() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <CalculadoraImpostos />
    </main>
  );
}
