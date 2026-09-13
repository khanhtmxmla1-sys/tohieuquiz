import { formatSystemDateTime, getSystemDateKey } from '../../../utils/dateTime';
import type { StudentResult } from '../../../types';
import type { ResultsStatistics } from '../../../utils/statisticsUtils';
import type { SheetData } from 'write-excel-file/browser';

const downloadText = (content: string, type: string, filename: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
};

const normalizeLegacyIdentityPart = (value: unknown): string => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('vi');

const trimmedIdentityPart = (value: unknown): string => String(value ?? '').trim();

const buildDisplayClassAliases = (results: StudentResult[]): Map<string, Set<string>> => {
  const aliases = new Map<string, Set<string>>();
  results.forEach((result) => {
    const displayClass = normalizeLegacyIdentityPart(result.studentClass);
    const classId = trimmedIdentityPart(result.classId);
    if (!displayClass || !classId) return;
    const classIds = aliases.get(displayClass) ?? new Set<string>();
    classIds.add(classId);
    aliases.set(displayClass, classIds);
  });
  return aliases;
};

const resultIdentityKey = (
  result: StudentResult,
  index: number,
  displayClassAliases: Map<string, Set<string>>,
): string => {
  const quizId = trimmedIdentityPart(result.quizId);
  const studentId = trimmedIdentityPart(result.studentId);
  if (studentId) return `${quizId}\u0000student-id:${studentId}`;

  const studentName = normalizeLegacyIdentityPart(result.studentName);
  const classId = trimmedIdentityPart(result.classId);
  const displayClass = normalizeLegacyIdentityPart(result.studentClass);
  if (!studentName) {
    return `${quizId}\u0000malformed-result:${trimmedIdentityPart(result.id) || `index:${index}`}`;
  }

  if (classId) {
    return `${quizId}\u0000legacy-class-id:${classId}\u0000${studentName}`;
  }

  const classIds = displayClassAliases.get(displayClass);
  if (classIds?.size === 1) {
    return `${quizId}\u0000legacy-class-id:${Array.from(classIds)[0]}\u0000${studentName}`;
  }
  if (displayClass) {
    return `${quizId}\u0000legacy-class-display:${displayClass}\u0000${studentName}`;
  }

  return `${quizId}\u0000malformed-result:${trimmedIdentityPart(result.id) || `index:${index}`}`;
};

const timestampForComparison = (submittedAt: string): number => {
  const timestamp = Date.parse(submittedAt);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

const compareResultIds = (candidateId: string, currentId: string): number => {
  if (/^-?\d+$/.test(candidateId) && /^-?\d+$/.test(currentId)) {
    const candidateNumber = BigInt(candidateId);
    const currentNumber = BigInt(currentId);
    if (candidateNumber !== currentNumber) return candidateNumber > currentNumber ? 1 : -1;
  }
  if (candidateId === currentId) return 0;
  return candidateId > currentId ? 1 : -1;
};

const compareResultRecency = (candidate: StudentResult, current: StudentResult): number => {
  const candidateTimestamp = timestampForComparison(candidate.submittedAt);
  const currentTimestamp = timestampForComparison(current.submittedAt);
  if (candidateTimestamp !== currentTimestamp) return candidateTimestamp - currentTimestamp;

  const candidateId = trimmedIdentityPart(candidate.id);
  const currentId = trimmedIdentityPart(current.id);
  return compareResultIds(candidateId, currentId);
};

/** Selects the most recent attempt for each quiz/student pair. */
export const selectLatestResults = (results: StudentResult[]): StudentResult[] => {
  const latestByIdentity = new Map<string, StudentResult>();
  const displayClassAliases = buildDisplayClassAliases(results);
  results.forEach((result, index) => {
    const key = resultIdentityKey(result, index, displayClassAliases);
    const current = latestByIdentity.get(key);
    if (!current || compareResultRecency(result, current) > 0) {
      latestByIdentity.set(key, result);
    }
  });
  return Array.from(latestByIdentity.values());
};

const quizTitleForExport = (result: StudentResult): string => {
  const title = String(result.quizTitle ?? '').trim();
  if (title) return title;
  const quizId = trimmedIdentityPart(result.quizId);
  return quizId || 'Bài kiểm tra';
};

const durationForExport = (timeTaken: number): string => (
  Number.isFinite(timeTaken) ? `${timeTaken} phút` : 'Chưa xác định'
);

/** Builds the exact five-column sheet used by the latest-score workbook. */
export const buildLatestResultsSheetData = (results: StudentResult[]): SheetData => {
  const latestResults = selectLatestResults(results);
  return [
    [
      { value: 'STT', fontWeight: 'bold' },
      { value: 'Họ và tên', fontWeight: 'bold' },
      { value: 'Bài kiểm tra', fontWeight: 'bold' },
      { value: 'Điểm', fontWeight: 'bold' },
      { value: 'Thời gian làm', fontWeight: 'bold' },
    ],
    ...latestResults.map((result, index) => [
      index + 1,
      String(result.studentName ?? '').trim(),
      quizTitleForExport(result),
      result.score,
      durationForExport(result.timeTaken),
    ]),
  ];
};

export const exportLatestResultsXlsx = async (results: StudentResult[]): Promise<void> => {
  const data = buildLatestResultsSheetData(results);
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const blob = await writeExcelFile(data, {
    sheet: 'DiemMoiNhat',
    columns: [
      { width: 8 },
      { width: 28 },
      { width: 40 },
      { width: 12 },
      { width: 18 },
    ],
    stickyRowsCount: 1,
  }).toBlob();
  const { saveAs } = await import('file-saver');
  saveAs(blob, `diem-moi-nhat-${getSystemDateKey()}.xlsx`);
};

export const exportResultsCsv = (results: StudentResult[]) => {
  const data = results.map(result => ({
    'Học sinh': result.studentName,
    'Lớp': result.studentClass,
    'Điểm': result.score,
    'Số câu đúng': result.correctCount,
    'Tổng câu': result.totalQuestions,
    'Thời gian (phút)': result.timeTaken,
    'Ngày nộp': formatSystemDateTime(result.submittedAt),
  }));
  const headers = Object.keys(data[0] || {}).join(',');
  const rows = data.map(row => Object.values(row).join(',')).join('\n');
  downloadText(
    `\ufeff${headers}\n${rows}`,
    'text/csv;charset=utf-8;',
    `ket-qua-${getSystemDateKey()}.csv`,
  );
};

export const exportResultsSummary = (statistics: ResultsStatistics) => {
  const report = `
BÁO CÁO TỔNG HỢP KẾT QUẢ
========================
Ngày xuất: ${formatSystemDateTime(new Date())}

THỐNG KÊ CHUNG
--------------
Tổng số bài làm: ${statistics.totalResults}
Điểm trung bình: ${statistics.mean}
Điểm trung vị: ${statistics.median}
Độ lệch chuẩn: ${statistics.stdDev}
Điểm cao nhất: ${statistics.max}
Điểm thấp nhất: ${statistics.min}

TỶ LỆ ĐẠT/KHÔNG ĐẠT
-------------------
Đạt (≥5đ): ${statistics.passCount} học sinh (${statistics.passRate}%)
Không đạt (<5đ): ${statistics.failCount} học sinh

PHÂN BỐ ĐIỂM SỐ
---------------
${statistics.scoreDistribution.map(item => `${item.range}: ${item.count} học sinh (${item.percentage.toFixed(1)}%)`).join('\n')}
        `;
  downloadText(
    report,
    'text/plain;charset=utf-8;',
    `bao-cao-tong-hop-${getSystemDateKey()}.txt`,
  );
};
