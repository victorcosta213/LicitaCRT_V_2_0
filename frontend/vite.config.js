import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    historyApiFallback: true,
  },
  preview: {
    historyApiFallback: true,
  },
  build: {
    // o maior arquivo é a biblioteca de planilhas (~900 kB), baixada só nas telas
    // de importação/exportação; a abertura do sistema fica em ~600 kB
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // React e Supabase (usados em toda tela) num arquivo estável, que o navegador
        // mantém em cache entre deploys. Planilha, PDF e gráficos ficam com as telas
        // que os usam (carregadas sob demanda).
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (/node_modules[\\/]@supabase[\\/]/.test(id)) return 'supabase'
          return undefined
        },
      },
    },
  },
})
