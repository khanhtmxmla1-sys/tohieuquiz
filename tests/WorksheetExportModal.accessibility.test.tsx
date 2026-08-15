// @vitest-environment jsdom
import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorksheetQuiz } from './fixtures/worksheetExportFixture';

const exportWorksheetMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/worksheetExportService', () => ({
    exportWorksheet: exportWorksheetMock,
}));

import WorksheetExportModal from '../src/components/TeacherDashboard/WorksheetExportModal';

const quiz = createWorksheetQuiz();

const Harness = () => {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>Mở xuất vở bài tập</button>
            {open ? <WorksheetExportModal quiz={quiz} onClose={() => setOpen(false)} /> : null}
        </>
    );
};

describe('WorksheetExportModal accessibility', () => {
    beforeEach(() => {
        exportWorksheetMock.mockReset();
        exportWorksheetMock.mockResolvedValue(undefined);
    });

    it('exposes a named modal dialog, focuses close, and exposes selected option state', async () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole('button', { name: 'Mở xuất vở bài tập' }));

        const dialog = screen.getByRole('dialog', { name: 'Xuất Vở Bài Tập' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Đóng' })).toHaveFocus());
        expect(screen.getByRole('button', { name: /^PDF/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /^Word/ })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: /^Ô ly 5mm/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('traps focus, closes on Escape, and restores focus to the opener', async () => {
        render(<Harness />);
        const opener = screen.getByRole('button', { name: 'Mở xuất vở bài tập' });
        opener.focus();
        fireEvent.click(opener);

        const close = screen.getByRole('button', { name: 'Đóng' });
        const download = screen.getByRole('button', { name: 'Tải xuống' });
        await waitFor(() => expect(close).toHaveFocus());

        download.focus();
        fireEvent.keyDown(document, { key: 'Tab' });
        expect(close).toHaveFocus();

        close.focus();
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
        expect(download).toHaveFocus();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(opener).toHaveFocus();
    });

    it('announces export failures as an alert', async () => {
        exportWorksheetMock.mockRejectedValueOnce(new Error('export failed'));
        render(<Harness />);
        fireEvent.click(screen.getByRole('button', { name: 'Mở xuất vở bài tập' }));
        fireEvent.click(screen.getByRole('button', { name: 'Tải xuống' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Xuất file thất bại. Vui lòng thử lại.');
    });
});
