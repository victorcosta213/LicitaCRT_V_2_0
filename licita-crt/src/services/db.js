import { db } from './firebase'
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, serverTimestamp, query, where,
  orderBy, limit, startAfter, Timestamp
} from 'firebase/firestore'

// Helpers
export const nowTs = () => serverTimestamp()
export const toTs = (date) => (date instanceof Date ? Timestamp.fromDate(date) : date)

// CREATE
export async function createDoc(col, data = {}, customId) {
  const base = { ...data, createdAt: nowTs(), updatedAt: nowTs() }
  if (customId) {
    await setDoc(doc(db, col, customId), base)
    return { id: customId, ...base }
  }
  const ref = await addDoc(collection(db, col), base)
  return { id: ref.id, ...base }
}

// READ (by id)
export async function getById(col, id) {
  const snap = await getDoc(doc(db, col, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// UPDATE
export async function updateById(col, id, data = {}) {
  await updateDoc(doc(db, col, id), { ...data, updatedAt: nowTs() })
  return true
}

// DELETE
export async function removeById(col, id) {
  await deleteDoc(doc(db, col, id))
  return true
}

// LIST com filtros e ordenação
/**
 * opts: {
 *   filters: [{ field, op, value }], // op: '==','>=','<=','array-contains', etc.
 *   order:   [{ field, dir }],       // dir: 'asc'|'desc'
 *   pageSize: number,
 *   cursor: lastDocSnapshot
 * }
 */
export async function listDocs(col, opts = {}) {
  const { filters = [], order = [], pageSize = 20, cursor } = opts
  const c = collection(db, col)

  const parts = []

  // filtros
  for (const f of filters) {
    parts.push(where(f.field, f.op, f.value))
  }

  // ordenação
  for (const o of order) {
    parts.push(orderBy(o.field, o.dir || 'asc'))
  }

  // paginação
  parts.push(limit(pageSize))
  if (cursor) parts.push(startAfter(cursor))

  const q = query(c, ...parts)
  const snap = await getDocs(q)

  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null

  return { data, nextCursor }
}

// Consulta simples por igualdade
export async function findBy(col, field, value, extra = {}) {
  return listDocs(col, {
    filters: [{ field, op: '==', value }],
    ...extra
  })
}
