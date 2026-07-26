const { execSync } = require('node:child_process');
const path = require('node:path');
const { writeBackfillReport } = require('./metadata-backfill-report-utils.cjs');
const { buildPhase2ReviewRow } = require('./question-metadata-phase2-review-utils.cjs');

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

function printSection(title) {
    console.log(`\n=== ${title} ===`);
}

function buildTopBuckets(reviewRows) {
    const bucketCounts = new Map();

    for (const row of reviewRows) {
        bucketCounts.set(row.tag_signature, (bucketCounts.get(row.tag_signature) || 0) + 1);
    }

    return [...bucketCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 15)
        .map(([tagSignature, count]) => ({ tagSignature, count }));
}

function buildCategorySummary(reviewRows) {
    const categoryCounts = new Map();

    for (const row of reviewRows) {
        categoryCounts.set(row.review_category, (categoryCounts.get(row.review_category) || 0) + 1);
    }

    return [...categoryCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([category, count]) => ({ category, count }));
}

function main() {
    const result = runWranglerQuery(`
        SELECT id, question, tags, subject, skill_code, subskill_code, difficulty
        FROM questions
        ORDER BY id;
    `);

    const rows = result[0]?.results || [];
    const reviewRows = rows
        .map(buildPhase2ReviewRow)
        .filter(Boolean);

    const topBuckets = buildTopBuckets(reviewRows);
    const categorySummary = buildCategorySummary(reviewRows);

    const report = writeBackfillReport({
        modeLabel,
        reportType: 'phase2-review',
        summary: {
            totalQuestions: rows.length,
            phase2ReviewRows: reviewRows.length,
            topBuckets,
            categorySummary,
        },
        rows: reviewRows,
    });

    console.log(`Metadata phase 2 review (${modeLabel})`);

    printSection('Coverage summary');
    console.table([
        { metric: 'Total questions', count: rows.length, coverage: rows.length > 0 ? '100.0%' : '0.0%' },
        { metric: 'Phase 2 review rows', count: reviewRows.length, coverage: percent(reviewRows.length, rows.length) },
    ]);

    printSection('Top review buckets');
    console.table(topBuckets);

    printSection('Review categories');
    console.table(categorySummary);

    printSection('Sample review rows');
    console.table(reviewRows.slice(0, 15));

    printSection('Summary');
    console.log(
        [
            `Phase 2 review report gom ${reviewRows.length}/${rows.length} row can xem tay.`,
            `Top bucket dau tien: ${topBuckets[0]?.tagSignature || 'khong co'}.`,
            `Report JSON: ${report.latestJsonPath}`,
            `Report CSV: ${report.latestCsvPath}`,
        ].join(' '),
    );
}

try {
    main();
} catch (error) {
    console.error('Metadata phase 2 review failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
