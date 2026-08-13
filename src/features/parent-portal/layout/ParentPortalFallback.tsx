import React from 'react';
import SchoolLogo from '../../../components/common/SchoolLogo';

export const ParentPortalFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 font-vietnam" role="status">
    <div className="w-full max-w-sm rounded-[24px] border border-[#e2e8f0] bg-white px-8 py-7 text-center shadow-[0_24px_60px_-44px_rgba(30,58,138,0.75)]">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[15px] border border-[#dbe4f0] bg-white">
        <SchoolLogo size={36} decorative />
      </span>
      <p className="mt-4 font-bold text-[#1e3a8a]">TôHiệuQuiz · Cổng phụ huynh</p>
      <p className="mt-2 text-sm text-[#64748b]">Đang tải thông tin học tập…</p>
      <div className="mx-auto mt-5 h-1.5 w-28 overflow-hidden rounded-full bg-[#dbeafe]">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-[#2563eb] motion-reduce:animate-none" />
      </div>
    </div>
  </div>
);
