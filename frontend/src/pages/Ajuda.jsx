import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Card, PageHeader } from '../components/gc/ui'
import { CAMINHO, GLOSSARIO, GUIA, GUIA_LICITACAO } from '../utils/guia'
import { ROLES, normalizeRole } from '../utils/permissions'

export default function Ajuda() {
  const { role } = useAuth()
  const r = normalizeRole(role)
  const guia = GUIA[r]
  const guiaLic = GUIA_LICITACAO[r]
  const perfil = ROLES[r]?.label

  return (
    <>
      <PageHeader
        title="Ajuda"
        subtitle="Como o sistema funciona, o que cabe a você e o significado dos termos."
      />

      {guia && (
        <Card title={`O seu papel: ${perfil}`} subtitle={guia.resumo}>
          <ol className="guia__passos guia__passos--solto">
            {guia.passos.map((p) => (
              <li key={p.titulo} className="guia__passo">
                <span className="guia__num" aria-hidden="true" />
                <div className="guia__texto"><strong>{p.titulo}</strong><span>{p.texto}</span></div>
                <Link to={p.to} className="btn btn-sm btn-outline-primary guia__acao">{p.acao}</Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {guiaLic && (
        <Card title="Processos licitatórios" subtitle={guiaLic.resumo}>
          <ol className="guia__passos guia__passos--solto">
            {guiaLic.passos.map((p) => (
              <li key={p.titulo} className="guia__passo">
                <span className="guia__num" aria-hidden="true" />
                <div className="guia__texto"><strong>{p.titulo}</strong><span>{p.texto}</span></div>
                <Link to={p.to} className="btn btn-sm btn-outline-primary guia__acao">{p.acao}</Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card title="Por onde uma contratação anda" subtitle="Cada setor faz a sua parte e passa para o próximo. O seu setor aparece destacado.">
        <ol className="caminho">
          {CAMINHO.map((e) => (
            <li key={`${e.setor}-${e.texto}`} className={`caminho__etapa ${e.perfis.includes(r) ? 'caminho__etapa--meu' : 'caminho__etapa--outro'}`}>
              <span className="caminho__setor">{e.setor}</span>
              <span>{e.texto}</span>
            </li>
          ))}
        </ol>
        <p className="small text-secondary mb-0 mt-3">
          Quando você envia algo para o próximo setor, a tela dele se atualiza sozinha. Não precisa apertar F5.
        </p>
      </Card>

      <Card title="Dicas rápidas">
        <ul className="mb-0 ajuda__dicas">
          <li>A <strong>busca no topo</strong> encontra uma contratação pelo número, nome da contratada, CNPJ ou processo SEI. Atalho: tecla <kbd>/</kbd>.</li>
          <li>O <strong>sino</strong> mostra quantas tarefas aguardam você. Clique para abrir a lista.</li>
          <li>Em <strong>Minha mesa</strong> as tarefas vêm ordenadas: urgente, atenção e acompanhamento. Comece de cima.</li>
          <li>Os <strong>carimbos coloridos</strong> mostram a situação: verde está em dia, amarelo pede atenção, vermelho é urgente.</li>
          <li>Nada se apaga: contratações canceladas ficam registradas com a justificativa, e o histórico mostra quem alterou o quê.</li>
        </ul>
      </Card>

      <Card title="Glossário" subtitle="Os termos que aparecem nas telas, em linguagem simples.">
        <dl className="ajuda__glossario mb-0">
          {GLOSSARIO.map(([termo, texto]) => (
            <div key={termo}><dt>{termo}</dt><dd>{texto}</dd></div>
          ))}
        </dl>
      </Card>
    </>
  )
}
