import { supabase } from './supabase'

// Bucket privado: os arquivos só abrem por link temporário assinado.
const BUCKET = 'anexos'

// Nome aceito pelo Storage: sem acentos, espaços ou símbolos
export const nomeSeguro = (nome) =>
  String(nome ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'arquivo'

const segmentos = (s) => String(s).split('/').filter(Boolean).map(nomeSeguro).join('/')

export const buildPath = (folder, id, filename) =>
  [segmentos(folder), segmentos(id), nomeSeguro(filename)].join('/')

export async function uploadFile(pathOrFolder, file, idOptional) {
  const path = idOptional ? buildPath(pathOrFolder, idOptional, file.name) : pathOrFolder
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined })

  if (error) throw error
  return { path, size: file.size, contentType: file.type }
}

export async function urlTemporaria(path, segundos = 300) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, segundos)
  if (error) throw error
  return data.signedUrl
}

// Abre o anexo numa nova aba. A aba é aberta antes da chamada assíncrona
// para não ser barrada pelo bloqueador de pop-ups.
export async function abrirAnexo(path) {
  const aba = window.open('', '_blank')
  try {
    const url = await urlTemporaria(path)
    if (aba) {
      aba.opener = null
      aba.location.href = url
    } else {
      window.location.href = url
    }
  } catch (err) {
    aba?.close()
    throw err
  }
}

export const removeFile = async (path) => {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
