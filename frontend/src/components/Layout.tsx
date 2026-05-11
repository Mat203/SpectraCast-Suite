import React, { useState } from 'react';
import { Sidebar, type ModuleKey } from './Sidebar';
import { HelpPrivacyButton } from './HelpPrivacyButton';
import { HelpPrivacyModal } from './HelpPrivacyModal';
import { CookieConsentBanner } from './CookieConsentBanner';

interface LayoutProps {
  children: React.ReactNode;
  activeModule: ModuleKey;
  onModuleChange: (module: ModuleKey) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeModule, onModuleChange }) => {
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
      <Sidebar activeModule={activeModule} onModuleChange={onModuleChange} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      
      {/* Floating Help Button and Modal */}
      <HelpPrivacyButton onClick={() => setIsHelpModalOpen(true)} />
      <HelpPrivacyModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
      
      {/* Cookie Consent Banner */}
      <CookieConsentBanner />
    </div>
  );
};
