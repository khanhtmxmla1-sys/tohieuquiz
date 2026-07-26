const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inferMetadataFromTags } = require('./question-metadata-backfill-map.v1.cjs');
const { writeBackfillReport } = require('./metadata-backfill-report-utils.cjs');

const cwd = path.resolve(__dirname, '..');
const dbName = 'tohieuquiz-db';
const isRemote = process.argv.includes('--remote');
const modeFlag = isRemote ? '--remote' : '--local';
const modeLabel = isRemote ? 'REMOTE' : 'LOCAL';
const shouldWrite = process.argv.includes('--write');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) || 0 : 0;

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

function runWranglerSqlFile(sql) {
    const tempFile = path.join(os.tmpdir(), `metadata-backfill-${Date.now()}.sql`);
    fs.writeFileSync(tempFile, sql, 'utf8');

    try {
        const command = `npx wrangler d1 execute ${dbName} --file "${tempFile}" ${modeFlag}`;
        return execSync(command, {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    } finally {
        fs.rmSync(tempFile, { force: true });
    }
}

function escapeSqlString(value) {
    return String(value).replace(/'/g, "''");
}

function printSection(title) {
    console.log(`\n=== ${title} ===`);
}

function buildUpdateStatement(row) {
    const updates = [];

    if (row.subject) {
        updates.push(`subject = '${escapeSqlString(row.subject)}'`);
    }
    if (row.skill_code) {
        updates.push(`skill_code = '${escapeSqlString(row.skill_code)}'`);
    }
    if (row.subskill_code) {
        updates.push(`subskill_code = '${escapeSqlString(row.subskill_code)}'`);
    }
    if (row.difficulty) {
        updates.push(`difficulty = ${Number(row.difficulty)}`);
    }

    if (updates.length === 0) return null;

    return `UPDATE questions SET ${updates.join(', ')} WHERE id = '${escapeSqlString(row.id)}';`;
}

function main() {
    const result = runWranglerQuery(`
        SELECT id, question, tags, subject, skill_code, subskill_code, difficulty
        FROM questions
        ORDER BY id;
    `);

    const rows = result[0]?.results || [];
    const candidates = [];

    for (const row of rows) {
        const explicitExists = Boolean(
            (row.subject && String(row.subject).trim()) ||
            (row.skill_code && String(row.skill_code).trim()) ||
            (row.subskill_code && String(row.subskill_code).trim()) ||
            row.difficulty !== null,
        );

        if (explicitExists) continue;

        const inferred = inferMetadataFromTags(row.tags);
        if (!inferred.subject || !inferred.skillCode || inferred.ambiguous) {
            continue;
        }

        candidates.push({
            id: row.id,
            question: String(row.question || '').slice(0, 90),
            tags: row.tags,
            subject: inferred.subject,
            skill_code: inferred.skillCode,
            subskill_code: inferred.subskillCode || '',
            difficulty: inferred.difficulty || '',
        });
    }

    const finalCandidates = limit > 0 ? candidates.slice(0, limit) : candidates;
    const report = writeBackfillReport({
        modeLabel,
        reportType: shouldWrite ? 'apply' : 'dry-run',
        summary: {
            writeEnabled: shouldWrite,
            limit: limit > 0 ? limit : 'all',
            candidateRows: finalCandidates.length,
        },
        rows: finalCandidates,
    });

    console.log(`Metadata backfill apply (${modeLabel})`);
    printSection('Run mode');
    console.table([
        { key: 'mode', value: modeLabel },
        { key: 'write_enabled', value: shouldWrite ? 'yes' : 'no (dry-run)' },
        { key: 'limit', value: limit > 0 ? limit : 'all preview-safe rows' },
        { key: 'candidate_rows', value: finalCandidates.length },
    ]);

    printSection('Sample rows to update');
    console.table(finalCandidates.slice(0, 15));

    if (!shouldWrite) {
        printSection('Next step');
        console.log(
            [
                'Dry-run xong. Neu muon ghi DB, chay lai voi --write hoac dung npm script apply tuong ung.',
                `Report JSON: ${report.latestJsonPath}`,
                `Report CSV: ${report.latestCsvPath}`,
            ].join(' '),
        );
        return;
    }

    const updateStatements = finalCandidates
        .map(buildUpdateStatement)
        .filter(Boolean);

    if (updateStatements.length === 0) {
        printSection('Result');
        console.log('Khong co row nao du dieu kien de apply.');
        return;
    }

    const sql = updateStatements.join('\n');

    const output = runWranglerSqlFile(sql);
    printSection('Apply result');
    console.log(output.trim());
    printSection('Report files');
    console.log(`Report JSON: ${report.latestJsonPath}`);
    console.log(`Report CSV: ${report.latestCsvPath}`);
  }

try {
    main();
} catch (error) {
    console.error('Metadata backfill apply failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
