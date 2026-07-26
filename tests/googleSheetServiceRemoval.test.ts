import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectFile = (path: string) => resolve(process.cwd(), path);

const migratedRuntimeFiles = [
    'src/components/TeacherDashboard/ResultsTab.tsx',
    'src/components/TeacherDashboard/TeacherResultDetailPage.tsx',
    'src/components/TeacherDashboard/index.tsx',
    'stores/quizStore.ts',
];

describe('Google Sheets compatibility service removal', () => {
    it('removes the legacy service after all active consumers migrate', () => {
        expect(existsSync(projectFile('src/services/googleSheetService.ts'))).toBe(false);

        for (const path of migratedRuntimeFiles) {
            const source = readFileSync(projectFile(path), 'utf8');
            expect(source).not.toContain('googleSheetService');
            expect(source).not.toContain('setStripAnswersEnabled');
        }
    });
});
