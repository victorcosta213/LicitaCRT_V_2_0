import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // cada banco em memória leva alguns segundos para subir e aplicar as migrations
    testTimeout: 60000,
    hookTimeout: 60000,
  },
})
