import { Env } from '../types';
import { parseBody, hashSHA256 } from '../utils/helpers';
import { errorResponse, jsonResponse } from '../utils/response';
import { verifyJWTMiddleware } from '../middleware/jwtAuth';

const MAX_RETRIEVAL = 6;
const MIN_CONFIDENCE = 0.45;

const OUT_OF_SCOPE_FALLBACK =
    'Mình chưa có đủ dữ liệu để trả lời chính xác câu này trong phạm vi hướng dẫn hệ thống. Bạn vui lòng liên hệ quản trị viên để được hỗ trợ thêm.';

const RAG_SYSTEM_PROMPT = `
Bạn là trợ lý hỗ trợ sử dụng hệ thống TôHiệuQuiz.
Chỉ được trả lời dựa trên ngữ cảnh được cung cấp.
Nếu ngữ cảnh chưa đủ, phải trả lời ngắn gọn rằng chưa có đủ thông tin và gợi ý liên hệ quản trị viên.
Trả lời bằng tiếng Việt, rõ ràng, từng bước khi phù hợp.
Không bịa thông tin ngoài ngữ cảnh.
`;

type RetrievalRow = {
    chunk_id: string;
    source_path: string;
    title: string;
    section_title: string;
    content: string;
    rank?: number;
};

type RagSource = {
    title: string;
    sourcePath: string;
    snippet: string;
};

const toWords = (value: string): string[] => {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2);
};

const buildFtsQuery = (question: string): string => {
    const words = Array.from(new Set(toWords(question))).slice(0, 10);
    if (words.length === 0) return '';
    return words.map((w) => `${w}*`).join(' OR ');
};

const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};

const estimateConfidence = (rows: RetrievalRow[]): number => {
    if (!rows.length) return 0;
    const uniqueSources = new Set(rows.map((r) => r.source_path)).size;
    const coverageScore = clamp(rows.length / MAX_RETRIEVAL, 0, 1);
    const diversityScore = clamp(uniqueSources / 3, 0, 1);
    return clamp(0.25 + coverageScore * 0.45 + diversityScore * 0.3, 0, 0.95);
};

const toSnippet = (text: string, max = 220): string => {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= max) return normalized;
    return `${normalized.slice(0, max - 3)}...`;
};

const buildSources = (rows: RetrievalRow[]): RagSource[] => {
    const seen = new Set<string>();
    const sources: RagSource[] = [];
    for (const row of rows) {
        const key = `${row.source_path}::${row.section_title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        sources.push({
            title: row.section_title ? `${row.title} - ${row.section_title}` : row.title,
            sourcePath: row.source_path,
            snippet: toSnippet(row.content),
        });
        if (sources.length >= 4) break;
    }
    return sources;
};

const buildContext = (rows: RetrievalRow[]): string => {
    return rows
        .map((row, idx) => {
            const header = `#${idx + 1} | ${row.title}${row.section_title ? ` > ${row.section_title}` : ''} | ${row.source_path}`;
            return `${header}\n${row.content}`;
        })
        .join('\n\n');
};

const queryRagChunks = async (db: D1Database, question: string, limit: number): Promise<RetrievalRow[]> => {
    const ftsQuery = buildFtsQuery(question);
    if (ftsQuery) {
        try {
            const ftsRows = await db.prepare(`
                SELECT chunk_id, source_path, title, section_title, content, bm25(rag_chunks_fts) AS rank
                FROM rag_chunks_fts
                WHERE rag_chunks_fts MATCH ?
                ORDER BY rank ASC
                LIMIT ?
            `).bind(ftsQuery, limit).all<RetrievalRow>();

            if (ftsRows.results.length > 0) return ftsRows.results;
        } catch (err) {
            console.warn('[RAG] FTS query failed, fallback to LIKE:', err);
        }
    }

    const fallbackLike = `%${String(question || '').trim().slice(0, 80)}%`;
    const fallbackRows = await db.prepare(`
        SELECT
            c.id AS chunk_id,
            d.source_path AS source_path,
            d.title AS title,
            c.section_title AS section_title,
            c.content AS content
        FROM rag_chunks c
        JOIN rag_documents d ON d.id = c.document_id
        WHERE c.content LIKE ?
        ORDER BY c.updated_at DESC
        LIMIT ?
    `).bind(fallbackLike, limit).all<RetrievalRow>();

    return fallbackRows.results;
};

