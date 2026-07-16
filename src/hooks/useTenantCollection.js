import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

// Subscribes in real time to <collectionName> where ownerId == current tenant.
// orderByField is optional (e.g. 'date' desc-ish sorting is done client side to keep it simple).
export function useTenantCollection(collectionName) {
  const { ownerId } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ownerId) return
    setLoading(true)
    const q = query(collection(db, collectionName), where('ownerId', '==', ownerId))
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [collectionName, ownerId])

  return { items, loading }
}
