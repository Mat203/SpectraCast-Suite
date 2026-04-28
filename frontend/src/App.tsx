import { useState } from 'react'
import { Layout } from './components/Layout'
import { DataQualityView } from './components/DataQualityView'
import { LeadingIndicatorsView } from './components/LeadingIndicatorsView'
import { VisualStandardizerView } from './components/VisualStandardizerView'
import type { ModuleKey } from './components/Sidebar'

function App() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('dq')

  return (
    <Layout activeModule={activeModule} onModuleChange={setActiveModule}>
      {activeModule === 'dq' && <DataQualityView />}
      {activeModule === 'li' && <LeadingIndicatorsView />}
      {activeModule === 'vs' && <VisualStandardizerView />}
    </Layout>
  )
}

export default App
