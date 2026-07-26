import { DashboardSectionError, ProgressSkeleton } from './DashboardStates';
import type { LearningProgressPanelProps } from './dashboard.types';
import { getMissionProgressPercent } from './dashboard.utils';

export function LearningProgressPanel({
  dashboard,
  isLoading,
  errorMessage,
  expanded,
  claimingMissionId,
  onToggle,
  onRetry,
  onClaimMission,
}: LearningProgressPanelProps) {
  const completedMissions = dashboard?.missions.filter((mission) => mission.completed).length || 0;
  const totalMissions = dashboard?.missions.length || 0;

  return (
    <section
      data-testid="learning-progress-panel"
      aria-labelledby="learning-progress-title"
      className="rounded-[14px] border border-[#E5E7EB] bg-white p-5"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls="learning-progress-details"
        className="flex min-h-11 w-full items-start justify-between gap-4 rounded-[10px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      >
        <span>
          <span id="learning-progress-title" className="block text-lg font-semibold text-[#172033]">
            Tiến độ học tập
          </span>
          <span className="mt-1 block text-sm leading-6 text-[#526174]">
            {dashboard ? `${completedMissions}/${totalMissions} nhiệm vụ đã hoàn thành` : 'Đang tải tiến độ'}
          </span>
        </span>
        <span className="shrink-0 pt-1 text-sm font-medium text-sky-700">
          {expanded ? 'Thu gọn' : 'Xem chi tiết'}
        </span>
      </button>

      <div className="mt-4 grid grid-cols-2 gap-4 border-y border-slate-100 py-4 text-sm">
        <div>
          <p className="text-slate-500">Nhiệm vụ hôm nay</p>
          <p className="mt-1 font-semibold text-slate-800">
            {dashboard ? `${completedMissions}/${totalMissions}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Chuỗi học tập</p>
          <p className="mt-1 font-semibold text-slate-800">
            {dashboard?.profile.dailyStreak || 0} ngày
          </p>
        </div>
      </div>

      {expanded ? (
        <div id="learning-progress-details" className="mt-5">
          {isLoading && !dashboard ? <ProgressSkeleton /> : null}
          {!isLoading && errorMessage ? (
            <DashboardSectionError message={errorMessage} onRetry={onRetry} />
          ) : null}
          {!isLoading && !errorMessage && dashboard ? (
            <div className="divide-y divide-slate-100">
              {dashboard.missions.map((mission) => {
                const percent = getMissionProgressPercent(mission);
                const isClaiming = claimingMissionId === mission.id;
                const claimDisabled = !mission.completed || mission.claimed || isClaiming;
                const claimLabel = isClaiming
                  ? 'Đang nhận...'
                  : mission.claimed
                    ? 'Đã nhận'
                    : mission.completed
                      ? 'Nhận thưởng'
                      : 'Chưa đủ';

                return (
                  <article key={mission.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[#172033]">{mission.title}</h3>
                          <p className="mt-1 text-sm leading-6 text-[#526174]">{mission.description}</p>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-slate-500">
                          {mission.progress}/{mission.target} {mission.unit}
                        </span>
                      </div>

                      <div
                        role="progressbar"
                        aria-label={`Tiến độ ${mission.title}`}
                        aria-valuemin={0}
                        aria-valuemax={Math.max(0, mission.target)}
                        aria-valuenow={Math.min(Math.max(0, mission.progress), Math.max(0, mission.target))}
                        className="h-2 overflow-hidden rounded bg-slate-200"
                      >
                        <div
                          className="h-full origin-left rounded bg-sky-500 transition-transform duration-300 motion-reduce:transition-none"
                          style={{ transform: `scaleX(${percent / 100})` }}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-slate-500">Thưởng {mission.rewardCoins} xu</span>
                        <button
                          type="button"
                          onClick={() => onClaimMission(mission.id)}
                          disabled={claimDisabled}
                          className={`inline-flex min-h-10 items-center justify-center rounded-[10px] px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                            mission.claimed
                              ? 'bg-emerald-50 text-emerald-700'
                              : mission.completed
                                ? 'bg-sky-500 text-white hover:bg-sky-600'
                                : 'cursor-not-allowed bg-slate-100 text-slate-500'
                          }`}
                        >
                          {claimLabel}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
