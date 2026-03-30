import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Equipamentos from './pages/Equipamentos'
import Protocolos from './pages/Protocolos'
import Agenda from './pages/Agenda'
import Executar from './pages/Executar'
import Historico from './pages/Historico'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="equipamentos" element={<Equipamentos />} />
              <Route path="protocolos" element={<Protocolos />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="executar" element={<Executar />} />
              <Route path="historico" element={<Historico />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1C1C20',
              color: '#EDEDEF',
              border: '1px solid #2A2A30',
              borderRadius: '2px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#F97316', secondary: '#1C1C20' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#1C1C20' } },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  )
}
