import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import posthog from 'posthog-js'
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

const Dashboard = ({ activeModule, setActiveModule }: { activeModule: ModuleKey; setActiveModule: (module: ModuleKey) => void }) => {
  return (
    <Layout activeModule={activeModule} onModuleChange={setActiveModule}>
      {activeModule === 'dq' && <DataQualityView />}
      {activeModule === 'li' && <LeadingIndicatorsView />}
      {activeModule === 'vs' && <VisualStandardizerView />}
    </Layout>
  )
}

const ProfilePage = ({ activeModule, setActiveModule }: { activeModule: ModuleKey; setActiveModule: (module: ModuleKey) => void }) => {
  return (
    <Layout activeModule={activeModule} onModuleChange={setActiveModule}>
      <Profile />
    </Layout>
  )
}

const DashboardRoute = ({ activeModule, setActiveModule }: { activeModule: ModuleKey; setActiveModule: (module: ModuleKey) => void }) => {
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

  return <Dashboard activeModule={activeModule} setActiveModule={setActiveModule} />
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

function PostHogPageviewTracker() {
  const location = useLocation()
  useEffect(() => {
    posthog.capture('$pageview')
  }, [location.pathname])
  return null
}

function App() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('dq')

  return (
    <DeviceBlocker>
      <UserProvider>
        <ComputeModeProvider>
          <BrowserRouter>
            <PostHogPageviewTracker />
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
                    <DashboardRoute activeModule={activeModule} setActiveModule={setActiveModule} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage activeModule={activeModule} setActiveModule={setActiveModule} />
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
