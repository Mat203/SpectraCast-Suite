import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import posthog from 'posthog-js';
import { DataQualityView } from '../components/DataQualityView';
import { apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
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


vi.mock('posthog-js', () => ({
	default: {
		init: vi.fn(),
		capture: vi.fn(),
	},
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

const testReport = {
	rows: 10,
	columns: ['date', 'value'],
	missing_values: { value: 2 },
	missing_value_strategy_recommendations: {
		value: {
			strategy_code: '1',
			strategy: 'linear',
			reasoning: 'Test reasoning',
		},
	},
	outliers: { value: 1 },
	outlier_strategy_recommendations: {
		value: {
			strategy: 'mean',
			reasoning: 'Test reasoning',
		},
	},
	has_datetime_axis: true,
};

describe('DataQualityView Telemetry', () => {
	const apiFetchMock = vi.mocked(apiFetch);
	const captureMock = vi.mocked(posthog.capture);

	beforeEach(() => {
		apiFetchMock.mockReset();
		executeMock.mockReset();
		captureMock.mockReset();
		computeModeState.isLocalMode = false;

		apiFetchMock.mockImplementation(async (url) => {
			if (typeof url === 'string' && url.includes('/recent')) {
				return createApiResponse({ ok: true, json: { datasets: [] } }) as unknown as Response;
			}
			if (typeof url === 'string' && url.includes('/scan')) {
				return createApiResponse({ ok: true, json: testReport }) as unknown as Response;
			}
			return createApiResponse({ ok: true, json: { status: 'success' } }) as unknown as Response;
		});

		if (typeof File.prototype.text !== 'function') {
			Object.defineProperty(File.prototype, 'text', {
				configurable: true,
				writable: true,
				value: vi.fn().mockResolvedValue('date,value\n2024-01-01,10'),
			});
		} else {
			vi.spyOn(File.prototype, 'text').mockResolvedValue('date,value\n2024-01-01,10');
		}
	});

	it('sends outlier and imputation strategy telemetry in remote mode', async () => {
		useAppStore.setState({
			activeDataset: {
				file: new File([], 'data.csv'),
				fileId: 'file-123',
				originalFilename: 'data.csv',
				columns: ['date', 'value'],
			},
		});

		useAppStore.getState().setDataQualityUi({
			report: testReport,
		});

		renderWithProviders(<DataQualityView />);

		const user = userEvent.setup();

		const outlierLi = await screen.findByTitle('Click to handle outliers');
		await user.click(outlierLi);

		const applyOutlierButton = await screen.findByRole('button', { name: 'Apply & Rescan' });
		await user.click(applyOutlierButton);

		await waitFor(() => {
			expect(captureMock).toHaveBeenCalledWith('dq_strategy_applied', {
				module_type: 'outliers',
				chosen_strategy: 'mean',
				recommended_strategy: 'mean',
				dataset_size_rows: 10,
			});
		});

		const missingLi = await screen.findByTitle('Click to handle missing values');
		await user.click(missingLi);

		const applyMissingButton = await screen.findByRole('button', { name: 'Apply & Rescan' });
		await user.click(applyMissingButton);

		await waitFor(() => {
			expect(captureMock).toHaveBeenCalledWith('dq_strategy_applied', {
				module_type: 'imputation',
				chosen_strategy: '1',
				recommended_strategy: 'linear',
				dataset_size_rows: 10,
			});
		});
	});

	it('does not send telemetry in local mode', async () => {
		computeModeState.isLocalMode = true;

		useAppStore.setState({
			activeDataset: {
				file: new File([], 'data.csv'),
				fileId: 'file-123',
				originalFilename: 'data.csv',
				columns: ['date', 'value'],
			},
		});

		useAppStore.getState().setDataQualityUi({
			report: testReport,
		});

		executeMock
			.mockResolvedValueOnce({ csv: 'date,value\n2024-01-01,10' })
			.mockResolvedValueOnce(testReport)
			.mockResolvedValueOnce({ csv: 'date,value\n2024-01-01,10' })
			.mockResolvedValueOnce(testReport);

		renderWithProviders(<DataQualityView />);

		const user = userEvent.setup();

		const outlierLi = await screen.findByTitle('Click to handle outliers');
		await user.click(outlierLi);

		const applyOutlierButton = await screen.findByRole('button', { name: 'Apply & Rescan' });
		await user.click(applyOutlierButton);

		await waitFor(() => {
			expect(executeMock).toHaveBeenCalled();
		});

		expect(captureMock).not.toHaveBeenCalled();

		const missingLi = await screen.findByTitle('Click to handle missing values');
		await user.click(missingLi);

		const applyMissingButton = await screen.findByRole('button', { name: 'Apply & Rescan' });
		await user.click(applyMissingButton);

		await waitFor(() => {
			expect(executeMock).toHaveBeenCalledTimes(4);
		});

		expect(captureMock).not.toHaveBeenCalled();
	});
});
