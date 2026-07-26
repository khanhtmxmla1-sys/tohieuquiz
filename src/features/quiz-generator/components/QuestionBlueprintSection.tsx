import React from 'react';
import { Sparkles } from 'lucide-react';
import { QuestionType } from '../../../types';
import {
  buildBalancedTypeAllocations,
  validateQuizBlueprint,
  type QuestionTypeAllocation,
  type QuizBlueprint,
  type QuizBlueprintV3,
  type QuizIntent,
} from '../domain/quizBlueprint';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  [QuestionType.MCQ]: 'Trắc nghiệm',
  [QuestionType.TRUE_FALSE]: 'Đúng / Sai',
  [QuestionType.SHORT_ANSWER]: 'Điền đáp án',
  [QuestionType.MATCHING]: 'Nối cột',
  [QuestionType.MULTIPLE_SELECT]: 'Chọn nhiều',
  [QuestionType.DRAG_DROP]: 'Kéo thả',
  [QuestionType.ORDERING]: 'Sắp xếp thứ tự',
  [QuestionType.IMAGE_QUESTION]: 'Câu hỏi hình',
  [QuestionType.DROPDOWN]: 'Dropdown',
  [QuestionType.UNDERLINE]: 'Gạch chân',
  [QuestionType.CATEGORIZATION]: 'Phân loại',
  [QuestionType.WORD_SCRAMBLE]: 'Ghép chữ',
  [QuestionType.RIDDLE]: 'Câu đố',
  [QuestionType.ERROR_CORRECTION]: 'Sửa lỗi',
  [QuestionType.GEOMETRY]: 'Hình học',
};

interface QuestionBlueprintSectionProps {
  blueprint: QuizBlueprint;
  blueprintV3?: QuizBlueprintV3 | null;
  onChange: (blueprint: QuizBlueprint) => void;
}

const clampCount = (value: number): number => Math.max(0, Math.min(40, Math.trunc(value || 0)));

const QuestionBlueprintSection: React.FC<QuestionBlueprintSectionProps> = ({
  blueprint,
  blueprintV3,
  onChange,
}) => {
  const typeTotal = blueprint.typeAllocations.reduce((sum, allocation) => sum + allocation.count, 0);
  const errors = validateQuizBlueprint(blueprint);
  const typeError = errors.find((error) => error.startsWith('Tổng số câu theo dạng'));
  const slotTypeCount = blueprintV3
    ? new Set(blueprintV3.slots.map((slot) => slot.type)).size
    : 0;
  const slotDifficultyCounts = blueprintV3 ? {
    level1: blueprintV3.slots.filter((slot) => slot.difficulty === 1).length,
    level2: blueprintV3.slots.filter((slot) => slot.difficulty === 2).length,
    level3: blueprintV3.slots.filter((slot) => slot.difficulty === 3).length,
  } : null;

  const setIntent = (intent: QuizIntent) => {
    onChange({ ...blueprint, intent });
  };

  const updateAllocation = (type: QuestionType, count: number) => {
    const nextAllocations: QuestionTypeAllocation[] = blueprint.typeAllocations.map((allocation) => (
      allocation.type === type ? { ...allocation, count: clampCount(count) } : allocation
    ));
    onChange({ ...blueprint, typeAllocations: nextAllocations });
  };

  const autoBalance = () => {
    onChange({
      ...blueprint,
      typeAllocations: buildBalancedTypeAllocations(
        blueprint.typeAllocations.map(({ type }) => type),
        blueprint.totalQuestions,
      ),
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <div>
        <p className="mb-2 text-sm font-bold text-indigo-900">Mục đích tạo đề</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {([
            ['EXAM', 'Đề thi', 'Ngắn gọn, không gợi ý, bám ma trận'],
            ['PRACTICE', 'Ôn tập', 'Có lời giải và phản hồi hỗ trợ học tập'],
          ] as const).map(([intent, title, description]) => {
            const active = blueprint.intent === intent;
            return (
              <button
                key={intent}
                type="button"
                aria-label={title}
                aria-pressed={active}
                onClick={() => setIntent(intent)}
                className={`rounded-xl border-2 p-3 text-left transition-colors ${
                  active
                    ? 'border-indigo-500 bg-white text-indigo-900'
                    : 'border-transparent bg-indigo-100/70 text-gray-700 hover:border-indigo-300'
                }`}
              >
                <span className="block font-bold">{title}</span>
                <span className="mt-1 block text-xs">{description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-indigo-900">Số câu theo từng dạng</p>
          <p className="text-xs text-indigo-700">Tổng mục tiêu: {blueprint.totalQuestions} câu</p>
        </div>
        <button
          type="button"
          onClick={autoBalance}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
        >
          <Sparkles className="h-4 w-4" />
          AI tự cân đối
        </button>
      </div>

      <div className="space-y-2">
        {blueprint.typeAllocations.map(({ type, count }) => {
          const label = QUESTION_TYPE_LABELS[type] ?? type;
          return (
            <div
              key={type}
              className="flex flex-col gap-2 rounded-lg border border-indigo-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-medium text-gray-800">{label}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Giảm số câu ${label}`}
                  onClick={() => updateAllocation(type, count - 1)}
                  className="h-9 w-9 rounded-lg border border-gray-300 text-lg font-bold text-gray-700 hover:bg-gray-100"
                >
                  −
                </button>
                <input
                  aria-label={`Số câu ${label}`}
                  type="number"
                  min={0}
                  max={40}
                  value={count}
                  onChange={(event) => updateAllocation(type, Number(event.target.value))}
                  className="h-9 w-20 rounded-lg border border-gray-300 text-center font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  aria-label={`Tăng số câu ${label}`}
                  onClick={() => updateAllocation(type, count + 1)}
                  className="h-9 w-9 rounded-lg border border-gray-300 text-lg font-bold text-gray-700 hover:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {blueprintV3 && slotDifficultyCounts && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3" aria-label="Tóm tắt Blueprint V3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-bold text-emerald-800">{blueprintV3.slots.length} slot đã sẵn sàng</span>
            <span className="font-medium text-emerald-700">{slotTypeCount} dạng câu</span>
          </div>
          <p className="mt-1 text-xs text-emerald-700">
            Mức 1: {slotDifficultyCounts.level1} · Mức 2: {slotDifficultyCounts.level2} · Mức 3: {slotDifficultyCounts.level3}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <span className={`text-sm font-bold ${typeTotal === blueprint.totalQuestions ? 'text-emerald-700' : 'text-red-700'}`}>
          Tổng: {typeTotal} câu
        </span>
        {typeError && <span role="alert" className="text-sm font-medium text-red-700">{typeError}</span>}
      </div>
    </div>
  );
};

export default QuestionBlueprintSection;
