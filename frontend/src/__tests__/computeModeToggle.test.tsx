import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComputeModeToggle } from '../components/ComputeModeToggle';
import { renderWithProviders } from '../test/testUtils';

const warmupMock = vi.fn();

vi.mock('../lib/useHybridCompute', () => ({
	useHybridCompute: () => ({
		localRuntimeStatus: 'ready',
		localRuntimeError: null,
		warmupLocalRuntime: warmupMock,
	}),
}));

describe('ComputeModeToggle', () => {
	beforeEach(() => {
		warmupMock.mockReset();
	});

	it('enables local compute and warms the runtime', async () => {
		const user = userEvent.setup();
		renderWithProviders(<ComputeModeToggle />);

		const checkbox = screen.getByRole('checkbox');
		warmupMock.mockResolvedValueOnce(undefined);
		await user.click(checkbox);

		await waitFor(() => {
			expect(warmupMock).toHaveBeenCalled();
		});
		expect(screen.getByText('Running locally')).toBeInTheDocument();
	});
});
