import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ClipboardCheck, X } from 'lucide-react';
import type { Quiz } from '../../types';
import { useAuthStore } from '../../../stores/authStore';
import { useAssignmentStore } from '../../stores/useAssignmentStore';
import { useClassStore } from '../../stores/useClassStore';
import { CreateAssignmentSection } from './assignment-tab/CreateAssignmentSection';

interface AssignmentDrawerProps {
  quiz: Quiz;
  onClose: () => void;
  onViewAssignments: () => void;
}

export const AssignmentDrawer = ({ quiz, onClose, onViewAssignments }: AssignmentDrawerProps) => {
  const authStore = useAuthStore();
  const classes = useClassStore(state => state.classes);
  const fetchClasses = useClassStore(state => state.fetchClasses);
  const classLoading = useClassStore(state => state.isLoading);
  const assignmentError = useAssignmentStore(state => state.error);
  const assignmentLoading = useAssignmentStore(state => state.isLoading);
  const addAssignment = useAssignmentStore(state => state.addAssignment);
  const clearAssignmentError = useAssignmentStore(state => state.clearError);
  const [created, setCreated] = useState(false);
  const [composerKey, setComposerKey] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    clearAssignmentError();
    if (authStore.isAdmin) void fetchClasses();
    else if (authStore.username) void fetchClasses(authStore.username);

    const previousFocus = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocus?.focus();
    };
  }, [authStore.isAdmin, authStore.username, clearAssignmentError, fetchClasses, onClose]);

  const createAssignment = async (payload: Parameters<typeof addAssignment>[0]) => (
    Boolean(await addAssignment(payload))
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[2px]"
      onMouseDown={event => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Giao bài"
        className="flex h-full w-full max-w-[520px] flex-col bg-white shadow-2xl"
      >
        <header className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-sky-600">Giao bài</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 line-clamp-2">{quiz.title}</h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Đóng giao bài"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <ol className="mt-5 grid grid-cols-3 gap-2 text-xs font-medium text-slate-500" aria-label="Các bước giao bài">
            {['Đề bài', 'Đối tượng', 'Lịch & xác nhận'].map((step, index) => (
              <li key={step} className="flex items-center gap-2">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${index < 2 ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {index + 1}
                </span>
                <span className="hidden sm:inline">{step}</span>
              </li>
            ))}
          </ol>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {created ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <h3 className="mt-4 text-xl font-bold text-slate-900">Đã giao bài thành công</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Bài giao đã được lưu theo đúng lớp, học sinh, hạn nộp và số lượt đã chọn.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={onViewAssignments}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-sky-600 px-4 font-semibold text-white hover:bg-sky-700"
                >
                  <ClipboardCheck className="h-4 w-4" /> Xem bài đã giao
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreated(false);
                    setComposerKey(key => key + 1);
                  }}
                  className="h-11 rounded-lg border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Giao thêm lớp
                </button>
              </div>
            </div>
          ) : (
            <>
              {assignmentError && (
                <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {assignmentError}
                </div>
              )}
              <CreateAssignmentSection
                key={composerKey}
                classes={classes}
                quizzes={[quiz]}
                draft={null}
                onClearDraft={() => undefined}
                onCreateAssignment={createAssignment}
                isLoading={classLoading || assignmentLoading}
                initialQuizId={quiz.id}
                variant="drawer"
                onCreated={() => setCreated(true)}
              />
            </>
          )}
        </div>
      </aside>
    </div>
  );
};
