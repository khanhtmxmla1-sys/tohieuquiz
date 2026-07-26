import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '../src/types';
import { LiveExamQuiz } from '../src/components/LiveExam/LiveExamQuiz';

const mocks = vi.hoisted(() => ({
    updateActivity: vi.fn(),
}));

vi.mock('../src/hooks', () => ({
    useLiveExamTimer: () => ({ timeRemaining: 600, isExpired: false }),
    useLiveExamActivity: () => ({ updateActivity: mocks.updateActivity }),
}));

vi.mock('../src/services/liveExamService', () => ({
    submitAnswers: vi.fn(),
}));

vi.mock('../src/components/student/QuestionRenderer', () => ({
    default: ({ index }: { index: number }) => <div>Câu kiểm tra {index + 1}</div>,
}));

vi.mock('../src/components/student', () => ({
    SubmitConfirmModal: () => null,
}));

const questions = Array.from({ length: 25 }, (_, index) => ({
    id: `live-${index + 1}`,
    text: `Câu ${index + 1}`,
    type: 'MULTIPLE_CHOICE',
    options: [],
})) as unknown as Question[];

describe('LiveExamQuiz pagination activity', () => {
    let frameCallbacks: FrameRequestCallback[];

    const flushAnimationFrames = () => {
        while (frameCallbacks.length > 0) {
            frameCallbacks.shift()?.(0);
        }
    };

    beforeEach(() => {
        mocks.updateActivity.mockReset();
        frameCallbacks = [];
        vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
            frameCallbacks.push(callback);
            return frameCallbacks.length;
        }));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: vi.fn().mockReturnValue({ matches: true }),
        });
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('tracks the first question on the new page after continuing', async () => {
        render(
            <LiveExamQuiz
                sessionId="session-1"
                questions={questions}
                quizTitle="Thi thử"
                duration={60}
                endsAt="2026-07-17T16:00:00.000Z"
                onComplete={vi.fn()}
            />,
        );

        await waitFor(() => {
            expect(mocks.updateActivity).toHaveBeenCalledWith({
                currentQuestion: 1,
                answeredCount: 0,
            });
        });

        fireEvent.click(screen.getByRole('button', { name: 'Câu tiếp theo' }));
        act(flushAnimationFrames);

        await waitFor(() => {
            expect(mocks.updateActivity).toHaveBeenLastCalledWith({
                currentQuestion: 11,
                answeredCount: 0,
            });
        });
        expect(document.activeElement).toBe(document.getElementById('question-live-11'));
    });
});
