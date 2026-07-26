import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

// Writes one audit trail entry. Never throws — a logging failure should
// never block the actual action the user was trying to do.
export async function logAudit({ ownerId, subOwnerId, userName, action, entityType, entityName, details }) {
  try {
    await addDoc(collection(db, 'auditLog'), {
      ownerId,
      subOwnerId,
      userName: userName || 'Unknown',
      action,
      entityType,
      entityName: entityName || null,
      details: details || null,
      at: serverTimestamp(),
    })
  } catch {
    // best-effort only
  }
}
