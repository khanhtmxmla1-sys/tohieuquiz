import { callApi } from './apiAdapter';

const CHAT_SESSION_STORAGE_KEY = 'tohieuquiz_rag_session_id';

export interface ChatSource {
    title: string;
    sourcePath: string;
    snippet: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    sources?: ChatSource[];
    confidence?: number;
    fallbackReason?: 'NO_MATCH' | 'LOW_CONFIDENCE';
}

export interface ChatResponse {
    answer: string;
    confidence: number;
    sources?: ChatSource[];
    fallbackReason?: 'NO_MATCH' | 'LOW_CONFIDENCE';
}

type HelpRagApiResponse = {
    status?: string;
    data?: {
        answer?: string;
        confidence?: number;
        sources?: ChatSource[];
        fallbackReason?: 'NO_MATCH' | 'LOW_CONFIDENCE';
    };
    message?: string;
};

const generateSessionId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `rag-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getOrCreateSessionId = (): string => {
    try {
        const existing = localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
        if (existing && existing.trim()) return existing.trim();
        const next = generateSessionId();
        localStorage.setItem(CHAT_SESSION_STORAGE_KEY, next);
        return next;
    } catch {
        return generateSessionId();
    }
};

const stripBoldMarkers = (value: string): string => {
    return String(value || '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*\*/g, '')
        .trim();
};

export async function generateChatResponse(
    query: string,
    _history: ChatMessage[],
    options: { includeSources?: boolean } = {}
): Promise<ChatResponse> {
    const includeSources = Boolean(options.includeSources);
    const sessionId = getOrCreateSessionId();

    const response = await callApi<HelpRagApiResponse>('ask_help_rag', {
        question: query,
        sessionId,
        includeSources,
    });

    if (response?.status !== 'success' || !response.data?.answer) {
        throw new Error(response?.message || 'RAG service unavailable');
    }

    return {
        answer: stripBoldMarkers(String(response.data.answer || '')),
        confidence: Number(response.data.confidence || 0),
        sources: Array.isArray(response.data.sources) ? response.data.sources : undefined,
        fallbackReason: response.data.fallbackReason,
    };
}
