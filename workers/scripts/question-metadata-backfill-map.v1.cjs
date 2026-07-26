const SUBJECTS = {
    math: {
        label: 'Toan',
        aliases: ['math', 'toan'],
    },
    vietnamese: {
        label: 'Tieng Viet',
        aliases: ['vietnamese', 'tieng_viet', 'tieng viet', 'vi_ngu'],
    },
};

const SKILLS = {
    math: [
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
    ],
    vietnamese: [
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
    ],
};

const DIFFICULTY_TAGS = {
    1: ['difficulty_1', 'muc_1', 'muc_do_1', 'level_1', 'easy', 'de'],
    2: ['difficulty_2', 'muc_2', 'muc_do_2', 'level_2', 'medium', 'trung_binh'],
    3: ['difficulty_3', 'muc_3', 'muc_do_3', 'level_3', 'hard', 'kho'],
};

const DIFFICULTY_HINTS_BY_TAG = {
    1: ['lam_tron_so', 'rut_gon_phan_so', 'tap_doc'],
    2: ['so_sanh_phan_so', 'quy_dong', 'chu_ngu', 'vi_ngu', 'hinh_binh_hanh', 'ngu_phap'],
    3: ['trang_nguyen'],
};

function normalizeToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^#/, '')
        .replace(/đ/g, 'd')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, '_');
}

function splitTags(tags) {
    return String(tags || '')
        .split(',')
        .map(normalizeToken)
        .filter(Boolean);
}

function resolveSubject(tags) {
    const matches = Object.entries(SUBJECTS)
        .filter(([, subject]) => subject.aliases.some((alias) => tags.includes(normalizeToken(alias))))
        .map(([code, subject]) => ({ code, label: subject.label }));

    if (matches.length === 1) return matches[0];
    return null;
}

function resolveSkill(tags, subjectCode) {
    const subjectSkills = subjectCode ? SKILLS[subjectCode] : Object.values(SKILLS).flat();
    const matches = subjectSkills.filter((skill) =>
        skill.aliases.some((alias) => tags.includes(normalizeToken(alias))),
    );

    if (matches.length === 1) return matches[0];

    const uniqueMatches = matches.filter((skill, index) =>
        matches.findIndex((candidate) => candidate.code === skill.code) === index,
    );

    if (uniqueMatches.length === 1) return uniqueMatches[0];
    return null;
}

function resolveSubskill(tags, skill) {
    if (!skill) return undefined;
    const candidates = skill.aliases
        .map(normalizeToken)
        .filter((alias) => alias && alias !== skill.code && tags.includes(alias));

    return candidates[0];
}

function resolveDifficulty(tags) {
    for (const [difficulty, aliases] of Object.entries(DIFFICULTY_TAGS)) {
        if (aliases.some((alias) => tags.includes(normalizeToken(alias)))) {
            return Number(difficulty);
        }
    }

    for (const [difficulty, aliases] of Object.entries(DIFFICULTY_HINTS_BY_TAG)) {
        if (aliases.some((alias) => tags.includes(normalizeToken(alias)))) {
            return Number(difficulty);
        }
    }
    return undefined;
}

function inferMetadataFromTags(rawTags) {
    const tags = splitTags(rawTags);
    const subject = resolveSubject(tags);
    const skill = resolveSkill(tags, subject?.code);
    const subskillCode = resolveSubskill(tags, skill);
    const difficulty = resolveDifficulty(tags);

    const hasAnyMapping = Boolean(subject || skill || subskillCode || difficulty);
    const ambiguous = tags.length > 1 && !subject && !skill && !subskillCode && !difficulty;

    return {
        tags,
        subject: subject?.code,
        subjectLabel: subject?.label,
        skillCode: skill?.code,
        skillLabel: skill?.label,
        subskillCode,
        difficulty,
        ambiguous,
        hasAnyMapping,
    };
}

module.exports = {
    SUBJECTS,
    SKILLS,
    DIFFICULTY_TAGS,
    DIFFICULTY_HINTS_BY_TAG,
    normalizeToken,
    splitTags,
    inferMetadataFromTags,
};
