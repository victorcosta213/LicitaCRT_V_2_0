import { useState } from 'react'
import { Card, DefList, Pill, SeiRef } from './ui'
import FormModal from './FormModal'
import DocumentoModal from './DocumentoModal'
import { useGcActions } from './useGcActions'
import { PAPEL_RESPONSAVEL } from '../../utils/contrato'
import { minutaPortaria, termoCiencia } from '../../utils/documentos'
import { fmtDate, hojeISO } from '../../utils/format'
import { showConfirm, showError, showSuccess } from '../../utils/alerts'

const STATUS_PORTARIA = {
  null: { label: 'A elaborar', kind: 'secondary' },
  rascunho: { label: 'Em elaboração', kind: 'secondary' },
  aguardando_publicacao: { label: 'Aguardando assinatura/publicação', kind: 'warning' },
  publicada: { label: 'Publicada — fiscalização designada', kind: 'success' },
}

// Registro da publicação da portaria (Gestão ou Gabinete) — valida no banco
export function PublicacaoModal({ k, onClose }) {
  const { executar } = useGcActions()
  const c = k.c
  return (
    <FormModal
      title={`Registrar publicação da portaria — ${c.numero}`}
      fields={[
        { name: 'numero', label: 'Nº da portaria', col: 4, required: true },
        { name: 'data', label: 'Data da portaria', type: 'date', col: 4, required: true },
        { name: 'publicacao_data', label: 'Data da publicação', type: 'date', col: 4, required: true },
        { name: 'publicacao_meio', label: 'Meio de publicação', col: 6, placeholder: 'Diário Oficial, boletim interno, site…' },
        { name: 'sei', label: 'Nº do documento SEI', col: 6 },
        { name: 'link', label: 'Link SEI', col: 12 },
      ]}
      initial={{
        numero: c.portaria_numero, data: c.portaria_data, publicacao_data: hojeISO(),
        publicacao_meio: c.portaria_publicacao_meio, sei: c.portaria_sei, link: c.portaria_sei_link,
      }}
      submitLabel="Registrar publicação"
      onSubmit={async (v) => {
        await executar('gc_registrar_publicacao_portaria', {
          p_contrato: c.id, p_numero: v.numero, p_data: v.data, p_publicacao_data: v.publicacao_data,
          p_publicacao_meio: v.publicacao_meio, p_sei: v.sei, p_link: v.link,
        })
        showSuccess('Portaria publicada — fiscalização designada')
      }}
      onClose={onClose}
    />
  )
}

export function PortariaCard({ k }) {
  const { salvar, can, params } = useGcActions()
  const [doc, setDoc] = useState(null)
  const [publicar, setPublicar] = useState(false)
  const c = k.c
  const st = STATUS_PORTARIA[c.portaria_status] || STATUS_PORTARIA.null
  const pode = can('portaria.gerir')
  const fiscaisOk = !!k.fiscalTitular && !!k.fiscalSubstituto

  async function encaminhar() {
    if (!fiscaisOk) return showError('Designe o fiscal titular e o fiscal substituto antes de encaminhar a portaria.')
    if (!(await showConfirm('Encaminhar portaria', 'Encaminhar a portaria de designação para assinatura/publicação? O Gabinete será avisado.'))) return
    try {
      await salvar('contratos', { portaria_status: 'aguardando_publicacao' }, c.id)
      showSuccess('Portaria encaminhada')
    } catch (err) {
      showError(err.message)
    }
  }

  return (
    <Card
      title="Portaria de designação"
      actions={(
        <>
          <Pill kind={st.kind}>{st.label}</Pill>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setDoc(minutaPortaria(k, params))}>
            <i className="bi bi-file-earmark-text me-1" />Gerar minuta
          </button>
          {pode && !['aguardando_publicacao', 'publicada'].includes(c.portaria_status) && (
            <button className="btn btn-sm btn-primary" onClick={encaminhar} disabled={!fiscaisOk}
              title={fiscaisOk ? undefined : 'Designe o titular e o substituto'}>
              <i className="bi bi-send me-1" />Encaminhar para assinatura/publicação
            </button>
          )}
          {can('portaria.publicar') && c.portaria_status !== 'publicada' && (
            <button className="btn btn-sm btn-success" onClick={() => setPublicar(true)} disabled={!fiscaisOk}>
              <i className="bi bi-check2-square me-1" />Registrar publicação
            </button>
          )}
        </>
      )}
    >
      <DefList cols={3} items={[
        ['Nº da portaria', c.portaria_numero],
        ['Data', fmtDate(c.portaria_data)],
        ['Publicação', c.portaria_publicacao_data ? `${fmtDate(c.portaria_publicacao_data)}${c.portaria_publicacao_meio ? ` · ${c.portaria_publicacao_meio}` : ''}` : null],
        ['Documento SEI', <SeiRef key="s" documento={c.portaria_sei} link={c.portaria_sei_link} />],
      ]} />
      {doc && <DocumentoModal doc={doc} onClose={() => setDoc(null)} />}
      {publicar && <PublicacaoModal k={k} onClose={() => setPublicar(false)} />}
    </Card>
  )
}

