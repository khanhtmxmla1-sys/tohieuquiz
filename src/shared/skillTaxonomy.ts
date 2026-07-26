export type SupportedSkillSubject = 'math' | 'vietnamese';
export type SkillStatus = 'weak' | 'needs_practice' | 'stable';
export type SkillResolutionSource = 'explicit_db' | 'explicit_question' | 'tags';

export interface QuestionSkillMetadataFields {
    subject?: SupportedSkillSubject | string;
    skillCode?: string;
    subskillCode?: string;
}

export interface SkillDefinition {
    code: string;
    label: string;
    aliases: string[];
}

export interface ResolvedSkillMetadata {
    subject: SupportedSkillSubject;
    subjectLabel: string;
    skillCode: string;
    skillLabel: string;
    subskillCode?: string;
    source: SkillResolutionSource;
}

export interface SkillBreakdownItem {
    subject: SupportedSkillSubject;
    subjectLabel: string;
    skillCode: string;
    skillLabel: string;
    attempted: number;
    correct: number;
    wrong: number;
    accuracy: number;
    status: SkillStatus;
}

export interface SkillBreakdownSubjectGroup {
    subject: SupportedSkillSubject;
    label: string;
    skills: SkillBreakdownItem[];
}

export interface ResultSkillBreakdownResponse {
    resultId: string;
    studentName: string;
    studentClass: string;
    quizId: string;
    submittedAt: string;
    subjects: SkillBreakdownSubjectGroup[];
    unclassifiedQuestionCount: number;
    coveragePercent: number;
}

export interface WeaknessProfileResponse {
    studentName: string;
    studentClass: string;
    basedOnResultIds: string[];
    updatedAt: string;
    subjects: SkillBreakdownSubjectGroup[];
    unclassifiedQuestionCount: number;
    coveragePercent: number;
}

const SUBJECT_LABELS: Record<SupportedSkillSubject, string> = {
    math: 'Toan',
    vietnamese: 'Tieng Viet',
};

const SUBJECT_ALIASES: Record<SupportedSkillSubject, string[]> = {
    math: ['math', 'toan', '#toan'],
    vietnamese: ['vietnamese', 'tieng_viet', 'tieng viet', 'vi_ngu', '#tieng_viet', '#vi_ngu'],
};

const MATH_SKILLS: SkillDefinition[] = [
    { code: 'so_va_cau_tao_so', label: 'So va cau tao so', aliases: ['so', 'so_tu_nhien', 'cau_tao_so', 'gia_tri_chu_so', 'doc_viet_so', 'lam_tron_so'] },
    { code: 'phep_cong_tru', label: 'Phep cong tru', aliases: ['phep_cong', 'phep_tru', 'cong_tru', 'tinh_nham'] },
    { code: 'phep_nhan_chia', label: 'Phep nhan chia', aliases: ['phep_nhan', 'phep_chia', 'bang_nhan', 'bang_chia', 'nhan_chia'] },
    { code: 'phan_so', label: 'Phan so', aliases: ['phan_so', 'so_sanh_phan_so', 'rut_gon_phan_so', 'quy_dong', 'phan_so_bang_nhau'] },
    { code: 'so_thap_phan', label: 'So thap phan', aliases: ['so_thap_phan'] },
    { code: 'don_vi_do_luong', label: 'Don vi do luong', aliases: ['don_vi_do_luong', 'do_luong', 'don_vi_do', 'do_dai', 'khoi_luong', 'thoi_gian', 'tien_te', 'dien_tich'] },
    { code: 'hinh_hoc_co_ban', label: 'Hinh hoc co ban', aliases: ['hinh_hoc', 'hinh_binh_hanh', 'hinh_hoc_co_ban', 'chu_vi', 'dien_tich_hinh'] },
    { code: 'toan_co_loi_van', label: 'Toan co loi van', aliases: ['toan_co_loi_van', 'loi_van', 'giai_toan'] },
    { code: 'du_lieu_va_bieu_do', label: 'Du lieu va bieu do', aliases: ['du_lieu', 'bieu_do', 'bang_so_lieu'] },
    { code: 'quy_luat_va_tu_duy_logic', label: 'Quy luat va tu duy logic', aliases: ['quy_luat', 'logic', 'tu_duy_logic'] },
];

