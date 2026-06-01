import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadingIndicatorsStreamManager } from '../components/LeadingIndicatorsStreamManager';
import { useAppStore } from '../store/useAppStore';
import { renderWithProviders } from '../test/testUtils';

const startMock = vi.fn();
const sseState = {
	isProcessing: false,
	currentStage: '',
	error: null as string | null,
	result: null as Record<string, unknown> | null,
};

vi.mock('../lib/useSseRequest', () => ({
	useSseRequest: () => ({
		isProcessing: sseState.isProcessing,
		currentStage: sseState.currentStage,
		error: sseState.error,
		result: sseState.result,
		start: startMock,
	}),
}));

describe('LeadingIndicatorsStreamManager', () => {
	beforeEach(() => {
		startMock.mockReset();
		sseState.isProcessing = false;
		sseState.currentStage = '';
		sseState.error = null;
		sseState.result = null;
	});

	it('starts SSE when a new request payload is provided', async () => {
		sseState.isProcessing = true;
		sseState.currentStage = 'starting';

		useAppStore.setState((state) => ({
			leadingIndicatorsStream: {
				...state.leadingIndicatorsStream,
				requestId: 1,
				requestPayload: { file_id: 'file-1', target_col: 'gdp' },
				requestHeaders: { 'x-llm-api-key': 'key-123' },
			},
		}));

		renderWithProviders(<LeadingIndicatorsStreamManager />);

		await waitFor(() => {
			expect(startMock).toHaveBeenCalledWith(
				{ file_id: 'file-1', target_col: 'gdp' },
				{ headers: { 'x-llm-api-key': 'key-123' } },
			);
		});
	});

	it('updates the store when SSE returns an error', async () => {
		sseState.error = 'Rate limit exceeded.';

		renderWithProviders(<LeadingIndicatorsStreamManager />);

		await waitFor(() => {
			const streamState = useAppStore.getState().leadingIndicatorsStream;
			const uiState = useAppStore.getState().leadingIndicatorsUi;
			expect(streamState.toastMode).toBe('error');
			expect(streamState.toastVisible).toBe(true);
			expect(streamState.error).toBe('Rate limit exceeded.');
			expect(uiState.error).toBe('Rate limit exceeded.');
		});
	});
});
