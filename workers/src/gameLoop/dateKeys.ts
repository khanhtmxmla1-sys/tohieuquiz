import {
    getSystemDateKey as getHanoiDateKey,
    getSystemWeekKey as getHanoiWeekKey,
    getSystemWeekUtcRange,
} from '../utils/systemTime';

const DAY_MS = 86_400_000;

export const getCurrentDateKey = (date = new Date()): string => getHanoiDateKey(date);

const parseDateKeyToUtc = (dateKey: string): Date => {
    const [year, month, day] = String(dateKey || '').split('-').map((value) => Number(value || 0));
    return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
};

const formatUtcDateKey = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getPreviousDateKey = (dateKey: string): string => {
    const date = parseDateKeyToUtc(dateKey);
    date.setUTCDate(date.getUTCDate() - 1);
    return formatUtcDateKey(date);
};

export const getCurrentWeekKey = (date = new Date()): string => getHanoiWeekKey(date);

export const getPreviousWeekKey = (date = new Date()): string =>
    getHanoiWeekKey(new Date(date.getTime() - 7 * DAY_MS));

export const getWeekUtcRange = (weekKey: string): {
    startIso: string;
    endIsoExclusive: string;
} => {
    const { startIso, endIsoExclusive } = getSystemWeekUtcRange(weekKey);
    return { startIso, endIsoExclusive };
};
