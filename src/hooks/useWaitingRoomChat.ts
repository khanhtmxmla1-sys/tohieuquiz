import { useCallback, useEffect, useRef, useState } from 'react';
import type { WaitingRoomChatMessage } from '../types/liveExam.types';
import {
    getWaitingRoomChat,
    hideWaitingRoomChatMessage,
    sendWaitingRoomAnnouncement,
    sendWaitingRoomMessage,
    updateWaitingRoomChatSettings,
} from '../services/liveExamService';

const CHAT_POLL_INTERVAL = 3000;

interface UseWaitingRoomChatOptions {
    sessionId: string;
    enabled?: boolean;
    asTeacher?: boolean;
}

export function useWaitingRoomChat({
    sessionId,
    enabled = true,
    asTeacher = false,
}: UseWaitingRoomChatOptions) {
    const [messages, setMessages] = useState<WaitingRoomChatMessage[]>([]);
    const [chatEnabled, setChatEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    const refresh = useCallback(async () => {
        if (!sessionId) return;
        try {
            const data = await getWaitingRoomChat(sessionId, asTeacher);
            if (!mountedRef.current) return;
            setMessages(data.messages || []);
            setChatEnabled(Boolean(data.settings?.enabled));
            setError(null);
            setIsLoading(false);
        } catch (err: any) {
            if (!mountedRef.current) return;
            setError(err?.message || 'Không thể tải chat phòng chờ');
            setIsLoading(false);
        }
    }, [sessionId, asTeacher]);

    useEffect(() => {
        mountedRef.current = true;
        if (!enabled || !sessionId) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            return;
        }

        void refresh();
        intervalRef.current = setInterval(() => {
            void refresh();
        }, CHAT_POLL_INTERVAL);

        return () => {
            mountedRef.current = false;
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
        };
    }, [enabled, sessionId, refresh]);

    const sendMessage = useCallback(async (content: string) => {
        setIsSending(true);
        try {
            const message = asTeacher
                ? await sendWaitingRoomAnnouncement(sessionId, { content })
                : await sendWaitingRoomMessage(sessionId, { content });
            if (mountedRef.current) {
                setMessages((prev) => [...prev, message]);
                setError(null);
            }
            return message;
        } finally {
            if (mountedRef.current) setIsSending(false);
        }
    }, [asTeacher, sessionId]);

    const toggleChat = useCallback(async (nextEnabled: boolean) => {
        await updateWaitingRoomChatSettings(sessionId, { enabled: nextEnabled });
        if (mountedRef.current) setChatEnabled(nextEnabled);
    }, [sessionId]);

    const hideMessage = useCallback(async (messageId: string) => {
        await hideWaitingRoomChatMessage(sessionId, messageId);
        if (mountedRef.current) {
            setMessages((prev) => prev.filter((item) => item.id !== messageId));
        }
    }, [sessionId]);

    return {
        messages,
        chatEnabled,
        isLoading,
        isSending,
        error,
        refresh,
        sendMessage,
        toggleChat,
        hideMessage,
    };
}