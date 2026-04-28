import React from 'react';
import { Sidebar, type ModuleKey } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  activeModule: ModuleKey;
  onModuleChange: (module: ModuleKey) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeModule, onModuleChange }) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
      <Sidebar activeModule={activeModule} onModuleChange={onModuleChange} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};
