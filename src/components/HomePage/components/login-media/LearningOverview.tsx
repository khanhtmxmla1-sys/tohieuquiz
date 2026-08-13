import React from 'react';
import { Check, Clock3, FileQuestion, TrendingUp } from 'lucide-react';

const LearningOverview: React.FC = () => (
  <div
    data-purpose="learning-preview"
    className="login-page-reveal login-page-reveal-delay-2 relative mt-6 hidden max-w-[630px] lg:block"
    aria-hidden="true"
  >
    <div className="rounded-[24px] border border-[#dce5f1] bg-white/55 p-1 shadow-[0_22px_54px_-44px_rgba(30,58,138,0.42)]">
      <div className="overflow-hidden rounded-[20px] bg-white">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" />
            <span className="text-xs font-bold uppercase tracking-[0.13em] text-[#64748b]">Tổng quan học tập</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-[#f8fafc] px-2.5 py-1.5 text-xs font-semibold text-[#64748b]">
            <Clock3 size={14} /> Tuần này
          </div>
        </div>

        <div className="grid grid-cols-[1.25fr_0.75fr] gap-3 p-4">
          <div className="rounded-[16px] bg-[#f8fafc] p-3.5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-[#64748b]">Tiến độ lớp học</p>
                <p className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#0f172a]">Ổn định và tích cực</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#dbeafe] text-[#2563eb]">
                <TrendingUp size={18} />
              </span>
            </div>
            <div className="flex h-20 items-end gap-2.5 border-b border-[#dbe4f0] pb-1">
              {['h-[38%]', 'h-[55%]', 'h-[47%]', 'h-[72%]', 'h-[62%]', 'h-[84%]'].map((height, index) => (
                <span
                  key={`${height}-${index}`}
                  className={`flex-1 rounded-t-[7px] ${height} ${index === 5 ? 'bg-[#2563eb]' : 'bg-[#bfdbfe]'}`}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-2.5">
            <div className="rounded-[16px] border border-[#dbe4f0] bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#fef3c7] text-[#a16207]">
                  <FileQuestion size={18} />
                </span>
                <span className="rounded-md bg-[#eff6ff] px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-[#2563eb]">Sắp tới</span>
              </div>
              <p className="mt-3 text-sm font-bold text-[#1e293b]">Bài kiểm tra Toán</p>
              <p className="mt-1 text-xs text-[#64748b]">Sẵn sàng cho lớp học</p>
            </div>

            <div className="rounded-[16px] bg-[#1e3a8a] p-3 text-white">
              <div className="flex items-center gap-2 text-sm font-bold">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white/10">
                  <Check size={17} />
                </span>
                Kết quả đã tổng hợp
              </div>
              <p className="mt-2 text-xs leading-5 text-blue-100">Sẵn sàng xem ngay sau mỗi bài làm.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default LearningOverview;
