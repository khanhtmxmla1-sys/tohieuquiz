import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClassCard } from '../src/features/class-management/components/ClassCard/ClassCard';
import { ClassListView } from '../src/features/class-management/views/ClassListView';
import { StudentTable } from '../src/features/class-management/components/StudentTable/StudentTable';

const classroom = {
    id: 'c1', name: '5A', teacherUsername: 'teacher1', teacherFullName: 'Giao Vien Mau', createdAt: '2026-01-01T00:00:00.000Z', studentCount: 32, assignmentCount: 4,
};

describe('class management UI permissions and states', () => {
    it('hides archive/transfer actions from teachers while keeping class metrics', () => {
        render(<ClassCard classroom={classroom} isAdmin={false} onClick={vi.fn()} onTransfer={vi.fn()} onDelete={vi.fn()} />);
        expect(screen.queryByLabelText('Lưu trữ lớp 5A')).not.toBeInTheDocument();
        expect(screen.getByText('32 học sinh')).toBeInTheDocument();
        expect(screen.getByText('4 bài giao')).toBeInTheDocument();
    });

    it('shows archive action to administrators and calls the handler', () => {
        const onDelete = vi.fn();
        render(<ClassCard classroom={classroom} isAdmin onClick={vi.fn()} onTransfer={vi.fn()} onDelete={onDelete} />);
        fireEvent.click(screen.getByLabelText('Lưu trữ lớp 5A'));
        expect(onDelete).toHaveBeenCalledOnce();
    });

    it('distinguishes an API error from an empty class list', () => {
        render(<ClassListView classes={[]} isAdmin={false} onSelectClass={vi.fn()} onCreateClick={vi.fn()} onTransferClick={vi.fn()} onDeleteClick={vi.fn()} isLoading={false} error="Không thể tải danh sách lớp." onRetry={vi.fn()} />);
        expect(screen.getByText('Không thể tải danh sách lớp.')).toBeInTheDocument();
        expect(screen.queryByText('Chưa có lớp học nào')).not.toBeInTheDocument();
    });

    it('allows the class-owning teacher UI to open password reset', () => {
        const onResetPassword = vi.fn();
        render(<StudentTable students={[{ id: 's1', fullName: 'Hoc Sinh Mau', username: 'an.nv', classId: 'c1' }]} classId="c1" onResetPassword={onResetPassword} onRemoveStudent={vi.fn()} />);
        fireEvent.click(screen.getAllByLabelText('Đặt lại mật khẩu cho Hoc Sinh Mau')[0]);
        expect(onResetPassword).toHaveBeenCalledWith('s1');
    });
});
