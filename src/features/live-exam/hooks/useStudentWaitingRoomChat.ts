import { useCallback, useMemo, useState } from 'react';
import {
  getWaitingRoomChat,
  sendWaitingRoomMessage,
} from '../../../services/liveExamService';
import type {
  WaitingRoomChatMessage,
  WaitingRoomChatResponse,
} from '../../../types/liveExam.types';
import { usePollingQuery } from './usePollingQuery';

const CHAT_POLL_BASE_MS = 8_000;
const CHAT_POLL_JITTER_WINDOW_MS = 2_000;

interface UseStudentWaitingRoomChatOptions {
  sessionId: string;
  enabled?: boolean;
}

export function useStudentWaitingRoomChat({
  sessionId,
  enabled = true,
}: UseStudentWaitingRoomChatOptions) {
  const [pendingMessages, setPendingMessages] = useState<WaitingRoomChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const pollIntervalMs = useMemo(
    () => CHAT_POLL_BASE_MS + Math.round((Math.random() - 0.5) * CHAT_POLL_JITTER_WINDOW_MS),
    [sessionId],
  );
  const fetchChat = useCallback(
    () => getWaitingRoomChat(sessionId, false),
    [sessionId],
  );
  const { data, isLoading, error: pollError } = usePollingQuery<WaitingRoomChatResponse>({
    enabled: enabled && Boolean(sessionId),
    intervalMs: pollIntervalMs,
    fetcher: fetchChat,
    errorLabel: '[useStudentWaitingRoomChat] Error:',
    fallbackError: 'Không thể tải chat phòng chờ',
  });

  const messages = useMemo(() => {
    const serverMessages = data?.messages || [];
    if (pendingMessages.length === 0) return serverMessages;
    const serverIds = new Set(serverMessages.map((message) => message.id));
    return [
      ...serverMessages,
      ...pendingMessages.filter((message) => !serverIds.has(message.id)),
    ];
  }, [data?.messages, pendingMessages]);

  const sendMessage = useCallback(async (content: string) => {
    setIsSending(true);
    try {
      const message = await sendWaitingRoomMessage(sessionId, { content });
      setPendingMessages((current) => [...current, message]);
      setSendError(null);
      return message;
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Không thể gửi tin nhắn');
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [sessionId]);

  return {
    messages,
    chatEnabled: Boolean(data?.settings?.enabled ?? true),
    isLoading,
    isSending,
    error: sendError || pollError,
    sendMessage,
  };
}
