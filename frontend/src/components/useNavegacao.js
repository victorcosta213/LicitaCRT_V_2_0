import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGc } from '../context/GcContext'
import { alertasDoPerfil } from '../utils/contrato'
import { can, moduloDaRota, modulosFor } from '../utils/permissions'
import { useProcessosComPrazo } from './useProcessosComPrazo'

// Módulos do perfil, módulo/tela abertos e as contagens mostradas no menu
export function useNavegacao() {
  const { role, user } = useAuth()
  const { alertas = [], consolidados = [] } = useGc() || {}
  const { pathname } = useLocation()

  const modulos = useMemo(() => modulosFor(role), [role])
  const atual = useMemo(() => moduloDaRota(modulos, pathname), [modulos, pathname])

  // quem opera as licitações vê também os processos com prazo na mesa
  const processos = useProcessosComPrazo(can(role, 'processo.editar'))

  const contagens = useMemo(() => {
    const minhas = [...alertasDoPerfil(alertas, role, user?.id).filter((a) => a.severidade !== 'info'), ...processos]
    const atos = consolidados.filter((k) => k.c.portaria_status === 'aguardando_publicacao').length
      + consolidados.reduce((s, k) => s + k.b.os.filter((o) => !o.cancelado && o.status === 'aguardando_assinatura').length, 0)
    const criticas = minhas.filter((a) => a.severidade === 'danger').length
    return {
      tarefas: minhas.length,
      criticas,
      atos,
      porItem: { '/mesa': minhas.length, '/gabinete': atos },
      porModulo: { mesa: minhas.length, gabinete: atos },
    }
  }, [alertas, consolidados, role, user, processos])

  return { modulos, ...atual, contagens }
}

const lerTema = () => {
  try { return localStorage.getItem('app-theme') || 'light' } catch { return 'light' }
}

// Tema claro/escuro (lembrado neste navegador)
export function useTema() {
  const [tema, setTema] = useState(lerTema)
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', tema)
    try { localStorage.setItem('app-theme', tema) } catch { /* modo privado: só não lembra o tema */ }
  }, [tema])
  return [tema, () => setTema((t) => (t === 'dark' ? 'light' : 'dark'))]
}
