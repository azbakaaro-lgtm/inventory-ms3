import { useEffect, useRef } from 'react'
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { signOut } from 'firebase/auth'
import { getDeviceType, getBrowserName, getOS, fetchPublicIp, getOrCreateSessionId } from '../utils/deviceInfo'

const HEARTBEAT_MS = 60 * 1000
// A session with no heartbeat in this long is treated as "offline" by viewers.
export const ONLINE_WINDOW_MS = 2 * 60 * 1000

// Registers this browser tab as a "session" for the signed-in user, keeps
// it alive with a heartbeat, and signs the user out immediately if an
// admin force-logs-out or removes this session from the Active Sessions page.
export function useSessionTracker({ firebaseUser, profile }) {
  const sessionIdRef = useRef(null)

  useEffect(() => {
    if (!firebaseUser || !profile?.ownerId) return
    const sessionId = getOrCreateSessionId()
    sessionIdRef.current = sessionId
    const ref = doc(db, 'sessions', sessionId)
    let cancelled = false

    async function register() {
      const ip = await fetchPublicIp()
      if (cancelled) return
      await setDoc(ref, {
        uid: firebaseUser.uid,
        ownerId: profile.ownerId,
        userName: profile.name || firebaseUser.email,
        email: firebaseUser.email,
        role: profile.role || 'staff',
        device: getDeviceType(),
        browser: getBrowserName(),
        os: getOS(),
        ip: ip || null,
        loginAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        forceLogout: false,
      }, { merge: true })
    }
    register()

    const heartbeat = setInterval(() => {
      setDoc(ref, { lastActive: serverTimestamp(), forceLogout: false }, { merge: true }).catch(() => {})
    }, HEARTBEAT_MS)

    // Listen for an admin forcing this exact session out.
    const unsubListener = onSnapshot(ref, (snap) => {
      if (snap.exists() && snap.data().forceLogout) {
        signOut(auth).catch(() => {})
      }
    })

    function markActive() {
      setDoc(ref, { lastActive: serverTimestamp() }, { merge: true }).catch(() => {})
    }
    document.addEventListener('visibilitychange', markActive)
    window.addEventListener('focus', markActive)

    return () => {
      cancelled = true
      clearInterval(heartbeat)
      unsubListener()
      document.removeEventListener('visibilitychange', markActive)
      window.removeEventListener('focus', markActive)
    }
  }, [firebaseUser, profile?.ownerId])

  // Call on explicit logout so the session disappears immediately instead
  // of waiting to be marked offline.
  async function endSession() {
    if (sessionIdRef.current) {
      await deleteDoc(doc(db, 'sessions', sessionIdRef.current)).catch(() => {})
    }
  }

  return { endSession }
}
