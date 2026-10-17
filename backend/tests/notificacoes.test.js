import { describe, expect, it } from 'vitest'
import { montarEmail } from '../supabase/functions/enviar-notificacoes/mensagem.js'

const notificacao = {
  id: 1, email: 'fiscal@crt08.gov.br', contrato_id: 'c-1',
  assunto: 'LicitaCRT — nova tarefa: Competência devolvida pela Gestão',
  mensagem: 'Existe uma nova tarefa aguardando sua atuação na plataforma LicitaCRT.\n\nContratação 001/2026 — ACME <Ltda>',
}

describe('e-mail de tarefa (§19)', () => {
  it('vai só para o destinatário, com link direto para a contratação', () => {
    const e = montarEmail(notificacao, { remetente: 'LicitaCRT <nao-responda@crt08.gov.br>', appUrl: 'https://licitacrt.app/' })
    expect(e.to).toEqual(['fiscal@crt08.gov.br'])
    expect(e.from).toBe('LicitaCRT <nao-responda@crt08.gov.br>')
    expect(e.subject).toBe(notificacao.assunto)
    expect(e.text).toContain('Acesse: https://licitacrt.app/contratos/c-1')
    expect(e.html).toContain('href="https://licitacrt.app/contratos/c-1"')
  })

  it('escapa o conteúdo no HTML', () => {
    const e = montarEmail(notificacao, { appUrl: 'https://x' })
    expect(e.html).toContain('ACME &lt;Ltda&gt;')
    expect(e.html).not.toContain('<Ltda>')
  })

  it('sem endereço da plataforma, envia só o texto da tarefa', () => {
    const e = montarEmail(notificacao, {})
    expect(e.text).not.toContain('Acesse:')
    expect(e.html).not.toContain('<a ')
  })
})
