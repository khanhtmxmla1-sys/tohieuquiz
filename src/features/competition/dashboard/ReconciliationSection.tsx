import type { Dispatch, SetStateAction } from "react";
import type {
  SchoolExamEventView,
  SchoolExamIncidentView,
  SchoolExamReconcileView,
  SchoolExamRetestView,
} from "../competitionDashboardService";
import type { IncidentDraft } from "./dashboardTypes";

export interface ReconciliationSectionProps {
  isAdmin: boolean;
  selectedEvent: SchoolExamEventView | null;
  reconcile: SchoolExamReconcileView | null;
  incidents: SchoolExamIncidentView[];
  retests: SchoolExamRetestView[];
  incidentDraft: IncidentDraft;
  retestResolution: Record<
    string,
    "KEEP_ORIGINAL" | "REPLACE_WITH_RETEST" | "INVALIDATE_RESULT"
  >;
  pendingAction: string | null;
  setIncidentDraft: Dispatch<SetStateAction<IncidentDraft>>;
  setRetestResolution: Dispatch<
    SetStateAction<
      Record<
        string,
        "KEEP_ORIGINAL" | "REPLACE_WITH_RETEST" | "INVALIDATE_RESULT"
      >
    >
  >;
  grantRetest: (retest: SchoolExamRetestView) => Promise<void>;
  reportIncident: () => Promise<void>;
  startReconcile: () => Promise<void>;
}

export function ReconciliationSection({
  isAdmin,
  selectedEvent,
  reconcile,
  incidents,
  retests,
  incidentDraft,
  retestResolution,
  pendingAction,
  setIncidentDraft,
  setRetestResolution,
  grantRetest,
  reportIncident,
  startReconcile,
}: ReconciliationSectionProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Đối soát</h2>
      <p className="mt-2 text-sm text-slate-600">
        Blocker, warning, incident và retest được tách riêng; Live Exam đóng
        chưa có nghĩa là đã công bố.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-red-100 bg-red-50 p-3">
          <h3 className="font-bold text-red-900">
            Blockers (
            {reconcile?.issues.filter((issue) => issue.blocking).length || 0})
          </h3>
          {reconcile?.issues
            .filter((issue) => issue.blocking)
            .map((issue) => (
              <div key={issue.id} className="mt-1 text-xs text-red-800">
                {issue.issueType}
              </div>
            ))}
        </div>
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
          <h3 className="font-bold text-amber-900">
            Warnings (
            {reconcile?.issues.filter((issue) => !issue.blocking).length || 0})
          </h3>
          {reconcile?.issues
            .filter((issue) => !issue.blocking)
            .map((issue) => (
              <div key={issue.id} className="mt-1 text-xs text-amber-800">
                {issue.issueType}
              </div>
            ))}
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <h3 className="font-bold text-slate-900">
            Sự cố ({incidents.length})
          </h3>
          {incidents.map((incident) => (
            <div key={incident.id} className="mt-1 text-xs text-slate-600">
              {incident.reasonCode} · {incident.studentId || "—"}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <h3 className="font-bold text-slate-900">
            Thi lại ({retests.length})
          </h3>
          {retests.map((retest) => (
            <div key={retest.id} className="mt-2 text-xs text-slate-600">
              <div>
                {retest.studentId} · {retest.reasonCode || "—"} ·{" "}
                {retest.status}
              </div>
              {isAdmin && retest.status === "REQUESTED" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    aria-label={`Cách xử lý thi lại ${retest.studentId}`}
                    value={retestResolution[retest.id] || "REPLACE_WITH_RETEST"}
                    onChange={(event) =>
                      setRetestResolution((current) => ({
                        ...current,
                        [retest.id]: event.target.value as
                          | "KEEP_ORIGINAL"
                          | "REPLACE_WITH_RETEST"
                          | "INVALIDATE_RESULT",
                      }))
                    }
                    className="rounded border px-2 py-1"
                  >
                    <option value="KEEP_ORIGINAL">Giữ kết quả gốc</option>
                    <option value="REPLACE_WITH_RETEST">
                      Thay bằng thi lại
                    </option>
                    <option value="INVALIDATE_RESULT">Hủy kết quả</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void grantRetest(retest)}
                    disabled={pendingAction !== null}
                    className="rounded border px-2 py-1 font-semibold"
                  >
                    Cấp thi lại {retest.studentId}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {!isAdmin && selectedEvent && selectedEvent.rooms.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-bold text-slate-900">
            Báo cáo sự cố phòng được phân công
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold">
              Phòng sự cố
              <select
                aria-label="Phòng sự cố"
                value={incidentDraft.roomId}
                onChange={(event) =>
                  setIncidentDraft((current) => ({
                    ...current,
                    roomId: event.target.value,
                  }))
                }
                className="mt-1 block w-full rounded border px-2 py-1.5 font-normal"
              >
                <option value="">Chọn phòng</option>
                {selectedEvent.rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold">
              Học sinh sự cố
              <input
                aria-label="Học sinh sự cố"
                value={incidentDraft.studentId}
                onChange={(event) =>
                  setIncidentDraft((current) => ({
                    ...current,
                    studentId: event.target.value,
                  }))
                }
                className="mt-1 block w-full rounded border px-2 py-1.5 font-normal"
              />
            </label>
            <label className="text-xs font-semibold">
              Kết quả gốc
              <input
                aria-label="Kết quả gốc"
                value={incidentDraft.originalResultId}
                onChange={(event) =>
                  setIncidentDraft((current) => ({
                    ...current,
                    originalResultId: event.target.value,
                  }))
                }
                className="mt-1 block w-full rounded border px-2 py-1.5 font-normal"
              />
            </label>
            <label className="text-xs font-semibold">
              Lý do sự cố
              <select
                aria-label="Lý do sự cố"
                value={incidentDraft.reasonCode}
                onChange={(event) =>
                  setIncidentDraft((current) => ({
                    ...current,
                    reasonCode: event.target.value,
                  }))
                }
                className="mt-1 block w-full rounded border px-2 py-1.5 font-normal"
              >
                <option value="NETWORK_FAILURE">Mất mạng</option>
                <option value="DEVICE_FAILURE">Lỗi thiết bị</option>
                <option value="SERVER_INCIDENT">Lỗi máy chủ</option>
                <option value="EXAM_INTERRUPTED">Bài thi gián đoạn</option>
                <option value="ADMINISTRATIVE_ERROR">Lỗi hành chính</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => void reportIncident()}
            disabled={pendingAction !== null}
            className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Báo cáo sự cố
          </button>
        </div>
      )}
      {isAdmin && (
        <button
          type="button"
          onClick={() => void startReconcile()}
          disabled={!selectedEvent || pendingAction !== null}
          className="mt-4 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Bắt đầu đối soát
        </button>
      )}
    </article>
  );
}
