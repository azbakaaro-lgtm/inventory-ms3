import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

// Returns the store's custom uploaded logo (a data URL) if the admin has set
// one in Settings → Payment Methods, otherwise the app's default icon.
export function useAppLogo() {
  const { ownerId } = useAuth()
  const [logo, setLogo] = useState('/icon.png')

  useEffect(() => {
    if (!ownerId) return
    const unsub = onSnapshot(doc(db, 'posSettings', ownerId), (snap) => {
      const data = snap.data()
      setLogo(data?.appLogo || '/icon.png')
    })
    return unsub
  }, [ownerId])

  return logo
}
