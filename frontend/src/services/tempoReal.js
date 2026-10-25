import { supabase } from './supabase'

// Atualização automática: o Supabase Realtime avisa quando uma linha das tabelas muda
// (já filtrado pelas regras de acesso de quem está logado). O aviso só dispara uma
// nova leitura; nunca é usado como dado. Se o Realtime não estiver ativo no projeto,
// a leitura periódica (`intervaloReserva`) mantém a tela atualizada do mesmo jeito.

let contador = 0

// Junta rajadas de avisos numa única chamada e nunca roda duas leituras ao mesmo tempo:
// se chegar um aviso durante uma leitura, faz mais uma logo depois.
export function criarAtualizador(ler, { espera = 400 } = {}) {
  let temporizador = null
  let lendo = false
  let pendente = false
  let encerrado = false

  async function executar() {
    if (encerrado) return
    if (lendo) { pendente = true; return }
    lendo = true
    try {
      await ler()
    } catch (err) {
      console.error('[tempo real] falha ao atualizar', err)
    } finally {
      lendo = false
      if (pendente && !encerrado) { pendente = false; agendar() }
    }
  }

  function agendar() {
    if (encerrado) return
    clearTimeout(temporizador)
    temporizador = setTimeout(executar, espera)
  }

  return {
    agendar,
    agora: () => { clearTimeout(temporizador); return executar() },
    encerrar: () => { encerrado = true; clearTimeout(temporizador) },
  }
}

// Escuta mudanças em `tabelas` e chama `aoMudar()` a cada aviso. Devolve a função que cancela.
export function assinarMudancas(tabelas, aoMudar) {
  if (typeof supabase.channel !== 'function') return () => {}
  let canal
  try {
    contador += 1
    canal = supabase.channel(`mudancas-${contador}`)
    for (const table of tabelas) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table }, aoMudar)
    }
    canal.subscribe()
  } catch (err) {
    console.error('[tempo real] não foi possível assinar', err)
    return () => {}
  }
  return () => {
    try { supabase.removeChannel(canal) } catch { /* canal já encerrado */ }
  }
}
