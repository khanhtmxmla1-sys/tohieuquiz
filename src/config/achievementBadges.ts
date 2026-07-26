import type { GameLoopAchievement } from '../types/gameLoop.types';

export const ACHIEVEMENT_BADGE_IMAGES: Record<string, string> = {
    daily_hat_trick: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076075/tron_bo_nhiem_vu_ytffwa.png',
    questions_100: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076074/tram_cau_t4fx4k.png',
    perfect_20: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076074/than_dong_pjs6ko.png',
    speed_master_30: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076068/bac_thay_toc_do_z3qbpr.png',
    weekly_warrior: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076068/chien_binh_tuan_le_wdxkym.png',
    speed_demon_10: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076073/toc_do_anh_sang_zfh2cl.png',
    vietnamese_expert_50: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076067/cao_thu_tieng_viet_kohsua.png',
    streak_30: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076072/sieu_kien_tri_flut1w.png',
    first_quiz: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076067/bat_dau_hanh_trinh_okkpp8.png',
    questions_1000: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076071/nghin_cau_xe9gom.png',
    collector_5: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076072/nha_suu_tap_ovzan4.png',
    streak_7: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076070/kien_tri_7_ngay_zxwbzt.png',
    collector_10: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076069/dai_gia_suu_tam_axi5nx.png',
    questions_500: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076070/nam_tram_cau_gnrizs.png',
    perfect_5: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076069/diem_10_lien_tiep_qhjfvm.png',
    streak_3: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076069/kien_tri_3_ngay_vdhebl.png',
    streak_100: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076069/huyen_thoai_z6yjnh.png',
    math_expert_50: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076068/cao_thu_toan_ufw3o3.png',
    early_bird_10: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076068/chim_som_xt67pm.png',
    night_owl_10: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076068/cu_dem_em10oz.png',
    english_expert_50: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076067/bac_thay_tieng_anh_h0dcyv.png',
    math_expert_100: 'https://res.cloudinary.com/dwv7hot9x/image/upload/v1778076067/bac_thay_toan_pmqxhn.png',
};

export function getAchievementBadgeImage(code: string): string | undefined {
    return ACHIEVEMENT_BADGE_IMAGES[code];
}

export function getAchievementBadgeAlt(achievement: Pick<GameLoopAchievement, 'title'>): string {
    return `Huy hieu ${achievement.title}`;
}