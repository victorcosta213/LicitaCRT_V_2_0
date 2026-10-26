// Regra da redefinição de senha pelo administrador, separada do Deno para ser testada.
// `deps` entrega o que depende do ambiente: quem chamou, o papel dele, a senha padrão
// (segredo SENHA_PADRAO) e as duas operações que gravam.

export const SENHA_MINIMA = 8
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const resposta = (status, corpo) => ({ status, corpo })

export async function resetarSenha({ metodo, uid }, deps) {
  if (metodo !== 'POST') return resposta(405, { erro: 'Método não permitido.' })

  const chamador = await deps.chamador()
  if (!chamador) return resposta(401, { erro: 'Faça login para continuar.' })
  if ((await deps.papel()) !== 'admin') return resposta(403, { erro: 'Somente o administrador pode redefinir senhas.' })

  if (typeof uid !== 'string' || !UUID.test(uid)) return resposta(400, { erro: 'Usuário inválido.' })

  const senha = deps.senhaPadrao
  if (typeof senha !== 'string' || senha.length < SENHA_MINIMA) {
    // não revela o valor nem o tamanho esperado
    return resposta(500, { erro: 'A senha padrão não está configurada no servidor (segredo SENHA_PADRAO).' })
  }

  const trocou = await deps.atualizarSenha(uid, senha)
  if (trocou?.erro) return resposta(400, { erro: 'Não foi possível redefinir a senha deste usuário.' })

  const marcou = await deps.marcarProvisoria(uid)
  if (marcou?.erro) {
    return resposta(500, { erro: 'A senha foi redefinida, mas não foi possível exigir a troca no primeiro acesso. Tente redefinir de novo.' })
  }
  return resposta(200, { ok: true })
}
