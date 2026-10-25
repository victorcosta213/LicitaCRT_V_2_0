import { useEffect, useRef } from 'react'
import { assinarMudancas, criarAtualizador } from '../services/tempoReal'

// Reserva caso o Realtime esteja desligado ou a conexão caia: relê de tempos em tempos
// (só com a aba à vista) e sempre que a pessoa volta para a aba.
export const INTERVALO_RESERVA = 60000

// Mantém uma tela atualizada sozinha: relê quando alguma das `tabelas` muda, ao voltar
// para a aba e a cada `intervaloReserva`. `ler` deve atualizar os dados sem piscar a tela.
// `ativo=false` desliga tudo (ex.: ninguém logado).
export function useAtualizacaoAutomatica(tabelas, ler, { ativo = true, intervaloReserva = INTERVALO_RESERVA } = {}) {
  const lerRef = useRef(ler)
  useEffect(() => { lerRef.current = ler }, [ler])
  const chave = tabelas.join('|')

  useEffect(() => {
    if (!ativo) return undefined
    const atualizador = criarAtualizador(() => lerRef.current())
    const cancelar = assinarMudancas(chave.split('|'), atualizador.agendar)
    const aoVoltar = () => { if (document.visibilityState === 'visible') atualizador.agendar() }
    const reserva = setInterval(aoVoltar, intervaloReserva)
    window.addEventListener('focus', aoVoltar)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      atualizador.encerrar()
      cancelar()
      clearInterval(reserva)
      window.removeEventListener('focus', aoVoltar)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [chave, ativo, intervaloReserva])
}
