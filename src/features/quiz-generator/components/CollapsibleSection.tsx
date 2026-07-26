import React from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
    id: string;
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    badge?: string;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: (id: string) => void;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
    id, icon, title, subtitle, badge, children, isOpen, onToggle 
}) => {
    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:border-gray-300 shadow-sm">
            <button
                onClick={() => onToggle(id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center text-orange-600 shrink-0">
                        {icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800 text-sm">{title}</span>
                            {badge && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                                    {badge}
                                </span>
                            )}
                        </div>
                        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
                    </div>
                </div>
                <div className={`transition-transform duration-200 text-gray-400 ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-4 h-4" />
                </div>
            </button>
            {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100 animate-fade-in">
                    {children}
                </div>
            )}
        </div>
    );
};

export default CollapsibleSection;
