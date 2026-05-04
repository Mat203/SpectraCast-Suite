import { clearToken, getToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

type ApiFetchOptions = RequestInit & { auth?: boolean };

const buildUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
};

export const apiFetch = (path: string, options: ApiFetchOptions = {}) => {
  const { auth = true, headers, ...rest } = options;
  const nextHeaders = new Headers(headers || {});

  if (auth) {
    const token = getToken();
    if (token) {
      nextHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  return fetch(buildUrl(path), { ...rest, headers: nextHeaders }).then((response) => {
    if (auth && response.status === 401) {
      clearToken();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return response;
  });
};

export const downloadFile = async (path: string, filename: string) => {
  const response = await apiFetch(path, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Download failed (HTTP ${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const fetchBlobUrl = async (path: string) => {
  const response = await apiFetch(path, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Request failed (HTTP ${response.status})`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
