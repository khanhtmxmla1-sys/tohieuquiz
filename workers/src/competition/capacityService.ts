export interface CompetitionCapacityRoom {
  scheduledAt: string;
  durationMinutes: number;
  checkInLeadMinutes: number;
  closeDrainMinutes: number;
  assignedStudents: number;
}

export interface CertifiedLiveExamCapacityProfile {
  id: string;
  certifiedConcurrentStudents: number;
}

export interface CompetitionCapacityPreflightResult {
  status: 'READY' | 'PREFLIGHT_BLOCKED';
  reason: null | 'CAPACITY_UNVERIFIED' | 'CAPACITY_EXCEEDED';
  plannedConcurrency: number;
  certifiedConcurrentStudents: number | null;
  capacityProfileId: string | null;
}

const MINUTE_MS = 60_000;

function assertNonNegativeInteger(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('COMPETITION_CAPACITY_ROOM_INVALID');
  }
}

function loadWindow(room: CompetitionCapacityRoom): { start: number; end: number; students: number } {
  const scheduledAt = Date.parse(room.scheduledAt);
  if (!Number.isFinite(scheduledAt)) throw new Error('COMPETITION_CAPACITY_ROOM_INVALID');
  if (!Number.isInteger(room.durationMinutes) || room.durationMinutes <= 0) {
    throw new Error('COMPETITION_CAPACITY_ROOM_INVALID');
  }
  assertNonNegativeInteger(room.checkInLeadMinutes);
  assertNonNegativeInteger(room.closeDrainMinutes);
  assertNonNegativeInteger(room.assignedStudents);

  return {
    start: scheduledAt - (room.checkInLeadMinutes * MINUTE_MS),
    end: scheduledAt + ((room.durationMinutes + room.closeDrainMinutes) * MINUTE_MS),
    students: room.assignedStudents,
  };
}

export function calculatePeakConcurrency(rooms: CompetitionCapacityRoom[]): number {
  const events: Array<{ at: number; delta: number; kind: 'END' | 'START' }> = [];
  for (const room of rooms) {
    const window = loadWindow(room);
    if (window.students === 0) continue;
    events.push({ at: window.start, delta: window.students, kind: 'START' });
    events.push({ at: window.end, delta: -window.students, kind: 'END' });
  }

  events.sort((left, right) => (
    left.at - right.at
    || (left.kind === right.kind ? 0 : left.kind === 'END' ? -1 : 1)
  ));

  let current = 0;
  let peak = 0;
  for (const event of events) {
    current += event.delta;
    peak = Math.max(peak, current);
  }
  return peak;
}

export function evaluateCapacityPreflight(
  rooms: CompetitionCapacityRoom[],
  profile: CertifiedLiveExamCapacityProfile | null,
): CompetitionCapacityPreflightResult {
  const plannedConcurrency = calculatePeakConcurrency(rooms);
  if (!profile) {
    return {
      status: 'PREFLIGHT_BLOCKED',
      reason: 'CAPACITY_UNVERIFIED',
      plannedConcurrency,
      certifiedConcurrentStudents: null,
      capacityProfileId: null,
    };
  }

  if (!Number.isInteger(profile.certifiedConcurrentStudents) || profile.certifiedConcurrentStudents <= 0) {
    throw new Error('COMPETITION_CAPACITY_PROFILE_INVALID');
  }

  const base = {
    plannedConcurrency,
    certifiedConcurrentStudents: profile.certifiedConcurrentStudents,
    capacityProfileId: profile.id,
  };
  if (plannedConcurrency > profile.certifiedConcurrentStudents) {
    return { status: 'PREFLIGHT_BLOCKED', reason: 'CAPACITY_EXCEEDED', ...base };
  }
  return { status: 'READY', reason: null, ...base };
}
