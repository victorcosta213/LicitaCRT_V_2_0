import { storage } from './firebase'
import {
  ref, uploadBytes, uploadString, getDownloadURL, deleteObject
} from 'firebase/storage'

/**
 * Cria um caminho padrão de arquivo
 * ex.: `anexos/processoId/filename.ext`
 */
export const buildPath = (folder, id, filename) =>
  `${folder}/${id}/${filename}`.replace(/\/+/g, '/')

// Upload de arquivo (Blob/File)
export async function uploadFile(pathOrFolder, file, idOptional) {
  const path = idOptional ? buildPath(pathOrFolder, idOptional, file.name) : pathOrFolder
  const storageRef = ref(storage, path)
  const snap = await uploadBytes(storageRef, file, { contentType: file.type })
  const url = await getDownloadURL(snap.ref)
  return { path, url, size: snap.metadata.size, contentType: snap.metadata.contentType }
}

// Upload de string (ex.: base64 dataURL)
export async function uploadDataURL(path, dataUrl) {
  const storageRef = ref(storage, path)
  const snap = await uploadString(storageRef, dataUrl, 'data_url')
  const url = await getDownloadURL(snap.ref)
  return { path, url, size: snap.metadata.size, contentType: snap.metadata.contentType }
}

// Obter URL pública
export const getUrl = async (path) => getDownloadURL(ref(storage, path))

// Excluir
export const removeFile = async (path) => deleteObject(ref(storage, path))
