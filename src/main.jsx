import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import HomePage from './features/home/HomePage.jsx'
import Workspace from './features/workspace/Workspace.jsx'
import { AuthProvider, useAuth } from './features/auth/AuthProvider.jsx'
import AuthView from './features/auth/AuthView.jsx'

function HomePageWrapper() {
  const navigate = useNavigate()
  const navigateToWorkflow = (workflowId) =>
    navigate(workflowId ? `/workflow?id=${workflowId}` : '/workflow')
  return <HomePage onNavigateToWorkflow={navigateToWorkflow} />
}

function AppWithAuth() {
  const { session, loading } = useAuth()
  
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0e1015', color: '#58a6ff' }}>
        <div style={{ width: '30px', height: '30px', border: '3px solid rgba(88, 166, 255, 0.3)', borderRadius: '50%', borderTopColor: '#58a6ff', animation: 'spin 0.8s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  
  if (!session) {
    return <AuthView />
  }
  
  return (
    <Routes>
      <Route path="/" element={<Workspace />} />
      <Route path="/workspace" element={<Workspace />} />
      <Route path="/home" element={<HomePageWrapper />} />
      <Route path="/workflow" element={<Workspace />} />
    </Routes>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <AppWithAuth />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
