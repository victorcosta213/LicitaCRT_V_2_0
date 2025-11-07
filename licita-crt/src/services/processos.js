import { db } from './firebase'
import { collection, getDocs } from 'firebase/firestore'

export async function listarProcessos() {
  const snap = await getDocs(collection(db, 'processos'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
