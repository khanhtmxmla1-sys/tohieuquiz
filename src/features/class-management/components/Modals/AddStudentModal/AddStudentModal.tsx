import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CreateStudentPayload } from '../../../types';
import { ManualTab } from './ManualTab';
import { ExcelTab } from './ExcelTab';
import type { BatchStudentResult } from '../../../../../services/classroomService';

interface AddStudentModalProps {
    classId: string;
    onClose: () => void;
    onAdd: (payload: CreateStudentPayload) => Promise<void>;
    onAddBatch: (payloads: CreateStudentPayload[]) => Promise<BatchStudentResult | null>;
    isLoading: boolean;
    error: string | null;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({ classId, onClose, onAdd, onAddBatch, isLoading, error }) => {
    const [activeTab, setActiveTab] = useState<'manual' | 'excel'>('manual');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md" onClick={onClose}>
            <div
                className="bg-white w-full h-dvh md:h-auto md:max-h-[90vh] md:max-w-lg rounded-none md:rounded-2xl shadow-xl p-5 md:p-6 md:mx-4 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Thêm học sinh</h2>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                    <button
                        type="button"
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'manual' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('manual')}
                    >
                        Nhập thủ công
                    </button>
                    <button
                        type="button"
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'excel' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('excel')}
                    >
                        Nhập từ Excel
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm mb-4">
                        {error}
                    </div>
                )}

                {activeTab === 'manual' ? (
                    <ManualTab classId={classId} onClose={onClose} onSubmit={onAdd} isLoading={isLoading} />
                ) : (
                    <ExcelTab classId={classId} onClose={onClose} onSubmit={onAddBatch} isLoading={isLoading} />
                )}
            </div>
        </div>
    );
};
