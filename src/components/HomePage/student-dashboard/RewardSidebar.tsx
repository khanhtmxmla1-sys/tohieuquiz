import type { RewardSidebarProps } from './dashboard.types';

export function RewardSidebar({
  dashboard,
  giftShopEnabled,
  isProcessing,
  onOpenChest,
  onOpenGiftShop,
  onOpenBadges,
}: RewardSidebarProps) {
  const chestClaimed = Boolean(dashboard?.bonusChest.claimed);
  const chestAvailable = Boolean(dashboard?.bonusChest.available) && !chestClaimed;
  const chestLabel = chestClaimed
    ? 'Đã mở rương'
    : isProcessing
      ? 'Đang mở...'
      : chestAvailable
        ? 'Mở rương thưởng'
        : 'Chưa mở khóa';
  const chestDisabled = chestClaimed || isProcessing || !chestAvailable;

  const completedDays = Math.max(0, dashboard?.weekly.completedDays || 0);
  const targetDays = Math.max(1, dashboard?.weekly.targetDays || 5);
  const rhythmPercent = Math.min(100, Math.round((completedDays / targetDays) * 100));
  const achievements = dashboard?.achievements || [];
  const collection = dashboard?.profile.collection || [];

  return (
    <aside aria-label="Phần thưởng và thành tích" className="overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white">
      <section className="border-b border-slate-100 p-5">
        <h2 className="text-lg font-semibold text-[#172033]">Nhịp học tuần này</h2>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-[#526174]">Số ngày đã duy trì</span>
          <span className="font-semibold text-slate-800">{completedDays}/{targetDays} ngày</span>
        </div>
        <div
          role="progressbar"
          aria-label="Nhịp học tuần này"
          aria-valuemin={0}
          aria-valuemax={targetDays}
          aria-valuenow={Math.min(completedDays, targetDays)}
          className="mt-3 h-2 overflow-hidden rounded bg-slate-200"
        >
          <div
            className="h-full origin-left rounded bg-emerald-500 transition-transform duration-300 motion-reduce:transition-none"
            style={{ transform: `scaleX(${rhythmPercent / 100})` }}
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-[#526174]">
          Duy trì nhịp học đều để hình thành thói quen tốt hơn.
        </p>
        {giftShopEnabled ? (
          <button
            type="button"
            onClick={onOpenGiftShop}
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-sky-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Xem mục tiêu quà tặng
          </button>
        ) : null}
      </section>

      <section className="border-b border-slate-100 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#172033]">Rương thưởng ngày</h2>
            <p className="mt-1 text-sm leading-6 text-[#526174]">
              Mở khi hoàn thành đủ các nhiệm vụ trong ngày.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenChest}
            disabled={chestDisabled}
            className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-[10px] px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
              chestAvailable && !isProcessing
                ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : chestClaimed
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            {chestLabel}
          </button>
        </div>
      </section>

      <section className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#172033]">Huy hiệu và bộ sưu tập</h2>
            <p className="mt-1 text-sm text-[#526174]">
              {achievements.length} huy hiệu · {collection.length} vật phẩm
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenBadges}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-[10px] px-3 text-sm font-semibold text-sky-700 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Xem tất cả
          </button>
        </div>

        <div className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
          {achievements.slice(0, 3).map((achievement) => (
            <article key={achievement.code} className="py-3">
              <h3 className="text-sm font-semibold text-slate-800">{achievement.title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">{achievement.description}</p>
            </article>
          ))}
          {achievements.length === 0 ? (
            <p className="py-4 text-sm leading-6 text-slate-500">
              Hoàn thành bài đầu tiên để mở huy hiệu đầu tiên nhé.
            </p>
          ) : null}
        </div>

        <div className="mt-4 divide-y divide-slate-100 border-y border-slate-100 text-sm">
          <div className="flex items-center justify-between py-3">
            <p className="text-slate-500">Vé gợi ý</p>
            <p className="font-semibold text-slate-800">{dashboard?.profile.hintTokens || 0}</p>
          </div>
          <div className="flex items-center justify-between py-3">
            <p className="text-slate-500">Khiên chuỗi</p>
            <p className="font-semibold text-slate-800">{dashboard?.profile.streakShields || 0}</p>
          </div>
        </div>
      </section>
    </aside>
  );
}
