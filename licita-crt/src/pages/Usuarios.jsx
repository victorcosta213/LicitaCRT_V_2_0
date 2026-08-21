import { useState, useEffect, useMemo } from 'react'
import { listarUsuarios, criarUsuario, atualizarUsuario, toggleAtivo } from '../services/users'
import Swal from 'sweetalert2'
import Modal from 'bootstrap/js/dist/modal'
import './usuarios.css'

export default function Usuarios() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modalInstance, setModalInstance] = useState(null)
  
  // Form state
  const [editingId, setEditingId] = useState(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('viewer')
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await listarUsuarios()
      setUsers(data)
    } catch (err) {
      console.error(err)
      Swal.fire('Erro', 'Não foi possível carregar os usuários', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const el = document.getElementById('modalUsuario')
    if (el) {
      setModalInstance(new Modal(el))
    }
    return () => {
      if (modalInstance) modalInstance.dispose()
    }
  }, [])

  const filtered = useMemo(() => {
    if (!query) return users
    const q = query.toLowerCase()
    return users.filter(u => 
      (u.nome || '').toLowerCase().includes(q) || 
      (u.email || '').toLowerCase().includes(q)
    )
  }, [users, query])

  const openNew = () => {
    setEditingId(null)
    setNome('')
    setEmail('')
    setPassword('')
    setRole('viewer')
    modalInstance?.show()
  }

  const openEdit = (u) => {
    setEditingId(u.id)
    setNome(u.nome || '')
    setEmail(u.email || '')
    setPassword('') // Não edita senha aqui
    setRole(u.role || 'viewer')
    modalInstance?.show()
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
        Swal.fire('Erro', 'Ocorreu um erro na operação', 'error')
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editingId) {
        // Atualiza apenas nome e role (o email não muda, senha não muda aqui)
        await atualizarUsuario(editingId, { nome, role })
        Swal.fire('Atualizado', 'Os dados do usuário foram atualizados.', 'success')
      } else {
        // Cria novo
        await criarUsuario({ nome, email, password, role })
        Swal.fire('Criado', 'Novo usuário criado com sucesso.', 'success')
      }
      modalInstance?.hide()
      loadData()
    } catch (err) {
      console.error(err)
      let msg = 'Ocorreu um erro.'
      if (err.code === 'auth/email-already-in-use') msg = 'Este e-mail já está em uso.'
      if (err.code === 'auth/weak-password') msg = 'A senha deve ter pelo menos 6 caracteres.'
      Swal.fire('Erro', msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const stats = useMemo(() => {
    const admins = users.filter(u => u.role === 'admin').length
    const editors = users.filter(u => u.role === 'editor').length
    const viewers = users.filter(u => u.role === 'viewer').length
    return { total: users.length, admins, editors, viewers }
  }, [users])

  return (
    <div className="usuarios-page">
      <section className="usuarios-hero">
        <div className="usuarios-hero__text">
          <h1>Gestão de Usuários</h1>
          <p>Controle os acessos e permissões do sistema.</p>
        </div>
        <div className="usuarios-hero__actions">
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={openNew}>
            <i className="bi bi-person-plus" /> Novo Usuário
          </button>
        </div>
      </section>

      <div className="usuarios-stats">
        <div className="u-stat-card">
          <span>Total</span>
          <strong>{loading ? '-' : stats.total}</strong>
        </div>
        <div className="u-stat-card">
          <span>Admins</span>
          <strong>{loading ? '-' : stats.admins}</strong>
        </div>
        <div className="u-stat-card">
          <span>Editores</span>
          <strong>{loading ? '-' : stats.editors}</strong>
        </div>
        <div className="u-stat-card">
          <span>Visualizadores</span>
          <strong>{loading ? '-' : stats.viewers}</strong>
        </div>
      </div>

      <div className="usuarios-toolbar">
        <div className="input-group">
          <span className="input-group-text"><i className="bi bi-search" /></span>
          <input 
            className="form-control" 
            placeholder="Buscar por nome ou e-mail..."
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
              <th>Status</th>
              <th>Criado em</th>
              <th className="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="5" className="text-center py-4">Carregando usuários...</td></tr>
            )}
            
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan="5">
                  <div className="usuarios-empty">
                    <i className="bi bi-people" />
                    Nenhum usuário encontrado.
                  </div>
                </td>
              </tr>
            )}

            {!loading && filtered.map(u => {
              const init = (u.nome || u.email || '?').charAt(0).toUpperCase()
              const dateObj = u.createdAt?.toDate ? u.createdAt.toDate() : null
              const dateStr = dateObj ? dateObj.toLocaleDateString('pt-BR') : '-'

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
                    <span className={`role-badge ${u.role}`}>
                      {u.role === 'admin' && <i className="bi bi-shield-lock" />}
                      {u.role === 'editor' && <i className="bi bi-pencil-square" />}
                      {u.role === 'viewer' && <i className="bi bi-eye" />}
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${u.ativo ? 'ativo' : 'inativo'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>{dateStr}</td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-light me-2" onClick={() => openEdit(u)} title="Editar">
                      <i className="bi bi-pencil" />
                    </button>
                    <button 
                      className={`btn btn-sm ${u.ativo ? 'btn-outline-danger' : 'btn-outline-success'}`}
                      onClick={() => handleToggleStatus(u)}
                      title={u.ativo ? 'Desativar acesso' : 'Reativar acesso'}
                    >
                      <i className={`bi ${u.ativo ? 'bi-person-x' : 'bi-person-check'}`} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Criar/Editar */}
      <div className="modal fade usuarios-modal" id="modalUsuario" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <form className="modal-content" onSubmit={handleSubmit}>
            <div className="modal-header">
              <h5 className="modal-title fw-bold">
                {editingId ? 'Editar Usuário' : 'Novo Usuário'}
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
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    disabled={submitting}
                  />
                  <small className="text-muted">O usuário poderá redefinir a senha depois.</small>
                </div>
              )}

              <div>
                <label className="form-label fw-semibold">Perfil de Acesso (Role)</label>
                <select 
                  className="form-select" 
                  value={role} 
                  onChange={e => setRole(e.target.value)}
                  disabled={submitting}
                >
                  <option value="viewer">Viewer (Apenas Visualização)</option>
                  <option value="editor">Editor (Pode alterar processos)</option>
                  <option value="admin">Admin (Acesso Total)</option>
                </select>
              </div>
            </div>

            <div className="modal-footer bg-light rounded-bottom-4">
              <button type="button" className="btn btn-light" data-bs-dismiss="modal" disabled={submitting}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary d-flex align-items-center gap-2" disabled={submitting}>
                {submitting && <span className="spinner-border spinner-border-sm" />}
                {editingId ? 'Salvar Alterações' : 'Criar Usuário'}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  )
}