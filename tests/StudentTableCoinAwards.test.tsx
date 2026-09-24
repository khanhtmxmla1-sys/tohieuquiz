import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Student } from '../src/types/classroom.types';

const ui = vi.hoisted(() => ({ isMobile: false }));
const flag = vi.hoisted(() => ({ ready: true, enabled: true, degraded: false }));

vi.mock('../src/components/common', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  ModuleIcon: () => <span />,
  ResponsiveDataView: ({ items, renderDesktop, renderMobileCard }: {
    items: Student[];
    renderDesktop: () => React.ReactNode;
    renderMobileCard: (item: Student, index: number) => React.ReactNode;
  }) => ui.isMobile
    ? <div>{items.map((item, index) => <div key={item.id}>{renderMobileCard(item, index)}</div>)}</div>
    : <>{renderDesktop()}</>,
}));
vi.mock('../src/utils/toast', () => ({ showConfirm: vi.fn() }));
vi.mock('../src/features/coin-awards/useCoinAwardsFeatureFlag', () => ({
  useCoinAwardsFeatureFlag: () => flag,
}));

import { StudentTable } from '../src/features/class-management/components/StudentTable/StudentTable';
import { ClassDetailView } from '../src/features/class-management/views/ClassDetailView';
import { useCoinAwardsStore } from '../src/features/coin-awards/useCoinAwardsStore';
import { useAuthStore } from '../stores/authStore';

const LocationProbe = () => {
  const location = useLocation();
  const state = location.state as { coinAwardPrefillToken?: string } | null;
  return <output data-testid="coin-award-location">{location.pathname}|{state?.coinAwardPrefillToken || ''}</output>;
};

const students: Student[] = [
  { id: 's-1', fullName: 'Nguyễn An', username: 'an01', classId: 'class-1' },
  { id: 's-2', fullName: 'Trần Bình', username: 'binh02', classId: 'class-1' },
];

const renderStudentTable = (props: Partial<React.ComponentProps<typeof StudentTable>> = {}) => render(
  <StudentTable
    students={students}
    classId="class-1"
    onResetPassword={vi.fn()}
    onRemoveStudent={vi.fn()}
    onParentAccess={vi.fn()}
    onOpenCoinAwards={vi.fn()}
    {...props}
  />,
);

const renderControlledStudentTable = (props: Partial<React.ComponentProps<typeof StudentTable>> = {}) => {
  const onSelectionChange = props.onSelectionChange || vi.fn();
  const Harness = () => {
    const [selectedStudentIds, setSelectedStudentIds] = React.useState(props.selectedStudentIds || []);
    return (
      <StudentTable
        students={students}
        classId="class-1"
        onResetPassword={vi.fn()}
        onRemoveStudent={vi.fn()}
        onParentAccess={vi.fn()}
        onOpenCoinAwards={vi.fn()}
        {...props}
        selectedStudentIds={selectedStudentIds}
        onSelectionChange={(ids) => { onSelectionChange(ids); setSelectedStudentIds(ids); }}
      />
    );
  };
  return { ...render(<Harness />), onSelectionChange };
};

