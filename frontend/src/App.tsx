import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DataQualityView } from './components/DataQualityView'
import { LeadingIndicatorsView } from './components/LeadingIndicatorsView'
import { VisualStandardizerView } from './components/VisualStandardizerView'
import { WelcomeView } from './components/WelcomeView.tsx'
import { Profile } from './components/Profile'
import { Login } from './components/Login'
import { Register } from './components/Register'
import { ProtectedRoute } from './components/ProtectedRoute'
import type { ModuleKey } from './components/Sidebar'
import { UserProvider, useUser } from './lib/userContext.tsx'
import { ComputeModeProvider } from './lib/ComputeModeContext.jsx'
import { DeviceBlocker } from './components/DeviceBlocker'

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

const ProfilePage = () => {
  const [activeModule, setActiveModule] = useState<ModuleKey>('dq')

  return (
    <Layout activeModule={activeModule} onModuleChange={setActiveModule}>
      <Profile />
    </Layout>
  )
}

const DashboardRoute = () => {
  const { user, isLoading, refreshUser } = useUser()

  useEffect(() => {
    if (!user && !isLoading) {
      void refreshUser()
    }
  }, [user, isLoading, refreshUser])

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-600">Loading workspace...</div>
  }

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center text-slate-600">Loading workspace...</div>
  }

  if (!user.is_onboarded) {
    return <Navigate to="/welcome" replace />
  }

  return <Dashboard />
}

const WelcomeRoute = () => {
  const { user, isLoading, refreshUser } = useUser()

  useEffect(() => {
    if (!user && !isLoading) {
      void refreshUser()
    }
  }, [user, isLoading, refreshUser])

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-600">Loading workspace...</div>
  }

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center text-slate-600">Loading workspace...</div>
  }

  if (user.is_onboarded) {
    return <Navigate to="/app" replace />
  }

  return <WelcomeView />
}

function App() {
  return (
    <DeviceBlocker>
      <UserProvider>
        <ComputeModeProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/app" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/welcome"
                element={
                  <ProtectedRoute>
                    <WelcomeRoute />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <DashboardRoute />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </BrowserRouter>
        </ComputeModeProvider>
      </UserProvider>
    </DeviceBlocker>
  )
}

export default App
