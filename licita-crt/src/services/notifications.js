import { db } from './firebase'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'

export async function listarNotificacoesPorSetor(role, { limitN = 50 } = {}) {
  if (!role) return []
  const ref = collection(db, 'notificacoes')
  const q = query(ref, where('toRole', '==', role), orderBy('createdAt', 'desc'), limit(limitN))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
