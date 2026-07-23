import { createContext, useContext, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './AuthContext'

const ThemeContext = createContext(null)

export const BUILT_IN_THEMES = [
  {
    id: 'teal-gold',
    name: 'Teal & Gold (default)',
    builtIn: true,
    colors: {
      '--teal-900': '#073b3a', '--teal-800': '#0b4f4d', '--teal-700': '#0f6b66',
      '--teal-600': '#16897f', '--teal-500': '#1fa895',
      '--gold-500': '#e6b94d', '--gold-400': '#f0cd73',
      '--bg': '#f4faf9', '--surface': '#ffffff', '--surface-2': '#eef7f5',
      '--text-main': '#0d2b2a', '--text-muted': '#52706d', '--border': '#d9ece9',
    },
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    builtIn: true,
    colors: {
      '--teal-900': '#0a2540', '--teal-800': '#0f3562', '--teal-700': '#144a86',
      '--teal-600': '#1a63ad', '--teal-500': '#2a80d6',
      '--gold-500': '#f0a94e', '--gold-400': '#f3bd73',
      '--bg': '#f2f7fc', '--surface': '#ffffff', '--surface-2': '#e9f1fa',
      '--text-main': '#0b1f33', '--text-muted': '#4d6178', '--border': '#d7e4f2',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    builtIn: true,
    colors: {
      '--teal-900': '#3d1f0f', '--teal-800': '#5c2c14', '--teal-700': '#7a3b1a',
      '--teal-600': '#9c4d20', '--teal-500': '#c0642a',
      '--gold-500': '#e8a33d', '--gold-400': '#f0bd6b',
      '--bg': '#fbf5ef', '--surface': '#ffffff', '--surface-2': '#f7ebdd',
      '--text-main': '#2e1a0d', '--text-muted': '#785a44', '--border': '#efdcc4',
    },
  },
  {
    id: 'dark-mode',
    name: 'Dark Mode',
    builtIn: true,
    colors: {
      '--teal-900': '#04100f', '--teal-800': '#07211f', '--teal-700': '#0d332f',
      '--teal-600': '#144b45', '--teal-500': '#1c665e',
      '--gold-500': '#e6b94d', '--gold-400': '#f0cd73',
      '--bg': '#0f1715', '--surface': '#16221f', '--surface-2': '#1c2b27',
      '--text-main': '#eafffb', '--text-muted': '#9fc3bd', '--border': '#283a35',
    },
  },
  {
    id: 'red-black',
    name: 'Red & Black',
    builtIn: true,
    colors: {
      '--teal-900': '#1a1a1a', '--teal-800': '#3d1310', '--teal-700': '#5c1c17',
      '--teal-600': '#c0392b', '--teal-500': '#d9584a',
      '--gold-500': '#e6b94d', '--gold-400': '#f0cd73',
      '--bg': '#fdf6f5', '--surface': '#ffffff', '--surface-2': '#fbeceb',
      '--text-main': '#1a1010', '--text-muted': '#7a6660', '--border': '#f0dedc',
    },
  },
]

function applyThemeColors(colors) {
  const root = document.documentElement
  Object.entries(colors).forEach(([key, value]) => root.style.setProperty(key, value))
}

export function ThemeProvider({ children }) {
  const { profile } = useAuth()
  const ownerId = profile?.ownerId
  const [customThemes, setCustomThemes] = useState([])
  const [activeThemeId, setActiveThemeId] = useState('red-black')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!ownerId) return
    const ref = doc(db, 'themeSettings', ownerId)
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setCustomThemes(data.customThemes || [])
        setActiveThemeId(data.activeThemeId || 'red-black')
      } else {
        setCustomThemes([])
        setActiveThemeId('red-black')
      }
      setLoaded(true)
    })
    return unsub
  }, [ownerId])

  const allThemes = [...BUILT_IN_THEMES, ...customThemes]

  useEffect(() => {
    const theme = allThemes.find((t) => t.id === activeThemeId) || BUILT_IN_THEMES[0]
    applyThemeColors(theme.colors)
  }, [activeThemeId, customThemes])

  async function setActiveTheme(themeId) {
    setActiveThemeId(themeId) // instant local feedback
    if (!ownerId) return
    await setDoc(doc(db, 'themeSettings', ownerId), { activeThemeId: themeId }, { merge: true })
  }

  async function addTheme(name, colors) {
    if (!ownerId) return
    const id = `custom-${Date.now()}`
    const next = [...customThemes, { id, name, builtIn: false, colors }]
    setCustomThemes(next)
    await setDoc(doc(db, 'themeSettings', ownerId), { customThemes: next }, { merge: true })
    return id
  }

  async function deleteTheme(themeId) {
    if (!ownerId) return
    const next = customThemes.filter((t) => t.id !== themeId)
    setCustomThemes(next)
    const patch = { customThemes: next }
    if (activeThemeId === themeId) patch.activeThemeId = 'red-black'
    await setDoc(doc(db, 'themeSettings', ownerId), patch, { merge: true })
  }

  return (
    <ThemeContext.Provider value={{ themes: allThemes, activeThemeId, setActiveTheme, addTheme, deleteTheme, loaded }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
