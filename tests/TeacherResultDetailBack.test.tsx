import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import TeacherResultDetailPage from '../src/components/TeacherDashboard/TeacherResultDetailPage';

vi.mock('../src/components/teacher/ResultsView', () => ({ StudentDetailModal: () => null }));
vi.mock('../src/services/results/resultAnswersService', () => ({ fetchResultAnswers: vi.fn() }));

/**
 * "Quay lại danh sách" pops history when possible so filters and pagination are restored.
 * A direct deep link replaces to the canonical results URL instead of leaving the application.
 */
const Probe = () => {
    const location = useLocation();
    const navigationType = useNavigationType();
    return <div data-testid="probe">{`${location.pathname}|${navigationType}`}</div>;
};

const renderAt = (initialEntries: string[], initialIndex: number) =>
    render(
        <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
            <Probe />
            <Routes>
                <Route path="/teacher/results" element={<div>results-list</div>} />
                <Route path="/teacher/results/:resultId" element={<TeacherResultDetailPage />} />
            </Routes>
        </MemoryRouter>,
    );

const clickBack = () => fireEvent.click(screen.getByRole('button', { name: /Quay lại danh sách/ }));

describe('TeacherResultDetailPage back button', () => {
    it('pops history when the teacher pushed their way in from the dashboard', () => {
        renderAt(['/teacher/results?page=2', '/teacher/results/r-404'], 1);

        clickBack();

        expect(screen.getByTestId('probe')).toHaveTextContent('/teacher/results|POP');
        expect(screen.getByText('results-list')).toBeVisible();
    });

    it('replaces instead of walking off the site when opened as a direct link', () => {
        renderAt(['/teacher/results/r-404'], 0);

        clickBack();

        expect(screen.getByTestId('probe')).toHaveTextContent('/teacher/results|REPLACE');
        expect(screen.getByText('results-list')).toBeVisible();
    });
});
