import type { SkillBreakdownItem } from '../../../shared/skillTaxonomy';

export type StudentWeaknessFocus = {
    subject: SkillBreakdownItem['subject'];
    subjectId: string;
    subjectLabel: string;
    skillCode: string;
    skillLabel: string;
    title: string;
    shortHint: string;
    actionLabel: string;
    recommendationTitle: string;
    recommendationSummary: string;
    nextStepLabel: string;
    nextStepHint: string;
    status: SkillBreakdownItem['status'];
    accuracy: number;
};

type StudentSkillCopy = {
    title: string;
    shortHint: string;
    actionLabel: string;
};

const SKILL_COPY: Record<string, StudentSkillCopy> = {
    phan_so: {
        title: 'Phan so',
        shortHint: 'Con dang hay nham o dang toan nay. Minh luyen them vai cau nhe hon nhe.',
        actionLabel: 'Luyen phan so',
    },
    phep_cong_tru: {
        title: 'Phep cong tru',
        shortHint: 'Con can on lai cach dat tinh va tinh can than hon o dang nay.',
        actionLabel: 'On phep cong tru',
    },
    phep_nhan_chia: {
        title: 'Phep nhan chia',
        shortHint: 'Con thu luyen them vai cau co bang nhan bang chia de quen tay hon nhe.',
        actionLabel: 'On phep nhan chia',
    },
    toan_co_loi_van: {
        title: 'Toan co loi van',
        shortHint: 'Con can doc ky de bai va tim xem minh can tinh gi truoc nha.',
        actionLabel: 'On toan loi van',
    },
    doc_hieu: {
        title: 'Doc hieu',
        shortHint: 'Con thu doc cham lai doan van va gach chan nhung y quan trong nhe.',
        actionLabel: 'On doc hieu',
    },
    luyen_tu_va_cau: {
        title: 'Luyen tu va cau',
        shortHint: 'Con can on lai cach nhan biet va dung cau cho dung.',
        actionLabel: 'On luyen tu va cau',
    },
    chinh_ta: {
        title: 'Chinh ta',
        shortHint: 'Con dang can de y them cach viet dung am va van o dang nay.',
        actionLabel: 'On chinh ta',
    },
    tu_vung: {
        title: 'Tu vung',
        shortHint: 'Con thu hoc lai nghia cua tu va cach dung trong cau nhe.',
        actionLabel: 'On tu vung',
    },
};

const SUBJECT_IDS: Record<SkillBreakdownItem['subject'], string> = {
    math: 'toan',
    vietnamese: 'tieng-viet',
};

function getSkillCopy(skill: SkillBreakdownItem): StudentSkillCopy {
    return SKILL_COPY[skill.skillCode] || {
        title: skill.skillLabel,
        shortHint: 'Con dang can on them phan nay. Minh hoc them tung chut mot nhe.',
        actionLabel: 'Xem goi y hoc',
    };
}

function buildRecommendationSummary(skill: SkillBreakdownItem, copy: StudentSkillCopy): string {
    if (skill.status === 'weak') {
        return `Minh uu tien on ${copy.title} truoc vi dang nay con moi dat ${skill.accuracy}% do chinh xac.`;
    }
    return `Minh on them ${copy.title} de con chac tay hon va giai dang nay tu tin hon.`;
}

function buildNextStepHint(skill: SkillBreakdownItem, copy: StudentSkillCopy): string {
    if (skill.status === 'weak') {
        return `${copy.shortHint} Minh se uu tien nhung cau co muc do vua suc truoc.`;
    }
    return `${copy.shortHint} Minh se on lai bang mot vai cau gan voi bai con vua lam.`;
}

export function buildStudentWeaknessFocus(skill: SkillBreakdownItem): StudentWeaknessFocus {
    const copy = getSkillCopy(skill);

    return {
        subject: skill.subject,
        subjectId: SUBJECT_IDS[skill.subject],
        subjectLabel: skill.subjectLabel,
        skillCode: skill.skillCode,
        skillLabel: skill.skillLabel,
        title: copy.title,
        shortHint: copy.shortHint,
        actionLabel: copy.actionLabel,
        recommendationTitle: `Uu tien on ${copy.title}`,
        recommendationSummary: buildRecommendationSummary(skill, copy),
        nextStepLabel: 'Bat dau voi dang nay',
        nextStepHint: buildNextStepHint(skill, copy),
        status: skill.status,
        accuracy: skill.accuracy,
    };
}
