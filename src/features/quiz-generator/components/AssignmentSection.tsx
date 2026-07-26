import React from 'react';
import { Calendar, Users, Hash } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';

interface AssignmentSectionProps {
    assignToClass: boolean;
    setAssignToClass: (v: boolean) => void;
    selectedClassId: string;
    setSelectedClassId: (v: string) => void;
    deadline: string;
    setDeadline: (v: string) => void;
    maxAttempts: number;
    setMaxAttempts: (v: number) => void;
    classes: any[];
    isOpen: boolean;
    onToggle: (id: string) => void;
}

const AssignmentSection: React.FC<AssignmentSectionProps> = ({
    assignToClass, setAssignToClass, selectedClassId, setSelectedClassId,
    deadline, setDeadline, maxAttempts, setMaxAttempts, classes,
    isOpen, onToggle
}) => {
    return (
        <CollapsibleSection
            id="assign"
            icon={<Calendar className="w-4 h-4" />}
            title="Giao bài ngay"
            subtitle="Tùy chọn giao bài cho lớp học"
            isOpen={isOpen}
            onToggle={onToggle}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-gray-700 text-sm">Giao ngay cho lớp</p>
                        <p className="text-xs text-gray-500">Học sinh thấy bài tập ngay sau khi lưu</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAssignToClass(!assignToClass)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${assignToClass ? 'bg-orange-500' : 'bg-gray-300'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${assignToClass ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {assignToClass && (
                    <div className="space-y-3 animate-fade-in">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Chọn lớp <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                    className="w-full pl-10 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/40"
                                >
                                    <option value="">-- Chọn lớp học --</option>
                                    {classes.map((cls) => (
                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Hạn nộp</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="date"
                                        value={deadline}
                                        onChange={(e) => setDeadline(e.target.value)}
                                        className="w-full pl-10 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/40"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Số lượt làm</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={maxAttempts}
                                        onChange={(e) => setMaxAttempts(parseInt(e.target.value))}
                                        className="w-full pl-10 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/40"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </CollapsibleSection>
    );
};

export default AssignmentSection;
