import type { D1Database } from '@cloudflare/workers-types';
import type { WaitingRoomChatMessage } from '../../../../src/types/liveExam.types';
import type { WaitingRoomChatMessageParams } from './types';
import { generateId, now } from './utils';

export async function getWaitingRoomChat(
  db: D1Database,
  sessionId: string,
  includeHidden = false,
): Promise<{ messages: WaitingRoomChatMessage[]; enabled: boolean }> {
  const sessionRow = await db
    .prepare('SELECT chat_enabled FROM live_exam_sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ chat_enabled: number }>();

  const messagesQuery = includeHidden
    ? 'SELECT * FROM live_exam_chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 50'
    : 'SELECT * FROM live_exam_chat_messages WHERE session_id = ? AND is_hidden = 0 ORDER BY created_at DESC LIMIT 50';
  const rows = await db.prepare(messagesQuery).bind(sessionId).all<any>();

  return {
    enabled: Boolean(sessionRow?.chat_enabled ?? 1),
    messages: (rows.results || []).reverse().map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      senderRole: row.sender_role,
      senderId: row.sender_id,
      senderName: row.sender_name,
      content: row.content,
      kind: row.message_kind,
      isHidden: Boolean(row.is_hidden),
      createdAt: row.created_at,
    })),
  };
}

export async function createWaitingRoomChatMessage(
  db: D1Database,
  params: WaitingRoomChatMessageParams,
): Promise<WaitingRoomChatMessage> {
  const id = generateId();
  const createdAt = now();
  const kind = params.kind || 'message';

  await db.prepare(`
    INSERT INTO live_exam_chat_messages
      (id, session_id, sender_role, sender_id, sender_name, content, message_kind, is_hidden, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).bind(
    id,
    params.sessionId,
    params.senderRole,
    params.senderId,
    params.senderName,
    params.content,
    kind,
    createdAt,
  ).run();

  return {
    id,
    sessionId: params.sessionId,
    senderRole: params.senderRole,
    senderId: params.senderId,
    senderName: params.senderName,
    content: params.content,
    kind,
    isHidden: false,
    createdAt,
  };
}

export async function updateWaitingRoomChatEnabled(
  db: D1Database,
  sessionId: string,
  enabled: boolean,
): Promise<void> {
  await db.prepare(
    'UPDATE live_exam_sessions SET chat_enabled = ?, updated_at = ? WHERE id = ?',
  ).bind(enabled ? 1 : 0, now(), sessionId).run();
}

export async function hideWaitingRoomChatMessage(
  db: D1Database,
  sessionId: string,
  messageId: string,
): Promise<void> {
  await db.prepare(
    'UPDATE live_exam_chat_messages SET is_hidden = 1 WHERE id = ? AND session_id = ?',
  ).bind(messageId, sessionId).run();
}
