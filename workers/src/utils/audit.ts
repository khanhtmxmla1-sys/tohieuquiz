export interface AuditEntry {
    actorUsername: string;
    action: string;
    targetType: string;
    targetId: string;
    requestId: string;
    before?: unknown;
    after?: unknown;
}

const REDACTED_KEYS = new Set(['password', 'token', 'password_hash', 'authorization']);

function redact(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(redact);
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(item),
    ]));
}

export function auditStatement(db: D1Database, entry: AuditEntry): D1PreparedStatement {
    return db.prepare(`
        INSERT INTO admin_audit_logs
        (id, actor_username, action, target_type, target_id, request_id, before_json, after_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        `audit-${crypto.randomUUID()}`,
        entry.actorUsername,
        entry.action,
        entry.targetType,
        entry.targetId,
        entry.requestId,
        entry.before === undefined ? null : JSON.stringify(redact(entry.before)),
        entry.after === undefined ? null : JSON.stringify(redact(entry.after)),
        new Date().toISOString(),
    );
}

export async function writeAuditLog(db: D1Database, entry: AuditEntry): Promise<void> {
    await auditStatement(db, entry).run();
}
