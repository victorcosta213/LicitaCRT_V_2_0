// Monta o e-mail de uma notificação da fila gc_notificacoes (§19).
// Módulo puro: usado pela Edge Function e pelos testes.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))

export function montarEmail(n, { remetente, appUrl } = {}) {
  const link = appUrl && n.contrato_id ? `${appUrl.replace(/\/+$/, '')}/contratos/${n.contrato_id}` : appUrl || ''
  const texto = `${n.mensagem}${link ? `\n\nAcesse: ${link}` : ''}\n\n— LicitaCRT (mensagem automática, não responda)`
  const html = `<p>${esc(n.mensagem).replace(/\n/g, '<br>')}</p>`
    + (link ? `<p><a href="${esc(link)}">Abrir na plataforma</a></p>` : '')
    + '<p style="color:#888;font-size:12px">LicitaCRT — mensagem automática, não responda.</p>'
  return { from: remetente, to: [n.email], subject: n.assunto, text: texto, html }
}

// Máximo de tentativas antes de desistir de uma notificação
export const MAX_TENTATIVAS = 5
