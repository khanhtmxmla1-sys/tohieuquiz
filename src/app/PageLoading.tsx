import React from 'react';
import { Loader2 } from 'lucide-react';

export const PageLoading: React.FC = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
        <Loader2 className="w-10 h-10 text-[#6C5CE7] animate-spin" />
    </div>
);