const ensureRagTables = async (db: D1Database): Promise<void> => {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS rag_documents (
          id TEXT PRIMARY KEY,
          source_path TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          checksum TEXT NOT NULL,
          chunk_count INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS rag_chunks (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          section_title TEXT DEFAULT '',
          content TEXT NOT NULL,
          token_estimate INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
    `).run();

    await db.prepare(`
        CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
          chunk_id UNINDEXED,
          source_path,
          title,
          section_title,
          content,
          tokenize = 'unicode61'
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS rag_query_logs (
          id TEXT PRIMARY KEY,
          session_hash TEXT DEFAULT '',
          question TEXT NOT NULL,
          top_k INTEGER DEFAULT 6,
          retrieved_count INTEGER DEFAULT 0,
          confidence REAL DEFAULT 0,
          fallback_reason TEXT DEFAULT '',
          include_sources INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        )
    `).run();
};

const logQuery = async (
    db: D1Database,
    sessionHash: string,
    question: string,
    retrievedCount: number,
    confidence: number,
    fallbackReason: string,
    includeSources: boolean
): Promise<void> => {
    const logId = `raglog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await db.prepare(`
        INSERT INTO rag_query_logs (
            id, session_hash, question, top_k, retrieved_count, confidence, fallback_reason, include_sources, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        logId,
        sessionHash,
        question,
        MAX_RETRIEVAL,
        retrievedCount,
        confidence,
        fallbackReason,
        includeSources ? 1 : 0,
        new Date().toISOString()
    ).run();
};

export async function handleHelpRagRoutes(request: Request, env: Env, path: string, method: string): Promise<Response | null> {
    if (path !== '/api/help/ask' || method !== 'POST') return null;

    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;

    if (!env.CLIPROXY_API || !env.CLIPROXY_TOKEN) {
        return errorResponse('RAG service is not configured (missing CLIPROXY_API or CLIPROXY_TOKEN)', 500);
    }

    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');

    const question = String(body.question || '').trim();
    const sessionId = String(body.sessionId || '').trim();
    const includeSources = Boolean(body.includeSources);
    if (!question) return errorResponse('Missing question');

    const db = env.DB;
    await ensureRagTables(db);

    const rows = await queryRagChunks(db, question, MAX_RETRIEVAL);
    const confidence = estimateConfidence(rows);
    const hasEnoughContext = rows.length >= 2 || (rows.length === 1 && rows[0].content.length >= 280);
    let fallbackReason = '';

    if (!rows.length) fallbackReason = 'NO_MATCH';
    else if (!hasEnoughContext || confidence < MIN_CONFIDENCE) fallbackReason = 'LOW_CONFIDENCE';

    const sessionHash = sessionId ? await hashSHA256(`rag:${sessionId}`) : '';

    if (fallbackReason) {
        try {
            await logQuery(db, sessionHash, question, rows.length, confidence, fallbackReason, includeSources);
        } catch (err) {
            console.warn('[RAG] log insert failed:', err);
        }

        return jsonResponse({
            status: 'success',
            data: {
                answer: OUT_OF_SCOPE_FALLBACK,
                confidence,
                fallbackReason,
                ...(includeSources ? { sources: buildSources(rows) } : {}),
            },
        });
    }

    const contextText = buildContext(rows);
    const userPrompt = `Câu hỏi người dùng:\n${question}\n\nNgữ cảnh tài liệu:\n${contextText}`;

    const aiResponse = await fetch(`${env.CLIPROXY_API}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.CLIPROXY_TOKEN}`,
        },
        body: JSON.stringify({
            model: 'gemini-2.0-flash',
            messages: [
                { role: 'system', content: RAG_SYSTEM_PROMPT.trim() },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
            max_tokens: 900,
        }),
    });

    if (!aiResponse.ok) {
        const errText = await aiResponse.text().catch(() => '');
        console.error('[RAG] upstream error:', aiResponse.status, errText);
        return errorResponse(`AI service temporarily unavailable (${aiResponse.status})`, 503);
    }

    const aiData = await aiResponse.json() as any;
    const answer = String(aiData?.choices?.[0]?.message?.content || '').trim();
    if (!answer) {
        return errorResponse('Empty response from upstream AI service', 503);
    }

    try {
        await logQuery(db, sessionHash, question, rows.length, confidence, '', includeSources);
    } catch (err) {
        console.warn('[RAG] log insert failed:', err);
    }

    return jsonResponse({
        status: 'success',
        data: {
            answer,
            confidence,
            ...(includeSources ? { sources: buildSources(rows) } : {}),
        },
    });
}
