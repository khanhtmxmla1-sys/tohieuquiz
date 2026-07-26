import React, { useMemo, useState } from 'react';
import { Loader2, MessageCircle, Send, ShieldAlert } from 'lucide-react';
import type { WaitingRoomChatMessage } from '../../types/liveExam.types';
import NewlineMathText from '../common/NewlineMathText';

interface WaitingRoomChatPanelProps {
    messages: WaitingRoomChatMessage[];
    chatEnabled: boolean;
    isLoading?: boolean;
    isSending?: boolean;
    currentUsername?: string;
    onSendMessage: (content: string) => Promise<void>;
}

export const WaitingRoomChatPanel: React.FC<WaitingRoomChatPanelProps> = ({
    messages,
    chatEnabled,
    isLoading = false,
    isSending = false,
    currentUsername,
    onSendMessage,
}) => {
    const [draft, setDraft] = useState('');

    const sortedMessages = useMemo(
        () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        [messages]
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const content = draft.trim();
        if (!content || !chatEnabled || isSending) return;
        await onSendMessage(content);
        setDraft('');
    };

    return (
        <aside className="bg-white rounded-2xl shadow-2xl w-full min-h-[720px] max-h-[80vh] flex flex-col border border-blue-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                        <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800">Trò chuyện trong phòng chờ</h3>
                        <p className="text-sm text-slate-500">
                            {chatEnabled ? 'Học sinh có thể nhắn tin trong lúc chờ.' : 'Giáo viên đã tắt trò chuyện trong phòng chờ.'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/60">
                {isLoading ? (
                    <div className="h-full min-h-[240px] flex items-center justify-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Đang tải tin nhắn...
                    </div>
                ) : sortedMessages.length === 0 ? (
                    <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center text-slate-500 px-6">
                        <MessageCircle className="w-10 h-10 text-blue-300 mb-3" />
                        <p className="font-semibold">Chưa có tin nhắn nào trong phòng chờ.</p>
                        <p className="text-sm mt-1">Hãy gửi một lời nhắn ngắn để bắt đầu.</p>
                    </div>
                ) : (
                    sortedMessages.map((message) => {
                        const isMine = currentUsername && message.senderName === currentUsername;
                        const isAnnouncement = message.kind === 'announcement';
                        const isSystem = message.senderRole === 'system';

                        if (isSystem) {
                            return (
                                <NewlineMathText
                                    key={message.id}
                                    content={message.content}
                                    as="div"
                                    className="py-1 text-center text-xs font-semibold text-slate-500"
                                />
                            );
                        }

                        return (
                            <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                                    isAnnouncement
                                        ? 'bg-amber-50 border border-amber-200 text-amber-900'
                                        : isMine
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white border border-slate-200 text-slate-800'
                                }`}>
                                    <div className={`text-[11px] font-black mb-1 ${isMine ? 'text-blue-100' : 'text-slate-500'}`}>
                                        {isAnnouncement ? `Thông báo - ${message.senderName}` : message.senderName}
                                    </div>
                                    <NewlineMathText
                                        content={message.content}
                                        as="div"
                                        className="break-words text-sm leading-relaxed"
                                    />
                                    <div className={`text-[10px] mt-2 ${isMine ? 'text-blue-100/80' : 'text-slate-400'}`}>
                                        {new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="border-t border-slate-100 bg-white px-4 py-4">
                {!chatEnabled && (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm font-semibold px-3 py-2 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" /> Giáo viên đã tạm tắt trò chuyện trong phòng chờ.
                    </div>
                )}
                <form onSubmit={handleSubmit} className="flex items-end gap-3">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value.slice(0, 160))}
                        placeholder={chatEnabled ? 'Nhắn tin với cả phòng...' : 'Trò chuyện đang tạm khóa'}
                        disabled={!chatEnabled || isSending}
                        rows={3}
                        className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    />
                    <button
                        type="submit"
                        disabled={!chatEnabled || isSending || !draft.trim()}
                        className="h-12 px-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Gửi
                    </button>
                </form>
            </div>
        </aside>
    );
};

export default WaitingRoomChatPanel;