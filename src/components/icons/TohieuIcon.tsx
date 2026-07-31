import React from 'react';

export const TOHIEU_ICON_SOURCES = {
    overview: '/icons/tohieuquiz/overview.webp',
    'quiz-create': '/icons/tohieuquiz/quiz-create.webp',
    'quiz-management': '/icons/tohieuquiz/quiz-management.webp',
    assignment: '/icons/tohieuquiz/assignment.webp',
    classroom: '/icons/tohieuquiz/classroom.webp',
    'live-exam': '/icons/tohieuquiz/live-exam.webp',
    'learning-results': '/icons/tohieuquiz/learning-results.webp',
    certificate: '/icons/tohieuquiz/certificate.webp',
    'parent-portal': '/icons/tohieuquiz/parent-portal.webp',
    notification: '/icons/tohieuquiz/notification.webp',
    'gift-shop': '/icons/tohieuquiz/gift-shop.webp',
    settings: '/icons/tohieuquiz/settings.webp',
} as const;

export type TohieuIconName = keyof typeof TOHIEU_ICON_SOURCES;

export interface TohieuIconProps extends Omit<
    React.ImgHTMLAttributes<HTMLImageElement>,
    'src' | 'width' | 'height' | 'alt'
> {
    name: TohieuIconName;
    size?: number;
    alt?: string;
    decorative?: boolean;
}

const TohieuIcon: React.FC<TohieuIconProps> = ({
    name,
    size = 48,
    alt = '',
    decorative = true,
    className,
    ...imageProps
}) => (
    <img
        {...imageProps}
        src={TOHIEU_ICON_SOURCES[name]}
        width={size}
        height={size}
        alt={decorative ? '' : alt}
        aria-hidden={decorative ? true : undefined}
        decoding="async"
        draggable={false}
        className={className}
    />
);

export default TohieuIcon;
