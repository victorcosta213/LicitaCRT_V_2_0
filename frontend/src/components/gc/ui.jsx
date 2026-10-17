import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGc } from '../../context/GcContext'
import { ETAPA_CONTRATACAO, SITUACAO_CONTRATO } from '../../utils/contrato'

// Situação da contratação: a etapa até a execução; depois, a situação contratual
export function SituacaoContratacao({ k, grande }) {
  const s = k.etapa !== 'em_execucao' && ETAPA_CONTRATACAO[k.etapa]
    ? ETAPA_CONTRATACAO[k.etapa]
    : SITUACAO_CONTRATO[k.c.situacao] || SITUACAO_CONTRATO.ativo
  if (grande) return <Carimbo kind={s.kind}>{s.label}</Carimbo>
  return <Pill kind={s.kind} title={s.curto ? s.label : undefined}>{s.curto || s.label}</Pill>
}

// Dias até o fim da vigência, com destaque conforme a proximidade
export function BadgeVigencia({ dias, situacao }) {
  if (['encerrado', 'em_cadastro'].includes(situacao) || dias === null || dias === undefined) return null
  if (dias < 0) return <Pill kind="danger">Vencida há {-dias} d</Pill>
  if (dias <= 30) return <Pill kind="danger">{dias} dias</Pill>
  if (dias <= 60) return <Pill kind="warning">{dias} dias</Pill>
  if (dias <= 120) return <Pill kind="info">{dias} dias</Pill>
  return <span className="small text-secondary num">{dias} dias</span>
}

// Status em forma de carimbo de protocolo
export function Pill({ kind = 'secondary', children, title }) {
  return <span className={`carimbo carimbo--${kind}`} title={title}>{children}</span>
}

// Carimbo grande (cabeçalho da ficha)
export function Carimbo({ kind = 'secondary', children }) {
  return <span className={`carimbo carimbo--grande carimbo--${kind}`}>{children}</span>
}

export function PageHeader({ title, subtitle, actions, back, eyebrow }) {
  return (
    <header className="cabecalho">
      <div className="cabecalho__texto">
        {back && (
          <Link to={back.to} className="cabecalho__voltar">
            <i className="bi bi-arrow-left" />{back.label}
          </Link>
        )}
        {eyebrow && <div className="rotulo mb-1">{eyebrow}</div>}
        <h1 className="cabecalho__titulo">{title}</h1>
        {subtitle && <p className="cabecalho__sub">{subtitle}</p>}
      </div>
      {actions && <div className="cabecalho__acoes">{actions}</div>}
    </header>
  )
}

// Faixa de indicadores numa única régua (menos caixas na tela).
// itens: [{ label, value, hint, kind, to, onClick, ativo }]; fluxo = setas entre as etapas
export function Indicadores({ itens, fluxo }) {
  const lista = itens.filter(Boolean)
  return (
    <div className={`indicadores ${fluxo ? 'indicadores--fluxo' : ''}`} style={{ '--n': lista.length }}>
      {lista.map((it) => {
        const conteudo = (
          <>
            <span className="indicador__rotulo">
              {it.kind && <span className="indicador__ponto" aria-hidden="true" />}
              {it.label}
            </span>
            <span className="indicador__valor">{it.value}</span>
            {it.hint && <span className="indicador__dica">{it.hint}</span>}
          </>
        )
        const cls = `indicador ${it.kind ? `indicador--${it.kind}` : ''} ${it.ativo ? 'indicador--ativo' : ''}`
        if (it.to) return <Link key={it.label} to={it.to} className={cls}>{conteudo}</Link>
        if (it.onClick) return <button key={it.label} type="button" className={cls} onClick={it.onClick}>{conteudo}</button>
        return <div key={it.label} className={cls}>{conteudo}</div>
      })}
    </div>
  )
}

