import { useState } from 'react'
import { read, utils } from 'xlsx'
import { useGc } from '../../context/GcContext'
import { useAuth } from '../../context/AuthContext'
import { salvarVarios } from '../../services/gc'
import { INSTRUMENTO } from '../../utils/contrato'
import { lerPlanilhaContratos } from '../../utils/importContratos'
import { baixarModeloContratos } from '../../utils/modeloContratos'
import { normalizeRole } from '../../utils/permissions'
import { showError, showSuccess } from '../../utils/alerts'
import { brl, fmtDate } from '../../utils/format'

// Importa contratações de uma planilha: mostra o que será criado e o que será ignorado antes de gravar.
export default function ImportarContratosModal({ onClose }) {
  const { raw, reload } = useGc()
  const { role, user } = useAuth()
  const gestao = ['gestor', 'admin'].includes(normalizeRole(role))
  const [res, setRes] = useState(null)
  const [arquivo, setArquivo] = useState('')
  const [jaEmExecucao, setJaEmExecucao] = useState(false)
  const [busy, setBusy] = useState(false)

  function escolher(e) {
    const file = e.target.files?.[0]
    e.target.value = null
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = read(new Uint8Array(evt.target.result), { type: 'array' })
        const linhas = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' })
        const existentes = (raw?.contratos || []).filter((c) => !c.cancelado)
          .map((c) => ({ instrumento: c.instrumento, numero: c.numero }))
        setArquivo(file.name)
        setRes(lerPlanilhaContratos(linhas, { existentes }))
      } catch (err) {
        console.error(err)
        showError('Não foi possível ler o arquivo. Use .xlsx, .xls ou .csv.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // "já em execução" só aceita linhas completas (o banco exige os dados mínimos para encaminhar)
  const importaveis = res ? res.registros.filter((r) => !jaEmExecucao || r.pendencias.length === 0) : []
  const barradas = res ? res.registros.length - importaveis.length : 0

  async function importar() {
    setBusy(true)
    try {
      const agora = new Date().toISOString()
      const lista = importaveis.map(({ dados, pendencias }) => ({
        ...dados,
        responsavel_contratacao: null,
        situacao: jaEmExecucao ? 'ativo' : 'em_cadastro',
        // o banco só aceita "encaminhada" com os dados mínimos: linhas incompletas ficam em cadastro
        ...(gestao && !pendencias.length ? { encaminhado_em: agora, encaminhado_por: user?.id } : {}),
        ...(jaEmExecucao ? {
          execucao_anterior: true, validado_gestao: true, validado_em: agora, validado_por: user?.id,
        } : {}),
      }))
      // lotes de 100: uma linha recusada pelo banco não derruba as anteriores sem aviso
      let feitos = 0
      for (let i = 0; i < lista.length; i += 100) {
        await salvarVarios('contratos', lista.slice(i, i + 100))
        feitos += Math.min(100, lista.length - i)
      }
      await reload()
      showSuccess(`${feitos} contratação(ões) importada(s).`)
      onClose()
    } catch (err) {
      showError(`${err.message} Nada do lote com erro foi gravado; confira a planilha e tente de novo.`)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Importar contratações de planilha</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                <label className="btn btn-outline-primary mb-0">
                  <i className="bi bi-file-earmark-spreadsheet me-2" />{arquivo ? 'Trocar arquivo' : 'Escolher planilha'}
                  <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={escolher} />
                </label>
                <button type="button" className="btn btn-outline-secondary" onClick={baixarModeloContratos}>
                  <i className="bi bi-download me-2" />Baixar modelo
                </button>
                {arquivo && <span className="small text-secondary">{arquivo}</span>}
              </div>

              {!res && (
                <div className="alert alert-info small mb-0">
                  Colunas: <strong>Nº</strong>, <strong>Contratada</strong> e <strong>Objeto</strong> são obrigatórias.
                  Também são lidas: Instrumento, Processo SEI, CNPJ, Modalidade, Unidade demandante, Valor, Início,
                  Fim da vigência, Prazo de execução (dias) e Prorrogável. Instrumentos já cadastrados com o mesmo número
                  são ignorados. As contratações entram em <strong>cadastro</strong>; depois é só completar os dados e
                  {gestao ? ' receber/encaminhar na ficha.' : ' encaminhar à Gestão.'}
                </div>
              )}

              {res?.erro && <div className="alert alert-danger mb-0">{res.erro}</div>}

              {res && !res.erro && (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-3 small">
                    <span><strong>{importaveis.length}</strong> a importar</span>
                    <span className="text-secondary"><strong>{res.ignorados.length + barradas}</strong> ignorada(s)</span>
                    {res.registros.some((r) => r.pendencias.length) && (
                      <span className="text-warning-emphasis"><strong>{res.registros.filter((r) => r.pendencias.length).length}</strong> com dados a completar</span>
                    )}
                  </div>

                  {gestao && (
                    <div className="form-check mb-3">
                      <input id="jaExec" type="checkbox" className="form-check-input" checked={jaEmExecucao} onChange={(e) => setJaEmExecucao(e.target.checked)} />
                      <label htmlFor="jaExec" className="form-check-label">
                        Contratações que <strong>já estavam em execução</strong> antes da plataforma
                        <span className="d-block small text-secondary">
                          Entram ativas e recebidas, sem refazer portaria, termo e OS/OC. Só linhas completas (SEI, valor e vigência ou prazo).
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="table-responsive border rounded mb-3" style={{ maxHeight: 320 }}>
                    <table className="table table-sm align-middle mb-0 gc-table">
                      <thead>
                        <tr><th>Linha</th><th>Instrumento</th><th>Nº</th><th>Contratada</th><th className="text-end">Valor</th><th>Vigência</th><th>Situação da linha</th></tr>
                      </thead>
                      <tbody>
                        {res.registros.map(({ linha, dados, pendencias, avisos }) => {
                          const barrada = jaEmExecucao && pendencias.length > 0
                          return (
                            <tr key={linha} className={barrada ? 'text-secondary' : ''}>
                              <td className="num">{linha}</td>
                              <td>{INSTRUMENTO[dados.instrumento]}</td>
                              <td className="gc-num">{dados.numero}</td>
                              <td className="text-truncate" style={{ maxWidth: 220 }}>{dados.contratada}</td>
                              <td className="text-end num">{dados.valor_inicial ? brl(dados.valor_inicial) : '—'}</td>
                              <td className="num text-nowrap">{dados.vigencia_fim ? fmtDate(dados.vigencia_fim) : dados.prazo_execucao_dias ? `${dados.prazo_execucao_dias} dias` : '—'}</td>
                              <td className="small">
                                {barrada && <span className="carimbo carimbo--secondary">não importada: falta {pendencias.join(', ')}</span>}
                                {!barrada && pendencias.length > 0 && <span className="carimbo carimbo--warning">completar: {pendencias.join(', ')}</span>}
                                {!barrada && !pendencias.length && !avisos.length && <span className="carimbo carimbo--success">completa</span>}
                                {!barrada && avisos.length > 0 && <span className="d-block text-secondary">{avisos.join('; ')}</span>}
                              </td>
                            </tr>
                          )
                        })}
                        {res.ignorados.map((i) => (
                          <tr key={`i${i.linha}`} className="text-secondary">
                            <td className="num">{i.linha}</td><td colSpan="5">{i.numero || '—'}</td>
                            <td className="small"><span className="carimbo carimbo--danger">ignorada: {i.motivo}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {res.faltantes?.length > 0 && (
                    <div className="small text-secondary">Colunas não encontradas (ficam em branco): {res.faltantes.join(', ').replaceAll('_', ' ')}.</div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
              <button type="button" className="btn btn-primary px-4" onClick={importar} disabled={busy || !importaveis.length}>
                {busy ? 'Importando…' : `Importar ${importaveis.length || ''} contratação(ões)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
