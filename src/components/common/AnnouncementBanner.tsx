import React, { useState, useEffect } from 'react';
import { X, Megaphone, ArrowRight } from 'lucide-react';

interface AnnouncementBannerProps {
    id?: string;
    title: string;
    subtitle?: string;
    link?: string;
    image?: string;
    daysToLive?: number;
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
    id = 'default-banner',
    title,
    subtitle,
    link,
    image,
    daysToLive = 7
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        // Banner check log removed
        // Check if banner was recently closed
        const closedAt = localStorage.getItem(`announcement_closed_${id}`);
        if (closedAt) {
            const lastClosed = parseInt(closedAt, 10);
            const now = Date.now();
            const daysInMs = daysToLive * 24 * 60 * 60 * 1000;
            
            if (now - lastClosed < daysInMs) {
                // Hidden log removed
                return; // Still in hide period
            }
        }
        
        // Show banner with a slight delay for smooth entrance
        const timer = setTimeout(() => {
            // Showing log removed
            setIsVisible(true);
        }, 500);
        return () => clearTimeout(timer);
    }, [id, daysToLive]);

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExiting(true);
        setTimeout(() => {
            setIsVisible(false);
            localStorage.setItem(`announcement_closed_${id}`, Date.now().toString());
        }, 300); // Match animation duration
    };

    const openLink = () => {
        if (!link) return;
        const isInternal = link.startsWith('/') && !link.startsWith('//');
        let safe = isInternal;
        if (!isInternal) {
            try { safe = new URL(link).protocol === 'https:'; } catch { safe = false; }
        }
        if (!safe) return;
        const opened = window.open(link, '_blank', 'noopener,noreferrer');
        if (opened) opened.opener = null;
    };

    if (!isVisible) return null;

    return (
        <div 
            className={`announcement-banner-wrapper ${isExiting ? 'fade-out' : 'fade-in'}`}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none'
            }}
        >
            <div 
                className="announcement-banner-inner"
                style={{
                    maxWidth: '800px',
                    width: '100%',
                    background: 'rgba(220, 252, 231, 0.7)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    borderRadius: '24px',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    position: 'relative',
                    pointerEvents: 'auto',
                    cursor: link ? 'pointer' : 'default',
                    transition: 'transform 0.2s ease'
                }}
                onClick={openLink}
                onKeyDown={(event) => {
                    if (link && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        openLink();
                    }
                }}
                role={link ? 'link' : undefined}
                tabIndex={link ? 0 : undefined}
            >
                {/* Leading Icon/Image */}
                <div className="banner-icon-container" style={{ flexShrink: 0 }}>
                    {image ? (
                        <img 
                            src={image} 
                            alt="Announcement" 
                            style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }}
                        />
                    ) : (
                        <img 
                            src="/images/loa.png" 
                            alt="Announcement Indicator" 
                            style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'contain' }}
                        />
                    )}
                </div>

                {/* Text Content */}
                <div className="banner-text-content" style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ 
                        margin: 0, 
                        fontSize: '1rem', 
                        fontWeight: 700, 
                        color: '#166534',
                        fontFamily: "'Baloo 2', sans-serif",
                        lineHeight: 1.2
                    }}>
                        {title}
                    </h3>
                    {subtitle && (
                        <p style={{ 
                            margin: 0, 
                            fontSize: '0.85rem', 
                            color: '#14532d',
                            fontFamily: "'Baloo 2', sans-serif",
                            fontWeight: 500,
                            opacity: 0.9,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="banner-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    {link && (
                        <button 
                            className="banner-cta"
                            type="button"
                            onClick={(event) => { event.stopPropagation(); openLink(); }}
                            style={{
                                background: '#16a34a',
                                color: 'white',
                                border: 'none',
                                borderRadius: '999px',
                                padding: '6px 16px',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                fontFamily: "'Baloo 2', sans-serif",
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Xem Ngay <ArrowRight size={14} />
                        </button>
                    )}
                    
                    <button 
                        onClick={handleClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#166534',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            transition: 'background 0.2s'
                        }}
                        aria-label="Đóng thông báo"
                    >
                        <X size={20} />
                    </button>
                </div>

                <style>{`
                    .announcement-banner-wrapper {
                        animation: slideDown 0.5s ease-out forwards;
                    }
                    .announcement-banner-wrapper.fade-out {
                        animation: fadeOut 0.3s ease-in forwards;
                    }
                    @keyframes slideDown {
                        from { transform: translateY(-100%); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                    @keyframes fadeOut {
                        from { transform: translateY(0); opacity: 1; }
                        to { transform: translateY(-10px); opacity: 0; }
                    }
                    .banner-icon-container { transition: transform 0.3s ease; }
                    .announcement-banner-inner:hover .banner-icon-container { transform: scale(1.1); }
                    .banner-cta:hover { background: #15803d; transform: scale(1.05); }
                    
                    @media (max-width: 640px) {
                        .banner-text-content p { display: none; }
                        .banner-icon-container { display: none; }
                        .announcement-banner-inner { gap: 8px; border-radius: 16px; min-width: 0; }
                        .announcement-banner-wrapper { padding: 8px; }
                        .banner-cta { padding: 6px 10px !important; }
                    }
                `}</style>
            </div>
        </div>
    );
};

export default AnnouncementBanner;
