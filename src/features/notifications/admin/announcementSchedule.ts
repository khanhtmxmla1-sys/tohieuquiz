import {
  systemDateTimeLocalToIso,
  toSystemDateTimeLocal,
} from '../../../utils/dateTime';

export interface AnnouncementLocalSchedule {
  startsAt: string;
  endsAt: string;
}

export function announcementScheduleToApi(schedule: AnnouncementLocalSchedule): {
  startsAt: string | null;
  endsAt: string | null;
} {
  return {
    startsAt: schedule.startsAt ? systemDateTimeLocalToIso(schedule.startsAt) : null,
    endsAt: schedule.endsAt ? systemDateTimeLocalToIso(schedule.endsAt) : null,
  };
}

export function addHoursToAnnouncementLocal(value: string, hours: number): string {
  if (!value) return '';
  const date = new Date(systemDateTimeLocalToIso(value));
  date.setUTCHours(date.getUTCHours() + hours);
  return toSystemDateTimeLocal(date);
}
