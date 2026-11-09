import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Escuta em todas as interfaces para acesso pela rede local.
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
