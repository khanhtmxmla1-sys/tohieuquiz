import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import TeacherResultDetailPage from '../src/components/TeacherDashboard/TeacherResultDetailPage';

vi.mock('../src/components/teacher/ResultsView', () => ({ StudentDetailModal: () => null }));
vi.mock('../src/services/results/resultAnswersService', () => ({ fetchResultAnswers: vi.fn() }));

/**
 * "Quay lại danh sách" used to be navigate('/'), a fresh PUSH. useScrollReset sends PUSH to the top
 * of the page, which would drop a teacher at the top of the dashboard instead of back at the row
 * they opened. Both destinations are '/', so the assertions read the navigation type — that is the
 * only thing that distinguishes a real Back from a new push.
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
                <Route path="/" element={<div>dashboard</div>} />
                <Route path="/teacher/results/:resultId" element={<TeacherResultDetailPage />} />
            </Routes>
        </MemoryRouter>,
    );

const clickBack = () => fireEvent.click(screen.getByRole('button', { name: /Quay lại danh sách/ }));

describe('TeacherResultDetailPage back button', () => {
    it('pops history when the teacher pushed their way in from the dashboard', () => {
        renderAt(['/', '/teacher/results/r-404'], 1);

        clickBack();

        expect(screen.getByTestId('probe')).toHaveTextContent('/|POP');
        expect(screen.getByText('dashboard')).toBeVisible();
    });

    it('replaces instead of walking off the site when opened as a direct link', () => {
        renderAt(['/teacher/results/r-404'], 0);

        clickBack();

        expect(screen.getByTestId('probe')).toHaveTextContent('/|REPLACE');
        expect(screen.getByText('dashboard')).toBeVisible();
    });
});
