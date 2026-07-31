import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TohieuIcon, { TOHIEU_ICON_SOURCES } from '../src/components/icons/TohieuIcon';

describe('TohieuIcon', () => {
    it('maps brand icon names to public asset URLs', () => {
        expect(TOHIEU_ICON_SOURCES['quiz-create']).toBe('/icons/tohieuquiz/quiz-create.webp');
        expect(Object.keys(TOHIEU_ICON_SOURCES)).toHaveLength(12);
    });

    it('renders a decorative icon at the default size', () => {
        const { container } = render(<TohieuIcon name="quiz-create" />);
        const icon = container.querySelector('img');

        expect(icon).toHaveAttribute('src', '/icons/tohieuquiz/quiz-create.webp');
        expect(icon).toHaveAttribute('width', '48');
        expect(icon).toHaveAttribute('height', '48');
        expect(icon).toHaveAttribute('alt', '');
        expect(icon).toHaveAttribute('aria-hidden', 'true');
        expect(icon).toHaveAttribute('decoding', 'async');
        expect(icon).toHaveAttribute('draggable', 'false');
    });

    it('supports a meaningful accessible label when requested', () => {
        render(
            <TohieuIcon
                name="certificate"
                size={64}
                decorative={false}
                alt="Chứng nhận TôHiệuQuiz"
            />,
        );

        const icon = screen.getByRole('img', { name: 'Chứng nhận TôHiệuQuiz' });
        expect(icon).toHaveAttribute('width', '64');
        expect(icon).toHaveAttribute('height', '64');
        expect(icon).not.toHaveAttribute('aria-hidden');
    });
});
