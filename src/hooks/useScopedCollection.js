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

    if (isManager && !canViewAll) {
      // A branch manager sees their own records (matched by subOwnerId —
      // this always works, even for records created before branchOwnerId
      // existed) PLUS every sub-user's records (matched by branchOwnerId).
      // Two listeners merged client-side, since Firestore can't OR across
      // two different fields without a manually-created composite index.
      const ownQ = query(collection(db, collectionName), where('ownerId', '==', ownerId), where('subOwnerId', '==', firebaseUser.uid))
      const branchQ = query(collection(db, collectionName), where('ownerId', '==', ownerId), where('branchOwnerId', '==', firebaseUser.uid))
      let ownDocs = new Map()
      let branchDocs = new Map()
      const merge = () => {
        const combined = new Map([...ownDocs, ...branchDocs])
        setItems([...combined.values()])
        setLoading(false)
      }
      const unsub1 = onSnapshot(ownQ, (snap) => {
        ownDocs = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))
        merge()
      })
      const unsub2 = onSnapshot(branchQ, (snap) => {
        branchDocs = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))
        merge()
      })
      return () => { unsub1(); unsub2() }
    }

    const constraints = [where('ownerId', '==', ownerId)]
    if (canViewAll) {
      if (viewingUserId) constraints.push(where('subOwnerId', '==', viewingUserId))
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

    if (managerId) {
      // A sub-user only ever works with their own records.
      const q = query(collection(db, collectionName), where('ownerId', '==', ownerId), where('subOwnerId', '==', firebaseUser.uid))
      const unsub = onSnapshot(q, (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      })
      return unsub
    }

    // A manager (or admin/accountant using their own account) works with
    // their whole branch — their own records (matched by subOwnerId, which
    // always works even for records older than branchOwnerId) plus every
    // sub-user's records (matched by branchOwnerId). Merged client-side.
    const ownQ = query(collection(db, collectionName), where('ownerId', '==', ownerId), where('subOwnerId', '==', firebaseUser.uid))
    const branchQ = query(collection(db, collectionName), where('ownerId', '==', ownerId), where('branchOwnerId', '==', branchOwnerId))
    let ownDocs = new Map()
    let branchDocs = new Map()
    const merge = () => {
      const combined = new Map([...ownDocs, ...branchDocs])
      setItems([...combined.values()])
      setLoading(false)
    }
    const unsub1 = onSnapshot(ownQ, (snap) => {
      ownDocs = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))
      merge()
    })
    const unsub2 = onSnapshot(branchQ, (snap) => {
      branchDocs = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))
      merge()
    })
    return () => { unsub1(); unsub2() }
  }, [collectionName, ownerId, firebaseUser?.uid, managerId, branchOwnerId])

  return { items, loading }
}
