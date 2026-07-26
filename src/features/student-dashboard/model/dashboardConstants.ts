import type {
  PracticeSubjectDefinition,
  PracticeSubjectId,
} from '@/src/components/HomePage/student-dashboard/dashboard.types';

export const ASSIGNMENTS_PER_PAGE = 5;
export const ATTENDANCE_REWARD = { exp: 50, coins: 50 } as const;

export const SUBJECT_ORDER: readonly PracticeSubjectId[] = [
  'toan',
  'tieng-viet',
  'tu-nhien-xa-hoi',
  'tieng-anh',
  'tin-hoc',
];

export const SUBJECT_CONFIG: Record<PracticeSubjectId, PracticeSubjectDefinition> = {
  toan: {
    id: 'toan',
    title: 'Toán học',
    description: 'Rèn luyện tư duy và tính toán',
    icon: 'calculator',
    aliases: [
      '#toan', '#toán', '#phep_nhan', '#phan_so', '#hinh_hoc', '#gia_tri',
      '#biu_thức', '#quy_dong', '#rut_gon_phan_so', '#so_sanh_phan_so',
      '#lam_tron_so', '#hinh_binh_hanh', '#phep_chia', '#phep_cong', '#phep_tru',
    ],
    accentClass: 'text-blue-700',
    iconSurfaceClass: 'bg-blue-100',
    showOnHome: true,
  },
  'tieng-viet': {
    id: 'tieng-viet',
    title: 'Tiếng Việt',
    description: 'Vun đắp ngôn ngữ tiếng mẹ đẻ',
    icon: 'book-open',
    aliases: [
      '#tieng_viet', '#tiếng_việt', '#trạng_nguyên', '#vi_ngữ', '#chủ_ngữ',
      '#luyện_từ_và_câu', '#từ_đơn', '#từ_phức', '#ngu_phap', '#gia_dinh',
      '#tu_vung', '#tap_doc', '#chinh_ta',
    ],
    accentClass: 'text-amber-700',
    iconSurfaceClass: 'bg-amber-100',
    showOnHome: true,
  },
  'tu-nhien-xa-hoi': {
    id: 'tu-nhien-xa-hoi',
    title: 'Tự nhiên & Xã hội',
    description: 'Khám phá thế giới quanh em',
    icon: 'earth',
    aliases: [
      '#khoa_hoc', '#tu_nhien', '#xa_hoi', '#tn_xh', '#tự_nhiên_xã_hội',
      '#lịch_sử', '#địa_lý',
    ],
    accentClass: 'text-emerald-700',
    iconSurfaceClass: 'bg-emerald-100',
    showOnHome: true,
  },
  'tieng-anh': {
    id: 'tieng-anh',
    title: 'Tiếng Anh',
    description: 'Mở rộng giao tiếp quốc tế',
    icon: 'languages',
    aliases: ['#tieng_anh', '#anh_van', '#english', '#grammar', '#vocabulary'],
    accentClass: 'text-indigo-700',
    iconSurfaceClass: 'bg-indigo-100',
    showOnHome: true,
  },
  'tin-hoc': {
    id: 'tin-hoc',
    title: 'Tin học',
    description: 'Làm chủ công nghệ tương lai',
    icon: 'monitor',
    aliases: ['#tin_hoc', '#coding', '#scratch', '#may_tinh'],
    accentClass: 'text-slate-700',
    iconSurfaceClass: 'bg-slate-200',
    showOnHome: true,
  },
};
