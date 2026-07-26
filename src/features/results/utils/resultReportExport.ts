import type {
  ResultReportParentStatus,
  ResultReportStudentStatus,
} from '../../../../shared/result-reports.contract';

export interface ResultReportExportRow {
  studentName: string;
  className: string;
  score: number;
  attemptLabel: string;
  parentPhone: string | null;
  publicUrl: string | null;
  studentStatus: ResultReportStudentStatus;
  parentStatus: ResultReportParentStatus;
}

export const buildResultReportZaloMessage = (
  row: Pick<ResultReportExportRow, 'studentName' | 'publicUrl'>,
  quizTitle: string,
  expiresInDays = 30,
): string => {
  const link = row.publicUrl || '[chưa có link]';
  return `Kính gửi phụ huynh em ${row.studentName}, giáo viên đã gửi phiếu kết quả bài “${quizTitle}”. Xem phiếu tại: ${link}. Link có hiệu lực trong ${expiresInDays} ngày.`;
};

const csvCell = (value: unknown): string => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildResultReportCsv = (
  rows: readonly ResultReportExportRow[],
  quizTitle: string,
  expiresInDays = 30,
): string => {
  const header = [
    'Họ tên học sinh', 'Lớp', 'Điểm', 'Lần làm', 'Số điện thoại phụ huynh',
    'Link riêng', 'Tin nhắn gợi ý', 'Trạng thái học sinh', 'Trạng thái phụ huynh',
  ];
  const lines = rows.map((row) => [
    row.studentName,
    row.className,
    row.score,
    row.attemptLabel,
    row.parentPhone || '',
    row.publicUrl || '',
    buildResultReportZaloMessage(row, quizTitle, expiresInDays),
    row.studentStatus,
    row.parentStatus,
  ].map(csvCell).join(','));
  return `\uFEFF${header.map(csvCell).join(',')}\r\n${lines.join('\r\n')}`;
};
