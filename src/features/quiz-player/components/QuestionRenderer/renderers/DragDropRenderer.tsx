import React from 'react';
import { BaseRendererProps } from '../types';
import SmartText from '../utils/SmartText';
import { selectedAnswerClass } from '../../answer-state/stateStyles';

const DragDropRenderer: React.FC<BaseRendererProps> = ({
  question,
  answers,
  onAnswerChange,
}) => {
  const categories = (question as any).categories || [];
  const items = (question as any).items || [];
  const currentAssignments = (answers[question.id] as Record<string, string>) || {};
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null);

  const assignedCount = items.filter((item: any) => Boolean(currentAssignments[item.id])).length;

  const handleAssign = (itemId: string, categoryId: string) => {
    const newAssignments = {
      ...currentAssignments,
      [itemId]: categoryId,
    };

    onAnswerChange(question.id, newAssignments);
    setEditingItemId(null);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[10px] border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Phân loại các mục</h3>
          <span className="text-xs font-medium text-slate-500" aria-live="polite">
            Đã làm {assignedCount}/{items.length}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2" aria-label="Các nhóm phân loại">
          {categories.map((category: any) => (
            <span
              key={category.id}
              className="max-w-full rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium leading-5 text-sky-800"
            >
              <SmartText content={category.name} />
            </span>
          ))}
        </div>
      </section>

      <div className="space-y-3">
        {items.map((item: any) => {
          const assignedCategoryId = currentAssignments[item.id];
          const assignedCategory = categories.find((category: any) => category.id === assignedCategoryId);
          const isEditing = !assignedCategory || editingItemId === item.id;
          const itemLabel = String(item.content ?? '');

          return (
            <article
              key={item.id}
              className="rounded-[10px] border border-slate-200 bg-white p-4"
            >
              <div className="min-w-0 text-sm font-medium leading-6 text-slate-800">
                <SmartText content={item.content} />
              </div>

              {isEditing ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((category: any) => {
                    const categoryLabel = String(category.name ?? '');

                    return (
                      <button
                        key={category.id}
                        type="button"
                        aria-label={`Chọn nhóm ${categoryLabel} cho ${itemLabel}`}
                        aria-pressed={assignedCategoryId === category.id}
                        onClick={() => handleAssign(item.id, category.id)}
                        className="min-h-11 max-w-full rounded-[8px] border border-sky-200 bg-sky-50 px-3 py-2 text-left text-xs font-semibold leading-5 text-sky-700 transition-colors hover:border-sky-500 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <SmartText content={category.name} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span
                    aria-label={`Đã chọn nhóm ${String(assignedCategory.name ?? '')}`}
                    className={`inline-flex min-h-9 max-w-full items-center rounded-[8px] border px-3 py-1.5 text-xs font-semibold leading-5 ${selectedAnswerClass}`}
                  >
                    <span aria-hidden="true" className="mr-1">✓</span>
                    <SmartText content={assignedCategory.name} />
                  </span>
                  <button
                    type="button"
                    aria-label={`Đổi nhóm cho ${itemLabel}`}
                    onClick={() => setEditingItemId(item.id)}
                    className="min-h-11 rounded-[8px] px-3 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    Đổi
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {items.length > 0 && assignedCount === items.length ? (
        <p className="text-center text-sm font-medium text-sky-700" role="status">
          Đã phân loại xong tất cả.
        </p>
      ) : null}
    </div>
  );
};

export default React.memo(DragDropRenderer);
