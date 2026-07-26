import { getWorkersApiBaseUrl } from '../../../services/api/config';

export interface TrendData {
  assignment_id?: string;
  quiz_id?: string;
  avg_score: number;
  total_submissions?: number;
  total_attempts?: number;
}

export interface ScoreDistribution {
  score: number;
  count: number;
}

export interface ClassAnalyticsResponse {
  homeworkTrend: TrendData[];
  quizTrend: TrendData[];
  scoreDistribution: ScoreDistribution[];
  classId: string;
}

export const analyticsService = {
  /**
   * Fetch aggregated analytics data for a specific class
   */
  async getClassAnalytics(classId: string): Promise<ClassAnalyticsResponse> {
    try {
      const response = await fetch(`${getWorkersApiBaseUrl()}/api/analytics/class/${encodeURIComponent(classId)}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.status === 'success') {
        return result.data as ClassAnalyticsResponse;
      }
      throw new Error(result.message || 'Failed to fetch analytics');
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu thống kê lớp:', error);
      throw error;
    }
  }
};
