import {
    addSystemCalendarDays,
    formatSystemDate,
    getSystemDateKey,
    systemDateKeyToLabelDate,
} from '../../../utils/dateTime';
/**
 * Date Range Filter Component
 * 
 * Filter results by date range with presets
 */

import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export interface DateRange {
    startDate: Date | null;
    endDate: Date | null;
    label: string;
}

interface DateRangeFilterProps {
    value: DateRange;
    onChange: (range: DateRange) => void;
}

const PRESETS = [
    { label: 'Tất cả', days: null },
    { label: '7 ngày qua', days: 7 },
    { label: '30 ngày qua', days: 30 },
    { label: 'Tháng này', days: 'month' as const },
    { label: 'Tùy chọn', days: 'custom' as const },
];

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
    value,
    onChange,
}) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [showCustom, setShowCustom] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const handlePresetClick = (preset: typeof PRESETS[0]) => {
        if (preset.days === null) {
            onChange({ startDate: null, endDate: null, label: preset.label });
            setShowDropdown(false);
        } else if (preset.days === 'custom') {
            setShowCustom(true);
        } else if (preset.days === 'month') {
            const todayKey = getSystemDateKey();
            const startOfMonthKey = `${todayKey.slice(0, 7)}-01`;
            onChange({
                startDate: systemDateKeyToLabelDate(startOfMonthKey),
                endDate: systemDateKeyToLabelDate(todayKey),
                label: preset.label,
            });
            setShowDropdown(false);
        } else {
            const todayKey = getSystemDateKey();
            const startDateKey = addSystemCalendarDays(todayKey, -preset.days);
            onChange({
                startDate: systemDateKeyToLabelDate(startDateKey),
                endDate: systemDateKeyToLabelDate(todayKey),
                label: preset.label,
            });
            setShowDropdown(false);
        }
    };

    const handleCustomApply = () => {
        const startDate = customStart ? systemDateKeyToLabelDate(customStart) : null;
        const endDate = customEnd ? systemDateKeyToLabelDate(customEnd) : null;
        const label = startDate && endDate
            ? `${formatSystemDate(startDate)} - ${formatSystemDate(endDate)}`
            : 'Tùy chọn';
        onChange({ startDate, endDate, label });
        setShowCustom(false);
        setShowDropdown(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700">{value.label}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl border shadow-lg z-50">
                    {!showCustom ? (
                        <div className="p-2">
                            {PRESETS.map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => handlePresetClick(preset)}
                                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${value.label === preset.label
                                            ? 'bg-orange-100 text-orange-700'
                                            : 'hover:bg-gray-100 text-gray-700'
                                        }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 space-y-4">
                            <h4 className="font-medium text-gray-800">Chọn khoảng thời gian</h4>
                            <div className="space-y-2">
                                <label className="block text-sm text-gray-600">Từ ngày</label>
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm text-gray-600">Đến ngày</label>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowCustom(false)}
                                    className="flex-1 px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleCustomApply}
                                    className="flex-1 px-4 py-2 text-sm text-white bg-orange-600 rounded-lg hover:bg-orange-700"
                                >
                                    Áp dụng
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Backdrop */}
            {showDropdown && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => { setShowDropdown(false); setShowCustom(false); }}
                />
            )}
        </div>
    );
};

export default DateRangeFilter;
