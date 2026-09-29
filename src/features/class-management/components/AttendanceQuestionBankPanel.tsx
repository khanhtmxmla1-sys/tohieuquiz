import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Braces, Check, Edit3, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  createClassAttendanceQuestion,
  deleteClassAttendanceQuestion,
  getClassAttendance,
  setClassAttendanceEnabled,
  updateClassAttendanceQuestion,
  type AttendanceQuestionInput,
  type ClassAttendanceQuestion,
  type ClassAttendanceSummary,
} from '../../../services/attendanceService';
import { showConfirm, showError, showInfo, showSuccess } from '../../../utils/toast';
import { plainTextToRichText, type QuestionRichTextEnvelopeV1 } from '../../../../shared/question-rich-text.contract';
import RichQuestionEditor from '../../quiz-editor/components/RichQuestionEditor/RichQuestionEditor';
import { TextInput } from '../../quiz-editor/components/QuestionEditorModal/editors/shared';
import CompactMediaAttachment from '../../manual-quiz-workspace/components/CompactMediaAttachment';
import MathComposerPanel from '../../manual-quiz-workspace/math-composer/MathComposerPanel';
import { MathComposerProvider } from '../../manual-quiz-workspace/math-composer/useMathComposer';

interface AttendanceQuestionBankPanelProps {
  classId: string;
  teacherUsername: string;
  isOnline: boolean;
}

interface QuestionDraft {
  subject: string;
  question: string;
  questionRichText: QuestionRichTextEnvelopeV1;
  options: string[];
  correctAnswer: string;
  image: string;
  imageAlt: string;
}

const emptyDraft = (): QuestionDraft => ({
  subject: '',
  question: '',
  questionRichText: plainTextToRichText(''),
  options: ['', '', '', ''],
  correctAnswer: '',
  image: '',
  imageAlt: '',
});

const questionToDraft = (question: ClassAttendanceQuestion): QuestionDraft => ({
  subject: question.subject || '',
  question: question.question,
  questionRichText: question.questionRichText ?? plainTextToRichText(question.question),
  options: [...question.options, '', '', '', ''].slice(0, 4),
  correctAnswer: question.correctAnswer,
  image: question.image || '',
  imageAlt: question.imageAlt || '',
});

const questionInput = (draft: QuestionDraft): AttendanceQuestionInput => ({
  subject: draft.subject.trim(),
  question: draft.question.trim(),
  questionRichText: draft.questionRichText,
  options: draft.options.map((option) => option.trim()),
  correctAnswer: draft.correctAnswer,
  image: draft.image.trim(),
  imageAlt: draft.imageAlt.trim(),
});

const validateDraft = (draft: QuestionDraft): string | null => {
  if (!draft.question.trim()) return 'Vui lòng nhập nội dung câu hỏi.';
  if (draft.options.length !== 4 || draft.options.some((option) => !option.trim())) {
    return 'Vui lòng nhập đủ 4 đáp án A, B, C, D.';
  }
  if (!/^[A-D]$/.test(draft.correctAnswer)) return 'Vui lòng chọn đáp án đúng.';
  return null;
};

