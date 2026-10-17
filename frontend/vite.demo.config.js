// Modo demonstração: o sistema completo com dados fictícios em memória, sem Supabase.
// Serve para apresentar telas e treinar perfis sem tocar no banco de produção.
//   npm run demo  →  http://127.0.0.1:5174/?perfil=gestor
// (perfis: gestor, fiscal, substituto, compras, financeiro, gabinete, admin, viewer, sair)
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config.js'

const clienteFalso = fileURLToPath(new URL('./demo/supabaseDemo.js', import.meta.url))

export default mergeConfig(base, defineConfig({
  plugins: [{
    name: 'licitacrt-demo',
    enforce: 'pre',
    resolveId: (id) => (id === '@supabase/supabase-js' ? clienteFalso : null),
  }],
  optimizeDeps: { exclude: ['@supabase/supabase-js'] },
  // cache próprio: não interfere num `npm run dev` aberto ao mesmo tempo
  cacheDir: 'node_modules/.vite-demo',
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
}))
