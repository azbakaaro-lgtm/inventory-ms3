import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useSessionTracker } from '../hooks/useSessionTracker'

// Ensures the signed-in session survives page refreshes and app restarts
// on this device (this is the default for web, but set explicitly so
// behavior doesn't silently change across Firebase SDK versions).
setPersistence(auth, browserLocalPersistence).catch(() => {})

const AuthContext = createContext(null)

function pinStorageKey(uid) {
  return `inv_ms_pin_unlocked_${uid}`
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [profile, setProfile] = useState(null) // { role: 'admin'|'staff', ownerId, name, status, pin }
  const [loading, setLoading] = useState(true)
  const [pinUnlocked, setPinUnlocked] = useState(false)

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
        // A PIN unlock only needs to happen once per browser tab session —
        // sessionStorage clears itself when the tab/browser is closed.
        setPinUnlocked(sessionStorage.getItem(pinStorageKey(user.uid)) === '1')
      } else {
        setProfile(null)
        setPinUnlocked(false)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const { endSession } = useSessionTracker({ firebaseUser, profile })

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = async () => {
    if (firebaseUser) sessionStorage.removeItem(pinStorageKey(firebaseUser.uid))
    setPinUnlocked(false)
    await endSession()
    await signOut(auth)
  }

  async function setUserPin(newPin) {
    if (!firebaseUser) return
    await setDoc(doc(db, 'users', firebaseUser.uid), { pin: newPin }, { merge: true })
    setProfile((p) => ({ ...p, pin: newPin }))
    sessionStorage.setItem(pinStorageKey(firebaseUser.uid), '1')
    setPinUnlocked(true)
  }

  function unlockWithPin(enteredPin) {
    if (!profile?.pin || enteredPin !== profile.pin) return false
    sessionStorage.setItem(pinStorageKey(firebaseUser.uid), '1')
    setPinUnlocked(true)
    return true
  }

  // The tenant/data scope this user's records belong to.
  const ownerId = profile?.ownerId
  const isAdmin = profile?.role === 'admin'
  const isActive = profile?.status === 'active'

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, login, logout, ownerId, isAdmin, isActive, pinUnlocked, unlockWithPin, setUserPin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
