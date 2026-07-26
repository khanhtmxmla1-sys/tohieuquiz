/**
 * Avatar Configuration — Chibi Children Edition
 *
 * Cute chibi-style avatars of Vietnamese elementary school children.
 * Uses local neutral avatars by default. A dedicated Cloudinary folder can be
 * configured later through public Vite environment variables.
 */

const CLOUDINARY_BASE = import.meta.env.VITE_CLOUDINARY_AVATAR_BASE_URL?.trim().replace(/\/+$/, '') || '';
const CLOUDINARY_FOLDER = import.meta.env.VITE_CLOUDINARY_AVATAR_FOLDER?.trim().replace(/^\/+|\/+$/g, '') || '';
const LOCAL_AVATARS = ['/avatar1.webp', '/avatar2.webp', '/avatar3.webp'] as const;

const avatarUrl = (id: string): string => {
    if (CLOUDINARY_BASE && CLOUDINARY_FOLDER) {
        return `${CLOUDINARY_BASE}/w_200,h_200,c_fill,f_auto,q_auto/${CLOUDINARY_FOLDER}/${id}`;
    }
    const numericPart = Number.parseInt(id.match(/\d+/)?.[0] || '1', 10);
    return LOCAL_AVATARS[(numericPart - 1) % LOCAL_AVATARS.length];
};

export interface AvatarOption {
    id: string;
    name: string;
    url: string;
    category: 'girl' | 'boy';
}

export const AVATAR_LIST: AvatarOption[] = [
    // --- Girls ---
    { id: 'girl_01', name: 'Bé Hoa', url: avatarUrl('girl_01'), category: 'girl' },
    { id: 'girl_02', name: 'Bé Đào', url: avatarUrl('girl_02'), category: 'girl' },
    { id: 'girl_03', name: 'Bé Tím', url: avatarUrl('girl_03'), category: 'girl' },
    { id: 'girl_04', name: 'Bé Thảo', url: avatarUrl('girl_04'), category: 'girl' },
    { id: 'girl_05', name: 'Bé Mint', url: avatarUrl('girl_05'), category: 'girl' },
    { id: 'girl_06', name: 'Bé Cầu Vồng', url: avatarUrl('girl_06'), category: 'girl' },
    { id: 'girl_07', name: 'Bé Nắng', url: avatarUrl('girl_07'), category: 'girl' },
    { id: 'girl_08', name: 'Bé Jean', url: avatarUrl('girl_08'), category: 'girl' },

    // --- Boys ---
    { id: 'boy_01', name: 'Bé Minh', url: avatarUrl('boy_01'), category: 'boy' },
    { id: 'boy_02', name: 'Bé Sao', url: avatarUrl('boy_02'), category: 'boy' },
    { id: 'boy_03', name: 'Bé Cam', url: avatarUrl('boy_03'), category: 'boy' },
    { id: 'boy_04', name: 'Bé Thông Minh', url: avatarUrl('boy_04'), category: 'boy' },
    { id: 'boy_05', name: 'Bé Khỏe', url: avatarUrl('boy_05'), category: 'boy' },
    { id: 'boy_06', name: 'Bé Navy', url: avatarUrl('boy_06'), category: 'boy' },
];

/**
 * Get avatar URL by key. Falls back to default girl_01 avatar.
 */
export const getAvatarUrl = (avatarId?: string): string => {
    if (!avatarId) return AVATAR_LIST[0].url;
    const found = AVATAR_LIST.find(a => a.id === avatarId);
    return found ? found.url : AVATAR_LIST[0].url;
};

/**
 * Get avatar name by key.
 */
export const getAvatarName = (avatarId?: string): string => {
    if (!avatarId) return AVATAR_LIST[0].name;
    const found = AVATAR_LIST.find(a => a.id === avatarId);
    return found ? found.name : AVATAR_LIST[0].name;
};
