import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import StockIn from './pages/StockIn'
import StockOut from './pages/StockOut'
import Sales from './pages/Sales'
import Customers from './pages/Customers'
import Analytics from './pages/Analytics'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

function Page({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Page><Dashboard /></Page>} />
      <Route path="/products" element={<Page><Products /></Page>} />
      <Route path="/stock-in" element={<Page><StockIn /></Page>} />
      <Route path="/stock-out" element={<Page><StockOut /></Page>} />
      <Route path="/sales" element={<Page><Sales /></Page>} />
      <Route path="/customers" element={<Page><Customers /></Page>} />
      <Route path="/analytics" element={<Page><Analytics /></Page>} />
      <Route path="/reports" element={<Page><Reports /></Page>} />
      <Route path="/settings" element={<Page><Settings /></Page>} />
    </Routes>
  )
}
