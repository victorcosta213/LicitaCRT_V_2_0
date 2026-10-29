import { useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import Offcanvas from 'bootstrap/js/dist/offcanvas'
import { NOME_APP, ORGAO_NOME, ORGAO_SIGLA } from '../config'

// Trilho escuro com os módulos do perfil
function Trilho({ modulos, modulo, contagens, tema, alternarTema }) {
  return (
    <nav className="trilho" aria-label="Módulos">
      {modulos.map((m) => {
        const n = contagens.porModulo[m.key] || 0
        return (
          <Link
            key={m.key}
            to={m.itens[0].to}
            className={`trilho__modulo ${modulo?.key === m.key ? 'ativo' : ''}`}
            aria-current={modulo?.key === m.key ? 'page' : undefined}
            title={m.label}
          >
            <i className={`bi ${m.icon}`} aria-hidden="true" />
            <span>{m.curto}</span>
            {n > 0 && <span className="trilho__contagem" aria-label={`${n} pendente(s)`}>{n > 99 ? '99+' : n}</span>}
          </Link>
        )
      })}
      <div className="trilho__rodape">
        <button
          type="button"
          className="trilho__botao"
          onClick={alternarTema}
          title={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          aria-label="Alternar tema"
        >
          <i className={`bi ${tema === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`} />
        </button>
      </div>
    </nav>
  )
}

// `atual`: a tela aberta (a mais específica). Sem ela, vale a regra do NavLink.
function ItensDoModulo({ modulo, contagens, aoNavegar, atual }) {
  return modulo.itens.map((it) => {
    const n = contagens.porItem[it.to] || 0
    return (
      <NavLink
        key={it.to}
        to={it.to}
        className={({ isActive }) => `navmod__item ${(atual ? atual.to === it.to : isActive) ? 'active' : ''}`}
        onClick={aoNavegar}
      >
        <i className={`bi ${it.icon}`} aria-hidden="true" />
        <span>{it.label}</span>
        {n > 0 && <span className={`navmod__n ${contagens.criticas && it.to === '/mesa' ? 'navmod__n--alerta' : ''}`}>{n}</span>}
      </NavLink>
    )
  })
}

// Menu com as telas do módulo aberto
function NavModulo({ modulo, contagens, atual }) {
  if (!modulo) return null
  return (
    <aside className="navmod" aria-label={`Telas de ${modulo.label}`}>
      <div className="navmod__cab">
        <span className="navmod__produto">{ORGAO_SIGLA}</span>
        <span className="navmod__titulo">{modulo.label}</span>
      </div>
      <nav className="navmod__lista">
        <ItensDoModulo modulo={modulo} contagens={contagens} atual={atual} />
      </nav>
      <div className="navmod__rodape">
        <b>{NOME_APP}</b>
        {ORGAO_NOME}
      </div>
    </aside>
  )
}

// Celular: todos os módulos num painel lateral
function MenuMovel({ modulos, contagens, modulo, atual }) {
  const { pathname } = useLocation()
  useEffect(() => {
    const el = document.getElementById('menuMovel')
    if (!el) return
    try { Offcanvas.getOrCreateInstance(el).hide() } catch { /* painel ainda não montado */ }
  }, [pathname])

  return (
    <div className="offcanvas offcanvas-start menu-movel" tabIndex={-1} id="menuMovel" aria-labelledby="menuMovelTitulo">
      <div className="offcanvas-header border-bottom">
        <h2 className="offcanvas-title h6 mb-0" id="menuMovelTitulo">{NOME_APP}</h2>
        <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Fechar" />
      </div>
      <div className="offcanvas-body">
        {modulos.map((m) => (
          <div key={m.key} className="menu-movel__modulo">
            <div className="rotulo"><i className={`bi ${m.icon}`} />{m.label}</div>
            <ItensDoModulo modulo={m} contagens={contagens} atual={m.key === modulo?.key ? atual : null} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Sidebar({ nav, tema, alternarTema }) {
  const { modulos, modulo, contagens } = nav
  const mostrarMenu = modulo && modulo.itens.length > 1
  return (
    <>
      <Trilho modulos={modulos} modulo={modulo} contagens={contagens} tema={tema} alternarTema={alternarTema} />
      {mostrarMenu && <NavModulo modulo={modulo} contagens={contagens} atual={nav.item} />}
      <MenuMovel modulos={modulos} contagens={contagens} modulo={modulo} atual={nav.item} />
    </>
  )
}
