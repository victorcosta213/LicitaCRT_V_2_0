import { describe, expect, it, vi } from 'vitest'
import { resetarSenha } from '../supabase/functions/resetar-senha/logica.js'

const UID = '00000000-0000-0000-0000-000000000042'

// Dependências de um administrador autenticado, com a senha padrão configurada
const deps = (extra = {}) => ({
  chamador: vi.fn().mockResolvedValue({ id: 'admin' }),
  papel: vi.fn().mockResolvedValue('admin'),
  senhaPadrao: 'Padrao#Teste1',
  atualizarSenha: vi.fn().mockResolvedValue({}),
  marcarProvisoria: vi.fn().mockResolvedValue({}),
  ...extra,
})

describe('redefinição de senha pelo administrador', () => {
  it('troca para a senha padrão e marca como provisória, nesta ordem', async () => {
    const d = deps()
    const r = await resetarSenha({ metodo: 'POST', uid: UID }, d)
    expect(r).toEqual({ status: 200, corpo: { ok: true } })
    expect(d.atualizarSenha).toHaveBeenCalledWith(UID, 'Padrao#Teste1')
    expect(d.marcarProvisoria).toHaveBeenCalledWith(UID)
    expect(d.atualizarSenha.mock.invocationCallOrder[0]).toBeLessThan(d.marcarProvisoria.mock.invocationCallOrder[0])
  })

  it('só aceita POST', async () => {
    const d = deps()
    expect((await resetarSenha({ metodo: 'GET', uid: UID }, d)).status).toBe(405)
    expect(d.atualizarSenha).not.toHaveBeenCalled()
  })

  it('sem login, recusa (401) e não troca nada', async () => {
    const d = deps({ chamador: vi.fn().mockResolvedValue(null) })
    expect((await resetarSenha({ metodo: 'POST', uid: UID }, d)).status).toBe(401)
    expect(d.atualizarSenha).not.toHaveBeenCalled()
  })

  it.each(['gestor', 'compras', 'fiscal', 'financeiro', 'gabinete', 'viewer', 'sem_acesso', null])(
    'o perfil %s não pode redefinir senhas (403)', async (papel) => {
      const d = deps({ papel: vi.fn().mockResolvedValue(papel) })
      expect((await resetarSenha({ metodo: 'POST', uid: UID }, d)).status).toBe(403)
      expect(d.atualizarSenha).not.toHaveBeenCalled()
      expect(d.marcarProvisoria).not.toHaveBeenCalled()
    })

  it.each([undefined, '', 'abc', 123, "00000000-0000-0000-0000-000000000042'; drop table x"])(
    'identificador inválido (%s) é recusado (400)', async (uid) => {
      const d = deps()
      expect((await resetarSenha({ metodo: 'POST', uid }, d)).status).toBe(400)
      expect(d.atualizarSenha).not.toHaveBeenCalled()
    })

  it.each([undefined, '', 'curta1'])('sem a senha padrão configurada (%s), falha sem revelar nada (500)', async (senhaPadrao) => {
    const d = deps({ senhaPadrao })
    const r = await resetarSenha({ metodo: 'POST', uid: UID }, d)
    expect(r.status).toBe(500)
    expect(JSON.stringify(r.corpo)).not.toContain('curta1')
    expect(d.atualizarSenha).not.toHaveBeenCalled()
  })

  it('a resposta nunca contém a senha padrão', async () => {
    const ok = await resetarSenha({ metodo: 'POST', uid: UID }, deps())
    const falha = await resetarSenha({ metodo: 'POST', uid: UID }, deps({ atualizarSenha: vi.fn().mockResolvedValue({ erro: true }) }))
    expect(JSON.stringify(ok)).not.toContain('Padrao#Teste1')
    expect(JSON.stringify(falha)).not.toContain('Padrao#Teste1')
  })

  it('se o Auth recusar a troca, não marca como provisória', async () => {
    const d = deps({ atualizarSenha: vi.fn().mockResolvedValue({ erro: true }) })
    expect((await resetarSenha({ metodo: 'POST', uid: UID }, d)).status).toBe(400)
    expect(d.marcarProvisoria).not.toHaveBeenCalled()
  })

  it('se a marcação falhar, avisa para repetir (a senha já foi trocada)', async () => {
    const d = deps({ marcarProvisoria: vi.fn().mockResolvedValue({ erro: true }) })
    const r = await resetarSenha({ metodo: 'POST', uid: UID }, d)
    expect(r.status).toBe(500)
    expect(r.corpo.erro).toMatch(/redefinir de novo/)
  })
})
