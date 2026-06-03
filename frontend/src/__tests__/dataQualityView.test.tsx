import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataQualityView } from '../components/DataQualityView';
import { apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { recentDatasetsEmpty } from '../test/fixtures/apiResponses';
import { renderWithProviders } from '../test/testUtils';

const executeMock = vi.fn();
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
		execute: executeMock,
	}),
}));

vi.mock('../lib/api', () => ({
	apiFetch: vi.fn(),
	downloadFile: vi.fn(),
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

describe('DataQualityView', () => {
	const apiFetchMock = vi.mocked(apiFetch);

	beforeEach(() => {
		apiFetchMock.mockReset();
		executeMock.mockReset();
		computeModeState.isLocalMode = false;
	});

	it('shows an empty state when there are no recent datasets', async () => {
		apiFetchMock.mockResolvedValueOnce(
			createApiResponse({ ok: true, json: recentDatasetsEmpty }) as unknown as Response,
		);

		renderWithProviders(<DataQualityView />);

		expect(await screen.findByText('No recent datasets')).toBeInTheDocument();
	});

	it('surfaces out-of-memory errors during local scans', async () => {
		computeModeState.isLocalMode = true;
		apiFetchMock.mockResolvedValueOnce(
			createApiResponse({ ok: true, json: recentDatasetsEmpty }) as unknown as Response,
		);

		const oomError = new Error('Out of memory while processing dataset.');
		oomError.name = 'OutOfMemoryError';
		executeMock.mockRejectedValueOnce(oomError);

		renderWithProviders(<DataQualityView />);

		const file = new File(['date,value\n2024-01-01,10'], 'data.csv', { type: 'text/csv' });
		let textSpy: ReturnType<typeof vi.spyOn> | null = null;
		if (typeof File.prototype.text !== 'function') {
			Object.defineProperty(File.prototype, 'text', {
				configurable: true,
				writable: true,
				value: vi.fn().mockResolvedValue('date,value\n2024-01-01,10'),
			});
		} else {
			textSpy = vi.spyOn(File.prototype, 'text').mockResolvedValue('date,value\n2024-01-01,10');
		}
		useAppStore.setState({
			activeDataset: {
				file,
				fileId: null,
				originalFilename: 'data.csv',
				columns: ['date', 'value'],
			},
		});

		const user = userEvent.setup();
		const scanButton = await screen.findByRole('button', { name: 'Upload & Scan' });
		await waitFor(() => expect(scanButton).toBeEnabled());
		await user.click(scanButton);

		await waitFor(() => {
			expect(executeMock).toHaveBeenCalled();
		});

		textSpy?.mockRestore();

		expect(
			await screen.findByText('Out of memory while processing dataset.'),
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Run via API' })).toBeInTheDocument();
	});
});
