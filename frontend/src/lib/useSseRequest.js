import { useCallback, useMemo, useRef, useState } from 'react';
import { clearToken, getToken } from './auth';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? window.location.origin).replace(/\/$/, '');

const buildUrl = (path) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
};

export const useSseRequest = (url) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const start = useCallback(async (payload, options = {}) => {
    setIsProcessing(true);
    setCurrentStage('');
    setResult(null);
    setError(null);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };

      if (options.auth !== false) {
        const token = getToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const response = await fetch(buildUrl(url), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload || {}),
        signal: controller.signal,
      });

      if (options.auth !== false && response.status === 401) {
        clearToken();
        setError('Session expired. Please sign in again.');
        setIsProcessing(false);
        return null;
      }

      if (!response.ok || !response.body) {
        throw new Error(`SSE failed (HTTP ${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');

          const dataLines = rawEvent
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.replace(/^data:\s?/, ''));

          if (!dataLines.length) {
            continue;
          }

          const dataText = dataLines.join('\n').trim();
          if (!dataText) {
            continue;
          }

          let parsed;
          try {
            parsed = JSON.parse(dataText);
          } catch {
            continue;
          }

          if (parsed.status === 'progress') {
            setCurrentStage(parsed.stage || '');
          } else if (parsed.status === 'done') {
            setResult(parsed.data ?? null);
            setIsProcessing(false);
            return parsed.data ?? null;
          } else if (parsed.status === 'error') {
            throw new Error(parsed.message || 'Server error');
          }
        }
      }

      throw new Error('SSE stream closed unexpectedly.');
    } catch (err) {
      if (err?.name !== 'AbortError') {
        const message = err instanceof Error ? err.message : 'SSE error';
        setError(message);
      }
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [url]);

  return useMemo(
    () => ({
      isProcessing,
      currentStage,
      result,
      error,
      start,
      stop,
    }),
    [isProcessing, currentStage, result, error, start, stop],
  );
};
