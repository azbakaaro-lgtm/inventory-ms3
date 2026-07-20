import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useViewScope } from '../context/ViewScopeContext'

// Like useTenantCollection, but for data that belongs to a specific staff
// member's own sub-store (Products, Stock In, Stock Out, Sales):
// - Staff only ever see their OWN records (hard-locked, also enforced by
//   Firestore rules — this isn't just a UI filter).
// - Admins see every staff member's records combined by default, or one
//   specific person's when they pick them from the "Viewing" selector.
export function useScopedCollection(collectionName) {
  const { ownerId, isAdmin, firebaseUser } = useAuth()
  const { viewingUserId } = useViewScope()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ownerId) return
    setLoading(true)
    const constraints = [where('ownerId', '==', ownerId)]
    if (!isAdmin) {
      constraints.push(where('subOwnerId', '==', firebaseUser.uid))
    } else if (viewingUserId) {
      constraints.push(where('subOwnerId', '==', viewingUserId))
    }
    const q = query(collection(db, collectionName), ...constraints)
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [collectionName, ownerId, isAdmin, firebaseUser?.uid, viewingUserId])

  return { items, loading }
}

// Fetches products belonging to one specific sub-owner (regardless of who's
// currently logged in or what an admin is "viewing"). Used when editing an
// existing Sale/Stock entry — the product picker must show the ORIGINAL
// creator's products, not necessarily the current editor's own.
export function useProductsForSubOwner(subOwnerId) {
  const { ownerId } = useAuth()
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!ownerId || !subOwnerId) { setItems([]); return }
    const q = query(
      collection(db, 'products'),
      where('ownerId', '==', ownerId),
      where('subOwnerId', '==', subOwnerId)
    )
    const unsub = onSnapshot(q, (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [ownerId, subOwnerId])

  return items
}

// Always the CURRENT user's own records, regardless of what an admin is
// "viewing" elsewhere — used for product pickers in Sales/Stock In/Stock Out
// forms, since creating a record always acts on the creator's own sub-store.
export function useOwnCollection(collectionName) {
  const { ownerId, firebaseUser } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ownerId || !firebaseUser) return
    setLoading(true)
    const q = query(
      collection(db, collectionName),
      where('ownerId', '==', ownerId),
      where('subOwnerId', '==', firebaseUser.uid)
    )
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [collectionName, ownerId, firebaseUser?.uid])

  return { items, loading }
}
