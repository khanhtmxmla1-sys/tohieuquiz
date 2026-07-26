import React from 'react';
import { Settings, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import { AIProviderSelector } from '../../../components/teacher/QuizCreator';
import { AIProvider } from '../../../services/geminiService';

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
    isOpen: boolean;
    onToggle: (id: string) => void;
}

const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
    requireCode, setRequireCode, accessCode, setAccessCode, generateRandomCode,
    showOnHome, setShowOnHome, aiProvider, setAiProvider, isAdmin,
    isOpen, onToggle
}) => {
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
                    />
                </div>
            </div>
        </CollapsibleSection>
    );
};

export default AdvancedSettingsSection;
