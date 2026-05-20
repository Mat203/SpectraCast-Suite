import React, { useState, useEffect } from 'react';

export const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasConsent = localStorage.getItem('spectracast_cookie_consent');
    if (!hasConsent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('spectracast_cookie_consent', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-slate-900 text-white p-4 md:p-6 shadow-lg">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <p className="text-sm md:text-base leading-relaxed">
          We use strictly necessary cookies to keep you logged in and ensure the app functions correctly. We do not use marketing or tracking cookies.
        </p>
        <button
          onClick={handleAccept}
          className="flex-shrink-0 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
