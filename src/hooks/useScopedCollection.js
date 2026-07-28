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
  const { ownerId, canViewAll, isManager, managerId, firebaseUser } = useAuth()
  const { viewingUserId } = useViewScope()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ownerId) return
    setLoading(true)
    const constraints = [where('ownerId', '==', ownerId)]
    if (canViewAll) {
      if (viewingUserId) constraints.push(where('subOwnerId', '==', viewingUserId))
    } else if (isManager) {
      // A branch manager sees their own records plus every sub-user they created.
      constraints.push(where('branchOwnerId', '==', firebaseUser.uid))
    } else {
      // A sub-user only ever sees their own records — not their manager's,
      // and not any sibling sub-user's.
      constraints.push(where('subOwnerId', '==', firebaseUser.uid))
    }
    const q = query(collection(db, collectionName), ...constraints)
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [collectionName, ownerId, canViewAll, isManager, managerId, firebaseUser?.uid, viewingUserId])

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

// The CURRENT user's own working set of records for creating something new
// (product pickers in Sales/Stock In/Stock Out/POS forms) — regardless of
// what an admin elsewhere is "viewing":
// - A sub-user only ever works with their own records.
// - A manager (or admin/accountant using their own account) works with
//   their whole branch's records — their own plus every sub-user they created.
export function useOwnCollection(collectionName) {
  const { ownerId, firebaseUser, managerId, branchOwnerId } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ownerId || !firebaseUser) return
    setLoading(true)
    const q = managerId
      ? query(collection(db, collectionName), where('ownerId', '==', ownerId), where('subOwnerId', '==', firebaseUser.uid))
      : query(collection(db, collectionName), where('ownerId', '==', ownerId), where('branchOwnerId', '==', branchOwnerId))
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [collectionName, ownerId, firebaseUser?.uid, managerId, branchOwnerId])

  return { items, loading }
}