const VIETNAMESE_SKILLS: SkillDefinition[] = [
    { code: 'doc_thanh_tieng', label: 'Doc thanh tieng', aliases: ['doc_thanh_tieng', 'tap_doc'] },
    { code: 'doc_hieu', label: 'Doc hieu', aliases: ['doc_hieu', 'bai_doc'] },
    { code: 'tim_y_chinh', label: 'Tim y chinh', aliases: ['tim_y_chinh', 'y_chinh', 'tieu_de'] },
    { code: 'tu_vung', label: 'Tu vung', aliases: ['tu_vung', 'nghia_tu', 'tu_dong_nghia', 'tu_trai_nghia'] },
    { code: 'luyen_tu_va_cau', label: 'Luyen tu va cau', aliases: ['luyen_tu_va_cau', 'ngu_phap', 'chu_ngu', 'vi_ngu', 'trang_ngu', 'danh_tu', 'dong_tu', 'tinh_tu'] },
    { code: 'dat_cau_va_viet_cau', label: 'Dat cau va viet cau', aliases: ['dat_cau', 'viet_cau'] },
    { code: 'chinh_ta', label: 'Chinh ta', aliases: ['chinh_ta', 'am_van', 'c_k_q', 'ng_ngh', 'g_gh'] },
    { code: 'dau_cau_va_quy_tac_viet', label: 'Dau cau va quy tac viet', aliases: ['dau_cau', 'viet_hoa', 'quy_tac_viet'] },
    { code: 'sap_xep_va_lien_ket_y', label: 'Sap xep va lien ket y', aliases: ['sap_xep_cau', 'lien_ket_y', 'sap_xep_va_lien_ket_y'] },
    { code: 'cam_thu_noi_dung_va_nhan_vat', label: 'Cam thu noi dung va nhan vat', aliases: ['cam_thu', 'nhan_vat', 'bai_hoc', 'cam_thu_noi_dung_va_nhan_vat'] },
];

export const SKILL_TAXONOMY: Record<SupportedSkillSubject, SkillDefinition[]> = {
    math: MATH_SKILLS,
    vietnamese: VIETNAMESE_SKILLS,
};

function normalizeToken(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/^#/, '')
        .replace(/đ/g, 'd')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, '_');
}

export function normalizeSubjectCode(value?: string): SupportedSkillSubject | null {
    if (!value) return null;
    const normalized = normalizeToken(value);
    const entry = (Object.entries(SUBJECT_ALIASES) as Array<[SupportedSkillSubject, string[]]>)
        .find(([, aliases]) => aliases.some((alias) => normalizeToken(alias) === normalized));
    return entry?.[0] ?? null;
}

export function normalizeSkillCode(value?: string): string {
    return value ? normalizeToken(value) : '';
}

export function splitSkillTags(tags?: string[] | string | null): string[] {
    if (!tags) return [];
    const raw = Array.isArray(tags) ? tags : String(tags).split(',');
    return raw
        .map((tag) => normalizeToken(String(tag)))
        .filter(Boolean);
}

export function getSubjectLabel(subject: SupportedSkillSubject): string {
    return SUBJECT_LABELS[subject];
}

export function getSkillLabel(subject: SupportedSkillSubject, skillCode: string): string {
    const normalizedSkillCode = normalizeSkillCode(skillCode);
    const skill = SKILL_TAXONOMY[subject].find((entry) => entry.code === normalizedSkillCode);
    return skill?.label || normalizedSkillCode;
}

export function resolveExplicitSkillMetadata(
    source: QuestionSkillMetadataFields | null | undefined,
    resolutionSource: Exclude<SkillResolutionSource, 'tags'>,
): ResolvedSkillMetadata | null {
    if (!source?.subject || !source.skillCode) return null;
    const subject = normalizeSubjectCode(String(source.subject));
    const skillCode = normalizeSkillCode(source.skillCode);
    if (!subject || !skillCode) return null;

    const hasSkill = SKILL_TAXONOMY[subject].some((entry) => entry.code === skillCode);
    if (!hasSkill) return null;

    return {
        subject,
        subjectLabel: getSubjectLabel(subject),
        skillCode,
        skillLabel: getSkillLabel(subject, skillCode),
        subskillCode: source.subskillCode ? normalizeSkillCode(source.subskillCode) : undefined,
        source: resolutionSource,
    };
}

export function resolveSkillMetadataFromTags(tags?: string[] | string | null): ResolvedSkillMetadata | null {
    const normalizedTags = splitSkillTags(tags);
    if (normalizedTags.length === 0) return null;

    const subject = (Object.keys(SUBJECT_ALIASES) as SupportedSkillSubject[]).find((candidate) =>
        SUBJECT_ALIASES[candidate].some((alias) => normalizedTags.includes(normalizeToken(alias))),
    );

    const candidateSubjects = subject ? [subject] : (Object.keys(SKILL_TAXONOMY) as SupportedSkillSubject[]);

    for (const candidateSubject of candidateSubjects) {
        const skill = SKILL_TAXONOMY[candidateSubject].find((entry) =>
            entry.aliases.some((alias) => normalizedTags.includes(normalizeToken(alias))),
        );
        if (skill) {
            return {
                subject: candidateSubject,
                subjectLabel: getSubjectLabel(candidateSubject),
                skillCode: skill.code,
                skillLabel: skill.label,
                source: 'tags',
            };
        }
    }

    return null;
}

export function classifySkillStatus(attempted: number, correct: number, wrong: number): SkillStatus {
    if (attempted < 2) return 'stable';
    const accuracy = attempted === 0 ? 0 : (correct / attempted) * 100;
    if (accuracy < 50 && wrong >= 2) return 'weak';
    if (accuracy < 75) return 'needs_practice';
    return 'stable';
}
