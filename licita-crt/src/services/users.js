import { db } from './firebase'
import {
  doc, getDoc, setDoc, getDocs, updateDoc,
  collection, query, where, serverTimestamp,
} from 'firebase/firestore'
import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'

// ─── Role lookup (já existia) ────────────────────────────────────────────────
export async function getUserRole(uid, email) {
  try {
    if (uid) {
      const snap = await getDoc(doc(db, 'usuarios', uid))
      if (snap.exists()) return snap.data().role || 'viewer'
    }
    if (email) {
      const q = query(collection(db, 'usuarios'), where('email', '==', email))
      const res = await getDocs(q)
      if (!res.empty) return res.docs[0].data().role || 'viewer'
    }
  } catch (e) {
    console.error('[getUserRole] erro:', e)
  }
  return 'viewer'
}

// ─── Listar todos os usuários ─────────────────────────────────────────────────
export async function listarUsuarios() {
  const snap = await getDocs(collection(db, 'usuarios'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ─── Criar usuário (instância secundária — admin NÃO perde sessão) ────────────
let _secondaryAuth = null

function getSecondaryAuth() {
  if (_secondaryAuth) return _secondaryAuth
  const cfg = {
    apiKey: import.meta.env.VITE_FB_API_KEY,
    authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FB_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FB_APP_ID,
  }
  const secondaryApp = initializeApp(cfg, 'secondary-create-user')
  _secondaryAuth = getAuth(secondaryApp)
  return _secondaryAuth
}

export async function criarUsuario({ nome, email, password, role }) {
  // 1. Cria no Auth sem deslogar o admin
  const secondaryAuth = getSecondaryAuth()
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
  const uid = cred.user.uid

  // 2. Desconecta a sessão secundária
  await secondaryAuth.signOut()

  // 3. Salva perfil no Firestore
  await setDoc(doc(db, 'usuarios', uid), {
    nome,
    email,
    role,
    ativo: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return uid
}

// ─── Atualizar nome e/ou role ──────────────────────────────────────────────────
export async function atualizarUsuario(uid, { nome, role }) {
  await updateDoc(doc(db, 'usuarios', uid), {
    ...(nome !== undefined && { nome }),
    ...(role !== undefined && { role }),
    updatedAt: serverTimestamp(),
  })
}

// ─── Ativar / Desativar ────────────────────────────────────────────────────────
export async function toggleAtivo(uid, ativo) {
  await updateDoc(doc(db, 'usuarios', uid), {
    ativo,
    updatedAt: serverTimestamp(),
  })
}
