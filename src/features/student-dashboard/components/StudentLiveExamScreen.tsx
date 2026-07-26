import { Loader2 } from 'lucide-react';
import { WaitingRoomStudent } from '@/src/components/LiveExam/WaitingRoomStudent';
import { LiveExamQuiz } from '@/src/components/LiveExam/LiveExamQuiz';
import { ResultsRoom } from '@/src/components/LiveExam/ResultsRoom';
import { LiveExamSubmittedScreen } from './LiveExamSubmittedScreen';
import type { StudentLiveExamController } from '../hooks/useStudentLiveExam';

export const StudentLiveExamScreen = ({ controller }: {
  controller: StudentLiveExamController;
}) => {
  const { joinedExam, joinedQuiz, questions, stage, status } = controller;
  if (!joinedExam) return null;
  if (stage === 'waiting') return <WaitingRoomStudent sessionId={joinedExam.sessionId}
    sessionTitle={joinedExam.sessionTitle} onExamStart={controller.markActive} />;
  if (stage === 'active' && (!joinedQuiz || controller.isPreparing)) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Đang chuẩn bị bài thi...</h2>
        <p className="text-slate-600 mb-4">Giáo viên đã bắt đầu bài thi. Hệ thống đang tải đề để em vào làm bài.</p>
        {controller.loadError && <div className="rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold px-4 py-3">
          {controller.loadError}
        </div>}
      </div>
    </div>
  );
  if (stage === 'active' && joinedQuiz && status?.session?.endsAt) return (
    <LiveExamQuiz sessionId={joinedExam.sessionId} questions={questions}
      quizTitle={joinedExam.sessionTitle} duration={status.session.duration}
      endsAt={status.session.endsAt} onComplete={controller.complete} />
  );
  if (stage === 'submitted') return <LiveExamSubmittedScreen submission={controller.submission} />;
  if (stage === 'results') return <ResultsRoom sessionId={joinedExam.sessionId}
    sessionTitle={joinedExam.sessionTitle} />;
  return null;
};
