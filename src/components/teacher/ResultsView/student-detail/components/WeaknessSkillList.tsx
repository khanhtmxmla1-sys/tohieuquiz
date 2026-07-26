import React from 'react';
import type { SkillBreakdownItem } from '../../../../../shared/skillTaxonomy';
import { getSkillStatusLabel } from '../models/weaknessModel';

export const WeaknessSkillList: React.FC<{ skills: SkillBreakdownItem[] }> = ({ skills }) => {
    if (skills.length === 0) {
        return (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                Chưa thấy kỹ năng nào rơi vào nhóm cần ưu tiên từ 5 bài gần nhất. Đây là dấu hiệu tốt, nhưng anh vẫn có thể kết hợp thêm bảng câu sai để nhìn sâu hơn.
            </div>
        );
    }

    return (
        <>
            {skills.map((skill) => (
                <div key={`${skill.subject}-${skill.skillCode}`} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-black text-slate-800">{skill.skillLabel}</p>
                            <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{skill.subjectLabel}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                            skill.status === 'weak'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                        }`}>
                            {getSkillStatusLabel(skill.status)}
                        </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500">
                        <span>Độ chính xác</span>
                        <span className="font-black text-slate-800">{skill.accuracy}%</span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-slate-200/80 bg-white">
                        <div
                            className={`h-full rounded-full ${
                                skill.status === 'weak'
                                    ? 'bg-gradient-to-r from-red-400 to-rose-500'
                                    : 'bg-gradient-to-r from-amber-400 to-orange-500'
                            }`}
                            style={{ width: `${Math.max(skill.accuracy, 6)}%` }}
                        />
                    </div>
                    <p className="mt-3 text-[11px] font-medium text-slate-500">
                        Đã làm {skill.attempted} câu, sai {skill.wrong} câu ở nhóm kỹ năng này.
                    </p>
                </div>
            ))}
        </>
    );
};
