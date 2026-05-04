import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DataQualityView } from './components/DataQualityView'
import { LeadingIndicatorsView } from './components/LeadingIndicatorsView'
import { VisualStandardizerView } from './components/VisualStandardizerView'
import { Login } from './components/Login'
import { Register } from './components/Register'
import { ProtectedRoute } from './components/ProtectedRoute'
import type { ModuleKey } from './components/Sidebar'

const Dashboard = () => {
  const [activeModule, setActiveModule] = useState<ModuleKey>('dq')

  return (
    <Layout activeModule={activeModule} onModuleChange={setActiveModule}>
      {activeModule === 'dq' && <DataQualityView />}
      {activeModule === 'li' && <LeadingIndicatorsView />}
      {activeModule === 'vs' && <VisualStandardizerView />}
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
