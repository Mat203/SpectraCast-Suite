import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ datasets: [] }),
  }),
  downloadFile: vi.fn(),
  fetchBlobUrl: vi.fn(),
}));

import { useAppStore } from '../store/useAppStore';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const persistedStore = useAppStore as unknown as {
  persist?: { clearStorage?: () => void };
};

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof globalThis.ResizeObserver;
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  writable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useAppStore.getState().resetAppState();
  persistedStore.persist?.clearStorage?.();
});

afterEach(() => {
  cleanup();
});
