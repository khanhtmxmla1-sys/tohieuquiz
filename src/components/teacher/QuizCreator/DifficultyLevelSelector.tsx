/**
 * Difficulty Level Selector Component
 * 
 * Input fields for setting question difficulty distribution.
 */

import React from 'react';

interface DifficultyLevels {
    level1: number;
    level2: number;
    level3: number;
}

interface DifficultyLevelSelectorProps {
    levels: DifficultyLevels;
    onChange: (levels: DifficultyLevels) => void;
}

export const DifficultyLevelSelector: React.FC<DifficultyLevelSelectorProps> = ({
    levels,
    onChange,
}) => {
    const total = levels.level1 + levels.level2 + levels.level3;

    const handleChange = (field: keyof DifficultyLevels, value: number) => {
        onChange({
            ...levels,
            [field]: Math.max(0, Math.min(40, value)),
        });
    };

    return (
        <div className="bg-green-50 p-4 rounded-xl border border-green-200">
            <label className="block text-sm font-bold text-green-800 mb-3">
                Phân bổ câu hỏi theo mức độ:
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                        Mức 1: Nhận biết
                    </label>
                    <input
                        type="number"
                        min={0}
                        max={40}
                        value={levels.level1}
                        onChange={(e) => handleChange('level1', Number(e.target.value) || 0)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-center"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-center">Dễ, quen thuộc</p>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                        Mức 2: Thông hiểu
                    </label>
                    <input
                        type="number"
                        min={0}
                        max={40}
                        value={levels.level2}
                        onChange={(e) => handleChange('level2', Number(e.target.value) || 0)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-center"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-center">Trung bình</p>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                        Mức 3: Vận dụng cao
                    </label>
                    <input
                        type="number"
                        min={0}
                        max={40}
                        value={levels.level3}
                        onChange={(e) => handleChange('level3', Number(e.target.value) || 0)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-center"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-center">Khó, thực tiễn</p>
                </div>
            </div>
            <p className="text-sm text-green-700 font-bold mt-3 text-center">
                Tổng: {total} câu
            </p>
        </div>
    );
};

export default DifficultyLevelSelector;
