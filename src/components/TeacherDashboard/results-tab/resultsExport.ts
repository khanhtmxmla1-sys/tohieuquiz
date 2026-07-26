import type { StudentResult } from '../../../types';
import type { ResultsStatistics } from '../../../utils/statisticsUtils';

const downloadText = (content: string, type: string, filename: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
};

export const exportResultsCsv = (results: StudentResult[]) => {
  const data = results.map(result => ({
    'Học sinh': result.studentName,
    'Lớp': result.studentClass,
    'Điểm': result.score,
    'Số câu đúng': result.correctCount,
    'Tổng câu': result.totalQuestions,
    'Thời gian (phút)': result.timeTaken,
    'Ngày nộp': new Date(result.submittedAt).toLocaleString('vi-VN'),
  }));
  const headers = Object.keys(data[0] || {}).join(',');
  const rows = data.map(row => Object.values(row).join(',')).join('\n');
  downloadText(
    `\ufeff${headers}\n${rows}`,
    'text/csv;charset=utf-8;',
    `ket-qua-${new Date().toISOString().slice(0, 10)}.csv`,
  );
};

export const exportResultsSummary = (statistics: ResultsStatistics) => {
  const report = `
BÁO CÁO TỔNG HỢP KẾT QUẢ
========================
Ngày xuất: ${new Date().toLocaleString('vi-VN')}

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
    `bao-cao-tong-hop-${new Date().toISOString().slice(0, 10)}.txt`,
  );
};
