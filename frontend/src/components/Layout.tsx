import React, { useState } from 'react';
import { Sidebar, type ModuleKey } from './Sidebar';
import { HelpPrivacyButton } from './HelpPrivacyButton';
import { HelpPrivacyModal } from './HelpPrivacyModal';
import { CookieConsentBanner } from './CookieConsentBanner';
import { ProgressToast } from './ProgressToast';
import { LeadingIndicatorsStreamManager } from './LeadingIndicatorsStreamManager';
import { useAppStore } from '../store/useAppStore';

interface LayoutProps {
  children: React.ReactNode;
  activeModule: ModuleKey;
  onModuleChange: (module: ModuleKey) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeModule, onModuleChange }) => {
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const toastVisible = useAppStore((state) => state.leadingIndicatorsStream.toastVisible);
  const toastMode = useAppStore((state) => state.leadingIndicatorsStream.toastMode);
  const currentStage = useAppStore((state) => state.leadingIndicatorsStream.currentStage);
  const toastError = useAppStore((state) => state.leadingIndicatorsStream.error);
  const dismissToast = useAppStore((state) => state.dismissLeadingIndicatorsToast);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
      <Sidebar activeModule={activeModule} onModuleChange={onModuleChange} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      <ProgressToast
        isOpen={toastVisible}
        mode={toastMode}
        currentStage={currentStage}
        errorText={toastError}
        onClose={dismissToast}
      />

      <LeadingIndicatorsStreamManager />
      
      <HelpPrivacyButton onClick={() => setIsHelpModalOpen(true)} />
      <HelpPrivacyModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
      
      <CookieConsentBanner />
    </div>
  );
};
