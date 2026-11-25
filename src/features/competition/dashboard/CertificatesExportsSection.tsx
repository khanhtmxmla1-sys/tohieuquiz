import type { Dispatch, SetStateAction } from "react";
import type {
  SchoolExamCertificateBatchView,
  SchoolExamExportView,
  SchoolExamEventView,
  SchoolExamRankingView,
} from "../competitionDashboardService";
import type { CertificateDraft } from "./dashboardTypes";

export interface CertificatesExportsSectionProps {
  isAdmin: boolean;
  teacherClassId: string | null;
  selectedEvent: SchoolExamEventView | null;
  rankings: SchoolExamRankingView | null;
  certificateDraft: CertificateDraft;
  certificateBatch: SchoolExamCertificateBatchView | null;
  exportJob: SchoolExamExportView | null;
  pendingAction: string | null;
  setCertificateDraft: Dispatch<SetStateAction<CertificateDraft>>;
  createCertificates: () => Promise<void>;
  createExport: () => Promise<void>;
  refreshExport: () => Promise<void>;
}

export function CertificatesExportsSection({
  isAdmin,
  teacherClassId,
  selectedEvent,
  rankings,
  certificateDraft,
  certificateBatch,
  exportJob,
  pendingAction,
  setCertificateDraft,
  createCertificates,
  createExport,
  refreshExport,
}: CertificatesExportsSectionProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
      <h2 className="text-lg font-bold text-slate-900">Chứng nhận & XLSX</h2>
      <p className="mt-2 text-sm text-slate-600">
        Downstream jobs chạy sau publication và không làm rollback kết quả đã
        công bố.
      </p>
      {isAdmin && selectedEvent?.status === "PUBLISHED" && rankings && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-bold text-slate-900">
            Chứng nhận theo ranking đã công bố
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold">
              Mẫu chứng nhận Competition
              <input
                aria-label="Mẫu chứng nhận Competition"
                value={certificateDraft.templateId}
                onChange={(event) =>
                  setCertificateDraft((current) => ({
                    ...current,
                    templateId: event.target.value,
                  }))
                }
                className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
              />
            </label>
            <label className="text-xs font-semibold">
              Học sinh nhận chứng nhận
              <input
                aria-label="Học sinh nhận chứng nhận"
                value={certificateDraft.winnerStudentIds}
                onChange={(event) =>
                  setCertificateDraft((current) => ({
                    ...current,
                    winnerStudentIds: event.target.value,
                  }))
                }
                placeholder="student-1, student-2"
                className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
              />
            </label>
            <label className="text-xs font-semibold sm:col-span-2">
              Tiêu đề chứng nhận Competition
              <input
                aria-label="Tiêu đề chứng nhận Competition"
                value={certificateDraft.title}
                onChange={(event) =>
                  setCertificateDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
              />
            </label>
            <label className="text-xs font-semibold">
              Lời nhắn
              <input
                aria-label="Lời nhắn chứng nhận Competition"
                value={certificateDraft.message}
                onChange={(event) =>
                  setCertificateDraft((current) => ({
                    ...current,
                    message: event.target.value,
                  }))
                }
                className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
              />
            </label>
            <label className="text-xs font-semibold">
              Tiền tố thành tích
              <input
                aria-label="Tiền tố thành tích Competition"
                value={certificateDraft.achievementPrefix}
                onChange={(event) =>
                  setCertificateDraft((current) => ({
                    ...current,
                    achievementPrefix: event.target.value,
                  }))
                }
                className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void createCertificates()}
            disabled={pendingAction !== null}
            className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Tạo chứng nhận người đạt giải
          </button>
          {certificateBatch && (
            <p className="mt-2 text-sm text-slate-600">
              Certificate batch {certificateBatch.id}: {certificateBatch.status}{" "}
              · {certificateBatch.winnerCount} người
            </p>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {isAdmin ? (
          <button
            type="button"
            onClick={() => void createExport()}
            disabled={
              selectedEvent?.status !== "PUBLISHED" || pendingAction !== null
            }
            className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Xuất XLSX toàn trường
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void createExport()}
            disabled={
              selectedEvent?.status !== "PUBLISHED" ||
              !teacherClassId ||
              pendingAction !== null
            }
            className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Xuất XLSX theo lớp
          </button>
        )}
        <a
          href="/teacher/certificates"
          className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700"
        >
          Mở cấp chứng nhận
        </a>
        {exportJob && (
          <button
            type="button"
            onClick={() => void refreshExport()}
            disabled={pendingAction !== null}
            className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Làm mới XLSX
          </button>
        )}
        {exportJob?.status === "READY" && selectedEvent && (
          <a
            href={`/api/school-exams/${encodeURIComponent(selectedEvent.id)}/exports/${encodeURIComponent(exportJob.id)}/download`}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"
          >
            Tải XLSX
          </a>
        )}
      </div>
      {exportJob && (
        <p className="mt-2 text-sm text-slate-600">
          Export {exportJob.id}: {exportJob.status}
          {exportJob.errorCode ? ` · ${exportJob.errorCode}` : ""}
        </p>
      )}
    </article>
  );
}
