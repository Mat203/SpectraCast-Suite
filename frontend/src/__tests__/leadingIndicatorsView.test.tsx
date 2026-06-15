import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadingIndicatorsView } from '../components/LeadingIndicatorsView';
import { apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { rateLimitError, recentDatasetsEmpty } from '../test/fixtures/apiResponses';
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


const createApiResponse = (options: {
	ok: boolean;
	status?: number;
	json?: unknown;
}) => ({
	ok: options.ok,
	status: options.status ?? (options.ok ? 200 : 500),
	json: vi.fn().mockResolvedValue(options.json ?? {}),
});

describe('LeadingIndicatorsView', () => {
	const apiFetchMock = vi.mocked(apiFetch);

	beforeEach(() => {
		apiFetchMock.mockReset();
		computeModeState.isLocalMode = false;
	});

	it('shows a rate limit error when upload is throttled', async () => {
		apiFetchMock.mockImplementation(async (path: string) => {
			if (path === '/api/users/me') {
				return createApiResponse({ ok: true, json: recentDatasetsEmpty }) as unknown as Response;
			}
			if (path === '/api/upload') {
				return createApiResponse({ ok: false, status: 429, json: rateLimitError }) as unknown as Response;
			}
			return createApiResponse({ ok: true }) as unknown as Response;
		});

		const file = new File(['date,value\n2024-01-01,10'], 'macro.csv', { type: 'text/csv' });
		useAppStore.setState({
			activeDataset: {
				file,
				fileId: null,
				originalFilename: 'macro.csv',
				columns: ['value'],
			},
			leadingIndicators: {
				targetColumn: 'value',
				region: 'Ukraine',
				geoCode: 'UA',
				extraContext: '',
			},
		});

		renderWithProviders(<LeadingIndicatorsView />);

		const user = userEvent.setup();
		await user.click(
			screen.getByRole('button', { name: 'Run Leading Indicators Analysis' }),
		);

		expect(
			await screen.findByText('Upload failed: Rate limit exceeded. Please try again later.'),
		).toBeInTheDocument();
	});
});
