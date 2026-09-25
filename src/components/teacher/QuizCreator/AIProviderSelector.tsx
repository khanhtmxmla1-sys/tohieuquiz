/**
 * Select the AI source used for quiz generation.
 * Personal sources use server-stored encrypted credentials.
 */

import React from 'react';
import { Bot } from 'lucide-react';
import type { AIProvider } from '../../../services/geminiService';

const AI_PROVIDERS: Array<{
    id: AIProvider;
    name: string;
    description: string;
    adminOnly: boolean;
}> = [
    {
        id: 'llm-mux',
        name: 'AI TôHiệuQuiz',
        description: 'Kết nối qua nguồn AI của TôHiệuQuiz; không cần API key cá nhân.',
        adminOnly: false,
    },
    {
        id: 'gemini-personal',
        name: 'Gemini cá nhân',
        description: 'Dùng API key Gemini của bạn đã lưu mã hóa trên server TôHiệuQuiz.',
        adminOnly: false,
    },
    {
        id: 'deepseek-personal',
        name: 'DeepSeek cá nhân',
        description: 'Dùng API key DeepSeek của bạn đã lưu mã hóa trên server TôHiệuQuiz.',
        adminOnly: false,
    },
];

interface AIProviderSelectorProps {
    value: AIProvider;
    onChange: (provider: AIProvider) => void;
    isAdmin?: boolean;
    disabled?: boolean;
}

export const AIProviderSelector: React.FC<AIProviderSelectorProps> = ({
    value,
    onChange,
    isAdmin = false,
    disabled = false,
}) => {
    const availableProviders = React.useMemo(
        () => AI_PROVIDERS.filter((provider) => !provider.adminOnly || isAdmin),
        [isAdmin],
    );

    React.useEffect(() => {
        if (!availableProviders.find((provider) => provider.id === value)) {
            onChange(availableProviders[0]?.id || 'llm-mux');
        }
    }, [availableProviders, onChange, value]);

    return (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
            <label className="mb-3 flex items-center text-sm font-bold text-orange-800">
                <Bot className="mr-2 h-4 w-4" />
                Nguồn AI:
            </label>
            <div className="flex flex-wrap gap-2">
                {availableProviders.map((provider) => (
                    <button
                        key={provider.id}
                        type="button"
                        onClick={() => onChange(provider.id)}
                        disabled={disabled}
                        aria-pressed={value === provider.id}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                            value === provider.id
                                ? 'bg-orange-600 text-white shadow-md'
                                : 'border border-gray-200 bg-white text-gray-700 hover:border-orange-300'
                        }`}
                    >
                        {provider.name}
                    </button>
                ))}
            </div>
            <p className="mt-2 text-xs text-gray-600">
                {availableProviders.find((provider) => provider.id === value)?.description}
            </p>
            {disabled && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                    Không thể đổi nguồn AI khi một thao tác AI đang chạy.
                </p>
            )}
        </div>
    );
};

export default AIProviderSelector;