export function Empty({ children = 'Nenhum registro.', icon = 'bi-inbox' }) {
  return (
    <div className="vazio">
      <div className="vazio__icone" aria-hidden="true"><i className={`bi ${icon}`} /></div>
      {children}
    </div>
  )
}

export function Card({ title, subtitle, actions, children, className = '', flush }) {
  return (
    <section className={`card gc-card mb-4 ${className}`}>
      {(title || actions) && (
        <div className="card-header gc-card__cab">
          <div className="min-w-0">
            {title && <h2 className="gc-card__titulo">{title}</h2>}
            {subtitle && <div className="gc-card__sub">{subtitle}</div>}
          </div>
          {actions && <div className="d-flex gap-2 flex-wrap">{actions}</div>}
        </div>
      )}
      <div className={flush ? 'gc-card__corpo--flush' : 'card-body'}>{children}</div>
    </section>
  )
}

export function SeiRef({ processo, documento, link }) {
  if (!processo && !documento && !link) return <span className="text-secondary">—</span>
  return (
    <span className="sei">
      {processo && <span title="Processo SEI"><span className="sei__tipo">SEI</span> <span className="mono">{processo}</span></span>}
      {processo && documento && <span className="mx-1 text-secondary">·</span>}
      {documento && <span title="Documento SEI"><span className="sei__tipo">Doc</span> <span className="mono">{documento}</span></span>}
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="ms-2" title="Abrir no SEI">
          <i className="bi bi-box-arrow-up-right" />
        </a>
      )}
    </span>
  )
}

export function DefList({ items, cols = 3 }) {
  return (
    <dl className={`gc-deflist gc-deflist--${cols}`}>
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k} className="gc-deflist__item">
          <dt>{k}</dt>
          <dd>{v === null || v === undefined || v === '' ? '—' : v}</dd>
        </div>
      ))}
    </dl>
  )
}

