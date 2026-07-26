import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export interface ProgressData {
  timeLabel: string;
  score: number;
}

interface StudentProgressChartProps {
  data: ProgressData[];
  title?: string;
}

export const StudentProgressChart: React.FC<StudentProgressChartProps> = ({ 
  data, 
  title = "Biểu đồ tiến độ" 
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl">
        <p className="text-slate-400 font-medium tracking-wide">Chưa đủ dữ liệu để tạo biểu đồ.</p>
      </div>
    );
  }

  // Linear Gradient for Area Chart
  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-indigo-100/50 w-full h-full flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <h3 className="text-lg font-black text-slate-800 tracking-tight">{title}</h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Điểm trung bình hệ số 10</span>
        </div>
      </div>
      
      <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="timeLabel" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                padding: '12px 16px',
                fontWeight: 'bold',
              }}
              itemStyle={{ color: '#4f46e5', fontSize: '16px', fontWeight: 900 }}
              labelStyle={{ color: '#64748b', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px' }}
            />
            <Area 
              type="monotone" 
              dataKey="score" 
              name="Điểm số"
              stroke="#6366f1" 
              strokeWidth={4}
              fillOpacity={1} 
              fill="url(#colorScore)" 
              activeDot={{ r: 6, strokeWidth: 2, fill: "#fff", stroke: "#6366f1" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
