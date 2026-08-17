// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/authStore';
import { useClassStore } from '../src/stores/useClassStore';

const mocks = vi.hoisted(() => ({
  addAssignment: vi.fn(async () => 'assignment-1'),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../src/features/homework/stores/useHomeworkStore', () => ({
  useHomeworkStore: () => ({ addAssignment: mocks.addAssignment, isLoading: false }),
}));

vi.mock('../src/features/homework/hooks/useHomeworkUpload', () => ({
  useHomeworkUpload: () => ({
    uploadHomework: vi.fn(),
    isUploading: false,
    progress: 100,
    url: 'https://example.test/homework.pdf',
  }),
}));

vi.mock('../src/utils/toast', () => ({
  showSuccess: mocks.showSuccess,
  showError: mocks.showError,
}));

import { AssignmentCreator } from '../src/features/homework/components/AssignmentCreator';

describe('AssignmentCreator canonical class scope', () => {
  beforeEach(() => {
    mocks.addAssignment.mockClear();
    mocks.showSuccess.mockClear();
    mocks.showError.mockClear();
    useAuthStore.setState({
      isLoggedIn: true,
      username: 'teacher-a',
      teacherName: 'Cô A',
      isAdmin: false,
      teacherClass: '4A',
      teacherClasses: [
        { id: 'class-4a', name: '4A' },
        { id: 'class-5b', name: '5B' },
      ],
    });
    useClassStore.setState({
      classes: [
        { id: 'class-4a', name: '4A', teacherUsername: 'teacher-a', createdAt: '2026-08-01' },
        { id: 'class-5b', name: '5B', teacherUsername: 'teacher-a', createdAt: '2026-08-01' },
      ],
      isLoading: false,
      error: null,
    });
  });

  it('submits the canonical class id instead of the legacy class name', async () => {
    const view = render(<AssignmentCreator onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('VD: Phiếu Tiếng Việt tuần 23'), {
      target: { value: 'Bài tập phân số' },
    });
    const deadline = view.container.querySelector('input[type="datetime-local"]');
    expect(deadline).not.toBeNull();
    fireEvent.change(deadline as HTMLInputElement, { target: { value: '2026-08-18T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Giao phiếu bài tập ngay' }));

    await waitFor(() => expect(mocks.addAssignment).toHaveBeenCalledTimes(1));
    expect(mocks.addAssignment).toHaveBeenCalledWith(expect.objectContaining({
      class_id: 'class-4a',
      teacher_id: 'teacher-a',
    }));
  });
});
