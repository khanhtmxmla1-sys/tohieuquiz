import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StudentTable } from '../src/features/class-management/components/StudentTable/StudentTable';

vi.mock('../src/components/common', () => ({
  ResponsiveDataView: ({ renderDesktop }: { renderDesktop: () => React.ReactNode }) => <>{renderDesktop()}</>,
}));
vi.mock('../src/utils/toast', () => ({ showConfirm: vi.fn() }));

const student = {
  id: 'student-1', fullName: 'Nguyễn Văn An', username: 'an01', classId: 'class-1', parentPhone: '0901',
};

describe('StudentTable parent access action', () => {
  it('surfaces a dedicated parent access action without changing existing callbacks', () => {
    const onParentAccess = vi.fn();
    render(<StudentTable students={[student]} classId="class-1" onResetPassword={vi.fn()} onRemoveStudent={vi.fn()} onParentAccess={onParentAccess} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quản lý quyền phụ huynh cho Nguyễn Văn An' }));
    expect(onParentAccess).toHaveBeenCalledWith(student);
  });
});
