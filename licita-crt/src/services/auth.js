import { auth } from './firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  onAuthStateChanged,
} from 'firebase/auth'

export const login = (email, password) =>
  signInWithEmailAndPassword(auth, email, password)

export const register = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password)

export const resetPassword = (email) => sendPasswordResetEmail(auth, email)

export const changePassword = (newPassword) => updatePassword(auth.currentUser, newPassword)

export const logout = () => signOut(auth)

// Observer (use em context/provider)
export const onUserChanged = (cb) => onAuthStateChanged(auth, cb)
