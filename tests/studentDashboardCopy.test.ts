import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const homePageSource = readSource('src/components/HomePage/HomePage.tsx');
const studentQuizViewSource = readSource('src/app/StudentQuizView.tsx');
const waitingRoomChatSource = readSource('src/components/LiveExam/WaitingRoomChatPanel.tsx');
const studentDashboardSource = readSource('src/components/HomePage/StudentDashboardUI.tsx');
const errorBoundarySource = readSource('src/components/common/ErrorBoundary.tsx');
const supportErrorSource = readSource('src/components/common/SupportError.tsx');
const apiErrorsSource = readSource('src/services/api/errors.ts');
const sharedErrorSource = [errorBoundarySource, supportErrorSource, apiErrorsSource].join('\n');
const stylesSource = readSource('styles.css');
const studentCopySource = [
  homePageSource,
  studentQuizViewSource,
  waitingRoomChatSource,
  sharedErrorSource,
].join('\n');

describe('student dashboard Vietnamese copy', () => {
  it('uses valid UTF-8 copy for the authenticated dashboard loading state', () => {
    expect(homePageSource).toContain('Đang tải không gian học tập...');
    expect(homePageSource).not.toContain('?ang t?i kh?ng gian h?c t?p...');
  });

  it('loads and applies a Vietnamese-capable font in the student dashboard', () => {
    expect(stylesSource).toContain('family=Be+Vietnam+Pro');
    expect(studentDashboardSource).toContain("font-['Be_Vietnam_Pro']");
  });

  it('uses fully accented Vietnamese in the quiz loading error state', () => {
    for (const copy of [
      'Chưa tải được câu hỏi',
      'Hệ thống chưa tải được câu hỏi cho bài này. Vui lòng thử lại.',
      'Về trang chủ',
      'Thử lại',
    ]) {
      expect(studentQuizViewSource).toContain(copy);
    }
  });

  it('uses valid UTF-8 copy in the shared error screen', () => {
    for (const copy of [
      'Thông báo lỗi ứng dụng',
      'Ứng dụng gặp sự cố',
      'Ứng dụng gặp sự cố. Vui lòng thử lại.',
      'Mã hỗ trợ',
      'Thử lại',
      'Về trang chủ',
      'Tải lại trang',
      'Chi tiết dành cho phát triển',
    ]) {
      expect(sharedErrorSource).toContain(copy);
    }
  });

  it('keeps the student waiting-room chat copy fully accented', () => {
    for (const copy of [
      'Trò chuyện trong phòng chờ',
      'Học sinh có thể nhắn tin trong lúc chờ.',
      'Giáo viên đã tắt trò chuyện trong phòng chờ.',
      'Đang tải tin nhắn...',
      'Chưa có tin nhắn nào trong phòng chờ.',
      'Hãy gửi một lời nhắn ngắn để bắt đầu.',
      'Giáo viên đã tạm tắt trò chuyện trong phòng chờ.',
      'Thông báo -',
      'Nhắn tin với cả phòng...',
      'Trò chuyện đang tạm khóa',
      'Gửi',
    ]) {
      expect(waitingRoomChatSource).toContain(copy);
    }
  });

  it('contains no known mojibake or unaccented fallback phrases in student-facing states', () => {
    const forbidden = [
      '?ang t?i',
      'Dang tai',
      'He thong chua',
      'Vui long thu lai',
      'Ve trang chu',
      'Thu lai',
      'Chat phong cho',
      'Hoc sinh co the',
      'Giao vien da',
      'Chua co tin nhan',
      'Hay gui mot loi nhan',
      'Thong bao -',
      'Nhan tin voi ca phong',
      'Chat dang tam khoa',
      '>Gui<',
      'Ã',
      'Â',
      '�',
    ];

    for (const phrase of forbidden) {
      expect(studentCopySource).not.toContain(phrase);
    }
  });
});
