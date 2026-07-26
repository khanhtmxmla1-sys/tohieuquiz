import { DashboardEmptyState, DashboardSectionError } from './DashboardStates';
import type { WeeklyQuestsPanelProps } from './dashboard.types';
import { getWeeklyProgressPercent } from './dashboard.utils';

export function WeeklyQuestsPanel({
  quests,
  isLoading,
  errorMessage,
  claimingQuestId,
  onRetry,
  onClaim,
}: WeeklyQuestsPanelProps) {
  return (
    <section
      aria-labelledby="weekly-quests-title"
      className="rounded-[14px] border border-[#E5E7EB] bg-white p-5 md:p-6"
    >
      <div className="mb-5">
        <h2 id="weekly-quests-title" className="text-xl font-semibold text-[#172033]">
          Nhiệm vụ tuần
        </h2>
        <p className="mt-1 text-sm text-[#526174]">Làm mới vào thứ Hai hằng tuần.</p>
      </div>

      {isLoading ? (
        <div aria-busy="true" aria-label="Đang tải nhiệm vụ tuần" className="divide-y divide-slate-100">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="animate-pulse py-4 first:pt-0 last:pb-0" aria-hidden="true">
              <div className="mb-3 h-4 w-1/2 rounded bg-slate-200" />
              <div className="mb-4 h-3 w-4/5 rounded bg-slate-100" />
              <div className="h-2 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && errorMessage ? (
        <DashboardSectionError message={errorMessage} onRetry={onRetry} />
      ) : null}

      {!isLoading && !errorMessage && quests.length === 0 ? (
        <DashboardEmptyState
          title="Nhiệm vụ mới sẽ sớm xuất hiện."
          description="Em hãy quay lại sau để khám phá thử thách mới."
        />
      ) : null}

      {!isLoading && !errorMessage && quests.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {quests.map((quest) => {
            const percent = getWeeklyProgressPercent(quest.progress, quest.target);
            const isClaiming = claimingQuestId === quest.id;
            const disabled = !quest.completed || quest.claimed || isClaiming;
            const label = isClaiming
              ? 'Đang nhận...'
              : quest.claimed
                ? 'Đã nhận'
                : quest.completed
                  ? 'Nhận ngay'
                  : 'Chưa xong';

            return (
              <article key={quest.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#172033]">{quest.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#526174]">{quest.description}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-slate-500">
                      {quest.progress}/{quest.target}
                    </span>
                  </div>

                  <div
                    role="progressbar"
                    aria-label={`Tiến độ nhiệm vụ tuần ${quest.title}`}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(0, quest.target)}
                    aria-valuenow={Math.min(Math.max(0, quest.progress), Math.max(0, quest.target))}
                    className="h-2 overflow-hidden rounded bg-slate-200"
                  >
                    <div
                      data-testid={`weekly-quest-progress-fill-${quest.id}`}
                      className={`h-full origin-left rounded transition-transform duration-300 motion-reduce:transition-none ${
                        quest.claimed ? 'bg-emerald-500' : 'bg-sky-500'
                      }`}
                      style={{ transform: `scaleX(${percent / 100})` }}
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-medium text-slate-500">
                      Thưởng {quest.reward.coins} xu
                      {quest.reward.exp > 0 ? ` · ${quest.reward.exp} EXP` : ''}
                      {quest.reward.items.length > 0 ? ` · ${quest.reward.itemCount} vật phẩm` : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => onClaim(quest.id)}
                      disabled={disabled}
                      className={`inline-flex min-h-10 items-center justify-center rounded-[10px] px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                        quest.claimed
                          ? 'bg-emerald-50 text-emerald-700'
                          : quest.completed
                            ? 'bg-sky-500 text-white hover:bg-sky-600'
                            : 'cursor-not-allowed bg-slate-100 text-slate-500'
                      }`}
                    >
                      {label}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
