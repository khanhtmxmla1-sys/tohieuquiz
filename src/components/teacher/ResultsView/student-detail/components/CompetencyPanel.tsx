import React from 'react';
import { Award, BrainCircuit } from 'lucide-react';
import { CompetencyRadar } from '../../../../../features/analytics/components/CompetencyRadar';
import type { CompetencyData } from '../../../../../utils/competencyMapping';

interface CompetencyPanelProps {
    data: CompetencyData[];
    studentName: string;
}

export const CompetencyPanel: React.FC<CompetencyPanelProps> = ({ data, studentName }) => (
    <div className="lg:col-span-3 bg-white p-6 md:p-8 rounded-[2rem] shadow-xl shadow-blue-900/5 border border-white">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                    <Award className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Trục Năng Lực Học Tập</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase">Ma trận kiến thức TôHiệuQuiz</p>
                </div>
            </div>
        </div>
        <CompetencyRadar data={data} studentName={studentName} />
        <div className="mt-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white h-fit shadow-lg shadow-blue-200">
                <BrainCircuit className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium text-slate-700 leading-relaxed italic">
                "Biểu đồ Radar thể hiện điểm mạnh và điểm cần cải thiện của <span className="font-bold text-blue-700">{studentName}</span> qua bài thi này."
            </p>
        </div>
    </div>
);
