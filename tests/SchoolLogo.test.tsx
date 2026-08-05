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
} from '../src/config/branding';

describe('school branding', () => {
    it('keeps product and school identity separate', () => {
        expect(PRODUCT_NAME).toBe('TôHiệuQuiz');
        expect(SCHOOL_NAME).toBe('Trường Tiểu học Tô Hiệu');
        expect(SCHOOL_LOGO_URL).toBe('/assets/branding/school-logo-v1.png');
        expect(PRODUCT_LOGO_FALLBACK_URL).toBe('/favicon.svg');
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
