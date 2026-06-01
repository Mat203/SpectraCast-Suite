import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { ComputeModeProvider } from '../lib/ComputeModeContext.jsx';

type ProvidersProps = {
  children: React.ReactNode;
};

const Providers = ({ children }: ProvidersProps) => (
  <ComputeModeProvider>{children}</ComputeModeProvider>
);

export const renderWithProviders = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: Providers, ...options });
