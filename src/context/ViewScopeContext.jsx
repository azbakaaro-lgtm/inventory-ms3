import { createContext, useContext, useState } from 'react'

const ViewScopeContext = createContext(null)

// Tracks which staff member's data an admin is currently browsing.
// null = "All Staff (Combined)". Only meaningful for admins — staff are
// always hard-locked to their own data regardless of this value.
export function ViewScopeProvider({ children }) {
  const [viewingUserId, setViewingUserIdState] = useState(() => {
    try { return sessionStorage.getItem('inv_ms_viewing_user') || null } catch { return null }
  })

  function setViewingUserId(uid) {
    setViewingUserIdState(uid || null)
    try {
      if (uid) sessionStorage.setItem('inv_ms_viewing_user', uid)
      else sessionStorage.removeItem('inv_ms_viewing_user')
    } catch {}
  }

  return (
    <ViewScopeContext.Provider value={{ viewingUserId, setViewingUserId }}>
      {children}
    </ViewScopeContext.Provider>
  )
}

export function useViewScope() {
  return useContext(ViewScopeContext)
}
