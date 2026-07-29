import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, toAppError } from '../src/services/api/errors';
import { SupportError } from '../src/components/common/SupportError';

describe('request-id error presentation', () => {
  it('normalizes retryable server failures without exposing raw payloads', () => {
    const error = toAppError(new ApiError('Internal server error', 503, 'UPSTREAM_UNAVAILABLE', 'req-123'));
    expect(error).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', status: 503, requestId: 'req-123', retryable: true });
    expect(JSON.stringify(error)).not.toContain('stack');
  });

  it('shows a bounded retry and copies only requestId', async () => {
    const retry = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<SupportError error={{ code: 'RATE_LIMITED', message: 'Thử lại sau.', requestId: 'req-429', status: 429, retryable: true }} onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }));
    expect(retry).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sao chép mã hỗ trợ/i }));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith('req-429');
    expect(screen.getByText('Đã sao chép')).toBeInTheDocument();
  });
});