const AttendanceQuestionBankPanel: React.FC<AttendanceQuestionBankPanelProps> = ({
  classId,
  teacherUsername,
  isOnline,
}) => {
  const [summary, setSummary] = useState<ClassAttendanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ClassAttendanceQuestion | null>(null);
  const [draft, setDraft] = useState<QuestionDraft>(() => emptyDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [showMathComposer, setShowMathComposer] = useState(false);

  const load = useCallback(async () => {
    if (!isOnline) return;
    setIsLoading(true);
    try {
      setSummary(await getClassAttendance(classId));
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Không thể tải điểm danh.');
    } finally {
      setIsLoading(false);
    }
  }, [classId, isOnline]);

  useEffect(() => {
    if (isOnline) void load();
    else setIsLoading(false);
  }, [isOnline, load]);

  const questionCount = summary?.questions.length ?? 0;
  const statsLabel = summary
    ? `${summary.stats.claimedToday}/${summary.stats.totalStudents}`
    : '0/0';

  const openCreate = () => {
    setEditingQuestion(null);
    setDraft(emptyDraft());
    setShowMathComposer(false);
    setIsManagerOpen(true);
  };

  const startEdit = (question: ClassAttendanceQuestion) => {
    setEditingQuestion(question);
    setDraft(questionToDraft(question));
    setShowMathComposer(false);
  };

  const cancelEdit = () => {
    setEditingQuestion(null);
    setDraft(emptyDraft());
    setShowMathComposer(false);
  };

  const toggleAttendance = async () => {
    if (!summary || !isOnline || isToggling) return;
    setIsToggling(true);
    try {
      const next = await setClassAttendanceEnabled(classId, !summary.enabled);
      setSummary(next);
      showSuccess(next.enabled ? 'Đã bật điểm danh.' : 'Đã tắt điểm danh.');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Không thể cập nhật điểm danh.');
    } finally {
      setIsToggling(false);
    }
  };

  const saveQuestion = async () => {
    if (!isOnline || isSaving) return;
    const issue = validateDraft(draft);
    if (issue) {
      showError(issue);
      return;
    }

    setIsSaving(true);
    try {
      if (editingQuestion) {
        await updateClassAttendanceQuestion(classId, editingQuestion.id, questionInput(draft));
        showSuccess('Đã cập nhật câu hỏi.');
      } else {
        await createClassAttendanceQuestion(classId, questionInput(draft));
        showSuccess('Đã thêm câu hỏi điểm danh.');
      }
      await load();
      cancelEdit();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Không thể lưu câu hỏi.');
    } finally {
      setIsSaving(false);
    }
  };

  const removeQuestion = async (question: ClassAttendanceQuestion) => {
    if (!isOnline) return;
    const confirmed = await showConfirm({
      message: 'Xóa câu hỏi điểm danh này?',
      confirmLabel: 'Xóa câu hỏi',
      cancelLabel: 'Hủy',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      const next = await deleteClassAttendanceQuestion(classId, question.id);
      setSummary(next);
      if (editingQuestion?.id === question.id) cancelEdit();
      showSuccess('Đã xóa câu hỏi.');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Không thể xóa câu hỏi.');
    }
  };

  const compactStatus = useMemo(() => {
    if (isLoading) return 'Đang tải';
    if (!summary) return 'Chưa tải';
    return summary.enabled ? 'Đang bật' : 'Đang tắt';
  }, [isLoading, summary]);

  return (
    <>
      <section className="rounded-2xl border border-sky-100 bg-white p-3 shadow-sm" aria-label="Điểm danh bằng câu hỏi">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800">Điểm danh</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                summary?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {compactStatus}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {questionCount} câu · Mỗi học sinh nhận ngẫu nhiên 2 câu
            </p>
          </div>

          <button
            type="button"
            onClick={() => summary && showInfo(
              `Hôm nay đã có ${summary.stats.claimedToday}/${summary.stats.totalStudents} học sinh điểm danh.`,
            )}
            disabled={!summary}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            aria-label="Xem thống kê điểm danh hôm nay"
          >
            <BarChart3 className="h-4 w-4" />
            {statsLabel}
          </button>

          <button
            type="button"
            onClick={() => setIsManagerOpen(true)}
            disabled={!isOnline || !summary}
            className="min-h-10 rounded-lg border border-sky-200 bg-sky-50 px-3 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
          >
            Câu hỏi
          </button>

          <button
            type="button"
            onClick={() => void toggleAttendance()}
            disabled={!isOnline || !summary || isToggling}
            aria-pressed={Boolean(summary?.enabled)}
            className={`inline-flex min-h-10 min-w-24 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-white transition disabled:opacity-50 ${
              summary?.enabled ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {summary?.enabled ? 'Tắt' : 'Bật'}
          </button>
        </div>
      </section>

      {isManagerOpen && summary ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm md:items-center md:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) setIsManagerOpen(false);
          }}
        >
          <MathComposerProvider>
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Quản lý câu hỏi điểm danh"
              className="max-h-dvh w-full overflow-y-auto bg-white p-4 shadow-2xl md:max-h-[92vh] md:max-w-5xl md:rounded-2xl md:p-6"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Câu hỏi điểm danh</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Có {questionCount} câu. Học sinh được lấy ngẫu nhiên 2 câu mỗi ngày.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Đóng quản lý câu hỏi điểm danh"
                  onClick={() => !isSaving && setIsManagerOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.5fr)]">
                <div className="min-w-0 rounded-xl border border-slate-200 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-800">Danh sách câu hỏi</h3>
                    <button
                      type="button"
                      onClick={openCreate}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700"
                    >
                      <Plus className="h-4 w-4" /> Thêm câu
                    </button>
                  </div>

                  <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                    {summary.questions.length === 0 ? (
                      <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
                        Chưa có câu hỏi. Cần ít nhất 2 câu để bật điểm danh.
                      </p>
                    ) : summary.questions.map((question, index) => (
                      <div
                        key={question.id}
                        className={`rounded-lg border p-3 ${
                          editingQuestion?.id === question.id
                            ? 'border-sky-300 bg-sky-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <p className="text-xs font-semibold text-slate-500">
                          Câu {index + 1}{question.subject ? ` · ${question.subject}` : ''}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">
                          {question.question}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(question)}
                            className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeQuestion(question)}
                            className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="min-w-0 rounded-xl border border-slate-200 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {editingQuestion ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
                      </h3>
                      <p className="text-xs text-slate-500">Trắc nghiệm 4 đáp án A, B, C, D</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMathComposer((value) => !value)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm font-semibold text-sky-700"
                      aria-expanded={showMathComposer}
                    >
                      <Braces className="h-4 w-4" /> Công thức toán
                    </button>
                  </div>

                  <MathComposerPanel
                    ownerUsername={teacherUsername}
                    open={showMathComposer}
                    onClose={() => setShowMathComposer(false)}
                  />

                  <div className="mt-4 space-y-4">
                    <label className="block text-sm font-semibold text-slate-700">
                      Môn học <span className="font-normal text-slate-400">(tùy chọn)</span>
                      <input
                        value={draft.subject}
                        onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
                        placeholder="Ví dụ: Toán"
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-sky-500"
                      />
                    </label>

                    <div>
                      <p className="mb-1 text-sm font-semibold text-slate-700">Nội dung câu hỏi</p>
                      <RichQuestionEditor
                        value={draft.questionRichText}
                        onChange={(questionRichText, question) => setDraft((current) => ({
                          ...current,
                          question,
                          questionRichText,
                        }))}
                        ariaLabel="Nội dung câu hỏi điểm danh"
                        minHeightClassName="min-h-32"
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-700">Các đáp án · bấm vòng tròn để chọn đáp án đúng</p>
                      {draft.options.map((option, index) => {
                        const label = String.fromCharCode(65 + index);
                        const checked = draft.correctAnswer === label;
                        return (
                          <div key={label} className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => setDraft((current) => ({ ...current, correctAnswer: label }))}
                              className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${
                                checked
                                  ? 'border-emerald-500 bg-emerald-500 text-white'
                                  : 'border-slate-300 bg-white text-slate-500'
                              }`}
                              aria-label={`Chọn đáp án ${label} là đáp án đúng`}
                              aria-pressed={checked}
                            >
                              {checked ? <Check className="h-4 w-4" /> : label}
                            </button>
                            <TextInput
                              value={option}
                              showMathToolbar={false}
                              showMathPreview
                              onChange={(event) => setDraft((current) => {
                                const options = [...current.options];
                                options[index] = event.target.value;
                                return { ...current, options };
                              })}
                              aria-label={`Đáp án ${label}`}
                              placeholder={`Đáp án ${label}`}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <CompactMediaAttachment
                      label="câu hỏi điểm danh"
                      value={draft.image}
                      altText={draft.imageAlt}
                      onChange={(image) => setDraft((current) => ({ ...current, image }))}
                      onAltTextChange={(imageAlt) => setDraft((current) => ({ ...current, imageAlt }))}
                    />

                    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                      {editingQuestion ? (
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isSaving}
                          className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600"
                        >
                          Hủy sửa
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void saveQuestion()}
                        disabled={!isOnline || isSaving}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {editingQuestion ? 'Lưu thay đổi' : 'Thêm câu hỏi'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </MathComposerProvider>
        </div>
      ) : null}
    </>
  );
};

export default AttendanceQuestionBankPanel;