// Abas sublinhadas. Abas marcadas como `mais` ficam no menu "Mais" (menos ruído).
export function Tabs({ tabs, active, onChange }) {
  const principais = tabs.filter((t) => !t.mais)
  const extras = tabs.filter((t) => t.mais)
  const extraAtiva = extras.find((t) => t.key === active)
  const extrasComContagem = extras.reduce((s, t) => s + (t.count > 0 ? t.count : 0), 0)
  return (
    <div className="abas" role="tablist">
      {principais.map((t) => (
        <button
          key={t.key} type="button" role="tab" aria-selected={active === t.key}
          className={`aba ${active === t.key ? 'ativa' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count > 0 && <span className="aba__n">{t.count}</span>}
        </button>
      ))}
      {extras.length > 0 && (
        <div className="dropdown">
          <button type="button" className={`aba ${extraAtiva ? 'ativa' : ''}`} data-bs-toggle="dropdown" aria-expanded="false">
            {extraAtiva ? extraAtiva.label : 'Mais'}
            {!extraAtiva && extrasComContagem > 0 && <span className="aba__n">{extrasComContagem}</span>}
            <i className="bi bi-chevron-down small" />
          </button>
          <ul className="dropdown-menu">
            {extras.map((t) => (
              <li key={t.key}>
                <button type="button" className={`dropdown-item d-flex justify-content-between gap-3 ${active === t.key ? 'active' : ''}`} onClick={() => onChange(t.key)}>
                  {t.label}
                  {t.count > 0 && <span className="aba__n">{t.count}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Régua numerada das etapas (como as referências de uma prancha técnica)
export function Regua({ passos, atual }) {
  const i = passos.findIndex(([k]) => k === atual)
  const ref = useRef(null)
  // em telas estreitas a régua rola: deixa a etapa atual à vista
  useEffect(() => {
    const el = ref.current
    const passo = el?.querySelector('[aria-current="step"]')
    if (el && passo && el.scrollWidth > el.clientWidth) el.scrollLeft = passo.offsetLeft - el.clientWidth / 2 + passo.offsetWidth / 2
  }, [atual])
  return (
    <ol ref={ref} className="regua" style={{ '--n': passos.length }} aria-label="Etapas">
      {passos.map(([key, label], n) => {
        const estado = n < i ? 'feito' : n === i ? 'atual' : 'futuro'
        return (
          <li key={key} className={`regua__passo regua__passo--${estado}`} aria-current={estado === 'atual' ? 'step' : undefined}>
            <div className="regua__marca">
              <span className="regua__num">{estado === 'feito' ? <i className="bi bi-check-lg" /> : String(n + 1).padStart(2, '0')}</span>
              <span className="regua__linha" />
            </div>
            <div className="regua__rotulo">{label}</div>
          </li>
        )
      })}
    </ol>
  )
}

// Barra de distribuição com legenda clicável. itens: [{ key, label, value, cor, to | onClick, ativo }]
export function Distribuicao({ itens, vazio = 'Nada em andamento.' }) {
  const total = itens.reduce((s, i) => s + i.value, 0)
  if (!total) return <Empty icon="bi-bar-chart">{vazio}</Empty>
  return (
    <>
      <div className="distribuicao" role="img" aria-label={itens.map((i) => `${i.label}: ${i.value}`).join('; ')}>
        {itens.filter((i) => i.value > 0).map((i) => (
          <span key={i.key} style={{ width: `${(i.value / total) * 100}%`, '--c': i.cor }} title={`${i.label}: ${i.value}`} />
        ))}
      </div>
      <ul className="legenda-dist">
        {itens.map((i) => {
          const corpo = <><i style={{ '--c': i.cor }} />{i.label}<b>{i.value}</b></>
          let el = <span className="item">{corpo}</span>
          if (i.to) el = <Link to={i.to}>{corpo}</Link>
          if (i.onClick) el = <button type="button" className={i.ativo ? 'ativo' : ''} aria-pressed={!!i.ativo} onClick={i.onClick}>{corpo}</button>
          return <li key={i.key}>{el}</li>
        })}
      </ul>
    </>
  )
}

// "há 3 d", "hoje", "em 5 d" — dias < 0 = passado
export function Prazo({ dias, forte }) {
  if (dias === null || dias === undefined || Number.isNaN(dias)) return null
  const txt = dias === 0 ? 'hoje' : dias < 0 ? `há ${-dias} d` : `em ${dias} d`
  return <span className={`prazo ${forte ? 'prazo--forte' : ''}`}>{txt}</span>
}

// Envolve páginas que dependem dos dados da gestão contratual
export function GcGate({ children }) {
  const { loading, error, schemaMissing, raw, reload } = useGc()
  if (schemaMissing) {
    return (
      <div className="alert alert-warning">
        <h2 className="h6 fw-bold">Banco de dados ainda não preparado</h2>
        <p className="mb-2">
          As tabelas da gestão contratual (<code>gc_*</code>) não foram encontradas no Supabase.
          Execute o arquivo <code>backend/supabase/migrations/20261015_gestao_contratual.sql</code> no
          SQL Editor do projeto e recarregue esta página.
        </p>
        <button className="btn btn-sm btn-warning" onClick={reload}>Verificar novamente</button>
      </div>
    )
  }
  if (error && !raw) {
    return (
      <div className="alert alert-danger">
        Não foi possível carregar os dados: {error}{' '}
        <button className="btn btn-sm btn-outline-danger ms-2" onClick={reload}>Tentar novamente</button>
      </div>
    )
  }
  if (loading && !raw) {
    return (
      <div className="esqueleto" role="status">
        <span className="visually-hidden">Carregando…</span>
        <div className="esqueleto__linha" style={{ width: '32%', height: 28 }} />
        <div className="esqueleto__linha" style={{ width: '54%' }} />
        <div className="esqueleto__bloco" />
        <div className="esqueleto__bloco esqueleto__bloco--alto" />
      </div>
    )
  }
  return children
}
