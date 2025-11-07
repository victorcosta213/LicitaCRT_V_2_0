import { storage } from './firebase'
import {
  ref, uploadBytes, uploadString, getDownloadURL, deleteObject
} from 'firebase/storage'

export const buildPath = (folder, id, filename) =>
  `${folder}/${id}/${filename}`.replace(/\/+/g, '/')

export async function uploadFile(pathOrFolder, file, idOptional) {
  const path = idOptional ? buildPath(pathOrFolder, idOptional, file.name) : pathOrFolder
  const storageRef = ref(storage, path)
  const snap = await uploadBytes(storageRef, file, { contentType: file.type })
  const url = await getDownloadURL(snap.ref)
  return { path, url, size: snap.metadata.size, contentType: snap.metadata.contentType }
}

export async function uploadDataURL(path, dataUrl) {
  const storageRef = ref(storage, path)
  const snap = await uploadString(storageRef, dataUrl, 'data_url')
  const url = await getDownloadURL(snap.ref)
  return { path, url, size: snap.metadata.size, contentType: snap.metadata.contentType }
}

export const getUrl = async (path) => getDownloadURL(ref(storage, path))

export const removeFile = async (path) => deleteObject(ref(storage, path))
