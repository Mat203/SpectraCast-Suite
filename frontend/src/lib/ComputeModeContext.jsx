import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'spectracast_compute_mode_local';

const ComputeModeContext = createContext(null);

export const ComputeModeProvider = ({ children }) => {
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIsLocalMode(stored === 'true');
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem(STORAGE_KEY, String(isLocalMode));
  }, [isLocalMode, isReady]);

  const toggle = useCallback(() => {
    setIsLocalMode((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      isLocalMode,
      isReady,
      setIsLocalMode,
      toggle,
    }),
    [isLocalMode, isReady, toggle],
  );

  return (
    <ComputeModeContext.Provider value={value}>
      {children}
    </ComputeModeContext.Provider>
  );
};

export const useComputeMode = () => {
  const context = useContext(ComputeModeContext);
  if (!context) {
    throw new Error('useComputeMode must be used within ComputeModeProvider');
  }
  return context;
};
