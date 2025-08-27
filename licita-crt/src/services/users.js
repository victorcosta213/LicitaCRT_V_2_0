// src/services/users.js
import { db } from './firebase'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'

/**
 * Retorna o papel do usuário ('admin' | 'comum').
 * Tenta primeiro por doc id == uid; se não achar, tenta por e-mail.
 */
export async function getUserRole(uid, email) {
  try {
    if (uid) {
      const snap = await getDoc(doc(db, 'usuarios', uid))
      if (snap.exists()) {
        return snap.data().role || 'comum'
      }
    }
    if (email) {
      const q = query(collection(db, 'usuarios'), where('email', '==', email))
      const res = await getDocs(q)
      if (!res.empty) {
        return res.docs[0].data().role || 'comum'
      }
    }
  } catch (e) {
    console.error('[getUserRole] erro:', e)
  }
  return 'comum'
}
