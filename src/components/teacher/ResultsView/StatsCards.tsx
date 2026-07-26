/**
 * Stats Cards Component
 * 
 * Displays statistics summary for quiz results.
 */

import React from 'react';
import { Users, Award, TrendingUp, CheckCircle } from 'lucide-react';

export interface StatsData {
    total: number;
    average: number;
    highest: number;
    lowest: number;
    passCount: number;
    passRate: number;
}

export interface StatsCardsProps {
    stats: StatsData;
}

const StatCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: string;
    bgColor: string;
}> = ({ icon, label, value, color, bgColor }) => (
    <div className={`${bgColor} rounded-xl p-4 border border-gray-100`}>
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${color}`}>
                {icon}
            </div>
            <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
            </div>
        </div>
    </div>
);

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
                icon={<Users className="w-5 h-5 text-blue-600" />}
                label="Tổng số bài"
                value={stats.total}
                color="bg-blue-100"
                bgColor="bg-blue-50"
            />
            <StatCard
                icon={<TrendingUp className="w-5 h-5 text-green-600" />}
                label="Điểm TB"
                value={stats.average}
                color="bg-green-100"
                bgColor="bg-green-50"
            />
            <StatCard
                icon={<Award className="w-5 h-5 text-yellow-600" />}
                label="Điểm cao nhất"
                value={stats.highest}
                color="bg-yellow-100"
                bgColor="bg-yellow-50"
            />
            <StatCard
                icon={<CheckCircle className="w-5 h-5 text-purple-600" />}
                label="Tỷ lệ đạt"
                value={`${stats.passRate}%`}
                color="bg-purple-100"
                bgColor="bg-purple-50"
            />
        </div>
    );
};

export default StatsCards;
