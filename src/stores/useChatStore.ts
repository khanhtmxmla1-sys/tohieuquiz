/**
 * useChatStore.ts - Zustand store quản lý trạng thái Chatbot.
 */

import { create } from 'zustand';
import { generateChatResponse, ChatMessage } from '../services/aiChatService';

interface ChatState {
    isOpen: boolean;
    messages: ChatMessage[];
    isLoading: boolean;
    error: string | null;

    // Actions
    toggleChat: () => void;
    openChat: () => void;
    closeChat: () => void;
    sendMessage: (content: string, options?: { includeSources?: boolean }) => Promise<void>;
    clearHistory: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    isOpen: false,
    messages: [],
    isLoading: false,
    error: null,

    toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),

    openChat: () => set({ isOpen: true }),

    closeChat: () => set({ isOpen: false }),

    sendMessage: async (content: string, options = {}) => {
        const userMessage: ChatMessage = { role: 'user', content };

        // Add user message immediately
        set((state) => ({
            messages: [...state.messages, userMessage],
            isLoading: true,
            error: null,
        }));

        try {
            const history = get().messages;
            const response = await generateChatResponse(content, history.slice(0, -1), options); // Exclude the just-added message

            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: response.answer,
                sources: response.sources,
                confidence: response.confidence,
                fallbackReason: response.fallbackReason,
            };

            set((state) => ({
                messages: [...state.messages, assistantMessage],
                isLoading: false,
            }));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Đã có lỗi xảy ra';
            set({
                isLoading: false,
                error: errorMessage,
            });

            // Add error message as assistant response
            const errorAssistant: ChatMessage = {
                role: 'assistant',
                content: `⚠️ ${errorMessage}. Vui lòng thử lại sau.`,
            };
            set((state) => ({
                messages: [...state.messages, errorAssistant],
            }));
        }
    },

    clearHistory: () =>
        set({
            messages: [],
            error: null,
        }),
}));
