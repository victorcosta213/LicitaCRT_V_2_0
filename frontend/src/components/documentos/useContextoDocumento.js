import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useGc } from '../../context/GcContext'
import { listarUnidades, obterProcessoAdm } from '../../services/tramitacao'
import { dfdDoProcesso } from '../../services/documentos'

// O que os modelos precisam saber para preencher sozinhos: órgão, cidade, autor, unidade e processo.
// `numero` é o número do documento (o banco o define ao criar); `data` é a data do texto.
// `dfd`: a DFD do processo (ETP, pesquisa de preços e TR começam com o objeto e os itens dela);
// `origem`: ofício/despacho que originou a demanda (a DFD criada a partir dele já o cita).
export function useContextoDocumento({ processoId, numero, origem } = {}) {
  const { profile, nome, user } = useAuth()
  const { params } = useGc() || {}
  const [apoio, setApoio] = useState({ unidades: [], processo: null, dfd: null, pronto: false })

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const [unidades, proc, dfd] = await Promise.all([
        listarUnidades().catch(() => []),
        processoId ? obterProcessoAdm(processoId).catch(() => null) : null,
        processoId ? dfdDoProcesso(processoId).catch(() => null) : null,
      ])
      if (vivo) setApoio({ unidades, processo: proc?.processo || null, dfd, pronto: true })
    })()
    return () => { vivo = false }
  }, [processoId])

  const unidade = apoio.unidades.find((u) => u.id === profile?.unidade_id) || null
  return {
    pronto: apoio.pronto,
    ctx: {
      orgao: params?.orgao_nome || '',
      cidade: params?.orgao_cidade || '',
      numero: numero || '',
      data: new Date(),
      autor: { id: user?.id, nome: profile?.nome || nome || '' },
      unidade,
      processo: apoio.processo,
      dfd: apoio.dfd,
      origem: origem || '',
    },
  }
}
