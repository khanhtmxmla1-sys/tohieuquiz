import { EmptyState, ModuleIcon } from '../../common';

export const ResultsEmptyState = () => (
  <EmptyState
    icon={<ModuleIcon name="analytics-report" size="lg" />}
    title="Chưa có kết quả"
    description="Chưa có học sinh nào làm bài hoặc không tìm thấy kết quả phù hợp với bộ lọc."
  />
);
