// Catálogo de modelos de documento: o que cada perfil pode criar e como achar um modelo.
import { isMaster, normalizeRole } from '../utils/permissions'
import { MODELOS_COMUNS, CAT_COMUM } from './comuns'
import { MODELOS_PLANEJAMENTO, CAT_PLAN } from './planejamento'
import { MODELOS_CONTRATACAO, CAT_CONTR } from './contratacao'
import { MODELOS_GESTAO, CAT_GESTAO, CAT_SETORIAIS } from './gestao'

export const MODELOS = [...MODELOS_COMUNS, ...MODELOS_PLANEJAMENTO, ...MODELOS_CONTRATACAO, ...MODELOS_GESTAO]
export const CATEGORIAS = [CAT_COMUM, CAT_PLAN, CAT_CONTR, CAT_GESTAO, CAT_SETORIAIS]

const porCodigo = new Map(MODELOS.map((m) => [m.codigo, m]))
export const modeloPorCodigo = (codigo) => porCodigo.get(codigo) || null

// Administração e presidência podem usar todos os modelos; os demais, os do seu perfil
export const podeUsarModelo = (modelo, role) => isMaster(role) || modelo.perfis.includes(normalizeRole(role))
export const modelosDoPerfil = (role) => MODELOS.filter((m) => podeUsarModelo(m, role))

export function agruparPorCategoria(modelos) {
  return CATEGORIAS.map((categoria) => ({ categoria, modelos: modelos.filter((m) => m.categoria === categoria) })).filter((g) => g.modelos.length)
}
