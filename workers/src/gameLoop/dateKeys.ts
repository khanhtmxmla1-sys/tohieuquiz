export const getBangkokDateKey = (date = new Date()): string =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);

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

export const getISOWeekNumber = (date: Date): number => {
    const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = value.getUTCDay() || 7;
    value.setUTCDate(value.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
    return Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const getCurrentWeekKey = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-W${String(getISOWeekNumber(now)).padStart(2, '0')}`;
};
