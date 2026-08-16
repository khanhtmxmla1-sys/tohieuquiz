import { formatSystemDateTime } from '../../../utils/dateTime';
import React, { useEffect, useState } from 'react';
import { showError, showSuccess } from '@/src/utils/toast';
import { HomeworkAssignment, HomeworkAssignmentAnalytics, HomeworkSubmission } from '../types';
import { useHomeworkStore } from '../stores/useHomeworkStore';
import { useRosterStore } from '../../../stores/useRosterStore';
import { ArrowLeft, User, Clock, CheckCircle2, Sparkles, Send, Eye, MessageSquare, Trophy, Loader2 } from 'lucide-react';
import { Button } from '../../../components/common';
import MathSpan from '../../../components/common/MathSpan';
import { homeworkBackendService } from '../services/homeworkBackendService';
import { homeworkService } from '../services/homeworkService';
import { ClassHeatmap } from '../../analytics';
import { PhieuBatchPanel } from './PhieuBatchPanel';

interface AssignmentSubmissionsViewProps {
  assignment: HomeworkAssignment;
  onBack: () => void;
}

type GradingSubmission = HomeworkSubmission & {
  ai_flagged_reason?: string | null;
};

function readAiEvidence(submission: GradingSubmission | null) {
  const fallback = {
    feedback: submission?.ai_feedback || submission?.ai_evaluation || '',
    flaggedReason: submission?.ai_flagged_reason || null,
  };
  if (!submission?.ai_evaluation) return fallback;
  try {
    const parsed = JSON.parse(submission.ai_evaluation) as Record<string, unknown>;
    if (parsed?.version !== 1) return fallback;
    return {
      feedback: String(parsed.feedback || fallback.feedback),
      flaggedReason: parsed.flaggedReason == null ? fallback.flaggedReason : String(parsed.flaggedReason),
    };
  } catch {
    return fallback;
  }
}

function scoreFromBreakdown(breakdown: GradingSubmission['gradingBreakdown']): number | null {
  if (!breakdown?.length) return null;
  const earned = breakdown.reduce((total, item) => total + item.score, 0);
  const available = breakdown.reduce((total, item) => total + item.maxScore, 0);
  return available > 0 ? (earned / available) * 10 : null;
}

