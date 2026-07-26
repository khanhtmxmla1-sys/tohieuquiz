/**
 * AI Provider Selector Component
 * 
 * Select which AI provider to use for quiz generation.
 * Perplexity is only shown for admin users.
 */

import React from 'react';
import { AIProvider } from '../../../services/geminiService';
import { Bot } from 'lucide-react';

const AI_PROVIDERS = [
    { id: 'localhost', name: 'Localhost', description: 'AIcliproxy trên máy (Không timeout)', adminOnly: false },
    { id: 'llm-mux', name: 'AI Client Pro', description: 'Multi-Model qua ai.thtohieu.com', adminOnly: false },
];

interface AIProviderSelectorProps {
    value: AIProvider;
    onChange: (provider: AIProvider) => void;
    isAdmin?: boolean; // Only show Perplexity for admin
}

export const AIProviderSelector: React.FC<AIProviderSelectorProps> = ({
    value,
    onChange,
    isAdmin = false,
}) => {
    const isLocalBrowser = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // Filter providers based on admin status
    const availableProviders = AI_PROVIDERS.filter((p) => {
        if ((p.id === 'localhost') && !isLocalBrowser) return false;
        return !p.adminOnly || isAdmin;
    });

    // If current value is not available, switch to first available
    React.useEffect(() => {
        if (!availableProviders.find(p => p.id === value)) {
            const preferredProvider = availableProviders.find(p => p.id === 'llm-mux');
            onChange((preferredProvider?.id || availableProviders[0]?.id) as AIProvider || 'llm-mux');
        }
    }, [isAdmin, value, onChange, availableProviders]);

    return (
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
            <label className="block text-sm font-bold text-orange-800 mb-3 flex items-center">
                <Bot className="w-4 h-4 mr-2" />
                Chọn AI Provider:
            </label>
            <div className="flex flex-wrap gap-2">
                {availableProviders.map((provider) => (
                    <button
                        key={provider.id}
                        type="button"
                        onClick={() => onChange(provider.id as AIProvider)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${value === provider.id
                            ? 'bg-orange-600 text-white shadow-md'
                            : 'bg-white border border-gray-200 text-gray-700 hover:border-orange-300'
                            }`}
                    >
                        {provider.name}
                    </button>
                ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
                {availableProviders.find((p) => p.id === value)?.description}
            </p>
        </div>
    );
};

export default AIProviderSelector;
