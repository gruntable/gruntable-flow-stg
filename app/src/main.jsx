import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import HomePage from './pages/home/HomePage.jsx'
import Workflow from './pages/workflow/Workflow.jsx'
import TemplatesPage from './pages/templates/TemplatesPage.jsx'

function HomePageWrapper() {
  const navigate = useNavigate()
  const navigateToWorkflow = (workflowId) =>
    navigate(workflowId ? `/workflow?id=${workflowId}` : '/workflow?new=true')
  return <HomePage onNavigateToWorkflow={navigateToWorkflow} />
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePageWrapper />} />
      <Route path="/home" element={<HomePageWrapper />} />
      <Route path="/workflow" element={<Workflow />} />
      <Route path="/templates" element={<TemplatesPage />} />
    </Routes>
  </BrowserRouter>,
)
