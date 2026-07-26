import React from 'react';
import { BarChart3 } from 'lucide-react';
import type { CompetencyData } from '../../../../../utils/competencyMapping';

export const CompetencyMetrics: React.FC<{ data: CompetencyData[] }> = ({ data }) => (
    <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-blue-900/5 border border-white">
        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" /> Chi tiết chỉ số
        </h4>
        <div className="space-y-3">
            {data.map((item, index) => (
                <div key={index} className="group cursor-default">
                    <div className="flex items-center justify-between mb-1.5 px-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">{item.subject}</span>
                        <span className="text-xs font-black text-slate-900">{item.score}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                item.score >= 80
                                    ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                                    : item.score >= 50
                                        ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                                        : 'bg-gradient-to-r from-orange-400 to-red-500'
                            }`}
                            style={{ width: `${item.score}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    </div>
);
