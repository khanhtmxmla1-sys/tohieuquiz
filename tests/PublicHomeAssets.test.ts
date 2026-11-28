import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

const root = path.resolve(__dirname, '..');
const assetRoot = path.join(root, 'public/assets/landing/v1');
const expectedAssets = [
    'classroom-hero-640.webp',
    'classroom-hero-1200.webp',
    'teacher-benefits-640.webp',
    'teacher-benefits-960.webp',
    'student-benefits-640.webp',
    'student-benefits-960.webp',
    'competition-640.webp',
    'competition-1200.webp',
    'quiz-management.png',
    'live-exam.png',
    'gift-shop.png',
    'competition-round.png',
];

describe('public landing assets', () => {
    it('ships exactly the reviewed static asset set under the landing directory', async () => {
        const names = (await fs.readdir(assetRoot, { withFileTypes: true }))
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .sort();

        expect(names).toEqual([...expectedAssets].sort());
    });

    it('keeps every landing image valid, bounded, and free of Desktop/data-uri dependencies', async () => {
        let totalBytes = 0;

        for (const name of expectedAssets) {
            const filePath = path.join(assetRoot, name);
            const [bytes, metadata] = await Promise.all([
                fs.readFile(filePath),
                sharp(filePath).metadata(),
            ]);
            const extension = path.extname(name).slice(1);

            expect(['png', 'webp']).toContain(extension);
            expect(metadata.format).toBe(extension);
            expect(metadata.width, name).toBeGreaterThan(1);
            expect(metadata.height, name).toBeGreaterThan(1);
            expect(bytes.length, `${name} exceeds 1.2 MiB`).toBeLessThanOrEqual(1_200_000);
            expect(bytes.toString('utf8')).not.toMatch(/data:image|Desktop[\\/]/i);
            totalBytes += bytes.length;
        }

        for (const hero of ['classroom-hero-640.webp', 'classroom-hero-1200.webp']) {
            const bytes = await fs.stat(path.join(assetRoot, hero));
            expect(bytes.size, `${hero} exceeds 180 KiB`).toBeLessThanOrEqual(180_000);
        }
        expect(totalBytes, 'landing image bundle exceeds 1.2 MiB').toBeLessThanOrEqual(1_200_000);
    });
});
