import type { Dispatch, SetStateAction } from "react";
import type {
  SchoolExamEventView,
  SchoolExamRankingView,
  SchoolExamResultCorrectionView,
} from "../competitionDashboardService";
import type { CorrectionDraft } from "./dashboardTypes";

export interface PublicationSectionProps {
  isAdmin: boolean;
  selectedEvent: SchoolExamEventView | null;
  rankings: SchoolExamRankingView | null;
  resultCorrections: SchoolExamResultCorrectionView[];
  correctionDraft: CorrectionDraft;
  pendingAction: string | null;
  setCorrectionDraft: Dispatch<SetStateAction<CorrectionDraft>>;
  publishResults: () => Promise<void>;
  createResultCorrection: () => Promise<void>;
  republishCorrectedResults: () => Promise<void>;
}

export function PublicationSection({
  isAdmin,
  selectedEvent,
  rankings,
  resultCorrections,
  correctionDraft,
  pendingAction,
  setCorrectionDraft,
  publishResults,
  createResultCorrection,
  republishCorrectedResults,
}: PublicationSectionProps) {
  const pendingCorrections = resultCorrections.filter(
    (item) => item.status === "PENDING",
  ).length;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Công bố & xếp hạng</h2>
      <p className="mt-2 text-sm text-slate-600">
        Chỉ kết quả canonical đã publish mới được dùng cho xếp hạng chính thức.
      </p>
      {selectedEvent && (
        <p className="mt-2 text-sm font-semibold text-slate-700">
          Event: {selectedEvent.status}
        </p>
      )}
      {isAdmin && selectedEvent?.status === "READY_TO_PUBLISH" && (
        <button
          type="button"
          onClick={() => void publishResults()}
          disabled={pendingAction !== null}
          className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
        >
          Công bố kết quả
        </button>
      )}
      {rankings && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold text-slate-500">
            Publication v{rankings.publicationVersion} · Ranking v
            {rankings.rankingVersion} · {rankings.scope}
          </div>
          {rankings.items.map((item) => (
            <div
              key={item.studentId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm"
            >
              <span>
                <strong>{item.studentId}</strong> · {item.score} điểm
              </span>
              <span className="font-bold text-blue-700">Hạng {item.rank}</span>
            </div>
          ))}
        </div>
      )}
      {isAdmin && selectedEvent?.status === "PUBLISHED" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-bold text-amber-950">
            Điều chỉnh kết quả đã công bố
          </h3>
          <p className="mt-1 text-xs text-amber-800">
            Bản công bố hiện tại không thay đổi cho đến khi tạo phiên bản mới.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold">
              Học sinh cần điều chỉnh
              <input
                aria-label="Học sinh cần điều chỉnh"
                value={correctionDraft.studentId}
                onChange={(event) =>
                  setCorrectionDraft((current) => ({
                    ...current,
                    studentId: event.target.value,
                  }))
                }
                className="mt-1 block w-full rounded border px-2 py-1.5 font-normal"
              />
            </label>
            <label className="text-xs font-semibold">
              Điểm điều chỉnh
              <input
                aria-label="Điểm điều chỉnh"
                type="number"
                min="0"
                max="100"
                value={correctionDraft.score}
                onChange={(event) =>
                  setCorrectionDraft((current) => ({
                    ...current,
                    score: event.target.value,
                  }))
                }
                className="mt-1 block w-full rounded border px-2 py-1.5 font-normal"
              />
            </label>
            <label className="text-xs font-semibold">
              Số câu đúng điều chỉnh
              <input
                aria-label="Số câu đúng điều chỉnh"
                type="number"
                min="0"
                value={correctionDraft.correctCount}
                onChange={(event) =>
                  setCorrectionDraft((current) => ({
                    ...current,
                    correctCount: event.target.value,
                  }))
                }
                className="mt-1 block w-full rounded border px-2 py-1.5 font-normal"
              />
            </label>
            <label className="text-xs font-semibold">
              Thời gian điều chỉnh
              <input
                aria-label="Thời gian điều chỉnh"
                type="number"
                min="0"
                value={correctionDraft.timeTaken}
                onChange={(event) =>
                  setCorrectionDraft((current) => ({
                    ...current,
                    timeTaken: event.target.value,
                  }))
                }
                className="mt-1 block w-full rounded border px-2 py-1.5 font-normal"
              />
            </label>
            <label className="text-xs font-semibold sm:col-span-2">
              Lý do điều chỉnh
              <textarea
                aria-label="Lý do điều chỉnh"
                value={correctionDraft.reason}
                onChange={(event) =>
                  setCorrectionDraft((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                className="mt-1 block w-full rounded border px-2 py-1.5 font-normal"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void createResultCorrection()}
              disabled={pendingAction !== null}
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Ghi nhận điều chỉnh
            </button>
            {pendingCorrections > 0 && (
              <button
                type="button"
                onClick={() => void republishCorrectedResults()}
                disabled={pendingAction !== null}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
              >
                Công bố phiên bản điều chỉnh
              </button>
            )}
          </div>
          <p className="mt-2 text-xs font-semibold text-amber-900">
            {pendingCorrections} điều chỉnh đang chờ công bố
          </p>
        </div>
      )}
    </article>
  );
}
