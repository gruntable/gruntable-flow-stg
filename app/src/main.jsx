import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import HomePage from './features/home/HomePage.jsx'
import Workspace from './features/workspace/Workspace.jsx'

function HomePageWrapper() {
  const navigate = useNavigate()
  const navigateToWorkflow = (workflowId) =>
    navigate(workflowId ? `/workflow?id=${workflowId}` : '/workflow')
  return <HomePage onNavigateToWorkflow={navigateToWorkflow} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Workspace />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/home" element={<HomePageWrapper />} />
        <Route path="/workflow" element={<Workspace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
