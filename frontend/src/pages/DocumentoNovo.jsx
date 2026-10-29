import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Empty, PageHeader } from '../components/gc/ui'
import EnviarArquivoModal from '../components/documentos/EnviarArquivoModal'
import { useContextoDocumento } from '../components/documentos/useContextoDocumento'
import { agruparPorCategoria, modeloPorCodigo, modelosDoPerfil, podeUsarModelo } from '../modelos/catalogo'
import { valoresIniciais } from '../modelos/base'
import { criarDocumento, enviarArquivo, mensagemErroDocumento, obterDocumento } from '../services/documentos'
import { marcarItem } from '../services/solicitacoes'
import { showError, showSuccess } from '../utils/alerts'
import './documentos.css'

// Escolha do modelo. Com ?modelo=codigo (e, se for o caso, ?processo=id) cria o rascunho direto.
// ?origem=texto: ofício/despacho que originou a demanda (a DFD já o cita). ?arquivo=1 abre o envio de arquivo;
// com ?item=chave, o arquivo enviado já é registrado como juntado nesse item do roteiro do processo.
export default function DocumentoNovo() {
  const { role, user } = useAuth()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const processoId = sp.get('processo') || ''
  const modeloPedido = modeloPorCodigo(sp.get('modelo'))
  const item = sp.get('item') || ''
  const { ctx, pronto } = useContextoDocumento({ processoId, origem: sp.get('origem') || '' })
  const [arquivo, setArquivo] = useState(sp.get('arquivo') === '1')
  const [busca, setBusca] = useState('')
  const [criando, setCriando] = useState(false)
  const automatico = useRef(false)

  const disponiveis = useMemo(() => modelosDoPerfil(role), [role])
  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const filtrados = q ? disponiveis.filter((m) => `${m.nome} ${m.descricao} ${m.baseLegal} ${m.sigla}`.toLowerCase().includes(q)) : disponiveis
    return agruparPorCategoria(filtrados)
  }, [disponiveis, busca])

  async function criar(modelo) {
    if (criando) return
    setCriando(true)
    try {
      const id = await criarDocumento({ modelo, titulo: modelo.nome, processoId, conteudo: valoresIniciais(modelo, ctx), corpo: [] })
      navigate(`/documentos/${id}`, { replace: true })
    } catch (err) {
      showError(mensagemErroDocumento(err))
      setCriando(false)
    }
  }

  async function enviar({ arquivo: f, titulo, descricao }) {
    try {
      const id = await enviarArquivo({ arquivo: f, titulo, descricao, processoId, usuarioId: user?.id })
      if (processoId && item) {
        const { documento } = await obterDocumento(id)
        await marcarItem(processoId, item, 'juntado', `Documento ${documento?.numero || ''} (arquivo enviado)`).catch(() => {})
      }
      showSuccess('Arquivo enviado. Confira e envie para assinatura, se for o caso.')
      navigate(`/documentos/${id}`, { replace: true })
    } catch (err) { throw new Error(mensagemErroDocumento(err)) }
  }

  // modelo pedido pelo endereço: cria assim que o contexto (processo, unidade) estiver pronto
  useEffect(() => {
    if (!modeloPedido || !pronto || automatico.current || !podeUsarModelo(modeloPedido, role)) return
    automatico.current = true
    criar(modeloPedido)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeloPedido, pronto, role])

  if (modeloPedido && podeUsarModelo(modeloPedido, role)) {
    return <div className="esqueleto" role="status"><span className="visually-hidden">Criando o documento…</span><div className="esqueleto__linha" style={{ width: '40%', height: 28 }} /><div className="esqueleto__bloco" /></div>
  }

  return (
    <>
      <PageHeader
        back={{ to: '/documentos', label: 'Documentos' }}
        title="Novo documento"
        subtitle={processoId ? 'O documento ficará ligado ao processo que você estava vendo. Escolha o modelo.' : 'Escolha o modelo. O documento é criado como rascunho e você preenche em seguida.'}
      />

      <button type="button" className="modelo modelo--arquivo mb-4" onClick={() => setArquivo(true)} disabled={criando}>
        <span className="modelo__sigla mono">ANX</span>
        <span className="modelo__nome"><i className="bi bi-upload me-2" aria-hidden="true" />Enviar um arquivo</span>
        <span className="modelo__desc">PDF, imagem ou planilha feitos fora do sistema (proposta, certidão, nota fiscal…). O arquivo vira documento e pode ser assinado.</span>
      </button>

      <div className="barra-lista__busca mb-3" style={{ maxWidth: 520 }}>
        <i className="bi bi-search" aria-hidden="true" />
        <input className="form-control" placeholder="Procurar um modelo (ex.: ofício, ETP, parecer)" aria-label="Procurar modelo"
          value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {grupos.length === 0 && <Empty icon="bi-search">Nenhum modelo encontrado para &ldquo;{busca}&rdquo;.</Empty>}

      {grupos.map(({ categoria, modelos }) => (
        <section key={categoria} className="mb-4" aria-label={categoria}>
          <h2 className="grupo-titulo">{categoria}</h2>
          <div className="modelos">
            {modelos.map((m) => (
              <button key={m.codigo} type="button" className="modelo" disabled={criando} onClick={() => criar(m)}>
                <span className="modelo__sigla mono">{m.sigla}</span>
                <span className="modelo__nome">{m.nome}</span>
                <span className="modelo__desc">{m.descricao}</span>
                <span className="modelo__lei">{m.baseLegal}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {arquivo && <EnviarArquivoModal onSubmit={enviar} onClose={() => setArquivo(false)} />}
    </>
  )
}
