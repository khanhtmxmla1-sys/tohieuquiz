import React from 'react';
import { Settings, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import { AIProviderSelector } from '../../../components/teacher/QuizCreator';
import type { AIProvider } from '../../../services/geminiService';
import type { AiCredentialsController } from '../hooks/useAiCredentials';

interface AdvancedSettingsSectionProps {
    requireCode: boolean;
    setRequireCode: (v: boolean) => void;
    accessCode: string;
    setAccessCode: (v: string) => void;
    generateRandomCode: () => string;
    showOnHome: boolean;
    setShowOnHome: (v: boolean) => void;
    aiProvider: AIProvider;
    setAiProvider: (v: AIProvider) => void;
    isAdmin: boolean;
    aiCredentials: AiCredentialsController;
    onOpenAiSettings: () => void;
    isGenerating: boolean;
    isOpen: boolean;
    onToggle: (id: string) => void;
}

const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
    requireCode, setRequireCode, accessCode, setAccessCode, generateRandomCode,
    showOnHome, setShowOnHome, aiProvider, setAiProvider, isAdmin,
    aiCredentials, onOpenAiSettings, isGenerating, isOpen, onToggle
}) => {
    const selectedPersonalProvider = aiProvider === 'gemini-personal'
        ? 'gemini'
        : aiProvider === 'deepseek-personal'
            ? 'deepseek'
            : null;
    const selectedPersonalLabel = selectedPersonalProvider === 'gemini' ? 'Gemini' : 'DeepSeek';
    const selectedSummary = selectedPersonalProvider
        ? aiCredentials.summaries[selectedPersonalProvider]
        : null;

    return (
        <CollapsibleSection
            id="advanced"
            icon={<Settings className="w-4 h-4" />}
            title="Tùy chọn nâng cao"
            subtitle="Mã làm bài, hiển thị, AI provider"
            isOpen={isOpen}
            onToggle={onToggle}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {requireCode ? <Lock className="w-4 h-4 text-green-600" /> : <Unlock className="w-4 h-4 text-gray-400" />}
                        <div>
                            <p className="font-medium text-gray-700 text-sm">Yêu cầu mã để làm bài</p>
                            <p className="text-xs text-gray-500">Học sinh phải nhập mã mới được làm bài</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setRequireCode(!requireCode);
                            if (!requireCode && !accessCode) generateRandomCode();
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${requireCode ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${requireCode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {requireCode && (
                    <div className="flex items-center gap-3 pl-6 animate-fade-in">
                        <input
                            type="text"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                            placeholder="VD: TOAN3A"
                            className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 font-mono text-sm"
                            maxLength={10}
                        />
                        <button
                            type="button"
                            onClick={generateRandomCode}
                            className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium text-sm"
                        >
                            🎲 Tạo mã
                        </button>
                    </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                        {showOnHome ? <Eye className="w-4 h-4 text-blue-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                        <div>
                            <p className="font-medium text-gray-700 text-sm">Hiển thị trên trang chủ</p>
                            <p className="text-xs text-gray-500">Tắt nếu muốn chống lộ đề</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowOnHome(!showOnHome)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showOnHome ? 'bg-blue-500' : 'bg-gray-300'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showOnHome ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                <div className="pt-2 border-t border-gray-100">
                    <AIProviderSelector
                        value={aiProvider}
                        onChange={setAiProvider}
                        isAdmin={isAdmin}
                        disabled={isGenerating}
                    />
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 text-sm">
                                {!selectedPersonalProvider ? (
                                    <p className="font-medium text-slate-700">
                                        Nguồn hệ thống không cần API key cá nhân.
                                    </p>
                                ) : aiCredentials.loading ? (
                                    <p className="font-medium text-slate-600">Đang kiểm tra API key {selectedPersonalLabel}...</p>
                                ) : !aiCredentials.enabled ? (
                                    <p className="font-medium text-amber-800">
                                        Nguồn AI cá nhân chưa được bật cho tài khoản này.
                                    </p>
                                ) : selectedSummary?.configured ? (
                                    <p className="font-medium text-emerald-700">
                                        Đã lưu API key {selectedPersonalLabel} ••••{selectedSummary.last4}
                                    </p>
                                ) : (
                                    <p className="font-medium text-amber-800">
                                        Bạn chưa lưu API key {selectedPersonalLabel}. Tạo đề sẽ bị chặn cho đến khi cấu hình xong.
                                    </p>
                                )}
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    Thêm, thay, kiểm tra hoặc xóa key trong Cài đặt AI của tài khoản.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onOpenAiSettings}
                                className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            >
                                Mở cài đặt AI
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </CollapsibleSection>
    );
};

export default AdvancedSettingsSection;
