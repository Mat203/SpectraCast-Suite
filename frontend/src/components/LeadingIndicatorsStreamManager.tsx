import React, { useEffect, useRef } from 'react';
import { useSseRequest } from '../lib/useSseRequest';
import { useAppStore } from '../store/useAppStore';

export const LeadingIndicatorsStreamManager: React.FC = () => {
  const requestId = useAppStore((state) => state.leadingIndicatorsStream.requestId);
  const requestPayload = useAppStore((state) => state.leadingIndicatorsStream.requestPayload);
  const requestHeaders = useAppStore((state) => state.leadingIndicatorsStream.requestHeaders);
  const toastDismissed = useAppStore((state) => state.leadingIndicatorsStream.toastDismissed);
  const setLeadingIndicatorsUi = useAppStore((state) => state.setLeadingIndicatorsUi);
  const setLeadingIndicatorsStream = useAppStore((state) => state.setLeadingIndicatorsStream);

  const {
    isProcessing,
    currentStage,
    error,
    result,
    start,
  } = useSseRequest('/api/leading-indicators');

  const lastHandledRequest = useRef<number>(0);

  useEffect(() => {
    if (!requestPayload || requestId === 0 || requestId === lastHandledRequest.current) {
      return;
    }

    lastHandledRequest.current = requestId;

    void start(requestPayload, { headers: requestHeaders || {} });
  }, [requestId, requestPayload, requestHeaders, start]);

  useEffect(() => {
    setLeadingIndicatorsStream({
      isProcessing,
      currentStage,
    });
    setLeadingIndicatorsUi({ isLoading: isProcessing });
  }, [currentStage, isProcessing, setLeadingIndicatorsStream, setLeadingIndicatorsUi]);

  useEffect(() => {
    if (!error) {
      return;
    }
    setLeadingIndicatorsStream({
      error,
      isProcessing: false,
      toastMode: 'error',
      toastVisible: true,
      toastDismissed: false,
    });
    setLeadingIndicatorsUi({ error, isLoading: false });
  }, [error, setLeadingIndicatorsStream, setLeadingIndicatorsUi]);

  useEffect(() => {
    if (!result) {
      return;
    }

    setLeadingIndicatorsUi({ result, error: null, isLoading: false });
    setLeadingIndicatorsStream({
      result,
      toastMode: 'done',
      toastVisible: !toastDismissed,
      isProcessing: false,
    });
  }, [result, setLeadingIndicatorsStream, setLeadingIndicatorsUi, toastDismissed]);

  return null;
};
