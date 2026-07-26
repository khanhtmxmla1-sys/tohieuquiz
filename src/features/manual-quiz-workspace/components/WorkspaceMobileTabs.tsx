import React from 'react';
import { Eye, List, PencilLine } from 'lucide-react';

export type WorkspaceMobilePane = 'list' | 'editor' | 'preview';

interface WorkspaceMobileTabsProps {
    activePane: WorkspaceMobilePane;
    onChange: (pane: WorkspaceMobilePane) => void;
}

const TABS: Array<{
    id: WorkspaceMobilePane;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}> = [
    { id: 'list', label: 'Danh sách', icon: List },
    { id: 'editor', label: 'Soạn', icon: PencilLine },
    { id: 'preview', label: 'Xem trước', icon: Eye },
];

const WorkspaceMobileTabs: React.FC<WorkspaceMobileTabsProps> = ({ activePane, onChange }) => (
    <nav
        aria-label="Chuyển vùng soạn đề trên di động"
        className="z-30 grid grid-cols-3 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
        {TABS.map(({ id, label, icon: Icon }) => (
            <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activePane === id}
                aria-controls={`workspace-pane-${id}`}
                onClick={() => onChange(id)}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-2 text-xs font-semibold ${
                    activePane === id ? 'bg-sky-50 text-sky-700' : 'text-slate-500'
                }`}
            >
                <Icon className="h-4 w-4" />
                {label}
            </button>
        ))}
    </nav>
);

export default WorkspaceMobileTabs;
