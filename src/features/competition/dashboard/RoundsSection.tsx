import type { Dispatch, SetStateAction } from "react";
import type {
  CompetitionCampaignView,
  CompetitionRoundView,
} from "../competitionDashboardService";
import type { RoundDraft, RoundQuizDraft } from "./dashboardTypes";
import { formatDateTime, ROUND_NUMBERS } from "./dashboardHelpers";

export interface RoundsSectionProps {
  isAdmin: boolean;
  rounds: CompetitionRoundView[];
  roundDrafts: Record<number, RoundDraft>;
  roundQuizDrafts: Record<number, RoundQuizDraft>;
  loadingDetails: boolean;
  pendingAction: string | null;
  selectedCampaign: CompetitionCampaignView | null;
  updateRoundDraft: (roundNumber: number, patch: Partial<RoundDraft>) => void;
  updateRoundQuizDraft: (
    roundNumber: number,
    patch: Partial<RoundQuizDraft>,
  ) => void;
  saveRound: (roundNumber: number) => Promise<void>;
  finalizeRound: (roundNumber: number) => Promise<void>;
  saveRoundQuiz: (roundNumber: number) => Promise<void>;
}

export function RoundsSection({
  isAdmin,
  rounds,
  roundDrafts,
  roundQuizDrafts,
  loadingDetails,
  pendingAction,
  selectedCampaign,
  updateRoundDraft,
  updateRoundQuizDraft,
  saveRound,
  finalizeRound,
  saveRoundQuiz,
}: RoundsSectionProps) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">6 vòng thi</h2>
      <p className="mt-2 text-sm text-slate-600">
        Thời gian, số lượt tối đa và điểm đạt lấy từ cấu hình
        server-authoritative.
      </p>
      <div className="mt-4 space-y-3">
        {loadingDetails && rounds.length === 0 && (
          <p className="text-sm text-slate-500">Đang tải vòng thi…</p>
        )}
        {ROUND_NUMBERS.map((roundNumber) => {
          const round = rounds.find((item) => item.roundNumber === roundNumber);
          const draft = roundDrafts[roundNumber];
          return (
            <div
              key={roundNumber}
              className="rounded-xl border border-slate-200 p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900">Vòng {roundNumber}</h3>
                <span className="text-xs font-semibold text-slate-500">
                  {round?.status || "CHƯA CẤU HÌNH"}
                </span>
              </div>
              {isAdmin ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="min-w-0 text-xs font-semibold text-slate-600">
                    Mở vòng {roundNumber}
                    <input
                      aria-label={`Mở vòng ${roundNumber}`}
                      type="datetime-local"
                      value={draft?.opensAt || ""}
                      onChange={(event) =>
                        updateRoundDraft(roundNumber, {
                          opensAt: event.target.value,
                        })
                      }
                      className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900"
                    />
                  </label>
                  <label className="min-w-0 text-xs font-semibold text-slate-600">
                    Đóng vòng {roundNumber}
                    <input
                      aria-label={`Đóng vòng ${roundNumber}`}
                      type="datetime-local"
                      value={draft?.closesAt || ""}
                      onChange={(event) =>
                        updateRoundDraft(roundNumber, {
                          closesAt: event.target.value,
                        })
                      }
                      className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900"
                    />
                  </label>
                  <label className="min-w-0 text-xs font-semibold text-slate-600">
                    Số lượt tối đa vòng {roundNumber}
                    <input
                      aria-label={`Số lượt tối đa vòng ${roundNumber}`}
                      type="number"
                      min="1"
                      value={draft?.maxAttempts || "1"}
                      onChange={(event) =>
                        updateRoundDraft(roundNumber, {
                          maxAttempts: event.target.value,
                        })
                      }
                      className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900"
                    />
                  </label>
                  <label className="min-w-0 text-xs font-semibold text-slate-600">
                    Điểm đạt vòng {roundNumber}
                    <input
                      aria-label={`Điểm đạt vòng ${roundNumber}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={draft?.passingScore || "0"}
                      onChange={(event) =>
                        updateRoundDraft(roundNumber, {
                          passingScore: event.target.value,
                        })
                      }
                      className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900"
                    />
                  </label>
                  <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                      Quiz snapshot:{" "}
                      {round?.quizSnapshot?.status ||
                        (round ? "MISSING" : "chưa khóa")}{" "}
                      {round?.quizSnapshot
                        ? `(${round.quizSnapshot.mappingCount})`
                        : ""}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveRound(roundNumber)}
                        disabled={
                          !selectedCampaign ||
                          pendingAction !== null ||
                          round?.status === "FINALIZED"
                        }
                        className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                      >
                        Lưu vòng {roundNumber}
                      </button>
                      {round?.status === "CLOSED" && (
                        <button
                          type="button"
                          onClick={() => void finalizeRound(roundNumber)}
                          disabled={pendingAction !== null}
                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50"
                        >
                          Chốt vòng {roundNumber}
                        </button>
                      )}
                    </div>
                  </div>
                  {round && (
                    <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <label className="text-xs font-semibold text-slate-600">
                          Khối quiz vòng {roundNumber}
                          <input
                            aria-label={`Khối quiz vòng ${roundNumber}`}
                            type="number"
                            min="1"
                            max="12"
                            value={
                              roundQuizDrafts[roundNumber]?.gradeLevel || "1"
                            }
                            onChange={(event) =>
                              updateRoundQuizDraft(roundNumber, {
                                gradeLevel: event.target.value,
                              })
                            }
                            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 font-normal"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          Lớp ghi đè vòng {roundNumber}
                          <input
                            aria-label={`Lớp ghi đè vòng ${roundNumber}`}
                            value={roundQuizDrafts[roundNumber]?.classId || ""}
                            onChange={(event) =>
                              updateRoundQuizDraft(roundNumber, {
                                classId: event.target.value,
                              })
                            }
                            placeholder="Để trống = mặc định khối"
                            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 font-normal"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          Quiz ID vòng {roundNumber}
                          <input
                            aria-label={`Quiz ID vòng ${roundNumber}`}
                            value={roundQuizDrafts[roundNumber]?.quizId || ""}
                            onChange={(event) =>
                              updateRoundQuizDraft(roundNumber, {
                                quizId: event.target.value,
                              })
                            }
                            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 font-normal"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => void saveRoundQuiz(roundNumber)}
                        disabled={
                          pendingAction !== null || round.status === "FINALIZED"
                        }
                        className="mt-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                      >
                        Gán quiz vòng {roundNumber}
                      </button>
                    </div>
                  )}
                  {round?.quizMappings && round.quizMappings.length > 0 && (
                    <div className="sm:col-span-2 space-y-1 text-xs text-slate-600">
                      {round.quizMappings.map((mapping) => (
                        <div
                          key={
                            mapping.id ||
                            `${mapping.gradeLevel}-${mapping.classId || "default"}`
                          }
                        >
                          Khối {mapping.gradeLevel} ·{" "}
                          {mapping.classId || "mặc định"} · {mapping.quizId}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 grid gap-1 text-slate-600 sm:grid-cols-2">
                  <span>Mở: {formatDateTime(round?.opensAt)}</span>
                  <span>Đóng: {formatDateTime(round?.closesAt)}</span>
                  <span>Tối đa: {round?.maxAttempts ?? "—"} lượt</span>
                  <span>Điểm đạt: {round?.passingScore ?? "—"}</span>
                  {round?.quizMappings?.map((mapping) => (
                    <span
                      key={
                        mapping.id ||
                        `${mapping.gradeLevel}-${mapping.classId || "default"}`
                      }
                      className="sm:col-span-2"
                    >
                      Khối {mapping.gradeLevel} ·{" "}
                      {mapping.classId || "mặc định"} · {mapping.quizId}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}
