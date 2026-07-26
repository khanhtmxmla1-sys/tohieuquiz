/**
 * Score Distribution Card Component
 * Shows histogram of student scores with statistics
 */

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Award, Target, AlertCircle } from 'lucide-react';

interface ScoreData {
  distribution: Array<{
    range: string;
    count: number;
  }>;
  average: number;
  median: number;
  min: number;
  max: number;
}

interface ScoreDistributionCardProps {
  scores: ScoreData;
}

// Color mapping for score ranges
const getBarColor = (range: string): string => {
  const colorMap: Record<string, string> = {
    '0-2': '#ef4444',   // red - very poor
    '2-4': '#f97316',   // orange - poor
    '4-6': '#eab308',   // yellow - average
    '6-8': '#3b82f6',   // blue - good
    '8-10': '#22c55e',  // green - excellent
  };
  return colorMap[range] || '#94a3b8';
};

// Custom tooltip for chart
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-slate-200">
        <p className="text-sm font-semibold text-slate-800">
          Điểm {payload[0].payload.range}
        </p>
        <p className="text-sm text-slate-600">
          {payload[0].value} học sinh
        </p>
      </div>
    );
  }
  return null;
};

export const ScoreDistributionCard: React.FC<ScoreDistributionCardProps> = ({ scores }) => {
  const { distribution, average, median, min, max } = scores;

  // Prepare chart data with colors
  const chartData = distribution.map(d => ({
    range: d.range,
    count: d.count,
    fill: getBarColor(d.range),
  }));

  // Calculate total students
  const totalStudents = distribution.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <TrendingUp size={20} />
        Phân Bố Điểm Số
      </h3>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {/* Average */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Target size={16} className="text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">Trung bình</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">
            {average.toFixed(1)}
          </p>
        </div>

        {/* Median */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-100 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Award size={16} className="text-blue-700" />
            <span className="text-xs font-semibold text-blue-800">Trung vị</span>
          </div>
          <p className="text-2xl font-bold text-blue-950">
            {median.toFixed(1)}
          </p>
        </div>

        {/* Min */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={16} className="text-red-600" />
            <span className="text-xs font-semibold text-red-700">Thấp nhất</span>
          </div>
          <p className="text-2xl font-bold text-red-900">
            {min.toFixed(1)}
          </p>
        </div>

        {/* Max */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Award size={16} className="text-green-600" />
            <span className="text-xs font-semibold text-green-700">Cao nhất</span>
          </div>
          <p className="text-2xl font-bold text-green-900">
            {max.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Chart */}
      {totalStudents > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="range" 
                tick={{ fontSize: 12, fill: '#64748b' }}
                label={{ value: 'Khoảng điểm', position: 'insideBottom', offset: -5, style: { fontSize: 12, fill: '#475569' } }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: '#64748b' }}
                label={{ value: 'Số học sinh', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#475569' } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center bg-slate-50 rounded-xl">
          <p className="text-slate-500 text-sm">Chưa có dữ liệu điểm số</p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 justify-center">
        {[
          { range: '0-2', label: 'Rất yếu', color: '#ef4444' },
          { range: '2-4', label: 'Yếu', color: '#f97316' },
          { range: '4-6', label: 'Trung bình', color: '#eab308' },
          { range: '6-8', label: 'Khá', color: '#3b82f6' },
          { range: '8-10', label: 'Giỏi', color: '#22c55e' },
        ].map(item => (
          <div key={item.range} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-slate-600">
              {item.range}: {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScoreDistributionCard;
