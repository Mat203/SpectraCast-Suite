import { useState } from 'react'
import { Layout } from './components/Layout'
import { DataQualityView } from './components/DataQualityView'
import { LeadingIndicatorsView } from './components/LeadingIndicatorsView'
import type { ModuleKey } from './components/Sidebar'

function App() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('dq')

  return (
    <Layout activeModule={activeModule} onModuleChange={setActiveModule}>
      {activeModule === 'dq' ? <DataQualityView /> : <LeadingIndicatorsView />}
    </Layout>
  )
}

export default App