export const AssignmentSubmissionsView: React.FC<AssignmentSubmissionsViewProps> = ({
  assignment,
  onBack
}) => {
  const { submissions, fetchClassAssignments } = useHomeworkStore();
  const students = useRosterStore((state) => state.students);
  const fetchStudents = useRosterStore((state) => state.fetchStudents);
  const [localSubmissions, setLocalSubmissions] = useState<GradingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<GradingSubmission | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'GRADING' | 'ANALYTICS' | 'PHIEU'>('GRADING');

  // For editing
  const [editScore, setEditScore] = useState<number>(0);
  const [editFeedback, setEditFeedback] = useState<string>('');

  // Analytics data
  const [analyticsData, setAnalyticsData] = useState<HomeworkAssignmentAnalytics | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchStudents(assignment.class_id);
      const subs = await homeworkBackendService.getSubmissions(assignment.id);
      setLocalSubmissions(subs);
      
      try {
        const stats = await homeworkBackendService.getAssignmentAnalytics(assignment.id);
        setAnalyticsData(stats);
      } catch (e) {
        console.warn('Could not load analytics', e);
      }
      
      setLoading(false);
    };
    loadData();
  }, [assignment.id, assignment.class_id, fetchStudents]);

  const classStudents = students[assignment.class_id] || [];

  const handleSelectSubmission = (sub: GradingSubmission) => {
    setSelectedSubmission(sub);
    setEditScore(sub.status === 'GRADED' ? sub.score : (sub.ai_score ?? sub.score ?? 0));
    setEditFeedback(sub.teacher_feedback || '');
  };

  const handleGrade = async () => {
    if (!selectedSubmission) return;
    const breakdownScore = scoreFromBreakdown(selectedSubmission.gradingBreakdown);
    const publishBreakdown = breakdownScore !== null && Math.abs(breakdownScore - editScore) <= 0.01
      ? selectedSubmission.gradingBreakdown || []
      : [];
    setIsGrading(true);
    try {
      const published = await homeworkBackendService.publishGrade(
        selectedSubmission.id,
        editScore,
        editFeedback,
        publishBreakdown
      );
      const updatedSubmission: HomeworkSubmission = {
        ...selectedSubmission,
        score: editScore,
        teacher_feedback: editFeedback,
        gradingBreakdown: publishBreakdown,
        status: 'GRADED',
        published_at: published.publishedAt,
        graded_at: published.publishedAt,
      };
      
      // Update local state
      setLocalSubmissions(prev => prev.map(s => s.id === updatedSubmission.id ? updatedSubmission : s));
      setSelectedSubmission(updatedSubmission);
      showSuccess('Đã chấm điểm thành công! Học sinh hiện đã có thể xem kết quả.');
    } catch (err) {
      console.error(err);
      showError('Có lỗi xảy ra khi chấm điểm.');
    } finally {
      setIsGrading(false);
    }
  };

  const handleAIGrade = async () => {
    if (!selectedSubmission) return;
    setIsAILoading(true);
    try {
      const result = await homeworkService.gradeSubmission(selectedSubmission.id);
      
      // Auto-fill the form with AI results
      setEditScore(result.score);
      setEditFeedback(result.feedback);
      
      // Update local object to show AI part (optional, but good for immediate feedback)
      setSelectedSubmission({
        ...selectedSubmission,
        ai_evaluation: JSON.stringify({ version: 1, feedback: result.feedback, flaggedReason: result.flaggedReason || null }),
        ai_feedback: result.feedback,
        ai_flagged_reason: result.flaggedReason || null,
        ai_score: result.score,
        ai_confidence: result.confidence,
        gradingBreakdown: result.criteriaBreakdown.map((item, index) => ({ questionId: String(index + 1), ...item })),
      });
    } catch (err) {
      console.error(err);
      showError('AI không thể phân tích ảnh lúc này. Vui lòng thử lại sau.');
    } finally {
      setIsAILoading(false);
    }
  };

  const aiEvidence = readAiEvidence(selectedSubmission);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Đang tải danh sách bài nộp...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">{assignment.title}</h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Quản lý bài nộp • Lớp {assignment.class?.name || assignment.class_id}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('GRADING')}
          className={`px-4 py-3 font-bold text-sm tracking-wide border-b-2 transition-colors ${
            activeTab === 'GRADING' ? 'border-indigo-600 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          DANH SÁCH BÀI NỘP
        </button>
        <button
          onClick={() => setActiveTab('ANALYTICS')}
          className={`px-4 py-3 font-bold text-sm tracking-wide border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ANALYTICS' ? 'border-indigo-600 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4" /> BÁO CÁO NHANH
        </button>
        <button
          onClick={() => setActiveTab('PHIEU')}
          className={`px-4 py-3 font-bold text-sm tracking-wide border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'PHIEU' ? 'border-indigo-600 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> PHIEU KQ
        </button>
      </div>

      {activeTab === 'PHIEU' ? (
        <PhieuBatchPanel assignment={assignment} submissions={localSubmissions} />
      ) : activeTab === 'ANALYTICS' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="bg-white p-5 rounded-3xl border border-slate-100">
              <h3 className="text-lg font-black text-slate-800">Tổng quan bài tập</h3>
              <p className="text-sm text-slate-500 mb-4">Chỉ tính lần nộp mới nhất của từng học sinh.</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Đã nộp', `${analyticsData?.submitted || 0}/${analyticsData?.totalStudents || 0}`],
                  ['Đã chấm', analyticsData?.graded || 0],
                  ['Điểm TB', (analyticsData?.averageScore || 0).toFixed(1)],
                  ['Trung vị', (analyticsData?.medianScore || 0).toFixed(1)],
                ].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400 uppercase">{label}</p><p className="text-2xl font-black text-blue-700">{value}</p></div>)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100">
              <div className="mb-4">
                <h3 className="text-lg font-black text-slate-800">Ma trận phổ điểm Từng Cầu (Heatmap)</h3>
                <p className="text-sm text-slate-500">Bảng màu Xanh/Đỏ giúp phát hiện nhanh các "điểm mù" kiến thức của cả lớp bài này.</p>
              </div>
              <React.Suspense fallback={<div className="h-64 flex items-center justify-center animate-pulse bg-slate-50 rounded-xl">Đang tải ma trận...</div>}>
                <ClassHeatmap submissions={localSubmissions} />
              </React.Suspense>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl p-5">
            <h3 className="text-lg font-black text-slate-800">Câu/tiêu chí sai nhiều nhất</h3>
            <p className="text-sm text-slate-500 mb-4">Dưới 50%: chưa đạt; 50–79%: đạt một phần; từ 80%: thành thạo.</p>
            <div className="space-y-3">
              {(analyticsData?.mostMissed || []).map(item => (
                <div key={item.questionId} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex justify-between gap-3">
                    <MathSpan content={item.label} className="font-bold text-slate-700" />
                    <span className="text-sm font-bold text-rose-600">{item.notMet}/{item.total} chưa đạt</span>
                  </div>
                  {item.studentsNeedingHelp.length > 0 && (
                    <p className="text-xs text-slate-500 mt-2">Cần hỗ trợ: {item.studentsNeedingHelp.join(', ')}</p>
                  )}
                </div>
              ))}
              {(analyticsData?.mostMissed || []).length === 0 && <p className="text-sm text-slate-400">Chưa có đủ bài đã duyệt để phân tích.</p>}
            </div>
          </div>

        </div>
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Student List Sidebar */}
        <div className="xl:col-span-1 space-y-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2">Danh sách học sinh ({classStudents.length})</h3>
          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
            {classStudents.map((student) => {
              const submission = localSubmissions.find(s => s.student_id === student.id);
              const isSelected = selectedSubmission?.student_id === student.id;
              
              return (
                <div 
                  key={student.id}
                  onClick={() => submission && handleSelectSubmission(submission)}
                  className={`p-4 flex items-center justify-between border-b border-slate-50 last:border-0 transition-all ${
                    submission ? 'cursor-pointer hover:bg-indigo-50/50' : 'opacity-60 grayscale'
                  } ${isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      submission ? 'bg-indigo-100 text-blue-700' : 'bg-slate-100 text-blue-900'
                    }`}>
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{student.fullName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{student.username}</p>
                    </div>
                  </div>

                  {submission ? (
                    <div className="flex items-center gap-2">
                      {submission.status === 'GRADED' ? (
                        <div className="bg-emerald-100 text-emerald-600 p-1 rounded-full">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="bg-blue-100 text-blue-600 p-1 rounded-full">
                          <Clock className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] font-black text-slate-300 uppercase">Chưa nộp</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Grading Area */}
        <div className="xl:col-span-2">
          {selectedSubmission ? (
            <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-xl flex flex-col h-full">
              {/* Submission Content */}
              <div className="p-8 border-b border-slate-50">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                      <Eye className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-800">Bài làm của {selectedSubmission.student_name}</h4>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nộp lúc: {formatSystemDateTime(selectedSubmission.submitted_at)}</p>
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-widest ${
                    selectedSubmission.status === 'GRADED' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700 animate-pulse'
                  }`}>
                    {selectedSubmission.status === 'GRADED' ? 'Đã chấm điểm' : 'Đang chờ chấm'}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Image View */}
                  <div className="space-y-4">
                    <div className="relative group cursor-zoom-in">
                      <img 
                        src={selectedSubmission.file_urls[0]} 
                        className="w-full h-auto rounded-3xl border border-slate-100 shadow-sm" 
                        alt="Bài làm"
                      />
                    </div>
                    {selectedSubmission.student_note && (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Ghi chú của học sinh:</p>
                        <p className="text-sm text-slate-600 italic">"{selectedSubmission.student_note}"</p>
                      </div>
                    )}
                  </div>

                  {/* AI Evaluation & Teacher Input */}
                  <div className="space-y-6">
                    <div className="bg-indigo-50/50 rounded-3xl p-6 border border-indigo-100 relative overflow-hidden">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="flex items-center gap-2 text-blue-800 font-black text-sm uppercase tracking-wider">
                          <Sparkles className="w-5 h-5 text-blue-600" /> Đánh giá tự động từ AI
                        </h5>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={handleAIGrade}
                          disabled={isAILoading || selectedSubmission.status === 'GRADED'}
                          className="bg-white hover:bg-indigo-600 hover:text-white border-indigo-200 text-blue-700 font-black text-[10px] px-3 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
                        >
                          {isAILoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          {isAILoading ? 'ĐANG PHÂN TÍCH...' : selectedSubmission.status === 'GRADED' ? 'ĐIỂM ĐÃ CHỐT' : 'GỢI Ý CHẤM ĐIỂM'}
                        </Button>
                      </div>
                      
                      <div className="text-slate-700 text-sm leading-relaxed prose prose-slate max-w-none">
                        <MathSpan content={aiEvidence.feedback || 'Chưa có đánh giá. Bấm nút "Gợi ý chấm điểm" để bắt đầu.'} />
                      </div>
                      {selectedSubmission.ai_confidence != null && (
                        <p className="mt-3 text-xs font-bold text-indigo-500">
                          Độ tin cậy: {Math.round(selectedSubmission.ai_confidence * 100)}%
                        </p>
                      )}
                      {aiEvidence.flaggedReason && (
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Cần giáo viên lưu ý</p>
                          <p className="mt-1 text-sm text-amber-900">{aiEvidence.flaggedReason}</p>
                        </div>
                      )}
                      {(selectedSubmission.gradingBreakdown || []).length > 0 && (
                        <div className="mt-4 space-y-2" aria-label="Chi tiết tiêu chí AI">
                          {(selectedSubmission.gradingBreakdown || []).map((criterion) => (
                            <div key={criterion.questionId} className="rounded-xl border border-indigo-100 bg-white/80 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <MathSpan content={criterion.label} className="text-sm font-bold text-slate-700" />
                                <span className="shrink-0 text-sm font-black text-blue-700">
                                  {criterion.score}/{criterion.maxScore}
                                </span>
                              </div>
                              {criterion.comment && <p className="mt-1 text-xs text-slate-500">{criterion.comment}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 flex items-center justify-between pt-4 border-t border-indigo-100">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Điểm AI đề xuất:</span>
                        <span className="text-2xl font-black text-blue-700">{selectedSubmission.ai_score ?? '?'}/10</span>
                        {selectedSubmission.published_at && (
                          <span className="text-xs font-black text-emerald-700">
                            Điểm đã công bố: {selectedSubmission.score}/10
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <h5 className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-wider">
                        <MessageSquare className="w-5 h-5 text-slate-400" /> Phản hồi của giáo viên
                      </h5>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Chỉnh sửa điểm số</label>
                          <div className="flex items-center gap-4">
                            <input 
                              type="range" 
                              min="0" max="10" step="0.5"
                              value={editScore}
                              onChange={(e) => setEditScore(parseFloat(e.target.value))}
                              className="flex-1 accent-indigo-600"
                            />
                            <div className="w-16 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
                              <span className="text-xl font-black text-blue-700">{editScore}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Nhận xét thêm (tùy chọn)</label>
                          <textarea 
                            value={editFeedback}
                            onChange={(e) => setEditFeedback(e.target.value)}
                            placeholder="Nhập lời khuyên hoặc lời khen cho học sinh..."
                            className="w-full h-24 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                          />
                        </div>

                        <Button 
                          variant="primary"
                          onClick={handleGrade}
                          disabled={isGrading}
                          className="w-full py-4 rounded-2xl bg-indigo-600 shadow-indigo-100 shadow-xl"
                          icon={isGrading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        >
                          {selectedSubmission.status === 'GRADED' ? 'CẬP NHẬT ĐIỂM SỐ' : 'XÁC NHẬN CHẤM ĐIỂM'}
                        </Button>
                        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">
                           {selectedSubmission.status === 'GRADED' ? '✅ Hệ thống đã gửi kết quả.' : '⚠️ Lưu ý: Sau khi xác nhận, học sinh mới xem được điểm.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] p-20 flex flex-col items-center justify-center text-center h-full">
              <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-sm mb-6 border border-slate-100">
                <Trophy className="w-12 h-12 text-slate-300" />
              </div>
              <h3 className="text-2xl font-bold text-slate-700 mb-2">Sẵn sàng chấm điểm</h3>
              <p className="text-slate-400 max-w-sm">Chọn một học sinh từ danh sách bên trái để xem bài nộp và đánh giá của AI.</p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
