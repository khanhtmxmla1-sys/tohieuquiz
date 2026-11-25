import type { CompetitionCampaignView } from "../competitionDashboardService";
import type { AudiencePreview } from "./dashboardTypes";

export interface AudienceFreezeDialogProps {
  selectedCampaign: CompetitionCampaignView;
  audiencePreview: AudiencePreview;
  pendingAction: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function AudienceFreezeDialog({
  selectedCampaign,
  audiencePreview,
  pendingAction,
  onClose,
  onConfirm,
}: AudienceFreezeDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audience-freeze-confirm-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2
          id="audience-freeze-confirm-title"
          className="text-lg font-bold text-slate-950"
        >
          {selectedCampaign.audienceSnapshotId
            ? "Xác nhận tạo lại AudienceSnapshot"
            : "Xác nhận đóng băng AudienceSnapshot"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Snapshot mới sẽ chứa{" "}
          <strong>{audiencePreview.matchedCount} học sinh</strong> theo bản xem
          trước vừa tải.
        </p>
        {selectedCampaign.audienceSnapshotId && (
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Snapshot hiện tại vẫn được giữ bất biến để kiểm toán; chiến dịch sẽ
            chuyển sang dùng snapshot mới.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pendingAction !== null}
            className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={pendingAction !== null}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Xác nhận tạo snapshot mới
          </button>
        </div>
      </div>
    </div>
  );
}