describe('StudentTable coin-award selection', () => {
  it('selects an individual student with an explicitly labelled native checkbox', () => {
    const onSelectionChange = vi.fn();
    renderControlledStudentTable({ onSelectionChange, selectedStudentIds: [] });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn Nguyễn An' }));

    expect(onSelectionChange).toHaveBeenCalledWith(['s-1']);
    expect(screen.getByRole('button', { name: 'Thưởng xu cho 1 học sinh' })).toBeInTheDocument();
  });

  it('selects visible students and all active students independently', () => {
    const onSelectionChange = vi.fn();
    renderControlledStudentTable({ onSelectionChange, selectedStudentIds: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Chọn tất cả học sinh đang hiển thị' }));
    expect(onSelectionChange).toHaveBeenNthCalledWith(1, ['s-1', 's-2']);

    fireEvent.click(screen.getByRole('button', { name: 'Chọn tất cả học sinh đang hoạt động' }));
    expect(onSelectionChange).toHaveBeenNthCalledWith(2, ['s-1', 's-2']);
  });

  it('keeps the selection controls and bulk shortcut usable on mobile cards', () => {
    ui.isMobile = true;
    const onSelectionChange = vi.fn();
    try {
      renderControlledStudentTable({ onSelectionChange, selectedStudentIds: [] });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn Trần Bình' }));
      expect(onSelectionChange).toHaveBeenCalledWith(['s-2']);
      expect(screen.getByRole('button', { name: 'Thưởng xu cho 1 học sinh' })).toBeInTheDocument();
    } finally {
      ui.isMobile = false;
    }
  });

  it('disables selection and hides the sticky bulk bar while offline', () => {
    renderStudentTable({ selectedStudentIds: [], selectionDisabled: true });

    expect(screen.getByRole('checkbox', { name: 'Chọn Nguyễn An' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Thưởng xu cho/ })).not.toBeInTheDocument();
  });
});

const rosterStore = vi.hoisted(() => ({
  students: {
    'class-1': [
      { id: 's-1', fullName: 'Nguyễn An', username: 'an01', classId: 'class-1' },
      { id: 's-2', fullName: 'Trần Bình', username: 'binh02', classId: 'class-1' },
    ],
  },
  isLoading: false,
  error: null,
  fetchStudents: vi.fn(),
  addStudent: vi.fn(),
  addStudentsBulk: vi.fn(),
  resetPassword: vi.fn(),
  removeStudent: vi.fn(),
}));
vi.mock('../src/stores/useRosterStore', () => ({ useRosterStore: () => rosterStore }));
vi.mock('../src/features/class-management/components/ParentCommunicationPanel', () => ({ default: () => <div /> }));
vi.mock('../src/features/class-management/components/ParentAccessModal', () => ({ default: () => null }));
vi.mock('../src/features/class-management/components/Modals', () => ({ AddStudentModal: () => null, ResetPasswordModal: () => null }));

describe('ClassDetailView coin-award shortcut', () => {
  it('stores one-time selected-student prefill and navigates to the canonical award route without an API call', () => {
    rosterStore.students['class-1'] = students;
    useCoinAwardsStore.setState({ awardPrefill: null });
    useAuthStore.setState({ username: 'teacher-a' });
    render(
      <MemoryRouter initialEntries={['/teacher/classes']}>
        <ClassDetailView classroom={{ id: 'class-1', name: '4A', teacherUsername: 'teacher-a', createdAt: '2026-09-22' }} onBack={vi.fn()} />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn Nguyễn An' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thưởng xu cho 1 học sinh' }));

    expect(useCoinAwardsStore.getState().awardPrefill).toEqual(expect.objectContaining({
      token: expect.any(String),
      actorUsername: 'teacher-a',
      classId: 'class-1',
      studentIds: ['s-1'],
      selectionMode: 'SELECTED',
    }));
    const token = useCoinAwardsStore.getState().awardPrefill?.token;
    expect(screen.getByTestId('coin-award-location')).toHaveTextContent(`/teacher/coin-awards|${token}`);
  });

  it('prunes selected students when the active roster removes or archives them', () => {
    rosterStore.students['class-1'] = students;
    useCoinAwardsStore.setState({ awardPrefill: null });
    useAuthStore.setState({ username: 'teacher-a' });
    const initialStudents = rosterStore.students['class-1'];
    const { rerender } = render(
      <MemoryRouter>
        <ClassDetailView classroom={{ id: 'class-1', name: '4A', teacherUsername: 'teacher-a', createdAt: '2026-09-22' }} onBack={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn Nguyễn An' }));
    expect(screen.getByRole('button', { name: 'Thưởng xu cho 1 học sinh' })).toBeInTheDocument();

    rosterStore.students['class-1'] = initialStudents.filter((student) => student.id !== 's-1');
    rerender(
      <MemoryRouter>
        <ClassDetailView classroom={{ id: 'class-1', name: '4A', teacherUsername: 'teacher-a', createdAt: '2026-09-22' }} onBack={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /Thưởng xu cho/ })).not.toBeInTheDocument();
    rosterStore.students['class-1'] = students;
  });

  it('clears the controlled selection when the class changes', () => {
    rosterStore.students['class-1'] = students;
    const { rerender } = render(
      <MemoryRouter>
        <ClassDetailView classroom={{ id: 'class-1', name: '4A', teacherUsername: 'teacher-a', createdAt: '2026-09-22' }} onBack={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn Nguyễn An' }));
    expect(screen.getByRole('button', { name: 'Thưởng xu cho 1 học sinh' })).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ClassDetailView classroom={{ id: 'class-2', name: '4B', teacherUsername: 'teacher-a', createdAt: '2026-09-22' }} onBack={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /Thưởng xu cho/ })).not.toBeInTheDocument();
  });

  it('hides the shortcut when the coin-award feature flag is off', () => {
    rosterStore.students['class-1'] = students;
    flag.enabled = false;
    try {
      render(
        <MemoryRouter>
          <ClassDetailView classroom={{ id: 'class-1', name: '4A', teacherUsername: 'teacher-a', createdAt: '2026-09-22' }} onBack={vi.fn()} />
        </MemoryRouter>,
      );
      expect(screen.queryByRole('button', { name: /Thưởng xu/ })).not.toBeInTheDocument();
    } finally {
      flag.enabled = true;
    }
  });
});
