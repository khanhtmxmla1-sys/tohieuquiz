import { CheckCircle2 } from 'lucide-react';
import type { StudentLiveExamController } from '../hooks/useStudentLiveExam';

export const LiveExamSubmittedScreen = ({
  submission,
}: Pick<StudentLiveExamController, 'submission'>) => {
  const submittedAt = submission?.submittedAt
    ? new Date(submission.submittedAt).toLocaleTimeString('vi-VN') : '';
  return <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 text-center">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
      </div>
      <h2 className="text-3xl font-bold text-slate-800 mb-2">Em đã nộp bài thành công!</h2>
      <p className="text-slate-600 mb-6">
        Đây là điểm tạm thời của em. Kết quả chính thức và xếp hạng sẽ hiện khi giáo viên kết thúc phiên thi.
      </p>
      {submission && <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <ScoreCard label="Điểm tạm thời" value={submission.score}
          className="bg-blue-50 border-blue-200 text-blue-600" />
        <ScoreCard label="Câu đúng" value={submission.correctCount}
          className="bg-emerald-50 border-emerald-200 text-emerald-600" />
        <ScoreCard label="Câu sai" value={submission.wrongCount}
          className="bg-rose-50 border-rose-200 text-rose-600" />
      </div>}
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-left text-slate-600 space-y-2">
        <p>• Bài làm của em đã được ghi nhận an toàn.</p>
        <p>• Thời gian nộp: {submittedAt || 'Vừa xong'}.</p>
        <p>• Hệ thống sẽ tự chuyển sang kết quả chính thức khi phiên thi đóng.</p>
      </div>
    </div>
  </div>;
};

const ScoreCard = ({ label, value, className }: {
  label: string; value: string | number; className: string;
}) => <div className={`rounded-2xl border p-4 ${className}`}>
  <div className="text-sm font-semibold mb-1">{label}</div>
  <div className="text-3xl font-bold">{value}</div>
</div>;
