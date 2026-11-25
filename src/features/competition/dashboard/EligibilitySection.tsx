import type { Dispatch, SetStateAction } from "react";
import type {
  CompetitionCampaignView,
  CompetitionEligibilityView,
  CompetitionProgressItemView,
  CompetitionSchoolExamAdmissionsView,
} from "../competitionDashboardService";
import { competitionDashboardService } from "../competitionDashboardService";

export interface EligibilitySectionProps {
  isAdmin: boolean;
  selectedCampaignId: string;
  selectedCampaign: CompetitionCampaignView | null;
  eligibility: CompetitionEligibilityView | null;
  admissions: CompetitionSchoolExamAdmissionsView | null;
  progress: CompetitionProgressItemView[];
  qualifiedCount: number;
  loadingDetails: boolean;
  pendingAction: string | null;
  approveAdmissions: (studentIds?: string[]) => Promise<void>;
  finalizeEligibility: () => Promise<void>;
}

export function EligibilitySection({
  isAdmin,
  selectedCampaignId,
  selectedCampaign,
  eligibility,
  admissions,
  progress,
  qualifiedCount,
  loadingDetails,
  pendingAction,
  approveAdmissions,
  finalizeEligibility,
}: EligibilitySectionProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Điều kiện dự thi</h2>
      <p className="mt-2 text-sm text-slate-600">
        {eligibility
          ? `${qualifiedCount} / ${eligibility.items.length} học sinh đạt`
          : "Chưa có snapshot điều kiện dự thi."}
      </p>
      {eligibility && (
        <p className="mt-1 text-xs text-slate-500">
          Snapshot version {eligibility.version}
        </p>
      )}
      {isAdmin && admissions && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900">
                Duyệt vào vòng cấp trường
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                {admissions.approvedCount} / {admissions.items.length} học sinh
                đã duyệt
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={competitionDashboardService.schoolExamAdmissionsExportUrl(
                  selectedCampaignId,
                  admissions.version,
                )}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
              >
                Xuất Excel đủ điều kiện
              </a>
              <button
                type="button"
                onClick={() => void approveAdmissions()}
                disabled={
                  pendingAction !== null ||
                  admissions.approvedCount === admissions.items.length
                }
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Duyệt tất cả đủ điều kiện
              </button>
            </div>
          </div>
          {admissions.items.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Chưa có học sinh đủ điều kiện.
            </p>
          ) : (
            <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2">Học sinh</th>
                    <th className="px-3 py-2">Lớp</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {admissions.items.map((item) => (
                    <tr
                      key={item.studentId}
                      className="border-t border-slate-100"
                    >
                      <td className="px-3 py-2">
                        <strong>{item.fullName}</strong>
                        <div className="text-slate-500">
                          {item.username} · {item.studentId}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        Khối {item.gradeLevel} ·{" "}
                        {item.className || item.classId}
                      </td>
                      <td className="px-3 py-2">
                        {item.approved
                          ? `Đã duyệt${item.approvedBy ? ` bởi ${item.approvedBy}` : ""}`
                          : "Chờ duyệt"}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            void approveAdmissions([item.studentId])
                          }
                          disabled={item.approved || pendingAction !== null}
                          className="rounded-md border px-2 py-1 font-semibold disabled:opacity-50"
                        >
                          Duyệt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {!isAdmin && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-bold text-slate-900">Tiến độ lớp</h3>
          {progress.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Chưa có lượt thi được ghi nhận.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {progress.map((item) => (
                <div
                  key={`${item.roundId}-${item.studentId}`}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700"
                >
                  <div className="font-semibold text-slate-900">
                    {item.studentId} · Vòng {item.roundNumber}
                  </div>
                  <div className="mt-1">
                    {item.attemptsUsed} lượt · Điểm tốt nhất{" "}
                    {item.bestScore ?? "—"} ·{" "}
                    {item.isPassed ? "Đã đạt" : "Chưa đạt"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {isAdmin && (
        <button
          type="button"
          onClick={() => void finalizeEligibility()}
          disabled={
            !selectedCampaign || loadingDetails || pendingAction !== null
          }
          className="mt-4 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Chốt điều kiện dự thi
        </button>
      )}
    </article>
  );
}
