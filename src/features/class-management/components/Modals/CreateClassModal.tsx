import React, { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { Button } from '../../../../components/common';

interface CreateClassModalProps {
    onClose: () => void;
    onCreate: (name: string) => Promise<any>;
    isLoading: boolean;
}

export const CreateClassModal: React.FC<CreateClassModalProps> = ({ onClose, onCreate, isLoading }) => {
    const [name, setName] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        await onCreate(name.trim());
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md" onClick={onClose}>
            <div className="bg-white w-full h-dvh md:h-auto md:max-h-[90vh] md:max-w-md rounded-none md:rounded-2xl shadow-xl p-5 md:p-6 md:mx-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Tạo lớp mới</h2>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên lớp</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="VD: Lớp Toán 5A"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            autoFocus
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button onClick={onClose} variant="secondary" className="flex-1">Hủy</Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1"
                            disabled={!name.trim() || isLoading}
                            icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        >
                            {isLoading ? 'Đang tạo...' : 'Tạo lớp'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
