const { execSync } = require('node:child_process');
const path = require('node:path');

const cwd = path.resolve(__dirname, '..');
const dbName = 'tohieuquiz-db';
const isRemote = process.argv.includes('--remote');
const modeFlag = isRemote ? '--remote' : '--local';
const modeLabel = isRemote ? 'REMOTE' : 'LOCAL';

function runWranglerQuery(query) {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const escapedQuery = normalizedQuery.replace(/"/g, '\\"');
    const command = `npx wrangler d1 execute ${dbName} --command "${escapedQuery}" ${modeFlag}`;
    const output = execSync(command, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    const jsonStart = output.indexOf('[');
    const jsonEnd = output.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
        throw new Error(`Khong phan tich duoc output tu Wrangler:\n${output}`);
    }

    return JSON.parse(output.slice(jsonStart, jsonEnd + 1));
}

function percent(value, total) {
    if (!total) return '0.0%';
    return `${((value / total) * 100).toFixed(1)}%`;
}

function normalizeTag(rawTag) {
    return rawTag.trim().replace(/^#+/, '').toLowerCase();
}

function printSection(title) {
    console.log(`\n=== ${title} ===`);
}

function main() {
    const totalsResult = runWranglerQuery(`
        SELECT
            COUNT(*) AS total_questions,
            SUM(CASE WHEN subject IS NOT NULL AND subject != '' THEN 1 ELSE 0 END) AS with_subject,
            SUM(CASE WHEN skill_code IS NOT NULL AND skill_code != '' THEN 1 ELSE 0 END) AS with_skill_code,
            SUM(CASE WHEN subskill_code IS NOT NULL AND subskill_code != '' THEN 1 ELSE 0 END) AS with_subskill_code,
            SUM(CASE WHEN difficulty IS NOT NULL THEN 1 ELSE 0 END) AS with_difficulty,
            SUM(CASE WHEN tags IS NOT NULL AND TRIM(tags) != '' AND TRIM(tags) != '[]' THEN 1 ELSE 0 END) AS with_nonempty_tags
        FROM questions;
    `);

    const totals = totalsResult[0]?.results?.[0];
    if (!totals) {
        throw new Error('Khong lay duoc tong quan metadata tu bang questions.');
    }

    const subjectBreakdownResult = runWranglerQuery(`
        SELECT
            COALESCE(NULLIF(subject, ''), '(empty)') AS subject,
            COUNT(*) AS total_questions,
            SUM(CASE WHEN skill_code IS NOT NULL AND skill_code != '' THEN 1 ELSE 0 END) AS with_skill_code,
            SUM(CASE WHEN subskill_code IS NOT NULL AND subskill_code != '' THEN 1 ELSE 0 END) AS with_subskill_code,
            SUM(CASE WHEN difficulty IS NOT NULL THEN 1 ELSE 0 END) AS with_difficulty
        FROM questions
        GROUP BY COALESCE(NULLIF(subject, ''), '(empty)')
        ORDER BY total_questions DESC;
    `);

    const subjectRows = subjectBreakdownResult[0]?.results || [];

    const tagsResult = runWranglerQuery(`
        SELECT tags
        FROM questions
        WHERE tags IS NOT NULL
          AND TRIM(tags) != ''
          AND TRIM(tags) != '[]';
    `);

    const tagRows = tagsResult[0]?.results || [];
    const tagCounts = new Map();
    for (const row of tagRows) {
        const tags = String(row.tags || '')
            .split(',')
            .map(normalizeTag)
            .filter(Boolean);

        for (const tag of tags) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
    }

    const topTags = [...tagCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 10);

    console.log(`Question metadata audit (${modeLabel})`);
    printSection('Totals');
    console.table([
        {
            metric: 'Total questions',
            count: Number(totals.total_questions),
            coverage: Number(totals.total_questions) > 0 ? '100.0%' : '0.0%',
        },
        {
            metric: 'With subject',
            count: Number(totals.with_subject),
            coverage: percent(Number(totals.with_subject), Number(totals.total_questions)),
        },
        {
            metric: 'With skill_code',
            count: Number(totals.with_skill_code),
            coverage: percent(Number(totals.with_skill_code), Number(totals.total_questions)),
        },
        {
            metric: 'With subskill_code',
            count: Number(totals.with_subskill_code),
            coverage: percent(Number(totals.with_subskill_code), Number(totals.total_questions)),
        },
        {
            metric: 'With difficulty',
            count: Number(totals.with_difficulty),
            coverage: percent(Number(totals.with_difficulty), Number(totals.total_questions)),
        },
        {
            metric: 'With non-empty tags',
            count: Number(totals.with_nonempty_tags),
            coverage: percent(Number(totals.with_nonempty_tags), Number(totals.total_questions)),
        },
    ]);

    printSection('Subject breakdown');
    console.table(
        subjectRows.map((row) => ({
            subject: row.subject,
            total_questions: Number(row.total_questions),
            with_skill_code: Number(row.with_skill_code),
            with_subskill_code: Number(row.with_subskill_code),
            with_difficulty: Number(row.with_difficulty),
        })),
    );

    printSection('Top tags');
    if (topTags.length === 0) {
        console.log('Khong co tags de fallback.');
    } else {
        console.table(
            topTags.map(([tag, count]) => ({
                tag: `#${tag}`,
                count,
            })),
        );
    }

    printSection('Summary');
    if (Number(totals.with_skill_code) === 0 && Number(totals.with_difficulty) === 0) {
        console.log('Explicit metadata coverage dang rat thap. Recommendation hien tai van phu thuoc chu yeu vao tags fallback hoac heuristics khong day du.');
    } else {
        console.log('Question bank da co explicit metadata mot phan. Team nen tiep tuc backfill de giam phu thuoc vao tags fallback.');
    }
}

try {
    main();
} catch (error) {
    console.error('Metadata audit failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
