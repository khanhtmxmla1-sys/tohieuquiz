import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useManualQuizAutosave } from '../src/features/manual-quiz-workspace/hooks/useManualQuizAutosave';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

const seed = {
    title: 'Đề ban đầu',
    classLevel: '3A',
    category: 'toan',
    timeLimit: 15,
    tags: [],
    requireCode: false,
    showOnHome: true,
};

const AutosaveHarness = () => {
    const envelope = useManualQuizWorkspaceStore((state) => state.envelope);
    useManualQuizAutosave(envelope);
    const status = useManualQuizWorkspaceStore((state) => state.saveStatus);
    return <span data-testid="save-status">{status}</span>;
};

describe('useManualQuizAutosave', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        useManualQuizWorkspaceStore.getState().reset();
        useManualQuizWorkspaceStore.getState().initializeFromSeed(seed, 'teacher-a');
    });

    it('writes changed content locally within 600ms and marks it saved', async () => {
        render(<AutosaveHarness />);
        const envelope = useManualQuizWorkspaceStore.getState().envelope!;
        const key = `tohieuquiz:manual-draft:v1:teacher-a:${envelope.draftId}`;

        expect(localStorage.getItem(key)).toBeNull();
        await act(async () => { vi.advanceTimersByTime(599); });
        expect(localStorage.getItem(key)).toBeNull();
        await act(async () => { vi.advanceTimersByTime(1); });

        expect(localStorage.getItem(key)).toContain('Đề ban đầu');
        expect(screen.getByTestId('save-status')).toHaveTextContent('saved');
    });

    it('keeps the draft in memory and reports a friendly error when storage fails', async () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Quota exceeded', 'QuotaExceededError');
        });
        render(<AutosaveHarness />);

        await act(async () => { vi.advanceTimersByTime(600); });

        expect(screen.getByTestId('save-status')).toHaveTextContent('error');
        expect(useManualQuizWorkspaceStore.getState().saveError).toMatch(/trình duyệt/i);
        expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.title).toBe('Đề ban đầu');
    });
});
