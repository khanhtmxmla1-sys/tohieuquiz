import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '../src/types';
import QuizNavigation from '../src/features/quiz-player/components/QuizNavigation';
import QuizPagination from '../src/features/quiz-player/components/QuizPagination';
import {
    getActiveQuestionNumber,
    useQuizPageNavigation,
} from '../src/features/quiz-player/hooks/useQuizPageNavigation';

const QUESTIONS_PER_PAGE = 10;
const questions = Array.from({ length: 25 }, (_, index) => ({
    id: `q-${index + 1}`,
    text: `Câu ${index + 1}`,
    type: 'MULTIPLE_CHOICE',
    options: [],
})) as unknown as Question[];

const QuizNavigationHarness = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
    const visibleQuestions = questions.slice(
        (currentPage - 1) * QUESTIONS_PER_PAGE,
        currentPage * QUESTIONS_PER_PAGE,
    );
    const { activeQuestionId, changePage } = useQuizPageNavigation({
        questions,
        currentPage,
        totalPages,
        questionsPerPage: QUESTIONS_PER_PAGE,
        setCurrentPage,
    });

    return (
        <div>
            <QuizNavigation
                questions={questions}
                isQuestionAnswered={() => false}
                activeQuestionId={activeQuestionId}
                QUESTIONS_PER_PAGE={QUESTIONS_PER_PAGE}
                onPageChange={changePage}
            />

            <main>
                {visibleQuestions.map((question, index) => (
                    <section
                        key={question.id}
                        id={`question-${question.id}`}
                        tabIndex={-1}
                    >
                        Câu hiển thị {(currentPage - 1) * QUESTIONS_PER_PAGE + index + 1}
                    </section>
                ))}
            </main>

            <QuizPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={changePage}
                onSubmit={vi.fn()}
                isSubmitting={false}
            />
        </div>
    );
};

describe('quiz page navigation', () => {
    let frameCallbacks: FrameRequestCallback[];
    let scrollIntoView: ReturnType<typeof vi.fn>;

    const flushAnimationFrames = () => {
        while (frameCallbacks.length > 0) {
            const callback = frameCallbacks.shift();
            callback?.(0);
        }
    };

    beforeEach(() => {
        frameCallbacks = [];
        scrollIntoView = vi.fn();

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
            value: scrollIntoView,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('moves to and focuses the first question of the next page', () => {
        render(<QuizNavigationHarness />);

        fireEvent.click(screen.getByRole('button', { name: 'Câu tiếp theo' }));
        act(flushAnimationFrames);

        const firstQuestionOnPageTwo = document.getElementById('question-q-11');
        expect(screen.getByRole('status').textContent).toContain('Trang 2 / 3');
        expect(firstQuestionOnPageTwo).toBeTruthy();
        expect(document.activeElement).toBe(firstQuestionOnPageTwo);
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
        expect(screen.getByRole('button', { name: 'Đi đến câu 11' }).getAttribute('aria-current')).toBe('step');
        expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    });

    it('opens and focuses the exact question selected from the navigation grid', () => {
        render(<QuizNavigationHarness />);

        fireEvent.click(screen.getByRole('button', { name: 'Đi đến câu 18' }));
        act(flushAnimationFrames);

        const selectedQuestion = document.getElementById('question-q-18');
        expect(screen.getByRole('status').textContent).toContain('Trang 2 / 3');
        expect(document.activeElement).toBe(selectedQuestion);
        expect(screen.getByRole('button', { name: 'Đi đến câu 18' }).getAttribute('aria-current')).toBe('step');
        expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    });

    it('reports the selected question instead of the last question of the page', () => {
        expect(getActiveQuestionNumber(questions, 'q-18', 2, QUESTIONS_PER_PAGE)).toBe(18);
        expect(getActiveQuestionNumber(questions, null, 3, QUESTIONS_PER_PAGE)).toBe(21);
        expect(getActiveQuestionNumber([], null, 1, QUESTIONS_PER_PAGE)).toBe(0);
    });
});
