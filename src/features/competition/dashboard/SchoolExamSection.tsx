import type { Dispatch, SetStateAction } from "react";
import type {
  CompetitionEligibilityView,
  SchoolExamEventView,
} from "../competitionDashboardService";
import type { ExamDraft, RoomDraft } from "./dashboardTypes";
import { formatDateTime } from "./dashboardHelpers";

export interface SchoolExamSectionProps {
  isAdmin: boolean;
  selectedEvent: SchoolExamEventView | null;
  eligibility: CompetitionEligibilityView | null;
  preflight: SchoolExamEventView["preflight"] | null;
  examDraft: ExamDraft;
  roomDraft: RoomDraft;
  pendingAction: string | null;
  setExamDraft: Dispatch<SetStateAction<ExamDraft>>;
  setRoomDraft: Dispatch<SetStateAction<RoomDraft>>;
  createSchoolExamEvent: () => Promise<void>;
  createSchoolExamRoom: () => Promise<void>;
  runPreflight: () => Promise<void>;
  provisionSchoolExam: () => Promise<void>;
}

export function SchoolExamSection({
  isAdmin,
  selectedEvent,
  eligibility,
  preflight,
  examDraft,
  roomDraft,
  pendingAction,
  setExamDraft,
  setRoomDraft,
  createSchoolExamEvent,
  createSchoolExamRoom,
  runPreflight,
  provisionSchoolExam,
}: SchoolExamSectionProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Thi cấp trường</h2>
      <p className="mt-2 text-sm text-slate-600">
        Ca thi, phòng, form, tải đỉnh dự kiến và capacity đã chứng nhận.
      </p>
      {selectedEvent ? (
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <strong>{selectedEvent.title}</strong> · {selectedEvent.status} ·{" "}
            {formatDateTime(selectedEvent.examDate)}
          </div>
          {preflight && (
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="font-semibold">Peak / Capacity: </span>
              <span>
                {preflight.plannedConcurrency ?? "—"} /{" "}
                {preflight.certifiedConcurrentStudents ?? "—"}
              </span>
              {preflight.reason && (
                <span className="ml-2 text-amber-700">{preflight.reason}</span>
              )}
            </div>
          )}
          <div className="space-y-2">
            {selectedEvent.rooms.map((room) => (
              <div
                key={room.id}
                className="rounded-lg border border-slate-200 p-3"
              >
                <strong>{room.name}</strong> · Form {room.formCode} ·{" "}
                {room.memberCount} học sinh · {room.provisionStatus}
              </div>
            ))}
          </div>
          {isAdmin &&
            ["DRAFT", "PREFLIGHT_BLOCKED"].includes(selectedEvent.status) && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-bold text-slate-900">
                  Thêm phòng / ca thi
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold">
                    Tên phòng/ca
                    <input
                      aria-label="Tên phòng/ca"
                      value={roomDraft.name}
                      onChange={(event) =>
                        setRoomDraft((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Mã phòng
                    <input
                      aria-label="Mã phòng"
                      value={roomDraft.roomCode}
                      onChange={(event) =>
                        setRoomDraft((current) => ({
                          ...current,
                          roomCode: event.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Lịch thi phòng
                    <input
                      aria-label="Lịch thi phòng"
                      type="datetime-local"
                      value={roomDraft.scheduledAt}
                      onChange={(event) =>
                        setRoomDraft((current) => ({
                          ...current,
                          scheduledAt: event.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Thời lượng (phút)
                    <input
                      aria-label="Thời lượng phòng"
                      type="number"
                      value={roomDraft.durationMinutes}
                      onChange={(event) =>
                        setRoomDraft((current) => ({
                          ...current,
                          durationMinutes: event.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Mã form
                    <input
                      aria-label="Mã form"
                      value={roomDraft.formCode}
                      onChange={(event) =>
                        setRoomDraft((current) => ({
                          ...current,
                          formCode: event.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Quiz ID
                    <input
                      aria-label="Quiz ID"
                      value={roomDraft.quizId}
                      onChange={(event) =>
                        setRoomDraft((current) => ({
                          ...current,
                          quizId: event.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Giám thị
                    <input
                      aria-label="Giám thị"
                      value={roomDraft.invigilatorIds}
                      onChange={(event) =>
                        setRoomDraft((current) => ({
                          ...current,
                          invigilatorIds: event.target.value,
                        }))
                      }
                      placeholder="teacher-a, teacher-b"
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Học sinh
                    <input
                      aria-label="Học sinh"
                      value={roomDraft.studentIds}
                      onChange={(event) =>
                        setRoomDraft((current) => ({
                          ...current,
                          studentIds: event.target.value,
                        }))
                      }
                      placeholder="student-1, student-2"
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Blueprint ID
                    <input
                      aria-label="Blueprint ID"
                      value={roomDraft.blueprintId}
                      onChange={(event) =>
                        setRoomDraft((current) => ({
                          ...current,
                          blueprintId: event.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Tổng điểm
                    <input
                      aria-label="Tổng điểm"
                      type="number"
                      value={roomDraft.totalScore}
                      onChange={(event) =>
                        setRoomDraft((current) => ({
                          ...current,
                          totalScore: event.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Độ khó
                    <input
                      aria-label="Độ khó"
                      value={roomDraft.difficulty}
                      onChange={(event) =>
                        setRoomDraft((current) => ({
                          ...current,
                          difficulty: event.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Khối
                    <input
                      aria-label="Khối"
                      type="number"
                      value={roomDraft.gradeLevel}
                      onChange={(event) =>
                        setRoomDraft((current) => ({
                          ...current,
                          gradeLevel: event.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold sm:col-span-2">
                    Mục tiêu
                    <input
                      aria-label="Mục tiêu"
                      value={roomDraft.objectiveIds}
                      onChange={(event) =>
                        setRoomDraft((current) => ({
                          ...current,
                          objectiveIds: event.target.value,
                        }))
                      }
                      placeholder="obj-1, obj-2"
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                    />
                  </label>
                  {selectedEvent.examFormPolicy === "EQUIVALENT_FORM_SET" && (
                    <label className="sm:col-span-2 flex items-center gap-2 text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={roomDraft.equivalentFormApproved}
                        onChange={(event) =>
                          setRoomDraft((current) => ({
                            ...current,
                            equivalentFormApproved: event.target.checked,
                          }))
                        }
                      />
                      Đã duyệt form tương đương
                    </label>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void createSchoolExamRoom()}
                  disabled={pendingAction !== null}
                  className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Thêm phòng/ca thi
                </button>
              </div>
            )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-slate-500">Chưa có kỳ thi cấp trường.</p>
          {isAdmin && eligibility && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">
                Tên kỳ thi cấp trường
                <input
                  aria-label="Tên kỳ thi cấp trường"
                  value={examDraft.title}
                  onChange={(event) =>
                    setExamDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                />
              </label>
              <label className="text-xs font-semibold">
                Ngày thi cấp trường
                <input
                  aria-label="Ngày thi cấp trường"
                  type="datetime-local"
                  value={examDraft.examDate}
                  onChange={(event) =>
                    setExamDraft((current) => ({
                      ...current,
                      examDate: event.target.value,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                />
              </label>
              <label className="text-xs font-semibold">
                Chính sách form
                <select
                  aria-label="Chính sách form"
                  value={examDraft.examFormPolicy}
                  onChange={(event) =>
                    setExamDraft((current) => ({
                      ...current,
                      examFormPolicy: event.target
                        .value as ExamDraft["examFormPolicy"],
                    }))
                  }
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                >
                  <option value="SAME_FORM">Cùng form</option>
                  <option value="EQUIVALENT_FORM_SET">
                    Bộ form tương đương
                  </option>
                </select>
              </label>
              <label className="text-xs font-semibold">
                Capacity profile
                <input
                  aria-label="Capacity profile"
                  value={examDraft.capacityProfileId}
                  onChange={(event) =>
                    setExamDraft((current) => ({
                      ...current,
                      capacityProfileId: event.target.value,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                />
              </label>
              <button
                type="button"
                onClick={() => void createSchoolExamEvent()}
                disabled={
                  !examDraft.title ||
                  !examDraft.examDate ||
                  pendingAction !== null
                }
                className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 sm:col-span-2"
              >
                Tạo kỳ thi cấp trường
              </button>
            </div>
          )}
        </div>
      )}
      {isAdmin && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runPreflight()}
            disabled={
              !selectedEvent ||
              selectedEvent.rooms.length === 0 ||
              pendingAction !== null
            }
            className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Chạy preflight
          </button>
          <button
            type="button"
            onClick={() => void provisionSchoolExam()}
            disabled={
              !selectedEvent ||
              selectedEvent.status !== "READY" ||
              pendingAction !== null
            }
            className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Provision phòng thi
          </button>
        </div>
      )}
    </article>
  );
}
