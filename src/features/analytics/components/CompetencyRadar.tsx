import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { CompetencyData } from '../../../utils/competencyMapping';

interface CompetencyRadarProps {
  data: CompetencyData[];
  studentName?: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 shadow-xl border border-slate-100 rounded-xl">
        <p className="text-sm font-bold text-slate-800">{data.subject}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <p className="text-xs text-slate-600">Điểm: <span className="font-bold text-blue-600">{data.score}/100</span></p>
        </div>
        <p className="text-[10px] text-slate-400 mt-1 italic">Số câu hỏi: {data.count}</p>
      </div>
    );
  }
  return null;
};

export const CompetencyRadar: React.FC<CompetencyRadarProps> = ({ data, studentName }) => {
  // Kiểm tra nếu không có dữ liệu thực (toàn bộ total = 0)
  const hasData = data.some(d => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        <p className="text-slate-400 text-sm text-center">
            Chưa đủ dữ liệu để phân tích năng lực chi tiết. <br/>
            (Học sinh cần làm nhiều loại câu hỏi hơn)
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-[300px] md:h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            tick={false} 
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Radar
            name={studentName || 'Học sinh'}
            dataKey="score"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="#3b82f6"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
