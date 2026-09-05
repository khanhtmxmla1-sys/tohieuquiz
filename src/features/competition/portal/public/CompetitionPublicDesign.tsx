import type { ReactNode } from 'react';
import {
  Award,
  BookOpenCheck,
  CalendarDays,
  Clock3,
  FileText,
  GraduationCap,
  HelpCircle,
  LockKeyhole,
  Megaphone,
  Medal,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type {
  CompetitionPublicState,
  CompetitionRoundPresentationState,
  PublicCompetitionArticleDto,
} from '../../../../../shared/competition-portal.contract';

export const publicStatePresentation: Record<CompetitionPublicState, {
  label: string;
  className: string;
}> = {
  ONGOING: {
    label: 'Đang diễn ra',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  UPCOMING: {
    label: 'Sắp diễn ra',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  ENDED: {
    label: 'Đã kết thúc',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
  },
};

export const articleTypePresentation: Record<PublicCompetitionArticleDto['type'], {
  label: string;
  sectionId: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
}> = {
  SCHEDULE: {
    label: 'Lịch thi',
    sectionId: 'lich-thi',
    description: 'Các mốc thời gian quan trọng của cuộc thi.',
    icon: CalendarDays,
    iconClassName: 'bg-blue-100 text-blue-700',
  },
  RULES: {
    label: 'Thể lệ',
    sectionId: 'the-le',
    description: 'Quy định minh bạch để em tự tin tham gia.',
    icon: BookOpenCheck,
    iconClassName: 'bg-violet-100 text-violet-700',
  },
  GUIDE: {
    label: 'Hướng dẫn',
    sectionId: 'huong-dan',
    description: 'Các bước chuẩn bị và thao tác trong từng vòng.',
    icon: HelpCircle,
    iconClassName: 'bg-cyan-100 text-cyan-700',
  },
  ANNOUNCEMENT: {
    label: 'Thông báo',
    sectionId: 'thong-bao',
    description: 'Tin mới và cập nhật chính thức từ ban tổ chức.',
    icon: Megaphone,
    iconClassName: 'bg-rose-100 text-rose-700',
  },
  RESULT: {
    label: 'Kết quả',
    sectionId: 'ket-qua',
    description: 'Thông tin kết quả đã được công bố.',
    icon: Trophy,
    iconClassName: 'bg-amber-100 text-amber-700',
  },
  AWARD: {
    label: 'Giải thưởng',
    sectionId: 'giai-thuong',
    description: 'Ghi nhận nỗ lực và thành tích nổi bật.',
    icon: Award,
    iconClassName: 'bg-orange-100 text-orange-700',
  },
  CERTIFICATE: {
    label: 'Chứng nhận',
    sectionId: 'chung-nhan',
    description: 'Thông tin về chứng nhận và cách tra cứu.',
    icon: Medal,
    iconClassName: 'bg-teal-100 text-teal-700',
  },
  INCIDENT_NOTICE: {
    label: 'Lưu ý hệ thống',
    sectionId: 'luu-y-he-thong',
    description: 'Cập nhật vận hành cần thiết cho người tham gia.',
    icon: FileText,
    iconClassName: 'bg-slate-200 text-slate-700',
  },
};

const roundStatePresentation: Record<CompetitionRoundPresentationState, {
  label: string;
  className: string;
  icon: LucideIcon;
}> = {
  LOCKED: { label: 'Chưa mở', className: 'bg-white/10 text-white/75', icon: LockKeyhole },
  OPEN: { label: 'Đang mở', className: 'bg-emerald-300/15 text-emerald-100', icon: Sparkles },
  PASSED: { label: 'Đã vượt qua', className: 'bg-emerald-300/15 text-emerald-100', icon: Trophy },
  FAILED_RETRY_AVAILABLE: { label: 'Có thể thử lại', className: 'bg-orange-300/15 text-orange-100', icon: Clock3 },
  CLOSED: { label: 'Đã đóng', className: 'bg-white/10 text-white/70', icon: LockKeyhole },
};

export const CompetitionBrandMark = ({ inverted = false }: { inverted?: boolean }) => (
  <span className="inline-flex items-center gap-3">
    <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-black text-white shadow-lg shadow-blue-900/20">
      TH
    </span>
    <span className="leading-none">
      <span className={`block text-[0.65rem] font-black uppercase tracking-[0.24em] ${inverted ? 'text-cyan-300' : 'text-blue-600'}`}>Sân chơi</span>
      <span className={`mt-1 block text-lg font-black tracking-tight ${inverted ? 'text-white' : 'text-slate-950'}`}>TÔ HIỆU QUIZ</span>
    </span>
  </span>
);

export const CompetitionConstellation = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div className="absolute -right-20 -top-20 size-72 rounded-full bg-cyan-300/20 blur-3xl" />
    <div className="absolute -bottom-24 left-1/4 size-80 rounded-full bg-blue-500/20 blur-3xl" />
    <div className="absolute right-[12%] top-[22%] size-2 rounded-full bg-amber-300 shadow-[0_0_28px_8px_rgba(252,211,77,0.35)]" />
    <div className="absolute left-[8%] top-[18%] size-1.5 rounded-full bg-white/70" />
    <div className="absolute left-[18%] top-[38%] size-1 rounded-full bg-cyan-200/80" />
    <div className="absolute right-[28%] top-[9%] size-1 rounded-full bg-white/70" />
    <div className="absolute bottom-[18%] right-[8%] size-1.5 rounded-full bg-blue-200/80" />
  </div>
);

export const SectionEyebrow = ({ children, tone = 'blue' }: {
  children: ReactNode;
  tone?: 'blue' | 'amber' | 'light';
}) => {
  const className = tone === 'amber'
    ? 'text-amber-700'
    : tone === 'light'
      ? 'text-cyan-200'
      : 'text-blue-700';
  return (
    <p className={`text-xs font-black uppercase tracking-[0.2em] ${className}`}>{children}</p>
  );
};

export const PublicStateBadge = ({ state }: { state: CompetitionPublicState }) => {
  const presentation = publicStatePresentation[state];
  return (
    <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-extrabold ${presentation.className}`}>
      {presentation.label}
    </span>
  );
};

export const RoundStateBadge = ({ state }: { state: CompetitionRoundPresentationState }) => {
  const presentation = roundStatePresentation[state];
  const Icon = presentation.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${presentation.className}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {presentation.label}
    </span>
  );
};

export const ArticleTypeIcon = ({ type }: { type: PublicCompetitionArticleDto['type'] }) => {
  const presentation = articleTypePresentation[type];
  const Icon = presentation.icon;
  return (
    <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${presentation.iconClassName}`} aria-hidden="true">
      <Icon className="size-5" />
    </span>
  );
};

export const LearningSeal = () => (
  <div className="relative grid size-32 place-items-center rounded-full border border-white/20 bg-white/10 shadow-2xl backdrop-blur-sm" aria-hidden="true">
    <div className="absolute inset-3 rounded-full border border-dashed border-cyan-200/45" />
    <div className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-400 text-blue-950 shadow-lg">
      <GraduationCap className="size-10" />
    </div>
  </div>
);
