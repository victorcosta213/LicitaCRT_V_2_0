import { useState, useEffect, useMemo, useRef } from 'react'
import {
  listarUsuarios, criarUsuario, atualizarUsuario, toggleAtivo, deletarUsuario, resetarSenha, mensagemErroUsuario,
} from '../services/users'
import Swal from 'sweetalert2'
import Modal from 'bootstrap/js/dist/modal'
import { useAuth } from '../context/AuthContext'
import { PERFIS_EM_USO, ROLES, normalizeRole } from '../utils/permissions'
import { Indicadores, PageHeader, Tabs } from '../components/gc/ui'
import { fmtDate } from '../utils/format'
import { useAtualizacaoAutomatica } from '../components/useAtualizacao'
import { listarUnidades } from '../services/tramitacao'
import './usuarios.css'

// perfis oferecidos no cadastro; os ocultos (em espera) só aparecem para quem já os tem
const PERFIS = PERFIS_EM_USO.map((value) => ({ value, ...ROLES[value] }))
const comOcultos = (roles) => [...PERFIS, ...[...new Set(roles)].filter((r) => r && ROLES[r] && !PERFIS_EM_USO.includes(r) && r !== 'editor')
  .map((value) => ({ value, ...ROLES[value] }))]

export default function Usuarios() {
  const { user: eu } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [aba, setAba] = useState('usuarios')
  const [status, setStatus] = useState('todos')
  const [perfil, setPerfil] = useState('')
  const modalRef = useRef(null)

  // Form state
  const [editingId, setEditingId] = useState(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('viewer')
  const [unidade, setUnidade] = useState('')
  const [unidades, setUnidades] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const loadData = async ({ silencioso = false } = {}) => {
    if (!silencioso) setLoading(true)
    try {
      const data = await listarUsuarios()
      setUsers(data)
    } catch (err) {
      console.error(err)
      if (!silencioso) Swal.fire('Erro', 'Não foi possível carregar os usuários', 'error')
    } finally {
      if (!silencioso) setLoading(false)
    }
  }
  useAtualizacaoAutomatica(['usuarios'], () => loadData({ silencioso: true }))

  useEffect(() => {
    loadData()
    listarUnidades().then(setUnidades).catch(() => setUnidades([])) // antes da migration da tramitação não há unidades
    const el = document.getElementById('modalUsuario')
    if (el) modalRef.current = new Modal(el)
    return () => modalRef.current?.dispose()
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return users.filter((u) => {
      if (status === 'ativos' && !u.ativo) return false
      if (status === 'inativos' && u.ativo) return false
      if (perfil && normalizeRole(u.role) !== perfil) return false
      return !q || (u.nome || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
    })
  }, [users, query, status, perfil])

  const perfisDaLista = useMemo(() => comOcultos(users.map((u) => normalizeRole(u.role))), [users])
  const porPerfil = useMemo(() => perfisDaLista.map((p) => ({
    ...p,
    pessoas: users.filter((u) => normalizeRole(u.role) === p.value),
  })).filter((p) => !p.oculto || p.pessoas.length), [users, perfisDaLista])
  const nAtivos = users.filter((u) => u.ativo).length

  const openNew = () => {
    setEditingId(null)
    setNome('')
    setEmail('')
    setPassword('')
    setRole('viewer')
    setUnidade('')
    modalRef.current?.show()
  }

  const openEdit = (u) => {
    setEditingId(u.id)
    setNome(u.nome || '')
    setEmail(u.email || '')
    setPassword('') // Não edita senha aqui
    setRole(normalizeRole(u.role)) // perfil legado "editor" passa a Compras ao salvar
    setUnidade(u.unidade_id || '')
    modalRef.current?.show()
  }

  const handleToggleStatus = async (u) => {
    const actionStr = u.ativo ? 'desativar' : 'reativar'
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: `Deseja ${actionStr} o acesso de ${u.nome || u.email}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Sim, ${actionStr}`,
      cancelButtonText: 'Cancelar'
    })

    if (result.isConfirmed) {
      try {
        await toggleAtivo(u.id, !u.ativo)
        Swal.fire('Sucesso!', `Usuário ${u.ativo ? 'desativado' : 'reativado'} com sucesso.`, 'success')
        loadData()
      } catch (err) {
        console.error(err)
        Swal.fire('Erro', mensagemErroUsuario(err), 'error')
      }
    }
  }

  const handleResetarSenha = async (u) => {
    const result = await Swal.fire({
      title: 'Redefinir a senha?',
      text: `A senha de ${u.nome || u.email} voltará à senha padrão do sistema. No próximo acesso, a pessoa será obrigada a criar uma nova senha. Redefina só quando ela for entrar logo em seguida.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, redefinir',
      cancelButtonText: 'Cancelar',
    })
    if (!result.isConfirmed) return
    try {
      await resetarSenha(u.id)
      Swal.fire('Senha redefinida', `${u.nome || u.email} já pode entrar com a senha padrão. O sistema pedirá que ela crie uma nova senha.`, 'success')
    } catch (err) {
      console.error(err)
      Swal.fire('Erro', mensagemErroUsuario(err), 'error')
    }
  }

  const handleDelete = async (u) => {
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: `Apagar o perfil de ${u.nome || u.email}? A pessoa perde o acesso imediatamente. Se ela puder voltar no futuro, prefira "Desativar".`,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: 'Sim, apagar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b81f25'
    })

    if (result.isConfirmed) {
      try {
        await deletarUsuario(u.id)
        Swal.fire('Excluído!', 'O perfil foi removido e o acesso, bloqueado.', 'success')
        loadData()
      } catch (err) {
        console.error(err)
        Swal.fire('Erro', mensagemErroUsuario(err), 'error')
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editingId) {
        // Atualiza apenas nome e role (o email não muda, senha não muda aqui)
        await atualizarUsuario(editingId, { nome, role, unidade_id: unidades.length ? unidade : undefined })
        Swal.fire('Atualizado', 'Os dados do usuário foram atualizados.', 'success')
      } else {
        const { precisaConfirmar, trocaObrigatoria } = await criarUsuario({ nome, email: email.trim().toLowerCase(), password, role, unidade_id: unidade })
        const trocar = trocaObrigatoria ? ' No primeiro acesso, ela será obrigada a criar a própria senha.' : ' Atenção: o sistema não conseguiu exigir a troca de senha no primeiro acesso.'
        Swal.fire('Criado', (precisaConfirmar
          ? `Enviamos um e-mail de confirmação para ${email}. O acesso funciona depois que a pessoa clicar no link.`
          : `${nome} já pode entrar com o e-mail ${email} e a senha informada. Repasse a senha por um canal seguro.`) + trocar, trocaObrigatoria ? 'success' : 'warning')
      }
      modalRef.current?.hide()
      loadData()
    } catch (err) {
      console.error(err)
      Swal.fire('Erro', mensagemErroUsuario(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const stats = useMemo(() => {
    const admins = users.filter(u => u.role === 'admin').length
    const operacionais = users.filter(u => ['compras', 'gestor', 'fiscal', 'financeiro', 'juridico', 'administrativo', 'rh', 'ti', 'editor'].includes(u.role)).length
    const viewers = users.filter(u => u.role === 'viewer').length
    return { total: users.length, admins, editors: operacionais, viewers }
  }, [users])

  return (
    <div className="usuarios-page">
      <PageHeader
        title="Usuários e perfis"
        subtitle="Quem acessa a plataforma e com qual perfil. O acesso só existe com perfil ativo."
        actions={(
          <button className="btn btn-primary" onClick={openNew}>
            <i className="bi bi-person-plus me-2" />Novo usuário
          </button>
        )}
      />

      <Indicadores itens={[
        { label: 'Usuários', value: loading ? '…' : stats.total },
        { label: 'Administradores', value: loading ? '…' : stats.admins },
        { label: 'Perfis operacionais', value: loading ? '…' : stats.editors, hint: 'Compras, Gestão, Fiscal, Financeiro, Gabinete' },
        { label: 'Visualizadores', value: loading ? '…' : stats.viewers },
      ]} />

      <Tabs
        tabs={[{ key: 'usuarios', label: 'Usuários', count: users.length }, { key: 'perfis', label: 'Perfis e permissões' }]}
        active={aba}
        onChange={setAba}
      />

      {aba === 'perfis' && (
        <div className="row g-3">
          {porPerfil.map((p) => (
            <div className="col-md-6 col-xl-4" key={p.value}>
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <span className={`carimbo ${['admin', 'presidente'].includes(p.value) ? 'carimbo--dark' : p.value === 'viewer' ? 'carimbo--secondary' : 'carimbo--primary'}`}>{p.label}</span>
                    <span className="mono small text-secondary">{p.pessoas.length} pessoa(s)</span>
                  </div>
                  <p className="small mb-3">{p.desc}</p>
                  {p.pessoas.length === 0
                    ? <div className="small text-secondary">Ninguém com este perfil.</div>
                    : (
                      <ul className="list-unstyled small mb-0">
                        {p.pessoas.map((u) => (
                          <li key={u.id} className="d-flex justify-content-between gap-2 py-1 border-top">
                            <span className="text-truncate">{u.nome || u.email}</span>
                            {!u.ativo && <span className="text-danger">inativo</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
              </div>
            </div>
          ))}
          <div className="col-12 small text-secondary">
            As regras de cada perfil valem também no banco: mudar o perfil de alguém muda, na hora, o que a pessoa lê e grava.
            O fiscal só enxerga as contratações em que está designado, e o Gabinete só os atos encaminhados a ele.
          </div>
        </div>
      )}

      {aba === 'usuarios' && (
      <div className="card usuarios-card">
        <div className="barra-lista">
          <div className="segmentos" role="tablist" aria-label="Situação do acesso">
            {[['todos', 'Todos', users.length], ['ativos', 'Ativos', nAtivos], ['inativos', 'Inativos', users.length - nAtivos]].map(([k, l, n]) => (
              <button key={k} type="button" role="tab" aria-selected={status === k} className={`segmento ${status === k ? 'ativo' : ''}`} onClick={() => setStatus(k)}>
                {l}<span className="segmento__n">{n}</span>
              </button>
            ))}
          </div>
          <select className="form-select w-auto" aria-label="Perfil" value={perfil} onChange={(e) => setPerfil(e.target.value)}>
            <option value="">Todos os perfis</option>
            {perfisDaLista.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <div className="barra-lista__busca">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              className="form-control"
              placeholder="Buscar por nome ou e-mail"
              aria-label="Buscar usuário"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

      <div className="usuarios-table-wrap">
        <table className="usuarios-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Perfil</th>
              <th>Unidade</th>
              <th>Status</th>
              <th>Criado em</th>
              <th className="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="6" className="text-center py-4">Carregando usuários...</td></tr>
            )}
            
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan="6">
                  <div className="usuarios-empty">
                    <i className="bi bi-people" />
                    Nenhum usuário encontrado.
                  </div>
                </td>
              </tr>
            )}

            {!loading && filtered.map(u => {
              const init = (u.nome || u.email || '?').charAt(0).toUpperCase()
              const dateStr = u.created_at ? fmtDate(u.created_at) : '—'

              return (
                <tr key={u.id}>
                  <td>
                    <div className="u-name-cell">
                      <div className="u-avatar">{init}</div>
                      <div>
                        <div className="u-name">{u.nome || 'Sem nome'}</div>
                        <div className="u-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`carimbo ${['admin', 'presidente'].includes(u.role) ? 'carimbo--dark' : u.role === 'viewer' ? 'carimbo--secondary' : 'carimbo--primary'}`}>
                      {ROLES[u.role]?.label || u.role}
                    </span>
                  </td>
                  <td className="small">{unidades.find((x) => x.id === u.unidade_id)?.sigla || <span className="text-secondary">—</span>}</td>
                  <td>
                    <span className={`carimbo ${u.ativo ? 'carimbo--success' : 'carimbo--danger'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="num text-secondary">{dateStr}</td>
                  <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => openEdit(u)} title="Editar">
                      <i className="bi bi-pencil" />
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary me-2"
                      onClick={() => handleResetarSenha(u)}
                      title={u.id === eu?.id ? 'Você não pode redefinir a própria senha por aqui' : 'Redefinir para a senha padrão'}
                      aria-label={`Redefinir senha de ${u.nome || u.email}`}
                      disabled={u.id === eu?.id}
                    >
                      <i className="bi bi-key" />
                    </button>
                    {/* o admin não desativa nem apaga a si mesmo (o banco também impede) */}
                    <button
                      className={`btn btn-sm ${u.ativo ? 'btn-outline-warning' : 'btn-outline-success'} me-2`}
                      onClick={() => handleToggleStatus(u)}
                      title={u.id === eu?.id ? 'Você não pode desativar o próprio acesso' : u.ativo ? 'Desativar acesso' : 'Reativar acesso'}
                      disabled={u.id === eu?.id}
                    >
                      <i className={`bi ${u.ativo ? 'bi-person-x' : 'bi-person-check'}`} />
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(u)}
                      title={u.id === eu?.id ? 'Você não pode apagar o próprio usuário' : 'Apagar usuário'}
                      disabled={u.id === eu?.id}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </div>
      )}

      {/* Modal Criar/Editar */}
      <div className="modal fade usuarios-modal" id="modalUsuario" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <form className="modal-content" onSubmit={handleSubmit}>
            <div className="modal-header">
              <h5 className="modal-title fw-bold">
                {editingId ? 'Editar usuário' : 'Novo usuário'}
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" disabled={submitting}></button>
            </div>
            
            <div className="modal-body vstack gap-3 p-4">
              <div>
                <label className="form-label fw-semibold">Nome completo</label>
                <input 
                  required 
                  className="form-control" 
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="form-label fw-semibold">E-mail</label>
                <input 
                  required 
                  type="email"
                  className="form-control" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="joao@exemplo.com"
                  disabled={submitting || editingId !== null} // Email não muda após criado
                />
                {editingId && <small className="text-muted">O e-mail não pode ser alterado.</small>}
              </div>

              {!editingId && (
                <div>
                  <label className="form-label fw-semibold">Senha temporária</label>
                  <input 
                    required 
                    type="password"
                    className="form-control" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                    autoComplete="new-password"
                    disabled={submitting}
                  />
                  <small className="text-muted">Provisória: no primeiro acesso, a pessoa será obrigada a criar a própria senha.</small>
                </div>
              )}

              <div>
                <label className="form-label fw-semibold">Perfil de acesso</label>
                <select 
                  className="form-select" 
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  disabled={submitting || (editingId !== null && editingId === eu?.id)}
                >
                  {comOcultos([role]).map((p) => (
                    <option key={p.value} value={p.value}>{p.label}{p.oculto ? ' (em espera)' : ''} — {p.desc}</option>
                  ))}
                </select>
              </div>

              {unidades.length > 0 && (
                <div>
                  <label className="form-label fw-semibold" htmlFor="usuario-unidade">Unidade (setor)</label>
                  <select id="usuario-unidade" className="form-select" value={unidade} onChange={e => setUnidade(e.target.value)} disabled={submitting}>
                    <option value="">Sem unidade</option>
                    {unidades.filter((x) => x.ativa || x.id === unidade).map((x) => <option key={x.id} value={x.id}>{x.sigla} — {x.nome}</option>)}
                  </select>
                  <small className="text-muted">Define de onde a pessoa abre, recebe e envia processos.</small>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal" disabled={submitting}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary d-flex align-items-center gap-2" disabled={submitting}>
                {submitting && <span className="spinner-border spinner-border-sm" />}
                {editingId ? 'Salvar alterações' : 'Criar usuário'}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  )
}