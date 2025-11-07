import { db } from './firebase'
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, serverTimestamp, query, where,
  orderBy, limit, startAfter, Timestamp
} from 'firebase/firestore'


export const nowTs = () => serverTimestamp()
export const toTs = (date) => (date instanceof Date ? Timestamp.fromDate(date) : date)

export async function createDoc(col, data = {}, customId) {
  const base = { ...data, createdAt: nowTs(), updatedAt: nowTs() }
  if (customId) {
    await setDoc(doc(db, col, customId), base)
    return { id: customId, ...base }
  }
  const ref = await addDoc(collection(db, col), base)
  return { id: ref.id, ...base }
}

export async function getById(col, id) {
  const snap = await getDoc(doc(db, col, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function updateById(col, id, data = {}) {
  await updateDoc(doc(db, col, id), { ...data, updatedAt: nowTs() })
  return true
}


export async function removeById(col, id) {
  await deleteDoc(doc(db, col, id))
  return true
}


export async function listDocs(col, opts = {}) {
  const { filters = [], order = [], pageSize = 20, cursor } = opts
  const c = collection(db, col)

  const parts = []

  for (const f of filters) {
    parts.push(where(f.field, f.op, f.value))
  }

  for (const o of order) {
    parts.push(orderBy(o.field, o.dir || 'asc'))
  }

  parts.push(limit(pageSize))
  if (cursor) parts.push(startAfter(cursor))

  const q = query(c, ...parts)
  const snap = await getDocs(q)

  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null

  return { data, nextCursor }
}

export async function findBy(col, field, value, extra = {}) {
  return listDocs(col, {
    filters: [{ field, op: '==', value }],
    ...extra
  })
}
