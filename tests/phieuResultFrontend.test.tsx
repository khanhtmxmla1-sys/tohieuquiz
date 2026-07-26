import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudentResult } from '../src/types';
import type { PhieuNhanXet, PhieuPublicLink } from '../src/features/homework/types/phieu.types';
import { callApi } from '../src/services/apiAdapter';
import { resultPhieuLinkService } from '../src/features/results/services/resultPhieuLinkService';
import { buildPhieuFromResult } from '../src/features/results/utils/buildPhieuFromResult';
import { PhieuKetQuaCardV2 } from '../src/features/results/components/PhieuKetQuaCardV2';
import { PhieuBTCard } from '../src/features/results/components/PhieuBTCard';
import ResultRowPhieuModal from '../src/features/results/components/ResultRowPhieuModal';
import { PhieuFromResultsPanel } from '../src/features/results/components/PhieuFromResultsPanel';
import { useAuthStore } from '../stores/authStore';

vi.mock('../src/services/apiAdapter', () => ({
  callApi: vi.fn(),
}));

const mockCallApi = vi.mocked(callApi);

const result: StudentResult = {
  id: '42',
  submissionId: 'legacy-submission-alias',
  quizId: 'quiz-1',
  quizTitle: 'Phân số',
  studentName: 'Hoc Sinh Mau',
  studentClass: '5A',
  score: 0,
  correctCount: 0,
  totalQuestions: 10,
  timeTaken: 12,
  submittedAt: 'invalid-date-value',
  answers: {},
};

const savedPhieu: PhieuNhanXet = {
  id: 'phieu-42',
  submission_id: 'result:42',
  student_id: 'student-42',
  student_name: 'Hoc Sinh Mau',
  class_id: 'class-5a',
  mon_hoc: 'Toán',
  ten_bai_tap: 'Phân số',
  ngay_lam_bai: '2026-07-15T10:00:00.000Z',
  tong_cau: 10,
  so_cau_dung: 0,
  so_cau_sai: 10,
  diem_so: 0,
  xep_loai: 'Yếu',
  nhan_xet_mode: 'manual',
  nhan_xet_style: 'nhe_nhang',
  nhan_xet: 'Nhận xét đã lưu từ máy chủ.',
  noi_dung_co_gang: 'Cần ôn lại phân số.',
  loi_dong_vien: 'Em tiếp tục cố gắng nhé.',
  status: 'published',
  version: 2,
  created_by: 'teacher-a',
  teacher_name: 'Cô Giáo A',
  created_at: '2026-07-15T10:00:00.000Z',
  updated_at: '2026-07-15T10:30:00.000Z',
};

const publicLink: PhieuPublicLink = {
  phieuId: 'phieu-42',
  studentName: 'Hoc Sinh Mau',
  publicToken: 'existing-token',
  url: 'https://api.thtohieu.com/p/existing-token',
};

describe('result phieu API client', () => {
  beforeEach(() => {
    mockCallApi.mockReset();
  });

  it('loads an existing link without publishing a new batch', async () => {
    mockCallApi.mockResolvedValueOnce({
      status: 'success',
      data: { phieu: savedPhieu, link: publicLink },
    });

    const value = await resultPhieuLinkService.getByResult('42');

    expect(value).toEqual({ phieu: savedPhieu, link: publicLink });
    expect(mockCallApi).toHaveBeenCalledTimes(1);
    expect(mockCallApi).toHaveBeenCalledWith('get_result_phieu', { resultId: '42' });
    expect(mockCallApi).not.toHaveBeenCalledWith('publish_phieu_batch', expect.anything());
  });

  it('uses the secure result upsert before publishing', async () => {
    mockCallApi
      .mockResolvedValueOnce({ status: 'success', data: savedPhieu })
      .mockResolvedValueOnce({
        status: 'success',
        data: { batchId: 'batch-1', links: [publicLink] },
      });

    const value = await resultPhieuLinkService.upsertAndPublish({
      resultId: '42',
      phieuInput: buildPhieuFromResult(result, 'Phân số', 'nhe_nhang', 'teacher-a'),
      existingPhieuId: 'phieu-42',
    });

    expect(value).toEqual({ phieu: savedPhieu, link: publicLink });
    expect(mockCallApi.mock.calls[0][0]).toBe('upsert_result_phieu');
    expect(mockCallApi.mock.calls[0][1]).toMatchObject({
      resultId: '42',
      id: 'phieu-42',
      submission_id: 'result:42',
    });
    expect(mockCallApi.mock.calls[1]).toEqual([
      'publish_phieu_batch',
      expect.objectContaining({ phieuIds: ['phieu-42'] }),
    ]);
  });
});

