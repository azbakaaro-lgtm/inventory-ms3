// Lightweight, dependency-free parsing of navigator.userAgent.
// Good enough to label sessions in the Active Sessions admin view —
// not meant to be a bulletproof UA parser.

export function getDeviceType() {
  const ua = navigator.userAgent || ''
  if (/iPad|Tablet(?!.*Mobile)|Nexus 7|Nexus 10|KFAPWI/i.test(ua)) return 'Tablet'
  if (/Mobi|Android(?=.*Mobile)|iPhone|iPod/i.test(ua)) return 'Mobile'
  return 'Desktop'
}

export function getBrowserName() {
  const ua = navigator.userAgent || ''
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR\//.test(ua)) return 'Opera'
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari'
  return 'Unknown browser'
}

export function getOS() {
  const ua = navigator.userAgent || ''
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown OS'
}

// Best-effort public IP lookup. Purely client-side (no server on this
// project), so it reflects the caller's public/NAT address and can fail
// silently if the network blocks it — callers should treat null as
// "Unavailable" rather than an error.
export async function fetchPublicIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    if (!res.ok) return null
    const data = await res.json()
    return data.ip || null
  } catch {
    return null
  }
}

export function getOrCreateSessionId() {
  const key = 'inv_ms_session_id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    sessionStorage.setItem(key, id)
  }
  return id
}
