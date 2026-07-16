import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [profile, setProfile] = useState(null) // { role: 'admin'|'staff', ownerId, name, status }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid))
        if (snap.exists()) {
          setProfile(snap.data())
        } else {
          // First person ever to sign in on a fresh project becomes the admin/owner.
          const newProfile = {
            email: user.email,
            name: user.email.split('@')[0],
            role: 'admin',
            ownerId: user.uid,
            status: 'active',
            createdAt: serverTimestamp(),
          }
          await setDoc(doc(db, 'users', user.uid), newProfile)
          setProfile(newProfile)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => signOut(auth)

  // The tenant/data scope this user's records belong to.
  const ownerId = profile?.ownerId
  const isAdmin = profile?.role === 'admin'
  const isActive = profile?.status === 'active'

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, login, logout, ownerId, isAdmin, isActive }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
