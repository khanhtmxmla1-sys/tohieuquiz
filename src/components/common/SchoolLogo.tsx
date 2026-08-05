import { useState } from 'react';
import {
    PRODUCT_LOGO_FALLBACK_URL,
    SCHOOL_LOGO_URL,
    SCHOOL_NAME,
} from '../../config/branding';

export type SchoolLogoSize = 32 | 36 | 40 | 44 | 64 | 80;

export interface SchoolLogoProps {
    size?: SchoolLogoSize;
    alt?: string;
    decorative?: boolean;
    className?: string;
}

const SIZE_CLASSES: Record<SchoolLogoSize, string> = {
    32: 'h-8 w-8',
    36: 'h-9 w-9',
    40: 'h-10 w-10',
    44: 'h-11 w-11',
    64: 'h-16 w-16',
    80: 'h-20 w-20',
};

type LogoSource = 'school' | 'product' | 'hidden';

const SchoolLogo = ({
    size = 40,
    alt,
    decorative = false,
    className = '',
}: SchoolLogoProps) => {
    const [source, setSource] = useState<LogoSource>('school');

    if (source === 'hidden') return null;

    const src = source === 'school' ? SCHOOL_LOGO_URL : PRODUCT_LOGO_FALLBACK_URL;
    const accessibleAlt = decorative ? '' : (alt ?? `Logo ${SCHOOL_NAME}`);

    return (
        <img
            src={src}
            alt={accessibleAlt}
            aria-hidden={decorative || undefined}
            width={size}
            height={size}
            decoding="async"
            draggable={false}
            className={`${SIZE_CLASSES[size]} shrink-0 object-contain ${className}`.trim()}
            onError={() => setSource((current) => current === 'school' ? 'product' : 'hidden')}
        />
    );
};

export default SchoolLogo;
