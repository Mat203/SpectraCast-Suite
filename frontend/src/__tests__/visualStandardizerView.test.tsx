import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualStandardizerView } from '../components/VisualStandardizerView';
import { apiFetch } from '../lib/api';
import { visualStylesResponse, recentDatasetsEmpty } from '../test/fixtures/apiResponses';
import { renderWithProviders } from '../test/testUtils';

const computeModeState = { isLocalMode: false };

vi.mock('../lib/ComputeModeContext.jsx', () => ({
	useComputeMode: () => ({
		isLocalMode: computeModeState.isLocalMode,
		setIsLocalMode: vi.fn(),
	}),
	ComputeModeProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock('../lib/useHybridCompute', () => ({
	useHybridCompute: () => ({
		execute: vi.fn(),
	}),
}));

vi.mock('../lib/api', () => ({
	apiFetch: vi.fn(),
	downloadFile: vi.fn(),
	fetchBlobUrl: vi.fn(),
}));

const createApiResponse = (options: {
	ok: boolean;
	status?: number;
	json?: unknown;
}) => ({
	ok: options.ok,
	status: options.status ?? (options.ok ? 200 : 500),
	json: vi.fn().mockResolvedValue(options.json ?? {}),
});

describe('VisualStandardizerView', () => {
	const apiFetchMock = vi.mocked(apiFetch);

	beforeEach(() => {
		apiFetchMock.mockReset();
		computeModeState.isLocalMode = false;
	});

	it('requires all plot fields before generating', async () => {
		apiFetchMock.mockImplementation(async (path: string) => {
			if (path === '/api/vs/styles') {
				return createApiResponse({ ok: true, json: visualStylesResponse }) as unknown as Response;
			}
			if (path === '/api/users/me') {
				return createApiResponse({ ok: true, json: recentDatasetsEmpty }) as unknown as Response;
			}
			return createApiResponse({ ok: true }) as unknown as Response;
		});

		renderWithProviders(<VisualStandardizerView />);

		const user = userEvent.setup();
		const generateButton = await screen.findByRole('button', { name: 'Generate Plot' });
		await user.click(generateButton);

		expect(
			await screen.findByText('Please fill all fields for plot generation'),
		).toBeInTheDocument();
	});
});
