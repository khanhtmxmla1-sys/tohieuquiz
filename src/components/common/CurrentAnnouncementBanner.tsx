import React, { useEffect, useState } from 'react';
import { Announcement, getAnnouncement } from '../../services/announcementService';
import AnnouncementBanner from './AnnouncementBanner';

const CurrentAnnouncementBanner: React.FC<{ role: 'teacher' | 'student' }> = ({ role }) => {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    useEffect(() => {
        let active = true;
        getAnnouncement(role).then((value) => { if (active) setAnnouncement(value); });
        return () => { active = false; };
    }, [role]);
    if (!announcement?.isBannerActive || !announcement.bannerTitle) return null;
    return <AnnouncementBanner id={`banner-${announcement.id}-${announcement.updatedAt || ''}`} title={announcement.bannerTitle}
        subtitle={announcement.bannerSubtitle} link={announcement.bannerLink} image={announcement.bannerImage}
        daysToLive={announcement.daysToLive} />;
};

export default CurrentAnnouncementBanner;
