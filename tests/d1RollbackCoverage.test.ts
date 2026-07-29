import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationsDir = path.join(root, 'workers', 'migrations');
const rollbacksDir = path.join(root, 'workers', 'rollbacks');

function sqlFiles(dir: string): string[] {
    return fs.readdirSync(dir)
        .filter((name) => name.endsWith('.sql'))
        .sort();
}

function numericPrefix(name: string): string {
    return name.slice(0, 4);
}

/**
 * Migrations that change production behaviour in a way we must be able to undo
 * quickly. Every entry here needs a matching script in workers/rollbacks/.
 */
const ROLLBACK_REQUIRED = [
    '0015',
    '0016',
    '0019',
    '0031',
    '0032',
    '0037',
    '0038',
    '0040',
    '0042',
    '0043',
    '0044',
    '0049',
    '0050',
];

describe('D1 rollback coverage', () => {
    it('ships a rollback script for every high-risk migration', () => {
        const rollbackPrefixes = new Set(sqlFiles(rollbacksDir).map(numericPrefix));
        const missing = ROLLBACK_REQUIRED.filter((prefix) => !rollbackPrefixes.has(prefix));

        expect(missing).toEqual([]);
    });

    it('never ships a rollback without the forward migration it undoes', () => {
        const migrationPrefixes = new Set(sqlFiles(migrationsDir).map(numericPrefix));
        const orphans = sqlFiles(rollbacksDir)
            .filter((name) => !migrationPrefixes.has(numericPrefix(name)));

        expect(orphans).toEqual([]);
    });

    it('names every rollback so the destructive intent is visible', () => {
        const badlyNamed = sqlFiles(rollbacksDir)
            .filter((name) => !/^\d{4}_drop_[a-z0-9_]+\.sql$/.test(name));

        expect(badlyNamed).toEqual([]);
    });

    it('documents why columns survive the rollback where SQLite cannot drop them', () => {
        const retainingScripts = [
            '0032_drop_result_report_delivery.sql',
            '0040_drop_results_assignment_scope.sql',
            '0042_drop_unified_notifications.sql',
            '0049_drop_gift_shop_governance.sql',
            '0050_drop_notification_preferences.sql',
        ];

        for (const script of retainingScripts) {
            const sql = fs.readFileSync(path.join(rollbacksDir, script), 'utf8');
            expect(sql.toLowerCase()).toContain('retained');
        }
    });

    it('drops live exam and game loop tables in a foreign-key-safe order', () => {
        const liveExam = fs.readFileSync(
            path.join(rollbacksDir, '0016_drop_live_exam_tables.sql'),
            'utf8',
        );

        const participantsAt = liveExam.indexOf('DROP TABLE IF EXISTS live_exam_participants');
        const sessionsAt = liveExam.indexOf('DROP TABLE IF EXISTS live_exam_sessions');
        expect(participantsAt).toBeGreaterThan(-1);
        expect(sessionsAt).toBeGreaterThan(participantsAt);

        const gameLoop = fs.readFileSync(
            path.join(rollbacksDir, '0015_drop_game_loop_tables.sql'),
            'utf8',
        );
        expect(gameLoop).toContain('DROP TABLE IF EXISTS student_game_profiles;');
    });
});
