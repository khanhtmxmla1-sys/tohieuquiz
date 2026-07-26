import React, { useMemo } from 'react';
import { HomeworkSubmission, AnalyticsNode } from '../../homework/types';
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

interface ClassHeatmapProps {
  submissions: HomeworkSubmission[];
  maxQuestions?: number;
}

export const ClassHeatmap: React.FC<ClassHeatmapProps> = ({ submissions }) => {
  // 1. Phân tích để lấy danh sách tất cả các câu hỏi
  const allQuestionIds = useMemo(() => {
    const ids = new Set<string>();
    submissions.forEach(sub => {
      if (sub.analyticsData) {
        sub.analyticsData.forEach(node => ids.add(node.questionId.toString()));
      }
    });
    // Thử sort theo số nếu the format in "1", "2"... 
    return Array.from(ids).sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [submissions]);

  // 2. Map submission data để render
  // Mở rộng logic: Giả sử điểm số: 1=Đúng, 0=Sai, >0.1 & <1 = Đúng một phần
  const getCellColor = (score: number | undefined) => {
    if (score === undefined) return 'bg-gray-100 text-gray-400'; // Unknown
    if (score >= 1) return 'bg-green-100 text-green-700 font-medium'; // Correct
    if (score <= 0) return 'bg-red-100 text-red-700 font-medium'; // Incorrect
    return 'bg-yellow-100 text-yellow-700 font-medium'; // Partial
  };

  const getCellIcon = (score: number | undefined) => {
    if (score === undefined) return <HelpCircle size={14} />;
    if (score >= 1) return <CheckCircle2 size={14} />;
    if (score <= 0) return <XCircle size={14} />;
    return <span className="text-xs font-bold">{Math.round(score * 100)}%</span>;
  };

  if (!submissions || submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
        <p className="text-gray-500 font-medium">Chưa có dữ liệu phân tích (Heatmap)</p>
      </div>
    );
  }

  if (allQuestionIds.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 text-yellow-700 rounded-lg text-sm">
        Bài kiểm tra này chưa có dữ liệu chi tiết theo từng câu hỏi.
      </div>
    );
  }

  return (
    <div className="w-full relative overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-xs text-gray-600 bg-gray-50 uppercase shadow-[0_1px_2px_rgba(0,0,0,0.05)] sticky top-0 z-20">
            <tr>
              <th className="px-4 py-3 font-semibold border-b border-r sticky left-0 bg-gray-50 z-30 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                Tên Học Sinh
              </th>
              {allQuestionIds.map((qId, index) => (
                <th key={qId} className="px-3 py-3 text-center border-b font-semibold min-w-[40px]">
                  C.{index + 1}
                </th>
              ))}
              <th className="px-4 py-3 text-center border-b font-semibold">Tổng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {submissions.map((sub, i) => {
              const nodesMap = new Map<string, AnalyticsNode>();
              if (sub.analyticsData) {
                sub.analyticsData.forEach(node => nodesMap.set(node.questionId.toString(), node));
              }

              // Tính toán số câu đúng để hiển thị tổng quan
              let correctCount = 0;
              let totalScore = 0;
              nodesMap.forEach(n => {
                if (n.score >= 1) correctCount++;
                totalScore += n.score;
              });

              return (
                <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-white group-hover:bg-gray-50 border-r shadow-[1px_0_0_rgba(0,0,0,0.05)] z-10 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {sub.student_name.charAt(0).toUpperCase()}
                    </div>
                    {sub.student_name}
                  </td>
                  
                  {allQuestionIds.map(qId => {
                    const node = nodesMap.get(qId);
                    return (
                      <td key={qId} className="p-0 border-r border-gray-50">
                        <div 
                          className={`w-full h-full min-h-[36px] flex items-center justify-center ${getCellColor(node?.score)}`}
                          title={`Câu ${qId}: ${node ? 'Đạt ' + (node.score*100) + '%' : 'Không có'}`}
                        >
                          {getCellIcon(node?.score)}
                        </div>
                      </td>
                    );
                  })}
                  
                  <td className="px-4 py-2 text-center font-bold text-gray-700 bg-gray-50/30">
                    <span className="text-green-600">{correctCount}</span>
                    <span className="text-gray-400 mx-0.5">/</span>
                    <span className="text-gray-600">{allQuestionIds.length}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="px-4 py-3 bg-gray-50 border-t flex gap-4 text-xs text-gray-500 justify-end">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>Đúng</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200"></div>Một phần</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>Sai</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-100 border border-gray-200"></div>Không rõ</div>
      </div>
    </div>
  );
};
