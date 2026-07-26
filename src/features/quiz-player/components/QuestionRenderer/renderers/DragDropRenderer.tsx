import React from 'react';
import { BaseRendererProps } from '../types';
import SmartText from '../utils/SmartText';

const DragDropRenderer: React.FC<BaseRendererProps> = ({
  question: question,
  answers,
  onAnswerChange,
}) => {
  const categories = (question as any).categories || [];
  const items = (question as any).items || [];
  const currentAssignments = (answers[question.id] as Record<string, string>) || {};

  const getItemsInCategory = (categoryId: string) => (
    items.filter((item: any) => currentAssignments[item.id] === categoryId)
  );
  const unassignedItems = items.filter((item: any) => !currentAssignments[item.id]);

  const handleAssign = (itemId: string, categoryId: string | null) => {
    const newAssignments = { ...currentAssignments };
    if (categoryId === null) {
      delete newAssignments[itemId];
    } else {
      newAssignments[itemId] = categoryId;
    }
    onAnswerChange(question.id, newAssignments);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {categories.map((category: any) => {
          const assignedItems = getItemsInCategory(category.id);
          return (
            <section
              key={category.id}
              className="flex min-h-[180px] flex-col rounded-[10px] border border-dashed border-sky-300 bg-sky-50/40 p-4"
            >
              <h3 className="border-b border-sky-100 pb-3 text-center text-base font-semibold text-sky-800">
                <SmartText content={category.name} />
              </h3>

              <div className="flex flex-1 flex-wrap content-start gap-2 pt-4">
                {assignedItems.map((item: any) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAssign(item.id, null)}
                    className="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-[#E76F51] hover:text-[#B94D36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <SmartText content={item.content} />
                  </button>
                ))}
                {assignedItems.length === 0 ? (
                  <div className="flex w-full flex-1 items-center justify-center py-8 text-sm text-slate-400">
                    Chưa có mục nào
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <section className="rounded-[10px] border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-700">
            Danh sách chưa phân loại ({unassignedItems.length})
          </h3>
          {unassignedItems.length > 0 ? (
            <span className="text-xs text-slate-500">Chọn nhóm cho từng mục</span>
          ) : null}
        </div>

        <div className="space-y-3">
          {unassignedItems.map((item: any) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-[10px] border border-slate-200 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1 text-sm font-medium text-slate-800">
                <SmartText content={item.content} />
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((category: any) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleAssign(item.id, category.id)}
                    className="min-h-9 rounded-[8px] border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-700 transition-colors hover:border-sky-500 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <SmartText content={category.name} />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {unassignedItems.length === 0 ? (
            <p className="py-4 text-center text-sm font-medium text-emerald-700">
              Đã phân loại xong tất cả.
            </p>
          ) : null}
        </div>
      </section>

      <p className="text-center text-xs leading-5 text-slate-500">
        Nhấn vào mục đã phân loại để đưa mục đó trở lại danh sách.
      </p>
    </div>
  );
};

export default React.memo(DragDropRenderer);
