import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '../src/components/common/ErrorBoundary';
import { expectConsoleError } from './helpers/expectedConsole';

const mocks = vi.hoisted(() => ({
  recoverFromStaleChunk: vi.fn(() => false),
  isStaleChunkError: vi.fn(() => false),
  reportClientError: vi.fn(),
}));

vi.mock('../src/utils/chunkRecovery', () => ({
  recoverFromStaleChunk: mocks.recoverFromStaleChunk,
  isStaleChunkError: mocks.isStaleChunkError,
}));

vi.mock('../src/services/observability/clientErrorReporter', () => ({
  reportClientError: mocks.reportClientError,
}));

const BrokenView = () => {
  throw new Error('Render failed for pupil@example.test');
};

describe('ErrorBoundary reporting', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reports a sanitized React failure before showing the fallback', async () => {
    const consoleSpy = expectConsoleError();

    render(
      <ErrorBoundary>
        <BrokenView />
      </ErrorBoundary>,
    );

    await waitFor(() => expect(mocks.reportClientError).toHaveBeenCalledTimes(1));
    expect(mocks.reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Render failed for pupil@example.test' }),
      expect.objectContaining({
        event: 'react_error_boundary',
        componentStack: expect.stringContaining('BrokenView'),
      }),
    );
    expect(mocks.recoverFromStaleChunk).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
});
