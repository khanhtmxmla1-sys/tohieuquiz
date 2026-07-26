export type ResultScoreRange = '0-2' | '3-4' | '5-6' | '7-8' | '9-10';

export interface ResultScoreBucket {
    range: ResultScoreRange;
    count: number;
    percentage: number;
}

export interface ResultSummaryStatistics {
    totalResults: number;
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    passRate: number;
    passCount: number;
    failCount: number;
    scoreDistribution: ResultScoreBucket[];
}

export interface ResultDashboardSummary {
    totalSubmissions: number;
    uniqueCompletedWorks: number;
    todaySubmissions: number;
    uniqueStudents: number;
    statistics: ResultSummaryStatistics;
    attemptPolicy: 'latest';
    timezone: 'Asia/Ho_Chi_Minh';
}

export interface ResultDashboardSummaryResponse {
    data: ResultDashboardSummary;
}
