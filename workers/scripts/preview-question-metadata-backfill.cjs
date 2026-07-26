const { execSync } = require('node:child_process');
const path = require('node:path');
const { inferMetadataFromTags } = require('./question-metadata-backfill-map.v1.cjs');
const { writeBackfillReport } = require('./metadata-backfill-report-utils.cjs');

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

function main() {
    const result = runWranglerQuery(`
        SELECT id, question, tags, subject, skill_code, subskill_code, difficulty
        FROM questions
        ORDER BY id;
    `);

    const rows = result[0]?.results || [];
    const previewRows = [];
    const unresolvedTagCounts = new Map();

    let totalQuestions = 0;
    let withTags = 0;
    let mappedSubject = 0;
    let mappedSkill = 0;
    let mappedSubskill = 0;
    let mappedDifficulty = 0;
    let ambiguous = 0;
    let unmapped = 0;

    for (const row of rows) {
        totalQuestions += 1;

        const explicitExists = Boolean(
            (row.subject && String(row.subject).trim()) ||
            (row.skill_code && String(row.skill_code).trim()) ||
            (row.subskill_code && String(row.subskill_code).trim()) ||
            row.difficulty !== null,
        );

        const inferred = inferMetadataFromTags(row.tags);
        const tags = inferred.tags;
        if (tags.length > 0) withTags += 1;

        const hasAnyMapping = inferred.hasAnyMapping;
        const hasWeakSignal = tags.length > 0 && !hasAnyMapping;

        if (inferred.subject) mappedSubject += 1;
        if (inferred.skillCode) mappedSkill += 1;
        if (inferred.subskillCode) mappedSubskill += 1;
        if (inferred.difficulty) mappedDifficulty += 1;

        if (inferred.ambiguous) ambiguous += 1;
        if (!hasAnyMapping) unmapped += 1;

        if (hasWeakSignal) {
            for (const tag of tags) {
                unresolvedTagCounts.set(tag, (unresolvedTagCounts.get(tag) || 0) + 1);
            }
        }

        if (!explicitExists && hasAnyMapping) {
            previewRows.push({
                id: row.id,
                question: String(row.question || '').slice(0, 90),
                tags: row.tags,
                subject: inferred.subject || '',
                skill_code: inferred.skillCode || '',
                subskill_code: inferred.subskillCode || '',
                difficulty: inferred.difficulty || '',
            });
        }
    }

    const topUnresolvedTags = [...unresolvedTagCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 10);

    const report = writeBackfillReport({
        modeLabel,
        reportType: 'preview',
        summary: {
            totalQuestions,
            withTags,
            mappedSubject,
            mappedSkill,
            mappedSubskill,
            mappedDifficulty,
            previewReadyRows: previewRows.length,
            ambiguous,
            unmapped,
            topUnresolvedTags: topUnresolvedTags.map(([tag, count]) => ({ tag: `#${tag}`, count })),
        },
        rows: previewRows,
    });

    console.log(`Metadata backfill preview (${modeLabel})`);

    printSection('Coverage summary');
    console.table([
        { metric: 'Total questions', count: totalQuestions, coverage: totalQuestions > 0 ? '100.0%' : '0.0%' },
        { metric: 'Questions with tags', count: withTags, coverage: percent(withTags, totalQuestions) },
        { metric: 'Preview subject inferred', count: mappedSubject, coverage: percent(mappedSubject, totalQuestions) },
        { metric: 'Preview skill inferred', count: mappedSkill, coverage: percent(mappedSkill, totalQuestions) },
        { metric: 'Preview subskill inferred', count: mappedSubskill, coverage: percent(mappedSubskill, totalQuestions) },
        { metric: 'Preview difficulty inferred', count: mappedDifficulty, coverage: percent(mappedDifficulty, totalQuestions) },
        { metric: 'Preview-ready rows (missing explicit + inferred)', count: previewRows.length, coverage: percent(previewRows.length, totalQuestions) },
        { metric: 'Unmapped rows', count: unmapped, coverage: percent(unmapped, totalQuestions) },
    ]);

    printSection('Sample preview rows');
    console.table(previewRows.slice(0, 15));

    printSection('Top unresolved tags');
    if (topUnresolvedTags.length === 0) {
        console.log('Khong co tag unresolved noi bat.');
    } else {
        console.table(topUnresolvedTags.map(([tag, count]) => ({ tag: `#${tag}`, count })));
    }

    printSection('Summary');
    console.log(
        [
            `Preview co the suy ra metadata cho ${previewRows.length}/${totalQuestions} cau hoi.`,
            `Ambiguous bucket hien tai: ${ambiguous}.`,
            `Report JSON: ${report.latestJsonPath}`,
            `Report CSV: ${report.latestCsvPath}`,
            unmapped > 0
                ? 'Can tiep tuc bo sung bang map tag -> taxonomy cho nhung tag unresolved pho bien.'
                : 'Question bank co the backfill duoc rat cao voi bang map hien tai.',
        ].join(' '),
    );
}

try {
    main();
} catch (error) {
    console.error('Metadata backfill preview failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
