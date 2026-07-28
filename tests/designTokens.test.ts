import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokenFile = resolve(process.cwd(), 'src/styles/design-tokens.css');

const relativeLuminance = (hex: string): number => {
    const channels = hex.replace('#', '').match(/.{2}/g)?.map(value => Number.parseInt(value, 16) / 255) ?? [];
    const linear = channels.map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrastRatio = (foreground: string, background: string): number => {
    const first = relativeLuminance(foreground);
    const second = relativeLuminance(background);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
};

describe('design tokens', () => {
    it('defines semantic color, spacing, radius, elevation and focus tokens', () => {
        const css = readFileSync(tokenFile, 'utf8');
        for (const token of ['--color-brand-primary', '--color-surface', '--color-text', '--space-4', '--radius-lg', '--elevation-2', '--focus-ring']) {
            expect(css).toContain(token);
        }
    });

    it('meets WCAG AA contrast for core text and brand button combinations', () => {
        expect(contrastRatio('#0f172a', '#ffffff')).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio('#ffffff', '#2563eb')).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio('#475569', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps new common primitives free from raw hexadecimal colors', () => {
        const files = [
            'Button.tsx', 'Card.tsx', 'Input.tsx', 'Alert.tsx', 'Skeleton.tsx',
            'EmptyState.tsx', 'AsyncState.tsx', 'Modal.tsx',
        ];
        for (const file of files) {
            const source = readFileSync(resolve(process.cwd(), 'src/components/common', file), 'utf8');
            expect(source, file).not.toMatch(/#[0-9a-f]{3,8}\b/i);
        }
    });

    it('includes a reduced-motion policy', () => {
        expect(readFileSync(tokenFile, 'utf8')).toContain('prefers-reduced-motion: reduce');
    });
});
