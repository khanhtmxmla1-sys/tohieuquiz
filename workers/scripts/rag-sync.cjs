#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { spawnSync } = require('child_process');

const WORKERS_DIR = process.cwd();
const REPO_ROOT = path.resolve(WORKERS_DIR, '..');
const DOCS_DIR = path.join(REPO_ROOT, 'docs');
const README_FILE = path.join(REPO_ROOT, 'README.md');
const DB_NAME = 'tohieuquiz-db';
const MAX_CHARS_PER_CHUNK = 1200;
const OVERLAP_CHARS = 180;

const argv = process.argv.slice(2);
const isRemote = argv.includes('--remote');
const dryRun = argv.includes('--dry-run');

function sha1(input) {
    return crypto.createHash('sha1').update(input).digest('hex');
}

function sqlString(value) {
    return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function collectMarkdownFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectMarkdownFiles(full));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
            files.push(full);
        }
    }
    return files;
}

function cleanContent(raw) {
    return String(raw || '')
        .replace(/\r\n/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function splitBySection(content) {
    const lines = content.split('\n');
    const sections = [];
    let currentTitle = 'General';
    let buffer = [];

    const flush = () => {
        const text = buffer.join('\n').trim();
        if (text) sections.push({ sectionTitle: currentTitle, text });
        buffer = [];
    };

    for (const line of lines) {
        const heading = line.match(/^\s{0,3}#{1,3}\s+(.+)$/);
        if (heading) {
            flush();
            currentTitle = heading[1].trim();
            continue;
        }
        buffer.push(line);
    }
    flush();
    return sections;
}

function chunkSectionText(sectionText) {
    const chunks = [];
    let cursor = 0;
    const text = sectionText.trim();
    const step = Math.max(300, MAX_CHARS_PER_CHUNK - OVERLAP_CHARS);
    while (cursor < text.length) {
        const slice = text.slice(cursor, cursor + MAX_CHARS_PER_CHUNK).trim();
        if (slice) chunks.push(slice);
        if (cursor + MAX_CHARS_PER_CHUNK >= text.length) break;
        cursor += step;
    }
    return chunks;
}

function readDocuments() {
    const files = [];
    if (fs.existsSync(README_FILE)) files.push(README_FILE);
    files.push(...collectMarkdownFiles(DOCS_DIR));

    return files.map((fullPath) => {
        const relativePath = path.relative(REPO_ROOT, fullPath).replace(/\\/g, '/');
        const raw = fs.readFileSync(fullPath, 'utf8');
        const content = cleanContent(raw);
        const checksum = sha1(content);
        const titleMatch = content.match(/^\s*#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : path.basename(fullPath, '.md');

        const sections = splitBySection(content);
        const chunks = [];
        let chunkIndex = 0;
        for (const section of sections) {
            const sectionChunks = chunkSectionText(section.text);
            for (const chunkText of sectionChunks) {
                const chunkId = `ragc_${sha1(`${relativePath}:${chunkIndex}:${chunkText}`).slice(0, 16)}`;
                chunks.push({
                    id: chunkId,
                    chunkIndex,
                    sectionTitle: section.sectionTitle,
                    content: chunkText,
                    tokenEstimate: Math.max(1, Math.ceil(chunkText.length / 4)),
                });
                chunkIndex += 1;
            }
        }

        return {
            id: `ragd_${sha1(relativePath).slice(0, 16)}`,
            sourcePath: relativePath,
            title,
            checksum,
            chunks,
        };
    });
}

function buildSql(documents) {
    const now = new Date().toISOString();
    const docIds = documents.map((d) => sqlString(d.id));

    const lines = [];
    lines.push(`
CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY,
  source_path TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  checksum TEXT NOT NULL,
  chunk_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`);
    lines.push(`
CREATE TABLE IF NOT EXISTS rag_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  section_title TEXT DEFAULT '',
  content TEXT NOT NULL,
  token_estimate INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`);
    lines.push(`
CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
  chunk_id UNINDEXED,
  source_path,
  title,
  section_title,
  content,
  tokenize = 'unicode61'
);`);

    for (const doc of documents) {
        lines.push(`DELETE FROM rag_chunks_fts WHERE source_path = ${sqlString(doc.sourcePath)};`);
        lines.push(`DELETE FROM rag_chunks WHERE document_id = ${sqlString(doc.id)};`);
        lines.push(`
INSERT INTO rag_documents (id, source_path, title, checksum, chunk_count, created_at, updated_at)
VALUES (
  ${sqlString(doc.id)},
  ${sqlString(doc.sourcePath)},
  ${sqlString(doc.title)},
  ${sqlString(doc.checksum)},
  ${doc.chunks.length},
  COALESCE((SELECT created_at FROM rag_documents WHERE id = ${sqlString(doc.id)}), ${sqlString(now)}),
  ${sqlString(now)}
)
ON CONFLICT(id) DO UPDATE SET
  source_path = excluded.source_path,
  title = excluded.title,
  checksum = excluded.checksum,
  chunk_count = excluded.chunk_count,
  updated_at = excluded.updated_at;`);

        for (const chunk of doc.chunks) {
            lines.push(`
INSERT INTO rag_chunks (id, document_id, chunk_index, section_title, content, token_estimate, created_at, updated_at)
VALUES (
  ${sqlString(chunk.id)},
  ${sqlString(doc.id)},
  ${chunk.chunkIndex},
  ${sqlString(chunk.sectionTitle)},
  ${sqlString(chunk.content)},
  ${chunk.tokenEstimate},
  ${sqlString(now)},
  ${sqlString(now)}
);`);
            lines.push(`
INSERT INTO rag_chunks_fts (chunk_id, source_path, title, section_title, content)
VALUES (
  ${sqlString(chunk.id)},
  ${sqlString(doc.sourcePath)},
  ${sqlString(doc.title)},
  ${sqlString(chunk.sectionTitle)},
  ${sqlString(chunk.content)}
);`);
        }
    }

    if (docIds.length > 0) {
        lines.push(`DELETE FROM rag_chunks WHERE document_id NOT IN (${docIds.join(', ')});`);
        lines.push(`DELETE FROM rag_documents WHERE id NOT IN (${docIds.join(', ')});`);
    }

    return lines.join('\n');
}

function main() {
    const documents = readDocuments();
    if (documents.length === 0) {
        console.error('No markdown sources found (docs/**/*.md, README.md).');
        process.exit(1);
    }

    const totalChunks = documents.reduce((sum, doc) => sum + doc.chunks.length, 0);
    console.log(`rag-sync: Loaded ${documents.length} docs, ${totalChunks} chunks.`);

    const sql = buildSql(documents);
    const tmpDir = path.join(os.tmpdir(), 'tohieuquiz-rag-sync');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const sqlFile = path.join(tmpDir, `rag-sync-${Date.now()}.sql`);
    fs.writeFileSync(sqlFile, sql, 'utf8');

    if (dryRun) {
        console.log(`rag-sync: SQL written: ${sqlFile}`);
        return;
    }

    const args = ['wrangler', 'd1', 'execute', DB_NAME, '--file', sqlFile];
    if (isRemote) args.push('--remote');

    console.log(`rag-sync: Executing on ${isRemote ? 'remote' : 'local'} D1: ${DB_NAME}`);
    const result = spawnSync('npx', args, {
        cwd: WORKERS_DIR,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
    console.log('rag-sync: Done.');
}

main();
