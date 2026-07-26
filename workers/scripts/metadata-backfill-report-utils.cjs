const fs = require('node:fs');
const path = require('node:path');

const reportsRoot = path.resolve(__dirname, '..', 'reports', 'metadata-backfill');

function ensureReportsDir() {
    fs.mkdirSync(reportsRoot, { recursive: true });
    return reportsRoot;
}

function formatTimestamp(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function csvEscape(value) {
    const normalized = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(normalized)) {
        return `"${normalized.replace(/"/g, '""')}"`;
    }
    return normalized;
}

function toCsv(rows, columns) {
    const header = columns.join(',');
    const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','));
    return [header, ...body].join('\n');
}

function writeBackfillReport({ modeLabel, reportType, summary, rows }) {
    ensureReportsDir();

    const timestamp = formatTimestamp();
    const fileBase = `${modeLabel.toLowerCase()}-${reportType}-${timestamp}`;
    const latestBase = `${modeLabel.toLowerCase()}-${reportType}-latest`;
    const jsonPath = path.join(reportsRoot, `${fileBase}.json`);
    const csvPath = path.join(reportsRoot, `${fileBase}.csv`);
    const latestJsonPath = path.join(reportsRoot, `${latestBase}.json`);
    const latestCsvPath = path.join(reportsRoot, `${latestBase}.csv`);

    const payload = {
        generatedAt: new Date().toISOString(),
        mode: modeLabel,
        reportType,
        summary,
        rows,
    };

    const columns = rows.length > 0
        ? Array.from(
            rows.reduce((set, row) => {
                Object.keys(row).forEach((key) => set.add(key));
                return set;
            }, new Set()),
        )
        : ['id', 'question', 'tags', 'subject', 'skill_code', 'subskill_code', 'difficulty'];

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.writeFileSync(latestJsonPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.writeFileSync(csvPath, toCsv(rows, columns), 'utf8');
    fs.writeFileSync(latestCsvPath, toCsv(rows, columns), 'utf8');

    return {
        jsonPath,
        csvPath,
        latestJsonPath,
        latestCsvPath,
        rowCount: rows.length,
    };
}

module.exports = {
    writeBackfillReport,
};
