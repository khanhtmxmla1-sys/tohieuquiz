import React, { useState } from 'react';
import { EyeOff, Loader2, Megaphone, MessageCircle } from 'lucide-react';
import type { WaitingRoomChatMessage } from '../../types/liveExam.types';
import NewlineMathText from '../common/NewlineMathText';

interface WaitingRoomChatTeacherCardProps {
    messages: WaitingRoomChatMessage[];
    chatEnabled: boolean;
    isLoading?: boolean;
    isSending?: boolean;
    onSendAnnouncement: (content: string) => Promise<void>;
    onToggleChat: (enabled: boolean) => Promise<void>;
    onHideMessage: (messageId: string) => Promise<void>;
}

export const WaitingRoomChatTeacherCard: React.FC<WaitingRoomChatTeacherCardProps> = ({
    messages,
    chatEnabled,
    isLoading = false,
    isSending = false,
    onSendAnnouncement,
    onToggleChat,
    onHideMessage,
}) => {
    const [announcement, setAnnouncement] = useState('');

    const recentMessages = [...messages].slice(-5).reverse();

    const handleAnnouncementSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const content = announcement.trim();
        if (!content || isSending) return;
        await onSendAnnouncement(content);
        setAnnouncement('');
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl p-5 border border-slate-100">
            <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                    <h3 className="text-lg font-black text-slate-800">Chat phong cho</h3>
                    <p className="text-sm text-slate-500">Gui thong bao, bat/tat chat va an tin nhan.</p>
                </div>
                <button
                    type="button"
                    onClick={() => void onToggleChat(!chatEnabled)}
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-black transition-colors ${chatEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-emerald-900'}`}
                >
                    {chatEnabled ? 'Dang bat' : 'Dang tat'}
                </button>
            </div>

            <form onSubmit={handleAnnouncementSubmit} className="space-y-3 mb-5">
                <textarea
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value.slice(0, 160))}
                    rows={3}
                    placeholder="Gui thong bao chung cho phong cho..."
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="submit"
                    disabled={isSending || !announcement.trim()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                    Gui thong bao
                </button>
            </form>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-3 text-slate-700 font-bold">
                    <MessageCircle className="w-4 h-4" /> Tin nhan gan day
                </div>
                {isLoading ? (
                    <div className="py-6 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Dang tai tin nhan...</div>
                ) : recentMessages.length === 0 ? (
                    <div className="py-6 text-center text-sm text-slate-500">Chua co tin nhan nao trong phong cho.</div>
                ) : (
                    <div className="space-y-3">
                        {recentMessages.map((message) => (
                            <div key={message.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-xs font-black text-slate-500 mb-1">{message.senderName}</div>
                                        <NewlineMathText
                                            content={message.content}
                                            as="div"
                                            className="break-words text-sm text-slate-800"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void onHideMessage(message.id)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                                    >
                                        <EyeOff className="w-3.5 h-3.5" /> An
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WaitingRoomChatTeacherCard;