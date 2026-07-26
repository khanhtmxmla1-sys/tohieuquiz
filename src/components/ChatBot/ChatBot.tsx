import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, MessageCircle, Send, Trash2, User, X } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import ExplanationContent from '../common/ExplanationContent';
import NewlineMathText from '../common/NewlineMathText';

const ChatBot: React.FC = () => {
    const { isOpen, messages, isLoading, toggleChat, sendMessage, clearHistory } = useChatStore();

    const [input, setInput] = useState('');
    const [includeSourcesRequested, setIncludeSourcesRequested] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) inputRef.current.focus();
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        setInput('');
        await sendMessage(trimmed, { includeSources: includeSourcesRequested });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <>
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleChat}
                        className="chatbot-fab"
                        aria-label="Mở trợ lý AI"
                    >
                        <MessageCircle size={28} />
                        <span className="chatbot-fab-badge">?</span>
                    </motion.button>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="chatbot-window"
                    >
                        <div className="chatbot-header">
                            <div className="chatbot-header-info">
                                <Bot size={24} className="chatbot-header-icon" />
                                <div>
                                    <h3 className="chatbot-header-title">Trợ Lý AI</h3>
                                    <span className="chatbot-header-subtitle">Hướng dẫn sử dụng</span>
                                </div>
                            </div>
                            <div className="chatbot-header-actions">
                                <button
                                    onClick={clearHistory}
                                    className="chatbot-action-btn"
                                    title="Xóa lịch sử"
                                    disabled={messages.length === 0}
                                >
                                    <Trash2 size={18} />
                                </button>
                                <button onClick={toggleChat} className="chatbot-action-btn chatbot-close-btn" title="Đóng">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="chatbot-messages">
                            {messages.length === 0 && (
                                <div className="chatbot-welcome">
                                    <Bot size={48} className="chatbot-welcome-icon" />
                                    <h4>Xin chào!</h4>
                                    <p>Tôi là trợ lý AI, sẵn sàng giúp bạn sử dụng hệ thống <span style={{ color: '#1e3a8a', fontWeight: 'bold' }}>ítong</span><span style={{ color: '#FACC15', fontWeight: 'bold' }}>Quiz</span>.</p>
                                    <div className="chatbot-suggestions">
                                        <span className="chatbot-suggestion-label">Gợi ý:</span>
                                        {[
                                            'Cách tạo đề bằng AI?',
                                            'Hướng dẫn làm bài quiz',
                                            'Cách phân quyền giáo viên',
                                        ].map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                onClick={() => sendMessage(suggestion, { includeSources: false })}
                                                className="chatbot-suggestion-btn"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`chatbot-message ${msg.role === 'user' ? 'user' : 'assistant'}`}
                                >
                                    <div className="chatbot-message-avatar">
                                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                    </div>
                                    <div className="chatbot-message-content">
                                        {msg.role === 'assistant' ? (
                                            <ExplanationContent content={msg.content} />
                                        ) : (
                                            <NewlineMathText content={msg.content} as="p" />
                                        )}
                                        {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                                            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                                                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Nguồn tham khảo</p>
                                                <ul className="space-y-1">
                                                    {msg.sources.map((source, sourceIdx) => (
                                                        <li key={`${source.sourcePath}-${sourceIdx}`} className="text-xs leading-snug text-slate-700">
                                                            <p className="font-semibold">{source.title}</p>
                                                            <p className="text-slate-500">{source.sourcePath}</p>
                                                            <NewlineMathText content={source.snippet} as="p" />
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {isLoading && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="chatbot-message assistant">
                                    <div className="chatbot-message-avatar">
                                        <Bot size={16} />
                                    </div>
                                    <div className="chatbot-message-content chatbot-typing">
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Đang suy nghĩ...</span>
                                    </div>
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSubmit} className="chatbot-input-form flex-col">
                            <label className="mb-1 flex items-center gap-2 text-xs text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={includeSourcesRequested}
                                    onChange={(e) => setIncludeSourcesRequested(e.target.checked)}
                                    disabled={isLoading}
                                />
                                Kèm nguồn tham khảo
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Nhập câu hỏi của bạn..."
                                    className="chatbot-input"
                                    disabled={isLoading}
                                />
                                <button type="submit" className="chatbot-send-btn" disabled={!input.trim() || isLoading}>
                                    <Send size={20} />
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default ChatBot;
