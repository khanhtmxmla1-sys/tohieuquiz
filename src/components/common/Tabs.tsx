/**
 * Common Tab Component
 * 
 * Reusable tab navigation.
 */

import React from 'react';

export interface TabItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

export interface TabsProps {
    tabs: TabItem[];
    activeTab: string;
    onChange: (tabId: string) => void;
    variant?: 'default' | 'pills';
}

export const Tabs: React.FC<TabsProps> = ({
    tabs,
    activeTab,
    onChange,
    variant = 'default',
}) => {
    if (variant === 'pills') {
        return (
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === tab.id
                                ? 'bg-white text-orange-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className="border-b border-gray-200">
            <nav className="flex gap-8">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={`flex items-center gap-2 py-4 px-1 font-medium border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default Tabs;
