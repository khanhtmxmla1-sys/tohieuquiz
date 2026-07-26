import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, Sparkles } from 'lucide-react';
import { practiceService } from '../../../services/practiceService';
import { usePracticeTopics } from '../../../features/student-dashboard/hooks/usePracticeTopics';
import {
  getTopicsForSubject,
  isPracticeSubjectId,
  SUBJECT_CONFIG,
} from '../../../features/student-dashboard/model';
import type { PracticeSubjectId } from '../../HomePage/student-dashboard/dashboard.types';
import { useQuizStore } from '../../../../stores/quizStore';
import {
  InvalidPracticeSubject,
  PracticeLibraryError,
  PracticeSubjectEmptyState,
  PracticeTopicSkeletons,
} from './PracticeLibraryStates';
import { PracticeSubjectHeader } from './PracticeSubjectHeader';
import { PracticeTopicGrid } from './PracticeTopicGrid';

interface SubjectLibraryProps {
  subjectId: string;
  isValidSubject: boolean;
  onBack: () => void;
}

interface ValidSubjectLibraryProps {
  subjectId: PracticeSubjectId;
  onBack: () => void;
}

const ValidSubjectLibrary = ({ subjectId, onBack }: ValidSubjectLibraryProps) => {
  const subject = SUBJECT_CONFIG[subjectId];
  const quizStore = useQuizStore();
  const topicState = usePracticeTopics();
  const [searchQuery, setSearchQuery] = useState('');
  const [startingTopic, setStartingTopic] = useState<string | null>(null);

  const topics = useMemo(
    () => getTopicsForSubject(topicState.topics, subjectId),
    [subjectId, topicState.topics],
  );
  const questionCount = useMemo(
    () => topics.reduce((sum, topic) => sum + topic.count, 0),
    [topics],
  );

  const handleStartPractice = async (topic: string) => {
    if (startingTopic) return;
    setStartingTopic(topic);

    try {
      const virtualQuiz = await practiceService.getPracticeQuiz(topic, 10);
      if (!virtualQuiz) {
        toast.error('Không thể tải bài luyện tập. Vui lòng thử lại.');
        return;
      }

      quizStore.selectQuiz(virtualQuiz);
      quizStore.setView('student');
    } catch {
      toast.error('Không thể tải bài luyện tập. Vui lòng thử lại.');
    } finally {
      setStartingTopic(null);
    }
  };

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#F4F7FC] font-sans text-slate-800">
      <PracticeSubjectHeader
        subject={subject}
        topicCount={topics.length}
        questionCount={questionCount}
        onBack={onBack}
      />

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-7 px-4 py-7 md:px-8 md:py-10">
        <section
          aria-labelledby="practice-topic-section-title"
          className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-teal-700">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm font-black uppercase tracking-wide">Luyện theo chuyên đề</span>
            </div>
            <h2
              id="practice-topic-section-title"
              className="mt-2 text-2xl font-black text-slate-900 md:text-3xl"
            >
              Chọn nội dung em muốn luyện
            </h2>
            <p className="mt-2 text-base font-medium leading-7 text-slate-600">
              Mỗi lượt gồm tối đa 10 câu được chọn từ chuyên đề em mở.
            </p>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <label htmlFor="practice-topic-search" className="sr-only">
              Tìm chuyên đề
            </label>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="practice-topic-search"
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Tìm chuyên đề, ví dụ: phép nhân"
              className="min-h-11 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-base text-slate-800 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>
        </section>

        {topicState.isLoading ? <PracticeTopicSkeletons /> : null}

        {!topicState.isLoading && topicState.errorMessage ? (
          <PracticeLibraryError onRetry={() => void topicState.retry()} />
        ) : null}

        {!topicState.isLoading && !topicState.errorMessage && topics.length === 0 ? (
          <PracticeSubjectEmptyState />
        ) : null}

        {!topicState.isLoading && !topicState.errorMessage && topics.length > 0 ? (
          <PracticeTopicGrid
            topics={topics}
            searchQuery={searchQuery}
            startingTopic={startingTopic}
            onStartTopic={topic => void handleStartPractice(topic)}
          />
        ) : null}
      </main>
    </div>
  );
};

const SubjectLibrary: React.FC<SubjectLibraryProps> = ({
  subjectId,
  isValidSubject,
  onBack,
}) => {
  if (!isValidSubject || !isPracticeSubjectId(subjectId)) {
    return <InvalidPracticeSubject onBack={onBack} />;
  }

  return <ValidSubjectLibrary subjectId={subjectId} onBack={onBack} />;
};

export default SubjectLibrary;
