// O sistema é usado no Brasil: datas e "hoje" são avaliados no fuso de Brasília.
process.env.TZ = 'America/Sao_Paulo'

import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  if (typeof document !== 'undefined') cleanup()
})

// Rede bloqueada: nenhum teste pode alcançar o Supabase (ou qualquer serviço) real.
const fetchOriginal = globalThis.fetch
globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input?.url || String(input)
  if (/^https?:/i.test(url)) return Promise.reject(new Error(`Rede bloqueada nos testes: ${url}`))
  return fetchOriginal(input, init)
}
