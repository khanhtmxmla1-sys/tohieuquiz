import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ManageTab from '../src/components/TeacherDashboard/ManageTab';
import { useAssignmentStore } from '../src/stores/useAssignmentStore';
import { useClassStore } from '../src/stores/useClassStore';
import { useRosterStore } from '../src/stores/useRosterStore';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';

vi.mock('../src/components/TeacherDashboard/WorksheetExportModal', () => ({ default: () => null }));
vi.mock('../src/utils/toast', () => ({
  showConfirm: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const quiz = {
  id: 'quiz-4',
  title: 'Phép cộng phân số',
  classLevel: '4',
  category: 'math',
  tags: ['phân số'],
  questions: [],
  timeLimit: 20,
  createdAt: '2026-07-23T00:00:00.000Z',
  createdBy: 'teacher-a',
} as any;

const resetStores = () => {
  useAuthStore.setState({
    isLoggedIn: true,
    username: 'teacher-a',
    teacherName: 'Cô An',
    teacherClass: '4A',
    isAdmin: false,
  } as any);
  useQuizStore.setState({
    quizzes: [quiz],
    loadQuizzes: vi.fn().mockResolvedValue(undefined),
    duplicateQuiz: vi.fn().mockResolvedValue(true),
  } as any);
  useClassStore.setState({
    classes: [{ id: 'class-4a', name: '4A', teacherUsername: 'teacher-a' }],
    isLoading: false,
    error: null,
    fetchClasses: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(),
  } as any);
  useRosterStore.setState({
    students: { 'class-4a': [] },
    isLoading: false,
    error: null,
    fetchStudents: vi.fn().mockResolvedValue(undefined),
  } as any);
  useAssignmentStore.setState({
    assignments: [],
    isLoading: false,
    error: null,
    addAssignment: vi.fn().mockResolvedValue({ id: 'assignment-1' }),
    fetchTeacherAssignments: vi.fn().mockResolvedValue(undefined),
    fetchAllAssignments: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(),
  } as any);
};

/**
 * Tailwind không được nạp trong jsdom nên `getComputedStyle` không phản ánh
 * `overflow-hidden`; kiểm tra trực tiếp class trên chuỗi ancestor mới bắt được lỗi.
 */
const clippingAncestorsOf = (element: HTMLElement): string[] => {
  const clipping: string[] = [];
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    if (node.classList.contains('overflow-hidden') || node.classList.contains('overflow-clip')) {
      clipping.push(node.className);
    }
  }
  return clipping;
};

describe('ManageTab quiz row menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it('shows every action in the ⋮ menu', () => {
    render(<ManageTab quizzes={[quiz]} onEdit={vi.fn()} onManageCode={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: `Tùy chọn khác cho ${quiz.title}` }));

    const menu = screen.getByRole('menu');
    for (const action of ['Quản lý mã', 'Xem trước', 'Sửa đề', 'Nhân bản', 'Xuất Vở Bài Tập', 'Xóa đề']) {
      expect(within(menu).getByRole('menuitem', { name: action })).toBeTruthy();
    }
  });

  it('keeps the ⋮ menu clear of clipping ancestors', () => {
    // Hồi quy: danh sách đề từng bọc trong `overflow-hidden` để bo góc, khiến menu bị
    // cắt tại mép container. Với danh sách chỉ một đề, menu gần như biến mất hoàn toàn —
    // chỉ còn thấy một phần mục đầu tiên.
    render(<ManageTab quizzes={[quiz]} onEdit={vi.fn()} onManageCode={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: `Tùy chọn khác cho ${quiz.title}` }));

    expect(clippingAncestorsOf(screen.getByRole('menu'))).toEqual([]);
  });

  it('rounds the first and last row so the hover fill stays inside the border', () => {
    // Bo góc ở thẻ thay cho `overflow-hidden` ở container: đây là thứ giữ cho nền hover
    // không tràn khỏi viền bo sau khi bỏ cắt.
    render(<ManageTab quizzes={[quiz]} onEdit={vi.fn()} onManageCode={vi.fn()} />);

    const row = screen.getByText(quiz.title).closest('article');
    expect(row).not.toBeNull();
    expect(row!.classList.contains('first:rounded-t-[11px]')).toBe(true);
    expect(row!.classList.contains('last:rounded-b-[11px]')).toBe(true);
  });
});
