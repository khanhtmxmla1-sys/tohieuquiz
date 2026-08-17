import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClassCard } from '../src/features/class-management/components/ClassCard/ClassCard';
import { ClassListView } from '../src/features/class-management/views/ClassListView';
import { StudentTable } from '../src/features/class-management/components/StudentTable/StudentTable';
import { CreateClassModal } from '../src/features/class-management/components/Modals/CreateClassModal';
import { AddStudentModal } from '../src/features/class-management/components/Modals/AddStudentModal/AddStudentModal';
import { TransferTeacherModal } from '../src/features/class-management/components/Modals/TransferTeacherModal';

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

    it('does not let keyboard events from nested admin actions also open the class card', () => {
        const onClick = vi.fn();
        const view = render(<ClassCard classroom={classroom} isAdmin onClick={onClick} onTransfer={vi.fn()} onDelete={vi.fn()} />);
        const archiveButton = screen.getByLabelText('Lưu trữ lớp 5A');

        fireEvent.keyDown(archiveButton, { key: 'Enter' });
        expect(onClick).not.toHaveBeenCalled();

        const cardButton = view.container.querySelector('[role="button"][tabindex="0"]');
        expect(cardButton).not.toBeNull();
        fireEvent.keyDown(cardButton as HTMLElement, { key: 'Enter' });
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(fireEvent.keyDown(cardButton as HTMLElement, { key: ' ' })).toBe(false);
        expect(onClick).toHaveBeenCalledTimes(2);
    });

    it('distinguishes an API error from an empty class list', () => {
        render(<ClassListView classes={[]} isAdmin={false} onSelectClass={vi.fn()} onCreateClick={vi.fn()} onTransferClick={vi.fn()} onDeleteClick={vi.fn()} isLoading={false} error="Không thể tải danh sách lớp." onRetry={vi.fn()} />);
        expect(screen.getByText('Không thể tải danh sách lớp.')).toBeInTheDocument();
        expect(screen.queryByText('Chưa có lớp học nào')).not.toBeInTheDocument();
    });

    it('requires an administrator to choose the teacher who will own a new class', async () => {
        const onCreate = vi.fn(async () => true);
        render(
            <CreateClassModal
                onClose={vi.fn()}
                onCreate={onCreate as any}
                isLoading={false}
                teachers={[
                    { username: 'teacher-a', full_name: 'Teacher A', role: 'teacher', class: '' },
                    { username: 'teacher-b', full_name: 'Teacher B', role: 'teacher', class: '' },
                ] as any}
                isLoadingTeachers={false}
            /> as any,
        );

        fireEvent.change(screen.getByPlaceholderText('VD: Lớp Toán 5A'), { target: { value: '4A' } });
        expect(screen.getByRole('button', { name: 'Tạo lớp' })).toBeDisabled();
        fireEvent.change(screen.getByRole('combobox', { name: 'Giáo viên phụ trách' }), { target: { value: 'teacher-b' } });
        fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' }));

        expect(onCreate).toHaveBeenCalledWith('4A', 'teacher-b');
    });

    it('shows API errors in the create-class modal instead of presenting them as an empty teacher list', () => {
        render(
            <CreateClassModal
                onClose={vi.fn()}
                onCreate={vi.fn(async () => false) as any}
                isLoading={false}
                teachers={[]}
                isLoadingTeachers={false}
                error="Không thể tải danh sách giáo viên."
            />,
        );

        expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải danh sách giáo viên.');
        expect(screen.queryByText('Chưa có giáo viên đang hoạt động để phân công lớp.')).not.toBeInTheDocument();
    });

    it('shows teacher class counts instead of legacy single-class metadata during transfer', () => {
        render(
            <TransferTeacherModal
                classroom={classroom}
                teachers={[
                    { username: 'teacher-a', full_name: 'Teacher A', role: 'teacher', class: 'Legacy 4A', classCount: 2 },
                ]}
                selectedTeacherUsername=""
                onSelectTeacher={vi.fn()}
                onClose={vi.fn()}
                onSubmit={vi.fn(async () => undefined)}
                isLoadingTeachers={false}
                isSaving={false}
                error={null}
            />,
        );

        expect(screen.getByRole('option', { name: 'Teacher A (teacher-a) - 2 lớp' })).toBeInTheDocument();
        expect(screen.queryByText(/Phụ trách: Legacy 4A/)).not.toBeInTheDocument();
    });

    it('gives classroom modals dialog semantics and closes them with Escape', () => {
        const createClose = vi.fn();
        const createView = render(
            <CreateClassModal
                onClose={createClose}
                onCreate={vi.fn(async () => true) as any}
                isLoading={false}
                teachers={[]}
                isLoadingTeachers={false}
            />,
        );
        expect(screen.getByRole('dialog', { name: 'Tạo lớp mới' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(createClose).toHaveBeenCalledOnce();
        createView.unmount();

        const addClose = vi.fn();
        const addView = render(
            <AddStudentModal
                classId="c1"
                onClose={addClose}
                onAdd={vi.fn(async () => undefined)}
                onAddBatch={vi.fn(async () => null)}
                isLoading={false}
                error={null}
            />,
        );
        expect(screen.getByRole('dialog', { name: 'Thêm học sinh' })).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(addClose).toHaveBeenCalledOnce();
        addView.unmount();

        const transferClose = vi.fn();
        render(
            <TransferTeacherModal
                classroom={classroom}
                teachers={[]}
                selectedTeacherUsername=""
                onSelectTeacher={vi.fn()}
                onClose={transferClose}
                onSubmit={vi.fn(async () => undefined)}
                isLoadingTeachers={false}
                isSaving={false}
                error={null}
            />,
        );
        expect(screen.getByRole('dialog', { name: 'Chuyển giáo viên' })).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(transferClose).toHaveBeenCalledOnce();
    });

    it('names student archive actions as soft archive operations', () => {
        render(
            <StudentTable
                students={[{ id: 's1', fullName: 'Hoc Sinh Mau', username: 'an.nv', classId: 'c1' }]}
                classId="c1"
                onResetPassword={vi.fn()}
                onRemoveStudent={vi.fn()}
                onParentAccess={vi.fn()}
            />,
        );
        expect(screen.getAllByRole('button', { name: 'Lưu trữ học sinh Hoc Sinh Mau' }).length).toBeGreaterThan(0);
    });

    it('allows the class-owning teacher UI to open password reset', () => {
        const onResetPassword = vi.fn();
        render(<StudentTable students={[{ id: 's1', fullName: 'Hoc Sinh Mau', username: 'an.nv', classId: 'c1' }]} classId="c1" onResetPassword={onResetPassword} onRemoveStudent={vi.fn()} />);
        fireEvent.click(screen.getAllByLabelText('Đặt lại mật khẩu cho Hoc Sinh Mau')[0]);
        expect(onResetPassword).toHaveBeenCalledWith('s1');
    });
});