export function TermoCard({ k }) {
  const { salvar, can, params } = useGcActions()
  const [doc, setDoc] = useState(null)
  const [sei, setSei] = useState(false)
  const [ciencia, setCiencia] = useState(null) // responsável
  const c = k.c
  const pode = can('termo.registrar')
  const envolvidos = k.b.responsaveis
    .filter((r) => r.ativo && ['gestor_titular', 'fiscal_tecnico', 'fiscal_substituto'].includes(r.papel))
  const publicada = c.portaria_status === 'publicada'

  return (
    <Card
      title="Termo de ciência e aceite"
      actions={(
        <>
          {k.formalizada
            ? <Pill kind="success">Fiscalização formalizada</Pill>
            : <Pill kind="secondary">Pendente</Pill>}
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setDoc(termoCiencia(k, params))} disabled={!publicada}
            title={publicada ? undefined : 'Gerado após a publicação da portaria'}>
            <i className="bi bi-file-earmark-text me-1" />Gerar termo
          </button>
          {pode && (
            <button className="btn btn-sm btn-light" onClick={() => setSei(true)}>
              <i className="bi bi-link-45deg me-1" />Documento SEI
            </button>
          )}
        </>
      )}
    >
      {!publicada && <div className="small text-secondary mb-2">O termo é gerado após a publicação da portaria.</div>}
      {envolvidos.length === 0 ? <div className="small text-secondary">Nenhum gestor/fiscal designado.</div> : (
        <ul className="list-unstyled mb-2">
          {envolvidos.map((r) => (
            <li key={r.id} className="d-flex align-items-center justify-content-between gap-2 py-1">
              <span>
                <i className={`bi ${r.ciente_em ? 'bi-check-square-fill text-success' : 'bi-square text-secondary'} me-2`} />
                <strong>{PAPEL_RESPONSAVEL[r.papel]}</strong> — {r.nome}
                {r.ciente_em && <span className="small text-secondary"> · ciente em {fmtDate(r.ciente_em)}</span>}
              </span>
              {pode && publicada && !r.ciente_em && (
                <button className="btn btn-sm btn-outline-success" onClick={() => setCiencia(r)}>Registrar ciência</button>
              )}
            </li>
          ))}
        </ul>
      )}
      <SeiRef documento={c.termo_sei} link={c.termo_sei_link} />

      {doc && <DocumentoModal doc={doc} onClose={() => setDoc(null)} />}
      {sei && (
        <FormModal
          title="Termo de ciência — documento SEI"
          size="md"
          fields={[
            { name: 'termo_sei', label: 'Nº do documento SEI', col: 12 },
            { name: 'termo_sei_link', label: 'Link SEI', col: 12 },
          ]}
          initial={c}
          onSubmit={(v) => salvar('contratos', v, c.id)}
          onClose={() => setSei(false)}
        />
      )}
      {ciencia && (
        <FormModal
          title={`Ciência — ${ciencia.nome}`}
          size="md"
          fields={[{ name: 'ciente_em', label: 'Data da assinatura do termo no SEI', type: 'date', col: 12, required: true }]}
          initial={{ ciente_em: hojeISO() }}
          submitLabel="Registrar ciência"
          onSubmit={(v) => salvar('responsaveis', v, ciencia.id)}
          onClose={() => setCiencia(null)}
        />
      )}
    </Card>
  )
}
