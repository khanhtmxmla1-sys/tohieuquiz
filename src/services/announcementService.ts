/**
 * Announcement Service
 * Handles marquee announcement API calls via apiAdapter (uses the canonical Worker API)
 */

import { callApi } from './apiAdapter';
import {
    isAnnouncementChannel,
    isNotificationPriority,
    type AnnouncementChannel,
    type NotificationPriority,
} from '../../shared/notifications.contract';

export interface Announcement {
    id: string;
    content: string;
    isActive: boolean;
    updatedAt: string;
    // Banner fields
    bannerTitle?: string;
    bannerSubtitle?: string;
    bannerLink?: string;
    bannerImage?: string;
    isBannerActive?: boolean;
    daysToLive?: number;
    status?: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED';
    effectiveStatus?: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED';
    audience?: 'ALL' | 'TEACHERS' | 'STUDENTS';
    startsAt?: string | null;
    endsAt?: string | null;
    priority: NotificationPriority;
    channels: AnnouncementChannel[];
    dismissible: boolean;
    ctaLabel?: string;
    surfaceOverrides?: Record<string, unknown>;
}

const parseChannels = (announcement: any): AnnouncementChannel[] => {
    const direct = Array.isArray(announcement.channels) ? announcement.channels : null;
    if (direct) return direct.filter(isAnnouncementChannel);
    try {
        const parsed = JSON.parse(announcement.channels_json || '[]');
        if (Array.isArray(parsed)) return parsed.filter(isAnnouncementChannel);
    } catch {
        // Fall through to legacy flags.
    }
    const legacy: AnnouncementChannel[] = [];
    if (announcement.isActive === true || announcement.is_active === true || announcement.is_active === 'true') {
        legacy.push('TICKER');
    }
    if (announcement.isBannerActive === true
        || announcement.is_banner_active === true
        || announcement.is_banner_active === 'true') {
        legacy.push('BANNER');
    }
    return legacy;
};

const mapAnnouncement = (announcement: any): Announcement => ({
    ...announcement,
    id: String(announcement.id || '1'),
    content: announcement.content || '',
    isActive: announcement.isActive ?? (announcement.is_active === 'true' || announcement.is_active === true || announcement.is_active === 1),
    updatedAt: announcement.updatedAt ?? announcement.updated_at,
    bannerTitle: announcement.bannerTitle ?? announcement.banner_title,
    bannerSubtitle: announcement.bannerSubtitle ?? announcement.banner_subtitle,
    bannerLink: announcement.bannerLink ?? announcement.banner_link,
    bannerImage: announcement.bannerImage ?? announcement.banner_image,
    isBannerActive: announcement.isBannerActive === true
        || announcement.isBannerActive === 'true'
        || announcement.is_banner_active === 'true'
        || announcement.is_banner_active === true
        || announcement.is_banner_active === 1,
    daysToLive: Number(announcement.daysToLive ?? announcement.days_to_live ?? 7),
    status: announcement.status,
    effectiveStatus: announcement.effectiveStatus,
    audience: announcement.audience,
    startsAt: announcement.startsAt ?? announcement.starts_at,
    endsAt: announcement.endsAt ?? announcement.ends_at,
    priority: isNotificationPriority(announcement.priority) ? announcement.priority : 'INFO',
    channels: parseChannels(announcement),
    dismissible: announcement.dismissible !== false && announcement.dismissible !== 0,
    ctaLabel: announcement.ctaLabel ?? announcement.cta_label ?? '',
    surfaceOverrides: announcement.surfaceOverrides ?? announcement.surface_overrides ?? {},
});

export const getAnnouncements = async (
    role?: 'teacher' | 'student',
): Promise<Announcement[]> => {
    try {
        const action = role === 'teacher'
            ? 'get_teacher_announcement'
            : role === 'student'
                ? 'get_student_announcement'
                : 'get_announcement';
        const data = await callApi<any>(action);
        const items = Array.isArray(data?.data?.items)
            ? data.data.items
            : data?.announcement
                ? [data.announcement]
                : data?.content !== undefined
                    ? [data]
                    : [];
        return items.map(mapAnnouncement);
    } catch {
        return [];
    }
};

export const getAnnouncement = async (
    role?: 'teacher' | 'student',
): Promise<Announcement | null> => (await getAnnouncements(role))[0] || null;

/**
 * Save announcement (admin only)
 */
export const saveAnnouncement = async (params: Partial<Announcement>): Promise<boolean> => {
    try {
        const data = await callApi<any>('save_announcement', params);

        if (data && data.status === 'success') {
            return true;
        }

        console.error('Save announcement error:', data?.message);
        return false;
    } catch (error) {
        console.error('Error saving announcement:', error);
        return false;
    }
};