describe('result phieu formatting and editing', () => {
  it('builds a canonical result key instead of reusing a homework submission id', () => {
    const phieu = buildPhieuFromResult(result, 'Phân số', 'nhe_nhang', 'teacher-a');
    expect(phieu.submission_id).toBe('result:42');
    expect(phieu.student_id).toBe('result:42');
  });

  it('shows score zero, hides invalid dates, and uses the teacher full name', () => {
    render(
      <PhieuKetQuaCardV2
        phieu={{ ...savedPhieu, ngay_lam_bai: 'not-a-date' }}
      />,
    );

    expect(screen.getByText('0.0')).toBeInTheDocument();
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
    expect(screen.getByText('Cô Giáo A')).toBeInTheDocument();
  });

  it('keeps server-owned identity fields read-only while comments remain editable', () => {
    const { container } = render(
      <PhieuBTCard
        phieu={savedPhieu}
        editable
        editableIdentity={false}
        onChange={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(0);
    expect(container.querySelectorAll('textarea')).toHaveLength(3);
    expect(screen.getByText('0.0')).toBeInTheDocument();
  });
});

describe('batch result phieu generation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the result-specific upsert for every selected quiz result', async () => {
    useAuthStore.setState({ username: 'teacher-a' });
    const upsert = vi.spyOn(resultPhieuLinkService, 'upsertResult').mockResolvedValue(savedPhieu);

    render(
      <PhieuFromResultsPanel
        results={[{
          id: '42',
          student_name: 'Hoc Sinh Mau',
          class_name: '5A',
          quiz_id: 'quiz-1',
          quiz_title: 'Phân số',
          score: 0,
          correctCount: 0,
          total_questions: 10,
          submitted_at: '2026-07-15T10:00:00.000Z',
        }]}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tạo 1 phiếu' }));

    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    expect(upsert).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({ submission_id: 'result:42', student_id: 'result:42' }),
    );
  });
});

describe('result phieu modal hydration and printing', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isLoggedIn: true,
      username: 'teacher-a',
      teacherName: 'Cô Giáo A',
      isAdmin: false,
      teacherClass: '5A',
      token: 'test-token',
      isLoggingIn: false,
      loginError: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates saved comments and the active link after the async lookup finishes', () => {
    const view = render(
      <ResultRowPhieuModal
        result={result}
        quizTitle="Phân số"
        initialSavedPhieu={null}
        initialPublishedLink={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByDisplayValue('Nhận xét đã lưu từ máy chủ.')).not.toBeInTheDocument();

    view.rerender(
      <ResultRowPhieuModal
        result={result}
        quizTitle="Phân số"
        initialSavedPhieu={savedPhieu}
        initialPublishedLink={publicLink}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('Nhận xét đã lưu từ máy chủ.')).toBeInTheDocument();
    expect(screen.getByText(publicLink.url)).toBeInTheDocument();
  });

  it('opens the dedicated print view instead of printing the whole dashboard immediately', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { container } = render(
      <ResultRowPhieuModal
        result={result}
        quizTitle="Phân số"
        initialSavedPhieu={savedPhieu}
        initialPublishedLink={publicLink}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle('Mở hộp thoại in'));

    expect(printSpy).not.toHaveBeenCalled();
    expect(container.querySelector('.phieu-print-root')).not.toBeNull();
  });
});
