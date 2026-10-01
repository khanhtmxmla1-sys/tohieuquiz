// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SchoolLogo from '../src/components/common/SchoolLogo';
import {
    PRODUCT_LOGO_FALLBACK_URL,
    PRODUCT_NAME,
    SCHOOL_LOGO_URL,
    SCHOOL_NAME,
    SEO_LOGO_URL,
    SEO_SOCIAL_IMAGE_ALT,
    SEO_SOCIAL_IMAGE_URL,
} from '../src/config/branding';

describe('school branding', () => {
    it('keeps product and school identity separate', () => {
        expect(PRODUCT_NAME).toBe('TôHiệuQuiz');
        expect(SCHOOL_NAME).toBe('Trường Tiểu học Tô Hiệu');
        expect(SCHOOL_LOGO_URL).toBe('/assets/branding/school-logo-v2.webp');
        expect(PRODUCT_LOGO_FALLBACK_URL).toBe('/assets/branding/favicon-48.png');
        expect(SEO_LOGO_URL).toBe('https://www.thtohieu.com/assets/branding/school-logo-512.png');
        expect(SEO_SOCIAL_IMAGE_URL).toBe('https://www.thtohieu.com/assets/branding/tohieuquiz-social-card-v2.png');
        expect(SEO_SOCIAL_IMAGE_ALT).toBe('Huy hiệu Trường Tiểu học Tô Hiệu và TôHiệuQuiz');
    });

    it('renders a fixed-size school logo with meaningful alternative text', () => {
        render(<SchoolLogo size={36} alt="Logo Trường Tiểu học Tô Hiệu" />);

        const image = screen.getByRole('img', { name: 'Logo Trường Tiểu học Tô Hiệu' });
        expect(image).toHaveAttribute('src', SCHOOL_LOGO_URL);
        expect(image).toHaveAttribute('width', '36');
        expect(image).toHaveAttribute('height', '36');
        expect(image).toHaveClass('h-9', 'w-9', 'object-contain', 'shrink-0');
    });

    it('uses the product icon once as fallback, then hides a broken image', () => {
        const { container } = render(<SchoolLogo size={32} decorative />);

        let image = container.querySelector('img');
        expect(image).not.toBeNull();
        expect(image).toHaveAttribute('alt', '');

        fireEvent.error(image as HTMLImageElement);
        image = container.querySelector('img');
        expect(image).toHaveAttribute('src', PRODUCT_LOGO_FALLBACK_URL);

        fireEvent.error(image as HTMLImageElement);
        expect(container.querySelector('img')).toBeNull();
    });
});
