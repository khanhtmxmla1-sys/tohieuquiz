import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, ChevronRight, Loader2, Sparkles, Target } from 'lucide-react';
import { fetchWeaknessProfile } from '../../../services/weaknessProfileService';
import type { SkillBreakdownItem, WeaknessProfileResponse } from '../../../shared/skillTaxonomy';
import { buildStudentWeaknessFocus, type StudentWeaknessFocus } from './studentWeaknessFocus';

export type WeaknessSummaryCardProps = {
    resultId: string | number;
    scorePct: number;
    wrongQuestionIds: Array<string | number>;
    onOpenDrOwl: () => void;
    onOpenRecommendations: (focus?: StudentWeaknessFocus | null) => void;
};

function getStatusLabel(status: SkillBreakdownItem['status']): string {
    if (status === 'weak') return 'Can uu tien';
    if (status === 'needs_practice') return 'Can luyen them';
    return 'On dinh';
}

const WeaknessSummaryCard: React.FC<WeaknessSummaryCardProps> = ({
    resultId,
    scorePct,
    wrongQuestionIds,
    onOpenDrOwl,
    onOpenRecommendations,
}) => {
    const [profile, setProfile] = useState<WeaknessProfileResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadProfile = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetchWeaknessProfile(resultId);
                if (!cancelled) {
                    setProfile(response);
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    const normalizedError = err instanceof Error ? err : new Error(String(err));
                    setError(normalizedError.message || 'Chua tai duoc goi y luyen them.');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadProfile();

        return () => {
            cancelled = true;
        };
    }, [resultId]);

    const focusSkills = useMemo<SkillBreakdownItem[]>(() => {
        if (!profile) return [];

        const statusOrder: Record<SkillBreakdownItem['status'], number> = {
            weak: 0,
            needs_practice: 1,
            stable: 2,
        };

        return profile.subjects
            .flatMap((subject) => subject.skills)
            .filter((skill) => skill.status === 'weak' || skill.status === 'needs_practice')
            .sort((left, right) => {
                if (statusOrder[left.status] !== statusOrder[right.status]) {
                    return statusOrder[left.status] - statusOrder[right.status];
                }
                if (left.accuracy !== right.accuracy) {
                    return left.accuracy - right.accuracy;
                }
                return right.wrong - left.wrong;
            })
            .slice(0, 3);
    }, [profile]);

    const shouldOpenDrOwl = scorePct < 50 && wrongQuestionIds.length >= 2;
    const hasLowCoverage = Boolean(profile && (profile.coveragePercent < 70 || profile.unclassifiedQuestionCount > 0));

    const handlePrimaryAction = (skill: SkillBreakdownItem) => {
        if (shouldOpenDrOwl) {
            onOpenDrOwl();
            return;
        }
        onOpenRecommendations(buildStudentWeaknessFocus(skill));
    };

    if (isLoading) {
        return (
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="rounded-xl bg-indigo-100 p-2 text-indigo-600">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-slate-800">Con can luyen them</h4>
                        <p className="text-sm text-slate-500">He thong dang xem bai lam cua con...</p>
                    </div>
                </div>
                <div className="space-y-3">
                    {[0, 1].map((item) => (
                        <div key={item} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
                            <div className="mb-3 h-4 w-32 rounded bg-slate-200" />
                            <div className="mb-2 h-3 w-full rounded bg-slate-200" />
                            <div className="h-3 w-24 rounded bg-slate-200" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 w-5 h-5 text-red-500" />
                    <div className="flex-1">
                        <h4 className="text-base font-bold text-red-700">Con can luyen them</h4>
                        <p className="mt-1 text-sm text-red-600">{error}</p>
                        <button
                            type="button"
                            onClick={() => onOpenRecommendations(null)}
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                        >
                            <BookOpen className="w-4 h-4" />
                            Xem goi y hoc
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!focusSkills.length) {
        return (
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5">
                <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-emerald-100 p-2 text-emerald-600">
                        <Target className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-lg font-bold text-slate-800">Con can luyen them</h4>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                            Con dang lam kha tot roi! Neu muon, minh co the xem them goi y hoc de gioi hon nua.
                        </p>
                        <button
                            type="button"
                            onClick={() => onOpenRecommendations(null)}
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors"
                        >
                            <BookOpen className="w-4 h-4" />
                            Xem goi y hoc
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-indigo-100 p-2 text-indigo-600">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-slate-800">Con can luyen them</h4>
                        <p className="text-sm text-slate-500">Minh thay con nen uu tien on mấy phan nay truoc.</p>
                    </div>
                </div>
                {shouldOpenDrOwl && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-700">
                        <Loader2 className="w-3.5 h-3.5" />
                        Uu tien luyen ngay
                    </span>
                )}
            </div>

            {hasLowCoverage && profile && (
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
                    He thong dang hoc them tu bai lam cua con, nen goi y hien tai chi mang tinh dinh huong.
                </div>
            )}

            <div className="mt-4 space-y-3">
                {focusSkills.map((skill) => {
                    const focus = buildStudentWeaknessFocus(skill);

                    return (
                        <div key={`${skill.subject}-${skill.skillCode}`} className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-base font-bold text-slate-800">{focus.title}</p>
                                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{focus.shortHint}</p>
                                </div>
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                                    skill.status === 'weak'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {getStatusLabel(skill.status)}
                                </span>
                            </div>

                            <div className="mt-4 flex items-center justify-between text-xs font-medium text-slate-500">
                                <span>Do chinh xac</span>
                                <span className="font-black text-slate-800">{skill.accuracy}%</span>
                            </div>
                            <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-slate-200/80 bg-slate-100">
                                <div
                                    className={`h-full rounded-full ${
                                        skill.status === 'weak'
                                            ? 'bg-gradient-to-r from-red-400 to-rose-500'
                                            : 'bg-gradient-to-r from-amber-400 to-orange-500'
                                    }`}
                                    style={{ width: `${Math.max(skill.accuracy, 8)}%` }}
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => handlePrimaryAction(skill)}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                            >
                                {shouldOpenDrOwl ? 'Luyen ngay voi Cu Meo' : focus.actionLabel}
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WeaknessSummaryCard;
