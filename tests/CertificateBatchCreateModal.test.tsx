import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BatchCreateModal from '../src/features/certificates/BatchCreateModal';
import BatchCreateModalModule from '../src/features/certificates/certificate-batch-modal';

const mocks = vi.hoisted(() => ({
  fetchTemplateOptions: vi.fn(),
  fetch: vi.fn(),
  createBatch: vi.fn(),
  onClose: vi.fn(),
  onCreated: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
}));

vi.mock('../src/features/certificates/useBatches', () => ({
  fetchTemplateOptions: mocks.fetchTemplateOptions,
}));

vi.mock('../src/utils/toast', () => ({
  showSuccess: mocks.showSuccess,
  showError: mocks.showError,
}));

const studentsByClass = {
  'class-1': [
    { id: 'student-1', fullName: 'An', username: 'an01' },
    { id: 'student-2', fullName: 'Bình', username: 'binh02' },
    { id: 'student-3', fullName: 'Chi', username: 'chi03' },
  ],
  'class-2': [
    { id: 'student-4', fullName: 'Dũng', username: 'dung04' },
  ],
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const installFetchMock = () => {
  mocks.fetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/classes')) {
      return jsonResponse({ data: [
        { id: 'class-1', name: '3A' },
        { id: 'class-2', name: '3B' },
      ] });
    }
    if (url.endsWith('/api/quizzes')) {
      return jsonResponse([
        { id: 'quiz-1', title: 'Phân số' },
        { id: 'quiz-2', title: 'Hình học' },
      ]);
    }
    if (url.includes('/api/students?classId=')) {
      const classId = new URL(url, 'https://example.test').searchParams.get('classId') || '';
      return jsonResponse({ data: studentsByClass[classId as keyof typeof studentsByClass] || [] });
    }
    if (url.includes('/api/results?')) {
      return jsonResponse({ data: [
        { 'Student Name': 'An', 'Score': 9, 'Quiz ID': 'quiz-1', 'Quiz Title': 'Phân số' },
        { 'Student Name': 'Bình', 'Score': 8, 'Quiz ID': 'quiz-1', 'Quiz Title': 'Phân số' },
      ] });
    }
    if (url.endsWith('/api/certificates/render-preview')) {
      expect(init?.method).toBe('POST');
      return new Response(new Blob(['<svg />'], { type: 'image/svg+xml' }), {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal('fetch', mocks.fetch);
};

const renderModal = () => render(
  <BatchCreateModal
    onClose={mocks.onClose}
    onCreated={mocks.onCreated}
    createBatch={mocks.createBatch}
  />,
);

const waitForInitialLoad = async () => {
  await waitFor(() => expect(screen.getByText('(3/3 đã chọn)')).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Cấp cho 3 học sinh' })).toBeTruthy();
};

describe('Certificate BatchCreateModal contracts', () => {
  it('keeps the certificate feature compatibility export stable', () => {
    expect(BatchCreateModal).toBe(BatchCreateModalModule);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.fetchTemplateOptions.mockResolvedValue([
      { id: 'template-1', name: 'Mẫu phụ', is_active: 1, is_default: 0 },
      { id: 'template-default', name: 'Mẫu mặc định', is_active: 1, is_default: 1 },
    ]);
    mocks.createBatch.mockResolvedValue({ batch_id: 'batch-1', status: 'pending' });
    mocks.createObjectURL.mockReturnValue('blob:certificate-preview');
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = mocks.createObjectURL;
      static revokeObjectURL = mocks.revokeObjectURL;
    });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('request-stable-1' as `${string}-${string}-${string}-${string}-${string}`);
    installFetchMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('selects the default template, first class, and every student after loading', async () => {
    renderModal();
    await waitForInitialLoad();

    const selects = screen.getAllByRole('combobox');
    expect((selects[0] as HTMLSelectElement).value).toBe('template-default');
    expect((selects[1] as HTMLSelectElement).value).toBe('class-1');
    expect(mocks.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/students?classId=class-1'),
      expect.objectContaining({ credentials: 'include', headers: expect.not.objectContaining({ Authorization: expect.anything() }) }),
    );
  });

  it('toggles only the students visible in the current search', async () => {
    renderModal();
    await waitForInitialLoad();

    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên hoặc tài khoản...'), {
      target: { value: 'An' },
    });
    fireEvent.click(screen.getByText('Chọn tất cả (1)'));

    expect(screen.getByText('(2/3 đã chọn)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cấp cho 2 học sinh' })).toBeTruthy();
    expect(screen.getByText('An').closest('div')?.className).not.toContain('bg-blue-50/40');
  });

  it('renders a preview for the first selected student and revokes its blob URL on close', async () => {
    renderModal();
    await waitForInitialLoad();

    fireEvent.click(screen.getByRole('radio', { name: /Playwrite Việt Nam/i }));
    fireEvent.change(screen.getByPlaceholderText('Đã hoàn thành xuất sắc'), {
      target: { value: 'Đã tiến bộ vượt bậc' },
    });
    fireEvent.change(screen.getByPlaceholderText('Mường La, ngày 15 tháng 7 năm 2026'), {
      target: { value: 'Mường La, ngày 19 tháng 7 năm 2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xem trước ảnh' }));

    await waitFor(() => expect(screen.getByText('Dữ liệu mẫu: An. Chưa gửi cho học sinh.')).toBeTruthy());
    const previewCall = mocks.fetch.mock.calls.find(([url]) => String(url).endsWith('/api/certificates/render-preview'));
    expect(JSON.parse(String(previewCall?.[1]?.body))).toEqual({
      template_id: 'template-default',
      class_id: 'class-1',
      student_id: 'student-1',
      student_name_font: 'Playwrite VN',
      achievement_prefix: 'Đã tiến bộ vượt bậc',
      date_line: 'Mường La, ngày 19 tháng 7 năm 2026',
    });
    expect(screen.getByAltText('Xem trước chứng nhận của An')).toHaveAttribute('src', 'blob:certificate-preview');

    fireEvent.click(screen.getByRole('button', { name: 'Đóng xem trước' }));
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith('blob:certificate-preview');
  });

  it('validates the title before creating a batch', async () => {
    renderModal();
    await waitForInitialLoad();

    fireEvent.click(screen.getByRole('button', { name: 'Cấp cho 3 học sinh' }));

    expect(mocks.showError).toHaveBeenCalledWith('Vui lòng nhập tiêu đề');
    expect(mocks.createBatch).not.toHaveBeenCalled();
  });

  it('submits one stable request id and the selected student ids', async () => {
    renderModal();
    await waitForInitialLoad();

    fireEvent.change(screen.getByPlaceholderText('Vd: Kết quả kỳ thi Toán tháng 6'), {
      target: { value: '  Đợt cấp tháng 7  ' },
    });
    fireEvent.change(screen.getByPlaceholderText('Vd: Chúc mừng em đã hoàn thành xuất sắc!'), {
      target: { value: '  Tiếp tục phát huy  ' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /Alex Brush/i }));
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[2], { target: { value: 'quiz-1' } });
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/results?quizId=quiz-1'),
      expect.anything(),
    ));

    fireEvent.click(screen.getByText('Chi').closest('div') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Cấp cho 2 học sinh' }));

    await waitFor(() => expect(mocks.createBatch).toHaveBeenCalledTimes(1));
    expect(mocks.createBatch).toHaveBeenCalledWith(expect.objectContaining({
      request_id: 'request-stable-1',
      template_id: 'template-default',
      title: 'Đợt cấp tháng 7',
      message: 'Tiếp tục phát huy',
      student_name_font: 'Alex Brush',
      class_id: 'class-1',
      quiz_id: 'quiz-1',
      student_ids: ['student-1', 'student-2'],
    }));
    expect(mocks.showSuccess).toHaveBeenCalledWith('Đã tiếp nhận 2 chứng nhận và đang xử lý.');
    expect(mocks.onCreated).toHaveBeenCalledTimes(1);
  });
});
