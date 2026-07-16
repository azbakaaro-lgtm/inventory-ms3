import { initializeApp, getApps, deleteApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Used ONLY so an admin can create a brand-new login (email/password)
// for a staff member WITHOUT getting signed out of their own session.
// Firebase's client SDK always signs in as whichever user was just
// created, so we spin up a throwaway secondary app, create the user
// there, then immediately tear that secondary app down.
export async function createUserWithoutSigningIn(email, password) {
  const secondaryName = `secondary-${Date.now()}`
  const secondaryApp = initializeApp(firebaseConfig, secondaryName)
  const secondaryAuth = getAuth(secondaryApp)
  try {
    const { createUserWithEmailAndPassword } = await import('firebase/auth')
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    return cred.user.uid
  } finally {
    await secondaryAuth.signOut().catch(() => {})
    await deleteApp(secondaryApp)
  }
}
